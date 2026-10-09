import pytest
import math
from app.database import SessionLocal
from app.models import User, RatesVersion, Quote, MultiBladeRuleTable, PartsLibrary
from app.multi_blade_engine import (
    calculate_blade_geometry_and_construction,
    calculate_multi_blade_damper_cost,
    evaluate_blade_geometry,
    validate_multi_blade_rules,
    DEFAULT_MULTI_BLADE_RATES,
    DEFAULT_MATERIAL_DENSITIES,
    DEFAULT_MAX_BLADE_LENGTH_TABLE,
)
from app.costing_engine import calculate_damper_cost
from app.seed import seed_database, load_seed_json
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


# Test 1: Saving and reloading custom blade dimensions
def test_saving_and_reloading_custom_blade_dimensions(db_session):
    token = get_auth_token("engineer@damperquote.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "customer_name": "Test Customer Custom Blade",
        "customer_company": "Industrial Air Corp",
        "project_name": "Custom Blade Louver Project",
        "damper_type": "multi_blade",
        "width_mm": 1800,
        "height_mm": 1800,
        "depth_mm": 200,
        "quantity": 1,
        "markup_pct": 10.0,
        "multi_blade_config": {
            "blade_mode": "CUSTOM",
            "blade_type": "Folded single-skin blade",
            "blade_count": 10,
            "blade_chord_mm": 200.0,
            "blade_length_mm": 1780.0,
            "blade_thickness_mm": 3.0,  # Max span for 3.0mm is 2000mm
            "web_width_mm": 120.0,
            "flange_left_mm": 25.0,
            "flange_right_mm": 25.0,
            "edge_return_mm": 10.0,
            "fold_angle_deg": 60.0,
            "side_clearance_mm": 10.0,
            "sections": 1,
            "shaft_diameter_mm": 20.0,
        }
    }

    create_resp = client.post("/api/v1/quotes", json=payload, headers=headers)
    assert create_resp.status_code == 200, create_resp.text
    created_quote = create_resp.json()
    quote_id = created_quote.get("quote_id") or created_quote.get("id")

    # Reload quote from API
    get_resp = client.get(f"/api/v1/quotes/{quote_id}", headers=headers)
    assert get_resp.status_code == 200
    reloaded = get_resp.json()

    mb_cfg = reloaded.get("multi_blade_config", {})
    assert mb_cfg.get("blade_mode") == "CUSTOM"
    assert mb_cfg.get("blade_chord_mm") == 200.0
    assert mb_cfg.get("blade_length_mm") == 1780.0
    assert mb_cfg.get("blade_thickness_mm") == 3.0
    assert mb_cfg.get("blade_type") == "Folded single-skin blade"


# Test 2: CUSTOM and AUTO modes
def test_custom_and_auto_modes():
    # AUTO mode derives pitch, chord, count, length
    auto_geom = calculate_blade_geometry_and_construction(
        config={"blade_mode": "AUTO", "blade_type": "Flat single-skin sheet blade", "target_pitch_mm": 150.0, "sections": 1},
        frame_width=3000.0, frame_height=3000.0, frame_depth=200.0
    )
    assert auto_geom["mode"] == "AUTO"
    assert auto_geom["dimension_sources"]["blade_chord_mm"] == "calculated"
    assert auto_geom["dimension_sources"]["blade_length_mm"] == "calculated"
    assert auto_geom["blade_count"] == 20
    assert auto_geom["blade_pitch_mm"] == 150.0

    # CUSTOM mode preserves user inputs and flags sources as 'user'
    custom_geom = calculate_blade_geometry_and_construction(
        config={
            "blade_mode": "CUSTOM",
            "blade_type": "Flat single-skin sheet blade",
            "blade_count": 15,
            "blade_chord_mm": 230.0,
            "blade_length_mm": 2980.0,
            "blade_thickness_mm": 3.0,
            "sections": 1,
        },
        frame_width=3000.0, frame_height=3000.0, frame_depth=200.0
    )
    assert custom_geom["mode"] == "CUSTOM"
    assert custom_geom["dimension_sources"]["blade_count"] == "user"
    assert custom_geom["dimension_sources"]["blade_chord_mm"] == "user"
    assert custom_geom["dimension_sources"]["blade_length_mm"] == "user"
    assert custom_geom["blade_count"] == 15
    assert custom_geom["blade_chord_mm"] == 230.0
    assert custom_geom["blade_length_mm"] == 2980.0


# Test 3: Correct calculation of blade pitch and count
def test_blade_pitch_and_count_calculation():
    # For H = 2400 mm, target count = 12 -> pitch = 200 mm
    geom = calculate_blade_geometry_and_construction(
        config={"blade_mode": "AUTO", "target_blade_count": 12, "sections": 1},
        frame_width=1200.0, frame_height=2400.0, frame_depth=200.0
    )
    assert geom["blade_count"] == 12
    assert geom["blade_pitch_mm"] == 200.0
    # Overlap 10% -> chord = 200 * 1.1 = 220 mm
    assert geom["blade_chord_mm"] == pytest.approx(220.0, abs=0.1)


# Test 4: Frame clearance validation
def test_frame_clearance_validation():
    # Blade length exceeding opening width + side clearances triggers error
    geom = calculate_blade_geometry_and_construction(
        config={"blade_mode": "CUSTOM", "blade_length_mm": 1050.0, "side_clearance_mm": 10.0, "sections": 1},
        frame_width=1000.0, frame_height=1000.0, frame_depth=200.0
    )
    errors, _ = validate_multi_blade_rules(
        config={"width_mm": 1000.0, "height_mm": 1000.0, "blade_thickness_mm": 2.0, "shaft_diameter_mm": 16.0, "sections": 1},
        geometry=geom,
        total_weight_kg=100.0
    )
    assert any(e["rule"] == "blade_span_exceeds_frame" for e in errors)

    # Insufficient side clearance (< 2.0 mm) triggers error
    geom_clr = calculate_blade_geometry_and_construction(
        config={"blade_mode": "CUSTOM", "side_clearance_mm": 1.0, "end_clearance_mm": 1.0},
        frame_width=1000.0, frame_height=1000.0, frame_depth=200.0
    )
    errors_clr, _ = validate_multi_blade_rules(
        config={"width_mm": 1000.0, "height_mm": 1000.0, "blade_thickness_mm": 2.0, "shaft_diameter_mm": 16.0},
        geometry=geom_clr,
        total_weight_kg=100.0
    )
    assert any(e["rule"] == "insufficient_side_clearance" for e in errors_clr)
    assert any(e["rule"] == "insufficient_end_clearance" for e in errors_clr)


# Test 5: Flat, Folded, and Double-skin blade calculations
def test_flat_folded_and_double_skin_blade_calculations():
    # 1. Flat single-skin
    flat_res = calculate_blade_geometry_and_construction(
        config={"blade_mode": "CUSTOM", "blade_type": "Flat single-skin sheet blade", "blade_chord_mm": 150.0, "blade_length_mm": 1000.0, "blade_thickness_mm": 2.0},
        frame_width=1000.0, frame_height=1000.0, frame_depth=200.0
    )
    assert flat_res["profile_type"] == "Flat single-skin sheet blade"
    assert flat_res["developed_width_mm"] == 150.0

    # 2. Folded single-skin
    folded_res = calculate_blade_geometry_and_construction(
        config={
            "blade_mode": "CUSTOM",
            "blade_type": "Folded single-skin blade",
            "blade_chord_mm": 160.0,
            "blade_length_mm": 1000.0,
            "blade_thickness_mm": 2.0,
            "web_width_mm": 100.0,
            "flange_left_mm": 20.0,
            "flange_right_mm": 20.0,
            "edge_return_mm": 8.0,
            "num_bends": 4,
        },
        frame_width=1000.0, frame_height=1000.0, frame_depth=200.0
    )
    assert folded_res["profile_type"] == "Folded single-skin blade"
    # dev_width = 100 + 20 + 20 + 16 + (4 * 0.4 * 2) = 156 + 3.2 = 159.2 mm
    assert folded_res["developed_width_mm"] == pytest.approx(159.2, abs=0.5)

    # 3. Double-skin hollow blade
    double_res = calculate_blade_geometry_and_construction(
        config={
            "blade_mode": "CUSTOM",
            "blade_type": "Double-skin hollow blade",
            "blade_chord_mm": 150.0,
            "blade_length_mm": 1000.0,
            "front_skin_thick_mm": 1.6,
            "rear_skin_thick_mm": 1.6,
            "overall_blade_depth_mm": 35.0,
            "edge_flange_width_mm": 15.0,
            "internal_stiffener_count": 2,
        },
        frame_width=1000.0, frame_height=1000.0, frame_depth=200.0
    )
    assert double_res["profile_type"] == "Double-skin hollow blade"
    prof_dt = double_res["profile_details"]
    assert prof_dt["internal_cavity_depth_mm"] == pytest.approx(35.0 - 3.2, abs=0.1)
    # Front dev width = 150 + 2*15 = 180 mm
    assert prof_dt["front_developed_width_mm"] == 180.0
    assert prof_dt["rear_developed_width_mm"] == 180.0


# Test 6: Weight and material quantity calculations
def test_weight_and_material_quantity_calculations():
    # Weight formula: Length * Width * Thickness * Density / 1e9
    # For Steel IS 2062 (7850 kg/m3), 1000 mm span * 150 mm width * 2 mm thk
    # = 1000 * 150 * 2 * 7850 / 1e9 = 2.355 kg
    geom = calculate_blade_geometry_and_construction(
        config={
            "blade_mode": "CUSTOM",
            "blade_type": "Flat single-skin sheet blade",
            "blade_chord_mm": 150.0,
            "blade_length_mm": 1000.0,
            "blade_thickness_mm": 2.0,
            "material": "IS 2062",
            "blade_count": 4,
            "sections": 1,
        },
        frame_width=1000.0, frame_height=1000.0, frame_depth=200.0
    )
    expected_single_wt = (1000.0 * 150.0 * 2.0 * 7850.0) / 1e9
    assert geom["single_blade_weight_kg"] == pytest.approx(expected_single_wt, rel=1e-3)
    assert geom["total_blade_weight_kg"] == pytest.approx(expected_single_wt * 4, rel=1e-3)


# Test 7: Blade geometry updating when a dimension changes
def test_geometry_updates_when_dimension_changes():
    cfg1 = {"blade_mode": "AUTO", "target_pitch_mm": 150.0, "sections": 1}
    geom1 = calculate_blade_geometry_and_construction(cfg1, 2000.0, 2000.0, 180.0)

    # Change height from 2000 to 3000 mm -> blade count increases from 13 to 20
    geom2 = calculate_blade_geometry_and_construction(cfg1, 2000.0, 3000.0, 180.0)
    assert geom2["blade_count"] > geom1["blade_count"]
    assert geom2["total_blades_all_sections"] > geom1["total_blades_all_sections"]


# Test 8: BOM quantities and costs matching the configured geometry
def test_bom_quantities_and_costs_matching_geometry():
    config = {
        "width_mm": 2000,
        "height_mm": 2000,
        "depth_mm": 180,
        "blade_type": "Double-skin hollow blade",
        "blade_mode": "CUSTOM",
        "blade_count": 10,
        "blade_chord_mm": 220.0,
        "blade_length_mm": 980.0,
        "blade_thickness_mm": 2.0,
        "front_skin_thick_mm": 2.0,
        "rear_skin_thick_mm": 2.0,
        "overall_blade_depth_mm": 40.0,
        "internal_stiffener_count": 2,
        "internal_stiffener_thick_mm": 2.0,
        "internal_stiffener_width_mm": 30.0,
        "sections": 2,
    }
    rates = {
        "material_rates": {"IS 2062": 72.0, "EN8": 95.0},
        "labour_rates": {"IS 2062": 10.0, "EN8": 1.0},
        "fabrication_rate_per_kg": 96.0,
        "finishing_rate_per_kg": 20.0,
        "default_markup_pct": 10.0,
    }

    cost_res = calculate_multi_blade_damper_cost(config, rates, damper_quantity=1)
    bom_lines = cost_res["lines"]

    # Verify BOM has separate front and rear skins + stiffeners
    front_line = next((l for l in bom_lines if "Front Skins" in l["part_name"]), None)
    rear_line = next((l for l in bom_lines if "Rear Skins" in l["part_name"]), None)
    stiff_line = next((l for l in bom_lines if "Internal Stiffeners" in l["part_name"]), None)

    assert front_line is not None
    assert rear_line is not None
    assert stiff_line is not None
    # 10 blades per section * 2 sections = 20 blades total
    assert front_line["qty"] == 20
    assert rear_line["qty"] == 20
    # 2 stiffeners per blade * 20 blades = 40 stiffeners
    assert stiff_line["qty"] == 40


# Test 9: Manual BOM edit persistence
def test_manual_bom_edit_persistence(db_session):
    token = get_auth_token("engineer@damperquote.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_payload = {
        "customer_name": "Manual BOM Client",
        "customer_company": "BOM Edit Corp",
        "project_name": "Manual BOM Check",
        "damper_type": "multi_blade",
        "width_mm": 1500,
        "height_mm": 1500,
        "depth_mm": 180,
        "quantity": 1,
        "multi_blade_config": {
            "blade_mode": "CUSTOM",
            "blade_type": "Flat single-skin sheet blade",
            "blade_count": 8,
            "blade_chord_mm": 200.0,
            "blade_length_mm": 1480.0,
            "blade_thickness_mm": 2.0,  # Max span for 2.0mm is 1500mm
            "sections": 1,
            "shaft_diameter_mm": 16.0,
        },
        "bom_edits": [
            {"line_index": 0, "dim_1": 1550.0, "edit_note": "Extended top channel for field fit"}
        ]
    }
    resp = client.post("/api/v1/quotes", json=create_payload, headers=headers)
    assert resp.status_code == 200, resp.text
    created = resp.json()
    qid = created["quote_id"]
    get_res = client.get(f"/api/v1/quotes/{qid}", headers=headers)
    assert get_res.status_code == 200
    q = get_res.json()

    # Verify line 0 was edited and flag is set
    assert q.get("bom_has_edits") is True
    assert q["lines"][0]["dim_1"] == 1550.0


# Test 10: Rate snapshot immutability
def test_rate_snapshot_immutability(db_session):
    token = get_auth_token("engineer@damperquote.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "customer_name": "Immutability Client",
        "customer_company": "Fixed Rate Systems",
        "project_name": "Rate Snapshot Test",
        "damper_type": "multi_blade",
        "width_mm": 1500,
        "height_mm": 1500,
        "depth_mm": 180,
        "quantity": 1,
        "multi_blade_config": {"blade_thickness_mm": 2.0, "sections": 1, "shaft_diameter_mm": 16.0}
    }
    resp = client.post("/api/v1/quotes", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    created = resp.json()
    qid = created["quote_id"]
    get_res = client.get(f"/api/v1/quotes/{qid}", headers=headers)
    assert get_res.status_code == 200
    q = get_res.json()
    snapshot = q.get("rates_snapshot")
    assert snapshot is not None
    assert "material_rates" in snapshot
    assert "bought_out_prices" in snapshot


# Test 11: Admin permission checks
def test_admin_permission_checks():
    eng_token = get_auth_token("engineer@damperquote.com")
    admin_token = get_auth_token("admin@damperquote.com")

    # Engineer should be denied updating rule tables
    res_forbidden = client.put(
        "/api/v1/admin/multi-blade/rule-tables/blade_factors",
        json={"rules_data": {"test": 1.0}},
        headers={"Authorization": f"Bearer {eng_token}"}
    )
    assert res_forbidden.status_code == 403

    # Admin should succeed
    res_ok = client.put(
        "/api/v1/admin/multi-blade/rule-tables/blade_factors",
        json={"rules_data": {"Single Skin (Flat)": 1.5, "Double Skin": 2.2}},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_ok.status_code == 200


# Test 12: Invalid dimensions blocking quote generation
def test_invalid_dimensions_blocking_quote():
    token = get_auth_token("engineer@damperquote.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Pitch > chord produces blocking validation error
    invalid_payload = {
        "customer_name": "Invalid Customer",
        "customer_company": "Invalid Co",
        "project_name": "Bad Quote",
        "damper_type": "multi_blade",
        "width_mm": 1000,
        "height_mm": 1000,
        "depth_mm": 180,
        "quantity": 1,
        "multi_blade_config": {
            "blade_mode": "CUSTOM",
            "blade_count": 4,
            "blade_pitch_mm": 250.0,
            "blade_chord_mm": 100.0,  # Pitch 250 > Chord 100
            "blade_thickness_mm": 1.6,
            "sections": 1,
            "shaft_diameter_mm": 16.0,
        }
    }
    resp = client.post("/api/v1/quotes", json=invalid_payload, headers=headers)
    assert resp.status_code == 400
    assert "pitch_exceeds_chord" in resp.text or "exceeds chord" in resp.text


# Test 13: Existing rack-and-pinion reference prices remain unchanged within ₹1
def test_existing_rack_and_pinion_reference_prices_within_1_rupee(db_session):
    seed_json = load_seed_json()
    ref_list = seed_json["reference_results_default_rates"]

    parts = [
        {
            "id": p.id,
            "sr_no": p.sr_no,
            "name": p.name,
            "is_round": p.is_round,
            "dim_l_or_dia": p.dim_l_or_dia,
            "dim_w_or_leng": p.dim_w_or_leng,
            "dim_t": p.dim_t,
            "base_qty": p.base_qty,
            "default_moc": p.default_moc,
            "dim1_scale_code": p.dim1_scale_code,
            "dim2_scale_code": p.dim2_scale_code,
            "qty_scale_code": p.qty_scale_code,
            "per_piece_machining": p.per_piece_machining,
            "rolling_cost": p.rolling_cost,
        }
        for p in db_session.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all()
    ]
    rates_v1 = db_session.query(RatesVersion).filter(RatesVersion.version_number == 1).first()
    rates_dict = {
        "material_rates": rates_v1.material_rates,
        "labour_rates": rates_v1.labour_rates,
        "bought_out_prices": rates_v1.bought_out_prices,
        "automation_prices": rates_v1.automation_prices,
        "fabrication_rate_per_kg": rates_v1.fabrication_rate_per_kg,
        "finishing_rate_per_kg": rates_v1.finishing_rate_per_kg,
        "default_markup_pct": rates_v1.default_markup_pct,
    }

    for expected in ref_list:
        W = float(expected["width_mm"])
        H = float(expected["height_mm"])
        D = float(expected["depth_mm"])
        exp_price = float(expected["quoted_price"])

        res = calculate_damper_cost(
            width_mm=W,
            height_mm=H,
            depth_mm=D,
            parts_data=parts,
            rates_data=rates_dict,
            damper_quantity=1,
            markup_pct_override=10.0,
        )
        assert abs(res["quoted_price"] - exp_price) <= 1.0, (
            f"Size {W}x{H}x{D} price mismatch: got {res['quoted_price']}, expected {exp_price}"
        )
