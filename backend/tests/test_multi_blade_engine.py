import pytest
from app.database import SessionLocal
from app.models import User, RatesVersion, Quote, QuoteRevision, MultiBladeRuleTable, MultiBladeChecklist, VerifiedSize
from app.multi_blade_engine import (
    calculate_multi_blade_damper_cost,
    evaluate_blade_geometry,
    validate_multi_blade_rules,
    DEFAULT_MULTI_BLADE_RATES,
    DEFAULT_MAX_BLADE_LENGTH_TABLE,
    DEFAULT_SHAFT_DIAMETER_TABLE,
)
from app.costing_engine import safe_eval_formula, safe_eval_condition
from app.seed import seed_database
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    seed_database(db)
    yield db
    db.close()

def get_auth_token(email="admin@damperquote.com", password="DamperQuote2026!"):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]

# 1. AUTO Mode Geometry Tests
def test_blade_engine_auto_mode_derivation():
    # Given pitch = 150mm for H = 3000mm -> derives count = 20, pitch = 150, chord with 10% overlap = 165mm
    geom1 = evaluate_blade_geometry(
        height_mm=3000, width_mm=2000, blade_mode="AUTO",
        target_pitch_mm=150, target_blade_count=None,
        manual_blade_count=None, manual_chord_mm=None, overlap_pct=10.0
    )
    assert geom1["blade_count"] == 20
    assert geom1["blade_pitch_mm"] == 150.0
    assert geom1["blade_chord_mm"] == pytest.approx(165.0, abs=0.1)

    # Given count = 12 for H = 3000mm -> derives pitch = 250mm, chord with 10% overlap = 275mm
    geom2 = evaluate_blade_geometry(
        height_mm=3000, width_mm=2000, blade_mode="AUTO",
        target_pitch_mm=None, target_blade_count=12,
        manual_blade_count=None, manual_chord_mm=None, overlap_pct=10.0
    )
    assert geom2["blade_count"] == 12
    assert geom2["blade_pitch_mm"] == 250.0
    assert geom2["blade_chord_mm"] == pytest.approx(275.0, abs=0.1)

# 2. MANUAL Mode Geometry Tests
def test_blade_engine_manual_mode():
    geom = evaluate_blade_geometry(
        height_mm=2000, width_mm=1500, blade_mode="MANUAL",
        target_pitch_mm=None, target_blade_count=None,
        manual_blade_count=8, manual_chord_mm=280.0, overlap_pct=12.0
    )
    assert geom["blade_count"] == 8
    assert geom["blade_pitch_mm"] == 250.0
    assert geom["blade_chord_mm"] == 280.0
    assert geom["overlap_pct"] == pytest.approx(((280 - 250) / 250) * 100, abs=0.1)

# 3. Section Splitting Above Maximum Blade Length
def test_section_splitting_above_max_blade_length():
    # 1.6 mm sheet has max blade span 1200 mm. For W = 3000 mm, suggested sections must be ceil(3000/1200) = 3
    geom = evaluate_blade_geometry(
        height_mm=3000, width_mm=3000, blade_mode="AUTO",
        target_pitch_mm=150, target_blade_count=None,
        manual_blade_count=None, manual_chord_mm=None,
        blade_thickness_mm=1.6, sections=1
    )
    assert geom["suggested_sections"] == 3
    # When sections=1 is provided for W=3000, rule validation must produce an error blocking quoting
    errors, warnings = validate_multi_blade_rules(
        config={"width_mm": 3000, "height_mm": 3000, "blade_thickness_mm": 1.6, "sections": 1, "shaft_diameter_mm": 16.0},
        geometry=geom, total_weight_kg=500.0
    )
    assert any(e["rule"] == "max_blade_length_exceeded" for e in errors)

    # When sections=3 is provided, blade length is ~990mm <= 1200mm, error is cleared!
    geom_split = evaluate_blade_geometry(
        height_mm=3000, width_mm=3000, blade_mode="AUTO",
        target_pitch_mm=150, target_blade_count=None,
        manual_blade_count=None, manual_chord_mm=None,
        blade_thickness_mm=1.6, sections=3
    )
    errors_split, _ = validate_multi_blade_rules(
        config={"width_mm": 3000, "height_mm": 3000, "blade_thickness_mm": 1.6, "sections": 3, "shaft_diameter_mm": 16.0},
        geometry=geom_split, total_weight_kg=500.0
    )
    assert not any(e["rule"] == "max_blade_length_exceeded" for e in errors_split)

# 4. Rules Validation: Errors Block, Warnings Flag
def test_rules_validation_errors_block_and_warnings_flag():
    # Pitch > Chord -> Error
    geom_invalid_pitch = evaluate_blade_geometry(
        height_mm=1000, width_mm=1000, blade_mode="MANUAL",
        target_pitch_mm=None, target_blade_count=None,
        manual_blade_count=2, manual_chord_mm=400.0,  # pitch = 500 > chord = 400
        sections=1
    )
    errors, warnings = validate_multi_blade_rules(
        config={"width_mm": 1000, "height_mm": 1000, "sections": 1, "shaft_diameter_mm": 16.0},
        geometry=geom_invalid_pitch, total_weight_kg=100.0
    )
    assert any(e["rule"] == "pitch_exceeds_chord" for e in errors)

    # Rubber seal with temperature = 120 C -> Warning (flagged, not blocking)
    errors2, warnings2 = validate_multi_blade_rules(
        config={
            "width_mm": 1000, "height_mm": 1000, "sections": 1, "shaft_diameter_mm": 16.0,
            "edge_seal": "Rubber", "temperature_c": 120.0
        },
        geometry=evaluate_blade_geometry(1000, 1000, "AUTO", 150, None, None, None),
        total_weight_kg=100.0
    )
    assert any(w["rule"] == "rubber_seal_temperature_limit" for w in warnings2)

# 5. Weight & Cost Totals Equal Sum of Parts (Internal Consistency)
def test_weight_and_cost_totals_equal_sum_of_parts():
    rates = {
        "material_rates": {"IS 2062": 72.0, "EN8": 95.0},
        "labour_rates": {"IS 2062": 10.0, "EN8": 1.0},
        "fabrication_rate_per_kg": 96.0,
        "finishing_rate_per_kg": 20.0,
        "default_markup_pct": 10.0,
        "multi_blade_rates": DEFAULT_MULTI_BLADE_RATES,
    }
    config = {
        "width_mm": 2000.0, "height_mm": 2000.0, "depth_mm": 180.0,
        "sections": 2, "blade_thickness_mm": 1.6, "shaft_diameter_mm": 16.0,
        "material": "IS 2062", "shaft_material": "EN8",
        "blade_type": "Single Skin (Flat)", "blade_action": "Opposed",
        "actuator_type": "Electric Actuator",
    }
    result = calculate_multi_blade_damper_cost(config, rates, damper_quantity=1)

    lines = result["lines"]
    sum_weight = sum(l["weight"] for l in lines)
    sum_rm = sum(l["rm_cost"] for l in lines)
    sum_mfg = sum(l["mfg_cost_total"] for l in lines)

    assert result["total_weight_kg"] == pytest.approx(sum_weight, abs=0.05)
    assert result["raw_material_cost"] == pytest.approx(sum_rm, abs=0.05)
    assert result["mfg_cost"] == pytest.approx(sum_mfg, abs=0.05)

    expected_basic = result["raw_material_cost"] + result["mfg_cost"] + result["bought_out_cost"]
    assert result["basic_cost"] == pytest.approx(expected_basic, abs=0.05)

    expected_total = result["basic_cost"] + result["automation_cost"] + result["fabrication_cost"]
    assert result["total_cost"] == pytest.approx(expected_total, abs=0.05)

    expected_price = round(expected_total * 1.10, 2)
    assert result["quoted_price"] == pytest.approx(expected_price, abs=0.05)

# 6. Safe Expression Evaluator Rejects Unsafe Input
def test_safe_expression_evaluator_rejects_unsafe():
    vars = {"W": 2000.0, "H": 2000.0, "D": 180.0, "ratio": 1.0, "weight": 400.0}
    assert safe_eval_condition("W > 1500 and ratio == 1.0", vars) is True
    assert safe_eval_condition("weight > 500", vars) is False

    # Unsafe injections must raise ValueError
    for unsafe in [
        "__import__('os')",
        "eval('1+1')",
        "W.__class__",
        "open('file.txt')",
        "exec('print(1)')",
    ]:
        with pytest.raises(ValueError):
            safe_eval_condition(unsafe, vars)

# 7. Quote Creation, Rate Snapshot Immutability & Overrides
def test_quote_creation_and_rate_snapshot_immutability():
    token = get_auth_token("engineer@damperquote.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_payload = {
        "customer_name": "Tata Steel Kalinganagar",
        "customer_company": "Tata Steel Multi-Blade Co",
        "project_name": "Flue Gas Louver Isolator",
        "damper_type": "multi_blade",
        "width_mm": 2000,
        "height_mm": 2000,
        "depth_mm": 180,
        "quantity": 1,
        "markup_pct": 15.0,
        "multi_blade_config": {
            "width_mm": 2000,
            "height_mm": 2000,
            "depth_mm": 180,
            "sections": 2,
            "blade_thickness_mm": 1.6,
            "shaft_diameter_mm": 16.0,
            "blade_type": "Single Skin (Flat)",
            "blade_action": "Opposed",
            "actuator_type": "Electric Actuator",
        }
    }
    resp = client.post("/api/v1/quotes", json=create_payload, headers=headers)
    assert resp.status_code == 200, resp.text
    qid = resp.json()["quote_id"]

    detail = client.get(f"/api/v1/quotes/{qid}").json()
    assert detail["damper_type"] == "multi_blade"
    saved_price = detail["quoted_price"]

    # Verify snapshot retains data
    db = SessionLocal()
    try:
        rev = db.query(QuoteRevision).filter_by(quote_id=qid, revision_number=1).first()
        assert rev is not None
        assert rev.snapshot_data["damper_type"] == "multi_blade"
        assert rev.snapshot_data["totals"]["quoted_price"] == saved_price
    finally:
        db.close()

# 8. Manual BOM Edits Flagged
def test_multi_blade_manual_bom_edits_flagged():
    token = get_auth_token("engineer@damperquote.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_payload = {
        "customer_name": "BOM Edit Client",
        "customer_company": "BOM Edit Industries",
        "project_name": "Multi-Blade with Custom Bracket",
        "damper_type": "multi_blade",
        "width_mm": 2000,
        "height_mm": 2000,
        "depth_mm": 180,
        "quantity": 1,
        "multi_blade_config": {
            "width_mm": 2000, "height_mm": 2000, "depth_mm": 180,
            "sections": 2, "blade_thickness_mm": 1.6, "shaft_diameter_mm": 16.0,
        },
        "bom_additions": [
            {"part_name": "Custom Mullion Stiffener", "dim_1": 200, "dim_2": 80, "dim_3": 6, "qty": 4, "moc": "IS 2062", "material_rate": 72.0}
        ]
    }
    resp = client.post("/api/v1/quotes", json=create_payload, headers=headers)
    assert resp.status_code == 200, resp.text
    qid = resp.json()["quote_id"]

    detail = client.get(f"/api/v1/quotes/{qid}").json()
    assert detail["bom_has_edits"] is True
    assert any(line["part_name"] == "Custom Mullion Stiffener" for line in detail["lines"])

# 9. Role Permissions: Engineer cannot update multi-blade admin rule tables
def test_role_permissions_engineer_forbidden_on_admin():
    eng_token = get_auth_token("engineer@damperquote.com")
    headers = {"Authorization": f"Bearer {eng_token}"}

    resp = client.put("/api/v1/admin/multi-blade/rule-tables/max_blade_length", json={
        "rules_data": [{"thickness_mm": 1.6, "max_length_mm": 1500.0}]
    }, headers=headers)
    assert resp.status_code == 403
