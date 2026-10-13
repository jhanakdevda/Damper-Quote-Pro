"""
Unit tests for Valve Engineering & Costing Engine
"""

import pytest
from app.valve_engine import (
    calculate_valve_cost,
    VALVE_TYPES,
    STANDARD_VALVE_SIZES,
    get_valve_size_data,
)

def test_valve_sizing_lookup():
    s300 = get_valve_size_data(300)
    assert s300["dn"] == 300
    assert s300["inch"] == '12"'
    assert s300["holes"] == 12

    s50 = get_valve_size_data(50)
    assert s50["dn"] == 50
    assert s50["inch"] == '2"'

def test_butterfly_valve_costing():
    cfg = {
        "valve_type": "butterfly_valve",
        "size_dn": 300,
        "pressure_rating": "PN 16",
        "end_connection": "Wafer",
        "body_moc": "WCB (Cast Carbon Steel ASTM A216)",
        "trim_moc": "CF8M (Cast Stainless Steel SS316)",
        "seat_moc": "PTFE / RTFE",
        "actuation_type": "Electric Quarter-Turn Actuator",
        "markup_pct": 10.0,
    }
    res = calculate_valve_cost(cfg, quantity=1)
    assert res["product_category"] == "valve"
    assert res["valve_type"] == "butterfly_valve"
    assert res["size_dn"] == 300
    assert res["total_weight_kg"] > 0
    assert res["quoted_price"] > res["total_cost"]
    assert len(res["lines"]) >= 9
    assert res["cad_spec"]["dn"] == 300

def test_knife_gate_valve_costing():
    cfg = {
        "valve_type": "knife_gate_valve",
        "size_dn": 400,
        "pressure_rating": "PN 10",
        "end_connection": "Wafer",
        "body_moc": "WCB (Cast Carbon Steel ASTM A216)",
        "trim_moc": "CF8M (Cast Stainless Steel SS316)",
        "seat_moc": "Metal-to-Metal Hardfaced",
        "actuation_type": "Pneumatic Double Acting Cylinder",
        "markup_pct": 12.0,
    }
    res = calculate_valve_cost(cfg, quantity=2)
    assert res["valve_type"] == "knife_gate_valve"
    assert res["size_dn"] == 400
    assert res["batch_totals"]["quoted_price"] == round(res["quoted_price"] * 2, 2)
    assert any("Blade" in l["part_name"] or "Trim" in l["part_name"] for l in res["lines"])

def test_ball_and_globe_valves():
    for v_type in ["ball_valve", "globe_valve"]:
        cfg = {
            "valve_type": v_type,
            "size_dn": 150,
            "pressure_rating": "Class 150",
            "end_connection": "Double Flanged RF",
            "body_moc": "CF8M (Cast Stainless Steel SS316)",
            "actuation_type": "Manual Hand Lever / Gearbox with Handwheel",
        }
        res = calculate_valve_cost(cfg, quantity=1)
        assert res["valve_type"] == v_type
        assert res["total_weight_kg"] > 0
        assert res["quoted_price"] > 0
