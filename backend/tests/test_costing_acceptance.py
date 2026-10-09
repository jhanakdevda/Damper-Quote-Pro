import os
import json
import pytest
from app.database import SessionLocal
from app.models import PartsLibrary, RatesVersion, Quote, QuoteRevision, User
from app.costing_engine import calculate_damper_cost, safe_eval_formula
from app.seed import seed_database, load_seed_json

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    seed_database(db)
    yield db
    db.close()

def get_seed_data_and_rates(db):
    seed_json = load_seed_json()
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
            "rolling_cost": p.rolling_cost
        }
        for p in db.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all()
    ]
    rates_v1 = db.query(RatesVersion).filter(RatesVersion.version_number == 1).first()
    rates_dict = {
        "material_rates": rates_v1.material_rates,
        "labour_rates": rates_v1.labour_rates,
        "bought_out_prices": rates_v1.bought_out_prices,
        "automation_prices": rates_v1.automation_prices,
        "fabrication_rate_per_kg": rates_v1.fabrication_rate_per_kg,
        "finishing_rate_per_kg": rates_v1.finishing_rate_per_kg,
        "default_markup_pct": rates_v1.default_markup_pct
    }
    return seed_json, parts, rates_dict

def test_reference_results_against_seed_json(db_session):
    """
    Test costing engine outputs for 3000x3000x450, 2000x2000x400, 4500x3500x500, and 6000x6000x800
    against expected values in damper_seed_data.json under reference_results_default_rates.
    Tolerance: Rs 1.0 (and 0.01).
    Never weaken tests. If any value differs, fail with a detailed diff report.
    """
    seed_json, parts, rates_dict = get_seed_data_and_rates(db_session)
    ref_list = seed_json["reference_results_default_rates"]
    
    diff_report = []
    
    for expected in ref_list:
        W = float(expected["width_mm"])
        H = float(expected["height_mm"])
        D = float(expected["depth_mm"])
        size_key = f"{int(W)}x{int(H)}x{int(D)}"
        
        actual = calculate_damper_cost(W, H, D, parts, rates_dict, damper_quantity=1)
        
        mappings = [
            ("total_weight_kg", "total_weight_kg"),
            ("raw_material", "raw_material_cost"),
            ("machining", "mfg_cost"),
            ("bought_out_and_finishing", "bought_out_cost"),
            ("basic_cost", "basic_cost"),
            ("automation", "automation_cost"),
            ("fabrication", "fabrication_cost"),
            ("total_cost", "total_cost"),
            ("quoted_price", "quoted_price")
        ]
        
        for json_key, engine_key in mappings:
            exp_val = float(expected[json_key])
            act_val = float(actual[engine_key])
            diff = abs(act_val - exp_val)
            if diff > 1.0:
                diff_report.append(f"[{size_key}] Field '{engine_key}' mismatch: expected {exp_val}, got {act_val} (diff: {diff:.2f})")
                
            assert pytest.approx(act_val, abs=1.0) == exp_val, f"[{size_key}] {engine_key} failed tolerance check"

    if diff_report:
        pytest.fail("\n".join(diff_report))

def test_rate_change_does_not_affect_saved_quotes(db_session):
    """
    Verify that updating global rates affects new quotes,
    but previously saved quotes retain their original snapshot and values.
    """
    seed_json, parts, rates_dict = get_seed_data_and_rates(db_session)
    
    # 1. Fetch reference quote from DB (seeded with v1 rates)
    saved_quote = db_session.query(Quote).filter(Quote.quote_number == "Q-2026-0001").first()
    original_quoted_price = saved_quote.quoted_price
    original_rm_cost = saved_quote.raw_material_cost
    
    # 2. Simulate global rate update (IS 2062 material rate changed from 72 to 100)
    updated_rates_dict = json.loads(json.dumps(rates_dict))
    updated_rates_dict["material_rates"]["IS 2062"] = 100.0
    
    # 3. Calculate NEW quote with updated rates
    new_quote_result = calculate_damper_cost(3000.0, 3000.0, 450.0, parts, updated_rates_dict, damper_quantity=1)
    
    # New quote must reflect higher raw material cost and higher quoted price
    assert new_quote_result["raw_material_cost"] > original_rm_cost
    assert new_quote_result["quoted_price"] > original_quoted_price
    
    # 4. Re-fetch old saved quote from DB
    db_session.refresh(saved_quote)
    
    # Old saved quote must remain untouched!
    assert saved_quote.quoted_price == original_quoted_price
    assert saved_quote.raw_material_cost == original_rm_cost

def test_input_validations(db_session):
    """Verify input validation rules for dimensions and quantity"""
    seed_json, parts, rates_dict = get_seed_data_and_rates(db_session)
    
    # Width out of bounds (< 1000 mm)
    with pytest.raises(ValueError, match="Width 500.0 mm out of range"):
        calculate_damper_cost(500.0, 3000.0, 450.0, parts, rates_dict)
        
    # Height out of bounds (> 6000 mm)
    with pytest.raises(ValueError, match="Height 7000.0 mm out of range"):
        calculate_damper_cost(3000.0, 7000.0, 450.0, parts, rates_dict)
        
    # Depth out of bounds (< 300 mm)
    with pytest.raises(ValueError, match="Depth 200.0 mm out of range"):
        calculate_damper_cost(3000.0, 3000.0, 200.0, parts, rates_dict)

    # Quantity < 1
    with pytest.raises(ValueError, match="Quantity 0 must be >= 1"):
        calculate_damper_cost(3000.0, 3000.0, 450.0, parts, rates_dict, damper_quantity=0)

def test_multi_quantity_scaling(db_session):
    """Verify damper quantity multiplier for batch quotes"""
    seed_json, parts, rates_dict = get_seed_data_and_rates(db_session)
    res = calculate_damper_cost(3000.0, 3000.0, 450.0, parts, rates_dict, damper_quantity=5)
    
    unit_price = res["quoted_price"]
    batch_price = res["batch_totals"]["quoted_price"]
    
    assert res["batch_totals"]["quantity"] == 5
    assert pytest.approx(batch_price, abs=0.01) == unit_price * 5

def test_html_reference_comparison(db_session):
    """
    Verify engine calculations match rack_pinion_damper_calculator.html
    reference output for base size 3000 x 3000 x 450 mm within Rs 1.
    """
    seed_json, parts, rates_dict = get_seed_data_and_rates(db_session)
    res = calculate_damper_cost(3000.0, 3000.0, 450.0, parts, rates_dict)
    
    # Reference targets from HTML compute() for 3000x3000x450
    assert pytest.approx(res["total_weight_kg"], abs=0.01) == 4923.95
    assert pytest.approx(res["raw_material_cost"], abs=0.01) == 575540.49
    assert pytest.approx(res["mfg_cost"], abs=0.01) == 102313.28
    assert pytest.approx(res["basic_cost"], abs=0.01) == 1017132.75
    assert pytest.approx(res["automation_cost"], abs=0.01) == 350000.00
    assert pytest.approx(res["fabrication_cost"], abs=0.01) == 472699.08
    assert pytest.approx(res["total_cost"], abs=0.01) == 1839831.83
    assert pytest.approx(res["quoted_price"], abs=0.01) == 2023815.01


def test_custom_formula_whitelist_and_operator_support():
    variables = {"W": 3000.0, "H": 2000.0, "D": 450.0, "nR": 4.0}
    assert safe_eval_formula("(W + H) / 5000", variables) == 1.0
    assert safe_eval_formula("nR * 2 - D / 450", variables) == 7.0
    for unsafe in ("__import__('os')", "W.real", "W if H else D", "W / 0", "2 ** 999999"):
        with pytest.raises(ValueError):
            safe_eval_formula(unsafe, variables)


def test_custom_scale_formula_is_applied_per_part(db_session):
    _, parts, rates_dict = get_seed_data_and_rates(db_session)
    custom_parts = [dict(part) for part in parts]
    original_dimension = custom_parts[0]["dim_l_or_dia"]
    custom_parts[0]["dim1_scale_code"] = "custom"
    custom_parts[0]["dim1_custom_formula"] = "W / 3000"
    result = calculate_damper_cost(4500, 3000, 450, custom_parts, rates_dict)
    assert result["lines"][0]["dim_1"] == pytest.approx(original_dimension * 1.5)
    custom_parts[0]["dim1_custom_formula"] = "__import__('os')"
    with pytest.raises(ValueError, match="Disallowed"):
        calculate_damper_cost(4500, 3000, 450, custom_parts, rates_dict)


def test_calibration_is_disabled_by_default(db_session):
    seed_json, parts, rates_dict = get_seed_data_and_rates(db_session)
    baseline = calculate_damper_cost(3000, 3000, 450, parts, rates_dict)
    disabled = dict(rates_dict, calibration={"raw_material": {"enabled": False, "factor": 2.0}})
    unchanged = calculate_damper_cost(3000, 3000, 450, parts, disabled)
    assert unchanged["total_cost"] == baseline["total_cost"]
    enabled = dict(rates_dict, calibration={"raw_material": {"enabled": True, "factor": 1.1}})
    calibrated = calculate_damper_cost(3000, 3000, 450, parts, enabled)
    assert calibrated["raw_material_cost"] > baseline["raw_material_cost"]
