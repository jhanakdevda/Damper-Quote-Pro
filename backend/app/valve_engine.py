"""
Valve Engineering & Costing Engine
-----------------------------------
Pune Valve & Damper Mfg. Co. Pvt. Ltd. (Bhosari, Pune)
Engine for Industrial Butterfly Valves, Knife Gate Valves, Ball Valves, and Globe Control Valves.

Handles standard engineering formats:
- Nominal Bore: DN50 to DN2000 (2" to 80")
- Pressure Classes: PN6, PN10, PN16, PN25, PN40, Class 150, Class 300, Class 600
- Standards: ASME B16.34, ASME B16.10, EN 558, API 598, MSS SP-81
- MOC: WCB, CF8M, CF8, Ductile Iron GGG40, Super Duplex
- Trim: SS316, SS304, Hard Chrome SS410, Stellite 6, Monel
- Seats: Resilient EPDM, PTFE/RTFE, Metal-to-Metal (Inconel/Stellite)
- End Connections: Wafer, Lugged, Flanged (ASME B16.5 / EN 1092-1), Butt Weld
- Actuation: Pneumatic Double Acting, Single Acting Spring Return, Electric Multi/Quarter-Turn, Manual Gearbox
"""

import math
from typing import Dict, Any, List, Optional

# Standard Valve Nominal Bores (mm) and their Imperial Designations
STANDARD_VALVE_SIZES = [
    {"dn": 50, "inch": "2\"", "flange_dia_mm": 165, "pcd_mm": 125, "holes": 4, "f2f_wafer": 43, "f2f_flanged": 108},
    {"dn": 65, "inch": "2.5\"", "flange_dia_mm": 185, "pcd_mm": 145, "holes": 4, "f2f_wafer": 46, "f2f_flanged": 112},
    {"dn": 80, "inch": "3\"", "flange_dia_mm": 200, "pcd_mm": 160, "holes": 8, "f2f_wafer": 46, "f2f_flanged": 114},
    {"dn": 100, "inch": "4\"", "flange_dia_mm": 220, "pcd_mm": 180, "holes": 8, "f2f_wafer": 52, "f2f_flanged": 127},
    {"dn": 125, "inch": "5\"", "flange_dia_mm": 250, "pcd_mm": 210, "holes": 8, "f2f_wafer": 56, "f2f_flanged": 140},
    {"dn": 150, "inch": "6\"", "flange_dia_mm": 285, "pcd_mm": 240, "holes": 8, "f2f_wafer": 56, "f2f_flanged": 140},
    {"dn": 200, "inch": "8\"", "flange_dia_mm": 340, "pcd_mm": 295, "holes": 8, "f2f_wafer": 60, "f2f_flanged": 152},
    {"dn": 250, "inch": "10\"", "flange_dia_mm": 405, "pcd_mm": 355, "holes": 12, "f2f_wafer": 68, "f2f_flanged": 165},
    {"dn": 300, "inch": "12\"", "flange_dia_mm": 460, "pcd_mm": 410, "holes": 12, "f2f_wafer": 78, "f2f_flanged": 178},
    {"dn": 350, "inch": "14\"", "flange_dia_mm": 520, "pcd_mm": 470, "holes": 16, "f2f_wafer": 78, "f2f_flanged": 190},
    {"dn": 400, "inch": "16\"", "flange_dia_mm": 580, "pcd_mm": 525, "holes": 16, "f2f_wafer": 102, "f2f_flanged": 216},
    {"dn": 450, "inch": "18\"", "flange_dia_mm": 640, "pcd_mm": 585, "holes": 20, "f2f_wafer": 114, "f2f_flanged": 222},
    {"dn": 500, "inch": "20\"", "flange_dia_mm": 715, "pcd_mm": 650, "holes": 20, "f2f_wafer": 127, "f2f_flanged": 229},
    {"dn": 600, "inch": "24\"", "flange_dia_mm": 840, "pcd_mm": 770, "holes": 20, "f2f_wafer": 154, "f2f_flanged": 267},
    {"dn": 700, "inch": "28\"", "flange_dia_mm": 910, "pcd_mm": 840, "holes": 24, "f2f_wafer": 165, "f2f_flanged": 292},
    {"dn": 800, "inch": "32\"", "flange_dia_mm": 1025, "pcd_mm": 950, "holes": 24, "f2f_wafer": 190, "f2f_flanged": 318},
    {"dn": 900, "inch": "36\"", "flange_dia_mm": 1125, "pcd_mm": 1050, "holes": 28, "f2f_wafer": 203, "f2f_flanged": 330},
    {"dn": 1000, "inch": "40\"", "flange_dia_mm": 1255, "pcd_mm": 1170, "holes": 28, "f2f_wafer": 216, "f2f_flanged": 410},
    {"dn": 1200, "inch": "48\"", "flange_dia_mm": 1485, "pcd_mm": 1390, "holes": 32, "f2f_wafer": 254, "f2f_flanged": 470},
    {"dn": 1400, "inch": "56\"", "flange_dia_mm": 1685, "pcd_mm": 1590, "holes": 36, "f2f_wafer": 280, "f2f_flanged": 530},
    {"dn": 1600, "inch": "64\"", "flange_dia_mm": 1930, "pcd_mm": 1820, "holes": 40, "f2f_wafer": 318, "f2f_flanged": 600},
    {"dn": 1800, "inch": "72\"", "flange_dia_mm": 2130, "pcd_mm": 2020, "holes": 44, "f2f_wafer": 356, "f2f_flanged": 670},
    {"dn": 2000, "inch": "80\"", "flange_dia_mm": 2345, "pcd_mm": 2230, "holes": 48, "f2f_wafer": 400, "f2f_flanged": 760},
]

# Material Densities and Base Rates (₹/kg)
VALVE_MATERIAL_RATES = {
    "WCB (Cast Carbon Steel ASTM A216)": {"density": 7850, "rate_per_kg": 145.0, "code": "WCB"},
    "CF8M (Cast Stainless Steel SS316)": {"density": 8000, "rate_per_kg": 380.0, "code": "CF8M"},
    "CF8 (Cast Stainless Steel SS304)": {"density": 7930, "rate_per_kg": 290.0, "code": "CF8"},
    "Ductile Iron GGG40": {"density": 7200, "rate_per_kg": 115.0, "code": "GGG40"},
    "Super Duplex 2205": {"density": 7800, "rate_per_kg": 650.0, "code": "2205"},
    "IS 2062 Gr.B (Fabricated MS)": {"density": 7850, "rate_per_kg": 72.0, "code": "IS 2062"},
    "SS 304L (Fabricated Plate)": {"density": 7930, "rate_per_kg": 260.0, "code": "SS 304L"},
    "SS 316L (Fabricated Plate)": {"density": 8000, "rate_per_kg": 340.0, "code": "SS 316L"},
}

PRESSURE_RATING_FACTORS = {
    "PN 6": {"factor": 0.85, "test_pressure_bar": 9.0},
    "PN 10": {"factor": 1.00, "test_pressure_bar": 15.0},
    "PN 16": {"factor": 1.15, "test_pressure_bar": 24.0},
    "PN 25": {"factor": 1.40, "test_pressure_bar": 37.5},
    "PN 40": {"factor": 1.75, "test_pressure_bar": 60.0},
    "Class 150": {"factor": 1.20, "test_pressure_bar": 29.3},
    "Class 300": {"factor": 1.80, "test_pressure_bar": 75.8},
    "Class 600": {"factor": 2.60, "test_pressure_bar": 151.7},
}

VALVE_TYPES = {
    "butterfly_valve": {
        "name": "High-Performance / Triple Offset Butterfly Valve",
        "short_name": "Butterfly Valve",
        "category": "Rotary Quarter-Turn",
        "std_code": "API 609 / EN 593",
        "base_weight_formula": lambda dn: 0.00035 * (dn ** 1.95),  # kg wafer baseline
    },
    "knife_gate_valve": {
        "name": "Heavy-Duty Knife Gate Valve (Slurry & Pulp)",
        "short_name": "Knife Gate Valve",
        "category": "Linear Sliding Gate",
        "std_code": "MSS SP-81 / TAPPI",
        "base_weight_formula": lambda dn: 0.00052 * (dn ** 1.92),  # kg baseline
    },
    "ball_valve": {
        "name": "Industrial Trunnion / Floating Ball Valve",
        "short_name": "Ball Valve",
        "category": "Rotary Quarter-Turn",
        "std_code": "API 6D / ASME B16.34",
        "base_weight_formula": lambda dn: 0.00075 * (dn ** 1.88),  # kg baseline
    },
    "globe_valve": {
        "name": "High-Pressure Cage Guided Globe Control Valve",
        "short_name": "Globe Control Valve",
        "category": "Linear Throttling",
        "std_code": "ASME B16.34 / ISA 75.01",
        "base_weight_formula": lambda dn: 0.00088 * (dn ** 1.90),  # kg baseline
    },
}


def get_valve_size_data(dn_mm: int) -> Dict[str, Any]:
    """Retrieve standard valve geometry matching closest DN."""
    closest = min(STANDARD_VALVE_SIZES, key=lambda s: abs(s["dn"] - dn_mm))
    return closest


def calculate_valve_cost(
    config: Dict[str, Any],
    rates_data: Optional[Dict[str, Any]] = None,
    quantity: int = 1,
    markup_pct_override: Optional[float] = None
) -> Dict[str, Any]:
    """
    Core engineering & costing calculation for industrial valves.
    Outputs full BOM, weight schedule, testing costs, actuation, and quotation lines.
    """
    valve_type_key = config.get("valve_type", "butterfly_valve")
    if valve_type_key not in VALVE_TYPES:
        valve_type_key = "butterfly_valve"

    v_def = VALVE_TYPES[valve_type_key]
    dn = int(config.get("size_dn") or config.get("dn_mm") or 300)
    size_data = get_valve_size_data(dn)

    pressure_rating = config.get("pressure_rating", "PN 16")
    rating_info = PRESSURE_RATING_FACTORS.get(pressure_rating, PRESSURE_RATING_FACTORS["PN 16"])
    rating_factor = rating_info["factor"]

    end_connection = config.get("end_connection", "Wafer")
    body_moc = config.get("body_moc", "WCB (Cast Carbon Steel ASTM A216)")
    trim_moc = config.get("trim_moc", "CF8M (Cast Stainless Steel SS316)")
    seat_moc = config.get("seat_moc", "PTFE / RTFE")
    actuation_type = config.get("actuation_type", "Electric Quarter-Turn Actuator")

    # Dimensions
    f2f_mm = size_data["f2f_flanged"] if "Flanged" in end_connection else size_data["f2f_wafer"]
    flange_dia_mm = size_data["flange_dia_mm"]
    pcd_mm = size_data["pcd_mm"]
    bolt_holes = size_data["holes"]

    # End connection weight factor
    conn_factor = 1.0
    if "Flanged" in end_connection:
        conn_factor = 1.45
    elif "Lugged" in end_connection:
        conn_factor = 1.15
    elif "Butt Weld" in end_connection:
        conn_factor = 1.05

    # Base weight calculation
    raw_base_wt = v_def["base_weight_formula"](dn)
    total_val_wt = max(8.0, raw_base_wt * rating_factor * conn_factor)

    # Component weights breakdown
    body_wt = round(total_val_wt * 0.58, 2)
    disc_or_gate_wt = round(total_val_wt * 0.22, 2)
    stem_wt = round(total_val_wt * 0.08, 2)
    bonnet_yoke_wt = round(total_val_wt * 0.08, 2)
    hardware_wt = round(total_val_wt * 0.04, 2)

    # Rates
    body_rate_info = VALVE_MATERIAL_RATES.get(body_moc, VALVE_MATERIAL_RATES["WCB (Cast Carbon Steel ASTM A216)"])
    trim_rate_info = VALVE_MATERIAL_RATES.get(trim_moc, VALVE_MATERIAL_RATES["CF8M (Cast Stainless Steel SS316)"])
    
    body_mat_rate = body_rate_info["rate_per_kg"]
    trim_mat_rate = trim_rate_info["rate_per_kg"]
    stem_mat_rate = 360.0  # Precision ground 17-4PH or SS410/SS316
    hardware_mat_rate = 180.0

    # Raw Material Costs
    body_rm_cost = body_wt * body_mat_rate
    trim_rm_cost = disc_or_gate_wt * trim_mat_rate
    stem_rm_cost = stem_wt * stem_mat_rate
    bonnet_rm_cost = bonnet_yoke_wt * (body_mat_rate * 0.9)
    hardware_rm_cost = hardware_wt * hardware_mat_rate

    seat_cost = 1500.0 + (dn * 12.0)
    if "Metal" in seat_moc:
        seat_cost *= 2.8
    elif "PTFE" in seat_moc:
        seat_cost *= 1.4

    gland_packing_cost = 800.0 + (dn * 4.0)

    total_rm_cost = round(body_rm_cost + trim_rm_cost + stem_rm_cost + bonnet_rm_cost + hardware_rm_cost + seat_cost + gland_packing_cost, 2)

    # Machining & Precision Manufacturing Costs
    body_machining = body_wt * 65.0
    trim_machining = disc_or_gate_wt * 95.0
    stem_machining = stem_wt * 140.0
    bonnet_machining = bonnet_yoke_wt * 50.0
    assembly_labour = max(1800.0, total_val_wt * 35.0)

    total_mfg_cost = round(body_machining + trim_machining + stem_machining + bonnet_machining + assembly_labour, 2)

    # Testing & Inspection (API 598 Hydro Shell & Seat Test)
    test_pressure_bar = rating_info["test_pressure_bar"]
    hydro_testing_cost = round(max(2500.0, total_val_wt * 18.0 + (test_pressure_bar * 40.0)), 2)
    blasting_painting_cost = round(max(1200.0, total_val_wt * 22.0), 2)

    # Actuation Sizing & Pricing
    actuator_cost = 0.0
    actuator_desc = "Manual Hand Lever / Gearbox with Handwheel"
    if "Electric" in actuation_type:
        actuator_cost = 65000.0 + (dn * 85.0)
        actuator_desc = f"Smart Electric Actuator 415V 3-Ph IP68 with Profibus/4-20mA (DN{dn})"
    elif "Pneumatic Double Acting" in actuation_type:
        actuator_cost = 28000.0 + (dn * 45.0)
        actuator_desc = f"Pneumatic Double-Acting Rack & Pinion Cylinder with NAMUR pad (DN{dn})"
    elif "Pneumatic Spring Return" in actuation_type:
        actuator_cost = 42000.0 + (dn * 60.0)
        actuator_desc = f"Pneumatic Spring-Return Single-Acting Fail-Safe Actuator (DN{dn})"
    else:
        actuator_cost = 8500.0 + (dn * 15.0)
        actuator_desc = f"Heavy-Duty Worm Gear Operator with Handwheel (DN{dn})"

    # Optional Accessories
    acc_cost = 0.0
    if config.get("with_limit_switch", True):
        acc_cost += 7500.0
    if config.get("with_solenoid_valve", True) and "Pneumatic" in actuation_type:
        acc_cost += 6500.0
    if config.get("with_positioner", False):
        acc_cost += 35000.0
    if config.get("with_air_filter_regulator", True) and "Pneumatic" in actuation_type:
        acc_cost += 3200.0

    total_automation_cost = round(actuator_cost + acc_cost, 2)

    # Unit Cost Totals
    basic_valve_cost = round(total_rm_cost + total_mfg_cost + hydro_testing_cost + blasting_painting_cost, 2)
    total_unit_cost = round(basic_valve_cost + total_automation_cost, 2)

    markup_pct = float(markup_pct_override if markup_pct_override is not None else config.get("markup_pct", 10.0))
    quoted_unit_price = round(total_unit_cost * (1.0 + markup_pct / 100.0), 2)
    batch_quoted_price = round(quoted_unit_price * quantity, 2)
    batch_total_cost = round(total_unit_cost * quantity, 2)

    # Operating Torque calculation (Nm)
    delta_p_bar = rating_info["test_pressure_bar"] / 1.5
    seat_radius_m = (dn / 2000.0)
    disc_area_m2 = math.pi * (seat_radius_m ** 2)
    hydro_thrust_n = delta_p_bar * 100000 * disc_area_m2
    stem_friction_coeff = 0.18
    calc_torque_nm = round(hydro_thrust_n * stem_friction_coeff * seat_radius_m * 1.35, 1)

    # Generate 14-line Production BOM
    bom_lines = [
        {
            "sr_no": 1,
            "part_name": f"Valve Body ({v_def['short_name']} - {end_connection})",
            "moc": body_moc,
            "qty": 1,
            "weight": body_wt,
            "material_rate": body_mat_rate,
            "rm_cost": round(body_rm_cost, 2),
            "mfg_cost": round(body_machining, 2),
            "total_cost": round(body_rm_cost + body_machining, 2),
            "spec": f"DN{dn} {size_data['inch']} Face-to-Face {f2f_mm}mm, PCD {pcd_mm}mm, {bolt_holes} Holes"
        },
        {
            "sr_no": 2,
            "part_name": f"Trim / Disc / Blade / Plug ({v_def['short_name']})",
            "moc": trim_moc,
            "qty": 1,
            "weight": disc_or_gate_wt,
            "material_rate": trim_mat_rate,
            "rm_cost": round(trim_rm_cost, 2),
            "mfg_cost": round(trim_machining, 2),
            "total_cost": round(trim_rm_cost + trim_machining, 2),
            "spec": f"Precision CNC Machined & Beveled Profile for {pressure_rating}"
        },
        {
            "sr_no": 3,
            "part_name": "Drive Stem / Spindle Shaft",
            "moc": "SS 410 / SS 316 Ground & Hardened",
            "qty": 1,
            "weight": stem_wt,
            "material_rate": stem_mat_rate,
            "rm_cost": round(stem_rm_cost, 2),
            "mfg_cost": round(stem_machining, 2),
            "total_cost": round(stem_rm_cost + stem_machining, 2),
            "spec": f"Keyed / Splined Drive Dia {round(math.sqrt(dn)*2.8, 1)}mm, Torque rated {calc_torque_nm} Nm"
        },
        {
            "sr_no": 4,
            "part_name": "Bonnet / Yoke Bracket & ISO 5211 Top Mounting",
            "moc": body_moc,
            "qty": 1,
            "weight": bonnet_yoke_wt,
            "material_rate": body_mat_rate,
            "rm_cost": round(bonnet_rm_cost, 2),
            "mfg_cost": round(bonnet_machining, 2),
            "total_cost": round(bonnet_rm_cost + bonnet_machining, 2),
            "spec": "Standard ISO 5211 Pad (F10/F14/F16/F25)"
        },
        {
            "sr_no": 5,
            "part_name": f"Seat Ring / Resilient Liner ({seat_moc})",
            "moc": seat_moc,
            "qty": 1,
            "weight": 0.8,
            "material_rate": 0,
            "rm_cost": round(seat_cost, 2),
            "mfg_cost": 0,
            "total_cost": round(seat_cost, 2),
            "spec": f"Leakage Rate A (API 598 Zero Bubbles) / FCI 70-2 Class VI"
        },
        {
            "sr_no": 6,
            "part_name": "Stem Gland Packing & Chevron V-Rings",
            "moc": "Die-formed Flexible Graphite + PTFE braided",
            "qty": 1,
            "weight": 0.5,
            "material_rate": 0,
            "rm_cost": round(gland_packing_cost, 2),
            "mfg_cost": 0,
            "total_cost": round(gland_packing_cost, 2),
            "spec": "Low Emission Fugitive VOC Seal per ISO 15848-1"
        },
        {
            "sr_no": 7,
            "part_name": "Body Fasteners, Studs & Nuts",
            "moc": "ASTM A193 Gr. B7 / A194 Gr. 2H",
            "qty": bolt_holes,
            "weight": hardware_wt,
            "material_rate": hardware_mat_rate,
            "rm_cost": round(hardware_rm_cost, 2),
            "mfg_cost": 0,
            "total_cost": round(hardware_rm_cost, 2),
            "spec": f"Zinc Flake / Geomet Coated Metric Fasteners ({bolt_holes} Nos)"
        },
        {
            "sr_no": 8,
            "part_name": "Precision Assembly & Factory Hydro Testing",
            "moc": "API 598 / ISO 5208 Test Bench",
            "qty": 1,
            "weight": 0,
            "material_rate": 0,
            "rm_cost": 0,
            "mfg_cost": round(assembly_labour + hydro_testing_cost, 2),
            "total_cost": round(assembly_labour + hydro_testing_cost, 2),
            "spec": f"Hydro Shell: {test_pressure_bar} bar | Air Seat: 6.0 bar | Backseat: {round(test_pressure_bar * 1.1, 1)} bar"
        },
        {
            "sr_no": 9,
            "part_name": "Shot Blasting & High-Build Epoxy Painting",
            "moc": "SA 2.5 + Epoxy Primer & Polyurethane Topcoat",
            "qty": 1,
            "weight": 0,
            "material_rate": 0,
            "rm_cost": 0,
            "mfg_cost": round(blasting_painting_cost, 2),
            "total_cost": round(blasting_painting_cost, 2),
            "spec": "DFT 250 microns RAL 5015 / Blue Signal"
        },
        {
            "sr_no": 10,
            "part_name": actuator_desc,
            "moc": "Standard OEM Package",
            "qty": 1,
            "weight": round(total_val_wt * 0.35, 1),
            "material_rate": 0,
            "rm_cost": round(actuator_cost, 2),
            "mfg_cost": 0,
            "total_cost": round(actuator_cost, 2),
            "spec": f"Selected Sizing Torque: {calc_torque_nm * 1.4:.0f} Nm (140% Safety Factor)"
        },
    ]

    if acc_cost > 0:
        bom_lines.append({
            "sr_no": 11,
            "part_name": "Automation Accessories & Valve Instrumentation",
            "moc": "IP67 / Ex-d Flameproof",
            "qty": 1,
            "weight": 3.5,
            "material_rate": 0,
            "rm_cost": round(acc_cost, 2),
            "mfg_cost": 0,
            "total_cost": round(acc_cost, 2),
            "spec": "Limit Switches, NAMUR Solenoid, Positioner & Air Filter Regulator"
        })

    return {
        "product_category": "valve",
        "valve_type": valve_type_key,
        "valve_name": v_def["name"],
        "valve_short_name": v_def["short_name"],
        "standard_code": v_def["std_code"],
        "size_dn": dn,
        "size_inch": size_data["inch"],
        "face_to_face_mm": f2f_mm,
        "flange_outer_dia_mm": flange_dia_mm,
        "pcd_mm": pcd_mm,
        "bolt_holes": bolt_holes,
        "pressure_rating": pressure_rating,
        "test_pressure_bar": test_pressure_bar,
        "end_connection": end_connection,
        "body_moc": body_moc,
        "trim_moc": trim_moc,
        "seat_moc": seat_moc,
        "actuation_type": actuation_type,
        "operating_torque_nm": calc_torque_nm,
        "total_weight_kg": round(total_val_wt, 2),
        "raw_material_cost": total_rm_cost,
        "mfg_cost": total_mfg_cost,
        "testing_cost": hydro_testing_cost,
        "finishing_cost": blasting_painting_cost,
        "automation_cost": total_automation_cost,
        "basic_cost": basic_valve_cost,
        "total_cost": total_unit_cost,
        "markup_pct": markup_pct,
        "quoted_price": quoted_unit_price,
        "quantity": quantity,
        "batch_totals": {
            "total_cost": batch_total_cost,
            "quoted_price": batch_quoted_price,
            "total_weight_kg": round(total_val_wt * quantity, 2),
        },
        "lines": bom_lines,
        "cad_spec": {
            "dn": dn,
            "f2f": f2f_mm,
            "flange_dia": flange_dia_mm,
            "pcd": pcd_mm,
            "holes": bolt_holes,
            "valve_type": valve_type_key,
            "actuator": actuation_type,
            "end_connection": end_connection,
        }
    }
