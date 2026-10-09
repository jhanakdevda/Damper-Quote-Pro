import math
import ast
import operator as _op
from typing import Dict, Any, List, Optional, Tuple
from app.costing_engine import safe_eval_condition, safe_eval_formula

# Default rule lookup tables (Placeholder - editable by Admin)
DEFAULT_MAX_BLADE_LENGTH_TABLE = [
    {"thickness_mm": 1.2, "max_length_mm": 800.0},
    {"thickness_mm": 1.6, "max_length_mm": 1200.0},
    {"thickness_mm": 2.0, "max_length_mm": 1500.0},
    {"thickness_mm": 3.0, "max_length_mm": 2000.0},
]

DEFAULT_SHAFT_DIAMETER_TABLE = [
    {"max_blade_length_mm": 1000.0, "min_shaft_dia_mm": 12.0},
    {"max_blade_length_mm": 1500.0, "min_shaft_dia_mm": 16.0},
    {"max_blade_length_mm": 2000.0, "min_shaft_dia_mm": 20.0},
    {"max_blade_length_mm": 99999.0, "min_shaft_dia_mm": 25.0},
]

DEFAULT_BLADE_FACTORS = {
    "Single Skin (Flat)": 1.5,
    "Flat single-skin sheet blade": 1.0,
    "Folded single-skin blade": 1.45,
    "Double Skin": 2.2,
    "Double-skin hollow blade": 2.2,
    "Aerofoil": 2.5,
    "Aerofoil blade": 2.1,
    "Custom cross-section blade": 1.6,
    # Short key fallbacks
    "single_skin": 1.5,
    "folded_single_skin": 1.45,
    "double_skin": 2.2,
    "aerofoil": 2.5,
    "custom_profile": 1.6,
}

DEFAULT_MATERIAL_DENSITIES = {
    "IS 2062": 7850.0,
    "Galvanized": 7850.0,
    "SS 304": 7930.0,
    "SS 304L": 7930.0,
    "SS 316": 8000.0,
    "SS 316L": 8000.0,
    "SS 410": 7750.0,
    "EN8": 7850.0,
    "Aluminum": 2700.0,
}

DEFAULT_BLADE_DIMENSION_LIMITS = {
    "min_blade_thickness_mm": 0.8,
    "max_blade_thickness_mm": 8.0,
    "min_side_clearance_mm": 2.0,
    "min_end_clearance_mm": 2.0,
    "min_blade_chord_mm": 50.0,
    "max_blade_chord_mm": 600.0,
    "min_blade_span_mm": 100.0,
    "max_blade_span_mm": 3500.0,
    "min_blade_count": 2,
    "max_blade_count": 50,
}

PERMITTED_BLADE_PROFILES = [
    "Flat single-skin sheet blade",
    "Folded single-skin blade",
    "Double-skin hollow blade",
    "Aerofoil blade",
    "Custom cross-section blade",
]

CUSTOM_PROFILES_SUPPORTED = [
    "Z-profile",
    "C-channel",
    "Hat-channel",
    "Double-V groove",
    "Airfoil-profile",
]

DEFAULT_MULTI_BLADE_RATES = {
    "bought_out_prices": {
        "bush_bearing": 450.0,
        "ball_bearing": 1200.0,
        "sealed_bearing": 1800.0,
        "crank_lever": 650.0,
        "tie_rod_per_m": 350.0,
        "edge_seal_rubber_per_m": 180.0,
        "edge_seal_metal_per_m": 420.0,
        "edge_seal_ceramic_per_m": 750.0,
        "side_seal_ss_per_m": 380.0,
        "side_seal_flexible_per_m": 220.0,
        "hardware_lump": 15000.0,
        "nameplate": 800.0,
    },
    "automation_prices": {
        "manual_quadrant": 8500.0,
        "pneumatic_double_acting": 45000.0,
        "pneumatic_spring_return": 68000.0,
        "electric_actuator": 120000.0,
        "limit_switch": 14000.0,
        "solenoid_valve": 18000.0,
        "positioner": 42000.0,
    },
    "blade_factors": DEFAULT_BLADE_FACTORS,
    "material_densities": DEFAULT_MATERIAL_DENSITIES,
    "dimension_limits": DEFAULT_BLADE_DIMENSION_LIMITS,
    "is_verified": False,  # False triggers "Placeholder multi-blade data: not company-verified" banner
}


def get_material_density(moc: str, density_table: Optional[Dict[str, float]] = None) -> float:
    """Returns material density in kg/m3. Defaults to 7850 for steel."""
    table = density_table or DEFAULT_MATERIAL_DENSITIES
    for key, val in table.items():
        if key.lower() in (moc or "").lower():
            return float(val)
    return float(table.get("IS 2062", 7850.0))


def get_max_blade_length_for_thickness(thickness_mm: float, table: Optional[List[Dict[str, float]]] = None) -> float:
    """Returns the maximum blade length (span) for a given blade thickness."""
    rules = table or DEFAULT_MAX_BLADE_LENGTH_TABLE
    sorted_rules = sorted(rules, key=lambda r: float(r.get("thickness_mm", 0)))
    for rule in sorted_rules:
        if thickness_mm <= float(rule.get("thickness_mm", 0)):
            return float(rule.get("max_length_mm", 1200.0))
    if sorted_rules:
        return float(sorted_rules[-1].get("max_length_mm", 2000.0))
    return 1200.0


def get_min_shaft_diameter_for_length(blade_length_mm: float, table: Optional[List[Dict[str, float]]] = None) -> float:
    """Returns minimum shaft diameter required for a given blade span."""
    rules = table or DEFAULT_SHAFT_DIAMETER_TABLE
    sorted_rules = sorted(rules, key=lambda r: float(r.get("max_blade_length_mm", 0)))
    for rule in sorted_rules:
        if blade_length_mm <= float(rule.get("max_blade_length_mm", 0)):
            return float(rule.get("min_shaft_dia_mm", 16.0))
    return 25.0


def calculate_blade_geometry_and_construction(
    config: Dict[str, Any],
    frame_width: float,
    frame_height: float,
    frame_depth: float,
    rule_tables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Core blade design module. Calculates finished geometry, developed dimensions,
    material requirement, clearances, weights, and dimension provenance (AUTO vs CUSTOM).
    """
    mode = str(config.get("blade_mode", "AUTO")).upper()
    if mode == "MANUAL":
        mode = "CUSTOM"

    orientation = str(config.get("blade_orientation", "Horizontal"))
    is_vertical = orientation.lower() == "vertical"

    # Outer frame & opening
    W = float(frame_width)
    H = float(frame_height)
    D = float(frame_depth)
    n_sec = max(1, int(config.get("sections", 1)))

    t_frame = float(config.get("frame_thickness_mm", 3.0))
    mullion_thick = float(config.get("intermediate_support_thick_mm", 6.0))

    # Clearances (mm)
    side_clearance = float(config.get("side_clearance_mm", 5.0))
    end_clearance = float(config.get("end_clearance_mm", 5.0))

    # Usable frame axes
    # If horizontal orientation: blades span horizontally across width, stacked vertically along height.
    # If vertical orientation: blades span vertically across height, stacked horizontally along width.
    if not is_vertical:
        span_total_available = max(50.0, W - ((n_sec - 1) * mullion_thick))
        section_span_avail = span_total_available / n_sec
        stack_dim = H
    else:
        span_total_available = max(50.0, H - ((n_sec - 1) * mullion_thick))
        section_span_avail = span_total_available / n_sec
        stack_dim = W

    # Blade Material and Density
    moc = str(config.get("material", "IS 2062"))
    density_table = (rule_tables or {}).get("material_densities", DEFAULT_MATERIAL_DENSITIES)
    density = get_material_density(moc, density_table)

    # Thickness / Gauge
    t_blade = float(config.get("blade_thickness_mm", 1.6))
    overlap_pct_input = config.get("overlap_pct")
    overlap_pct = float(overlap_pct_input) if overlap_pct_input is not None else 10.0
    overlap_ratio = max(0.0, overlap_pct) / 100.0

    # Dimension sources tracking: "user" vs "calculated"
    dimension_sources: Dict[str, str] = {}

    target_count = config.get("target_blade_count")
    target_pitch = config.get("target_pitch_mm")
    custom_count = config.get("blade_count") or config.get("manual_blade_count")
    custom_pitch = config.get("blade_pitch_mm")
    custom_chord = config.get("blade_chord_mm") or config.get("manual_chord_mm")
    custom_span = config.get("blade_length_mm") or config.get("blade_span_mm")
    custom_breadth = config.get("blade_depth_mm") or config.get("blade_breadth_mm")

    if mode == "CUSTOM":
        # Blade count
        if custom_count is not None and int(custom_count) >= 2:
            count = int(custom_count)
            dimension_sources["blade_count"] = "user"
        else:
            count = max(2, int(math.floor((stack_dim / 150.0) + 0.5)))
            dimension_sources["blade_count"] = "calculated"

        # Blade pitch
        if custom_pitch is not None and float(custom_pitch) > 0:
            pitch = float(custom_pitch)
            dimension_sources["blade_pitch_mm"] = "user"
        else:
            pitch = stack_dim / count if count > 0 else 150.0
            dimension_sources["blade_pitch_mm"] = "calculated"

        # Blade chord
        if custom_chord is not None and float(custom_chord) > 0:
            chord = float(custom_chord)
            dimension_sources["blade_chord_mm"] = "user"
            if pitch > 0:
                overlap_pct = ((chord - pitch) / pitch) * 100.0
                dimension_sources["overlap_pct"] = "calculated"
        else:
            chord = pitch * (1.0 + overlap_ratio)
            dimension_sources["blade_chord_mm"] = "calculated"
            dimension_sources["overlap_pct"] = "user" if overlap_pct_input is not None else "calculated"

        # Blade length / span
        if custom_span is not None and float(custom_span) > 0:
            blade_length = float(custom_span)
            dimension_sources["blade_length_mm"] = "user"
        else:
            blade_length = max(30.0, section_span_avail - (2 * side_clearance))
            dimension_sources["blade_length_mm"] = "calculated"

        # Thickness
        dimension_sources["blade_thickness_mm"] = "user" if "blade_thickness_mm" in config else "calculated"

    else:  # AUTO mode
        if target_count and int(target_count) >= 2:
            count = int(target_count)
            pitch = stack_dim / count
            dimension_sources["blade_count"] = "user"
            dimension_sources["blade_pitch_mm"] = "calculated"
        elif target_pitch and float(target_pitch) > 0:
            pitch_target = float(target_pitch)
            count = max(2, int(math.floor((stack_dim / pitch_target) + 0.5)))
            pitch = stack_dim / count
            dimension_sources["blade_count"] = "calculated"
            dimension_sources["blade_pitch_mm"] = "user"
        else:
            count = max(2, int(math.floor((stack_dim / 150.0) + 0.5)))
            pitch = stack_dim / count
            dimension_sources["blade_count"] = "calculated"
            dimension_sources["blade_pitch_mm"] = "calculated"

        chord = pitch * (1.0 + overlap_ratio)
        blade_length = max(30.0, section_span_avail - (2 * side_clearance))
        dimension_sources["blade_chord_mm"] = "calculated"
        dimension_sources["blade_length_mm"] = "calculated"
        dimension_sources["overlap_pct"] = "calculated"
        dimension_sources["blade_thickness_mm"] = "user" if "blade_thickness_mm" in config else "calculated"

    # Overall height / width definitions
    # Chord relates to blade profile width across the face from leading edge to trailing edge.
    # Span/length is the dimension along shaft axis across the opening section.
    # Breadth/depth is profile thickness into airflow.
    dimension_sources["blade_width_mm"] = dimension_sources["blade_chord_mm"]
    dimension_sources["blade_height_mm"] = dimension_sources["blade_pitch_mm"]

    # Profile construction types (5 types)
    raw_type = str(config.get("blade_type", "Flat single-skin sheet blade"))
    # Normalize naming
    if "folded" in raw_type.lower():
        profile_type = "Folded single-skin blade"
    elif "double" in raw_type.lower():
        profile_type = "Double-skin hollow blade"
    elif "aerofoil" in raw_type.lower():
        profile_type = "Aerofoil blade"
    elif "custom" in raw_type.lower() or "z-profile" in raw_type.lower():
        profile_type = "Custom cross-section blade"
    else:
        profile_type = "Flat single-skin sheet blade"

    # Profile-specific calculations
    front_dev_w = chord
    rear_dev_w = 0.0
    stiffener_dev_w = 0.0
    stiffener_qty_per_blade = 0
    stiffener_thick = 0.0

    profile_details: Dict[str, Any] = {
        "profile_type": profile_type,
        "is_estimated": False,
        "profile_description": profile_type,
    }

    if profile_type == "Flat single-skin sheet blade":
        blade_depth = t_blade
        dev_width = chord
        profile_details.update({
            "cross_section": "Flat Sheet",
            "front_edge_dim_mm": t_blade,
            "rear_edge_dim_mm": t_blade,
            "flange_width_mm": 0.0,
            "developed_width_mm": round(dev_width, 2),
        })

    elif profile_type == "Folded single-skin blade":
        fold_angle = float(config.get("fold_angle_deg", 45.0))
        flange_left = float(config.get("flange_left_mm", 20.0))
        flange_right = float(config.get("flange_right_mm", 20.0))
        edge_return = float(config.get("edge_return_mm", 8.0))
        num_bends = int(config.get("num_bends", 4))
        web_width = float(config.get("web_width_mm", max(20.0, chord - flange_left - flange_right)))
        rad = math.radians(fold_angle)
        fold_depth = float(config.get("fold_depth_mm", max(5.0, flange_left * math.sin(rad))))
        blade_depth = max(fold_depth, t_blade)

        # Developed sheet width with bend allowances
        bend_allowance = num_bends * (0.4 * t_blade)
        dev_width = web_width + flange_left + flange_right + (2 * edge_return) + bend_allowance

        profile_details.update({
            "cross_section": "Folded Sheet with Edge Lips",
            "web_width_mm": web_width,
            "flange_left_mm": flange_left,
            "flange_right_mm": flange_right,
            "edge_return_mm": edge_return,
            "fold_angle_deg": fold_angle,
            "fold_depth_mm": round(fold_depth, 2),
            "num_bends": num_bends,
            "bend_allowance_mm": round(bend_allowance, 2),
            "developed_width_mm": round(dev_width, 2),
        })

    elif profile_type == "Double-skin hollow blade":
        front_skin_thick = float(config.get("front_skin_thick_mm", t_blade))
        rear_skin_thick = float(config.get("rear_skin_thick_mm", t_blade))
        overall_depth = float(config.get("overall_blade_depth_mm", 30.0))
        cavity_depth = max(0.0, overall_depth - front_skin_thick - rear_skin_thick)
        edge_flange_w = float(config.get("edge_flange_width_mm", 15.0))
        stiff_count = int(config.get("internal_stiffener_count", 2))
        stiff_thick = float(config.get("internal_stiffener_thick_mm", 2.0))
        stiff_w = float(config.get("internal_stiffener_width_mm", cavity_depth))

        blade_depth = overall_depth
        front_dev_w = chord + (2 * edge_flange_w)
        rear_dev_w = chord + (2 * edge_flange_w)
        dev_width = front_dev_w + rear_dev_w  # total skin developed width
        stiffener_dev_w = stiff_w
        stiffener_qty_per_blade = stiff_count
        stiffener_thick = stiff_thick

        profile_details.update({
            "cross_section": "Double Skin Hollow Cavity",
            "front_skin_thick_mm": front_skin_thick,
            "rear_skin_thick_mm": rear_skin_thick,
            "overall_blade_depth_mm": overall_depth,
            "internal_cavity_depth_mm": round(cavity_depth, 2),
            "edge_flange_width_mm": edge_flange_w,
            "internal_stiffener_count": stiff_count,
            "internal_stiffener_thick_mm": stiff_thick,
            "internal_stiffener_width_mm": stiff_w,
            "front_developed_width_mm": round(front_dev_w, 2),
            "rear_developed_width_mm": round(rear_dev_w, 2),
            "developed_width_mm": round(dev_width, 2),
        })

    elif profile_type == "Aerofoil blade":
        max_thick = float(config.get("max_profile_thickness_mm", max(20.0, chord * 0.15)))
        le_radius = float(config.get("leading_edge_radius_mm", 6.0))
        te_thick = float(config.get("trailing_edge_thickness_mm", 2.0))
        camber = float(config.get("camber_pct", 0.0))
        profile_def = str(config.get("profile_definition", "NACA 0015 (Symmetric Aerofoil)"))

        blade_depth = max_thick
        # NACA perimeter is approximately 2.05 to 2.10 * chord
        dev_factor = float(config.get("dev_factor", 2.1))
        dev_width = chord * dev_factor

        profile_details.update({
            "cross_section": "Aerofoil Profile",
            "profile_definition": profile_def,
            "max_profile_thickness_mm": max_thick,
            "leading_edge_radius_mm": le_radius,
            "trailing_edge_thickness_mm": te_thick,
            "camber_pct": camber,
            "dev_factor": dev_factor,
            "developed_width_mm": round(dev_width, 2),
            "is_estimated": True,  # Aerofoil developed sheet is an engineering approximation
        })

    else:  # Custom cross-section blade
        custom_shape = str(config.get("custom_profile_shape", "Z-profile"))
        profile_depth = float(config.get("profile_depth_mm", 25.0))
        web_dim = float(config.get("web_dimension_mm", chord * 0.6))
        flange_dim = float(config.get("flange_dimension_mm", 25.0))
        lip_dim = float(config.get("lip_dimension_mm", 10.0))
        dev_factor = float(config.get("developed_width_factor", 1.6))

        blade_depth = profile_depth
        if "z-profile" in custom_shape.lower():
            dev_width = web_dim + (2 * flange_dim) + (2 * lip_dim)
        elif "c-channel" in custom_shape.lower():
            dev_width = web_dim + (2 * flange_dim)
        elif "hat" in custom_shape.lower():
            dev_width = web_dim + (2 * flange_dim) + (2 * lip_dim)
        elif "double-v" in custom_shape.lower():
            dev_width = chord * 1.45
        else:
            dev_width = chord * dev_factor

        profile_details.update({
            "cross_section": f"Custom Cross-Section ({custom_shape})",
            "custom_profile_shape": custom_shape,
            "profile_depth_mm": profile_depth,
            "web_dimension_mm": web_dim,
            "flange_dimension_mm": flange_dim,
            "lip_dimension_mm": lip_dim,
            "developed_width_mm": round(dev_width, 2),
            "is_estimated": True,
        })

    # Breadth/depth source
    dimension_sources["blade_depth_mm"] = "user" if custom_breadth is not None else "calculated"

    # ── Weight and Volume Calculations ──
    # Formula: Weight (kg) = Length (mm) * Width (mm) * Thickness (mm) * Density (kg/m3) / 1,000,000,000
    if profile_type == "Double-skin hollow blade":
        front_thick = profile_details.get("front_skin_thick_mm", t_blade)
        rear_thick = profile_details.get("rear_skin_thick_mm", t_blade)
        front_skin_wt = blade_length * front_dev_w * front_thick * density / 1e9
        rear_skin_wt = blade_length * rear_dev_w * rear_thick * density / 1e9
        stiff_wt = stiffener_qty_per_blade * (blade_length * stiffener_dev_w * stiffener_thick * density / 1e9)
        single_blade_wt = front_skin_wt + rear_skin_wt + stiff_wt
        skin_volume_mm3 = (blade_length * front_dev_w * front_thick) + (blade_length * rear_dev_w * rear_thick) + (stiffener_qty_per_blade * blade_length * stiffener_dev_w * stiffener_thick)
        profile_details["front_skin_weight_kg"] = round(front_skin_wt, 3)
        profile_details["rear_skin_weight_kg"] = round(rear_skin_wt, 3)
        profile_details["stiffener_weight_kg"] = round(stiff_wt, 3)
    else:
        single_blade_wt = blade_length * dev_width * t_blade * density / 1e9
        skin_volume_mm3 = blade_length * dev_width * t_blade

    total_blades = count * n_sec
    total_blade_wt = single_blade_wt * total_blades

    # Sizing limits & suggested sections
    max_len_table = (rule_tables or {}).get("max_blade_length_table", DEFAULT_MAX_BLADE_LENGTH_TABLE)
    max_allowed_span = get_max_blade_length_for_thickness(t_blade, max_len_table)
    suggested_sections = max(1, math.ceil(W / max_allowed_span if not is_vertical else H / max_allowed_span))

    # Single Blade Schedule Row
    blade_schedule_rows = [{
        "mark": "B-01",
        "profile": profile_type,
        "orientation": orientation,
        "action": str(config.get("blade_action", "Opposed")),
        "span_mm": round(blade_length, 2),
        "chord_mm": round(chord, 2),
        "depth_mm": round(blade_depth, 2),
        "thickness_mm": round(t_blade, 2),
        "developed_width_mm": round(dev_width, 2),
        "qty": total_blades,
        "single_weight_kg": round(single_blade_wt, 3),
        "total_weight_kg": round(total_blade_wt, 2),
        "material": moc,
        "density_kg_m3": density,
        "is_estimated": bool(profile_details.get("is_estimated", False)),
    }]

    return {
        "mode": mode,
        "orientation": orientation,
        "blade_count": count,
        "blade_pitch_mm": round(pitch, 2),
        "blade_chord_mm": round(chord, 2),
        "blade_length_mm": round(blade_length, 2),
        "blade_span_mm": round(blade_length, 2),
        "blade_depth_mm": round(blade_depth, 2),
        "blade_breadth_mm": round(blade_depth, 2),
        "blade_width_mm": round(chord, 2),
        "blade_height_mm": round(pitch, 2),
        "blade_thickness_mm": round(t_blade, 2),
        "overlap_pct": round(overlap_pct, 2),
        "sections": n_sec,
        "suggested_sections": suggested_sections,
        "max_allowed_span_mm": max_allowed_span,
        "total_blades_all_sections": total_blades,
        "side_clearance_mm": round(side_clearance, 2),
        "end_clearance_mm": round(end_clearance, 2),
        "dimension_sources": dimension_sources,
        "profile_type": profile_type,
        "profile_details": profile_details,
        "developed_length_mm": round(blade_length, 2),
        "developed_width_mm": round(dev_width, 2),
        "skin_volume_mm3": round(skin_volume_mm3, 2),
        "single_blade_weight_kg": round(single_blade_wt, 3),
        "total_blade_weight_kg": round(total_blade_wt, 2),
        "blade_material_density": density,
        "blade_schedule": blade_schedule_rows,
        "open_angle_deg": float(config.get("open_angle_deg", 90.0)),
        "closed_angle_deg": float(config.get("closed_angle_deg", 0.0)),
    }


def evaluate_blade_geometry(
    height_mm: float,
    width_mm: float,
    blade_mode: str,
    target_pitch_mm: Optional[float],
    target_blade_count: Optional[int],
    manual_blade_count: Optional[int],
    manual_chord_mm: Optional[float],
    overlap_pct: float = 10.0,
    sections: int = 1,
    side_clearance_mm: float = 5.0,
    intermediate_support_thick_mm: float = 6.0,
    blade_thickness_mm: float = 1.6,
    max_length_table: Optional[List[Dict[str, float]]] = None,
) -> Dict[str, Any]:
    """
    Backward-compatible wrapper for existing geometry calls.
    Returns exact expected dict keys.
    """
    cfg = {
        "blade_mode": blade_mode,
        "target_pitch_mm": target_pitch_mm,
        "target_blade_count": target_blade_count,
        "blade_count": manual_blade_count,
        "blade_chord_mm": manual_chord_mm,
        "overlap_pct": overlap_pct,
        "sections": sections,
        "side_clearance_mm": side_clearance_mm,
        "intermediate_support_thick_mm": intermediate_support_thick_mm,
        "blade_thickness_mm": blade_thickness_mm,
    }
    rule_tables = {"max_blade_length_table": max_length_table} if max_length_table else None
    res = calculate_blade_geometry_and_construction(cfg, width_mm, height_mm, 180.0, rule_tables)
    return res


def validate_multi_blade_rules(
    config: Dict[str, Any],
    geometry: Dict[str, Any],
    total_weight_kg: float,
    rule_tables: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    """
    Validates multi-blade rules.
    Returns: (errors, warnings) where errors block quoting and warnings flag it.
    """
    errors: List[Dict[str, str]] = []
    warnings: List[Dict[str, str]] = []

    W = float(config.get("width_mm", 3000))
    H = float(config.get("height_mm", 3000))
    D = float(config.get("depth_mm", 180))
    blade_thick = float(config.get("blade_thickness_mm", 1.6))
    shaft_dia = float(config.get("shaft_diameter_mm", 16.0))
    sections = int(config.get("sections", 1))
    blade_type = str(config.get("blade_type", "Flat single-skin sheet blade"))
    blade_action = str(config.get("blade_action", "Opposed"))
    edge_seal = str(config.get("edge_seal", "Rubber"))
    temp_c = float(config.get("temperature_c", 40))
    velocity = float(config.get("max_velocity_mps", 10))
    material = str(config.get("material", "IS 2062"))
    finish = str(config.get("surface_finish", "Painted"))
    actuator_type = str(config.get("actuator_type", "Electric Actuator"))
    has_pos = bool(config.get("has_positioner", False))

    blade_len = float(geometry["blade_length_mm"])
    chord = float(geometry["blade_chord_mm"])
    pitch = float(geometry["blade_pitch_mm"])
    blade_count = int(geometry["blade_count"])
    max_span = float(geometry["max_allowed_span_mm"])
    sugg_sec = int(geometry["suggested_sections"])
    side_clearance = float(geometry.get("side_clearance_mm", 5.0))
    end_clearance = float(geometry.get("end_clearance_mm", 5.0))
    orientation = str(geometry.get("orientation", "Horizontal"))
    is_vertical = orientation.lower() == "vertical"

    # 1. Positive dimensions check
    for dim_name, dim_val in [
        ("Width", W), ("Height", H), ("Depth", D),
        ("Blade Length", blade_len), ("Blade Chord", chord),
        ("Blade Pitch", pitch), ("Blade Thickness", blade_thick)
    ]:
        if dim_val <= 0:
            errors.append({
                "field": dim_name.lower().replace(" ", "_"),
                "rule": "positive_dimension_required",
                "message": f"{dim_name} must be greater than zero (entered: {dim_val:.1f} mm).",
            })

    # 2. Thickness allowable limits
    limits = (rule_tables or {}).get("dimension_limits", DEFAULT_BLADE_DIMENSION_LIMITS)
    min_t = float(limits.get("min_blade_thickness_mm", 0.8))
    max_t = float(limits.get("max_blade_thickness_mm", 8.0))
    if blade_thick < min_t or blade_thick > max_t:
        errors.append({
            "field": "blade_thickness_mm",
            "rule": "thickness_out_of_bounds",
            "message": f"Blade thickness ({blade_thick:.1f} mm) must be between {min_t:.1f} mm and {max_t:.1f} mm.",
        })

    # 3. Minimum clearances
    min_side_clr = float(limits.get("min_side_clearance_mm", 2.0))
    min_end_clr = float(limits.get("min_end_clearance_mm", 2.0))
    if side_clearance < min_side_clr:
        errors.append({
            "field": "side_clearance_mm",
            "rule": "insufficient_side_clearance",
            "message": f"Side clearance ({side_clearance:.1f} mm) is below required minimum ({min_side_clr:.1f} mm).",
        })
    if end_clearance < min_end_clr:
        errors.append({
            "field": "end_clearance_mm",
            "rule": "insufficient_end_clearance",
            "message": f"End clearance ({end_clearance:.1f} mm) is below required minimum ({min_end_clr:.1f} mm).",
        })

    # 4. Blade fit inside frame
    mullion_thick = float(config.get("intermediate_support_thick_mm", 6.0))
    if not is_vertical:
        span_available = (W - ((sections - 1) * mullion_thick)) / sections
        stack_available = H
    else:
        span_available = (H - ((sections - 1) * mullion_thick)) / sections
        stack_available = W

    if (blade_len + 2 * side_clearance) > (span_available + 0.5):
        errors.append({
            "field": "blade_length_mm",
            "rule": "blade_span_exceeds_frame",
            "message": f"Blade length ({blade_len:.1f} mm) + side clearances ({2 * side_clearance:.1f} mm) exceeds available frame opening ({span_available:.1f} mm).",
        })

    if (blade_count * pitch) > (stack_available + 2.0):
        errors.append({
            "field": "blade_count",
            "rule": "blade_stack_exceeds_frame",
            "message": f"Total blade stack height ({blade_count * pitch:.1f} mm) exceeds usable frame opening ({stack_available:.1f} mm).",
        })

    # 5. Rule: Max blade length by blade thickness
    if blade_len > max_span:
        errors.append({
            "field": "sections",
            "rule": "max_blade_length_exceeded",
            "message": f"Blade span ({blade_len:.0f} mm) exceeds maximum allowable limit ({max_span:.0f} mm) for {blade_thick:.1f} mm thickness. Damper must be split into at least {sugg_sec} sections.",
        })

    # 6. Rule: Blade count minimum
    if blade_count < 2:
        errors.append({
            "field": "blade_count",
            "rule": "min_blade_count",
            "message": "Minimum 2 blades are required for a multi-blade damper.",
        })

    # 7. Rule: Pitch must be <= chord so blades overlap when closed
    if pitch > chord:
        errors.append({
            "field": "blade_pitch_mm",
            "rule": "pitch_exceeds_chord",
            "message": f"Blade pitch ({pitch:.1f} mm) exceeds chord ({chord:.1f} mm). Blades will not overlap when closed, causing open gaps.",
        })

    # 8. Profile-specific construction validation
    prof_details = geometry.get("profile_details", {})
    if "Double" in blade_type:
        cavity = float(prof_details.get("internal_cavity_depth_mm", 10.0))
        if cavity <= 0:
            errors.append({
                "field": "overall_blade_depth_mm",
                "rule": "invalid_cavity_depth",
                "message": "Internal cavity depth must be greater than 0 mm (overall depth must exceed front + rear skin thicknesses).",
            })
    elif "Folded" in blade_type:
        web_w = float(prof_details.get("web_width_mm", 50.0))
        fold_ang = float(prof_details.get("fold_angle_deg", 45.0))
        if web_w <= 0:
            errors.append({
                "field": "web_width_mm",
                "rule": "invalid_web_width",
                "message": "Folded blade web width must be positive.",
            })
        if fold_ang <= 0 or fold_ang >= 90:
            errors.append({
                "field": "fold_angle_deg",
                "rule": "invalid_fold_angle",
                "message": "Fold angle must be between 1° and 89°.",
            })

    # 9. Rule: Shaft diameter minimum
    shaft_table = (rule_tables or {}).get("shaft_diameter_table", DEFAULT_SHAFT_DIAMETER_TABLE)
    min_shaft = get_min_shaft_diameter_for_length(blade_len, shaft_table)
    if shaft_dia < min_shaft:
        errors.append({
            "field": "shaft_diameter_mm",
            "rule": "shaft_diameter_too_small",
            "message": f"Shaft diameter ({shaft_dia:.1f} mm) is below the minimum required ({min_shaft:.1f} mm) for blade span {blade_len:.0f} mm.",
        })

    # ── Warnings ──
    # Aspect ratio outside 0.25 to 4.0
    aspect_ratio = W / H if H > 0 else 1.0
    if aspect_ratio < 0.25 or aspect_ratio > 4.0:
        warnings.append({
            "field": "aspect_ratio",
            "rule": "aspect_ratio_out_of_range",
            "message": f"Aspect ratio W/H ({aspect_ratio:.2f}) is outside recommended engineering bounds (0.25 to 4.0).",
        })

    # High velocity for blade type
    if "single" in blade_type.lower() and velocity > 12.0:
        warnings.append({
            "field": "max_velocity_mps",
            "rule": "high_velocity_single_skin",
            "message": f"Airflow velocity {velocity:.1f} m/s is high for single-skin blades (> 12 m/s). Consider Aerofoil blades to avoid flutter and fatigue.",
        })
    elif "double" in blade_type.lower() and velocity > 16.0:
        warnings.append({
            "field": "max_velocity_mps",
            "rule": "high_velocity_double_skin",
            "message": f"Airflow velocity {velocity:.1f} m/s exceeds 16 m/s for double skin blades. Aerofoil profile recommended.",
        })
    elif "aerofoil" in blade_type.lower() and velocity > 25.0:
        warnings.append({
            "field": "max_velocity_mps",
            "rule": "extreme_velocity",
            "message": f"Airflow velocity {velocity:.1f} m/s is extremely high (> 25 m/s). Check dynamic pressure and blade deflection.",
        })

    # Temperature limits by seal and material
    if edge_seal == "Rubber" and temp_c > 80.0:
        warnings.append({
            "field": "edge_seal",
            "rule": "rubber_seal_temperature_limit",
            "message": f"Rubber (EPDM/Neoprene) edge seals degrade above 80 °C (operating at {temp_c:.0f} °C). Select Metal or Ceramic Fibre seals.",
        })
    if "Painted" in finish and temp_c > 150.0:
        warnings.append({
            "field": "surface_finish",
            "rule": "painted_finish_temperature_limit",
            "message": f"Standard industrial paint blisters above 150 °C (operating at {temp_c:.0f} °C). Select Heat-Resistant coating or Stainless Steel.",
        })
    if "IS 2062" in material and temp_c > 350.0:
        warnings.append({
            "field": "material",
            "rule": "is2062_temperature_limit",
            "message": f"Carbon steel IS 2062 loses yield strength above 350 °C. Upgrade material to SS 304 or SS 316.",
        })

    # Opposed vs Parallel suitability
    if blade_action == "Parallel" and (has_pos or "Electric" in actuator_type):
        warnings.append({
            "field": "blade_action",
            "rule": "parallel_action_for_modulating",
            "message": "Opposed blade action provides superior linear control for modulating service; Parallel action is best suited for 2-position (open/close) service.",
        })

    # Total weight limit
    if total_weight_kg > 3000.0:
        warnings.append({
            "field": "total_weight_kg",
            "rule": "heavy_damper_warning",
            "message": f"Total damper weight ({total_weight_kg:.0f} kg) exceeds 3000 kg. Ensure heavy lifting lugs and reinforced duct support structures.",
        })

    return errors, warnings


def calculate_multi_blade_damper_cost(
    config: Dict[str, Any],
    rates_data: Dict[str, Any],
    damper_quantity: int = 1,
    markup_pct_override: Optional[float] = None,
    per_line_rate_overrides: Optional[Dict[int, float]] = None,
    rule_tables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Costing and BOM calculation engine for Multi-Blade (Louvered) Damper.
    Generates exact 16-column BOM lines compatible with the existing QuoteLine table and export templates.
    Integrates custom blade geometry, developed sheet widths, and profile-specific BOM construction.
    """
    W = float(config.get("width_mm", 3000.0))
    H = float(config.get("height_mm", 3000.0))
    D = float(config.get("depth_mm", 180.0))
    t_frame = float(config.get("frame_thickness_mm", 3.0))
    shaft_dia = float(config.get("shaft_diameter_mm", 16.0))
    sections = max(1, int(config.get("sections", 1)))

    frame_const = str(config.get("frame_construction", "Channel Box"))
    flange_type = str(config.get("flange_type", "Angle"))
    flange_width = float(config.get("flange_width_mm", 40.0))
    flange_thick = float(config.get("flange_thickness_mm", 5.0))
    moc = str(config.get("material", "IS 2062"))
    shaft_moc = str(config.get("shaft_material", "EN8"))
    edge_seal = str(config.get("edge_seal", "Rubber"))
    side_seal = str(config.get("side_seal", "Stainless Steel"))
    bearing_type = str(config.get("bearing_type", "Bush"))
    linkage_type = str(config.get("linkage_type", "Side-mounted crank & tie rod"))
    actuator_type = str(config.get("actuator_type", "Electric Actuator"))
    has_pos = bool(config.get("has_positioner", False))
    has_limit_sw = bool(config.get("has_limit_switch", False))
    has_solenoid = bool(config.get("has_solenoid", False))

    # Retrieve Rates & Densities
    material_rates = rates_data.get("material_rates", {})
    labour_rates = rates_data.get("labour_rates", {})
    fab_rate_per_kg = float(rates_data.get("fabrication_rate_per_kg", 96.0))
    finishing_rate_per_kg = float(rates_data.get("finishing_rate_per_kg", 20.0))
    markup_pct = markup_pct_override if markup_pct_override is not None else float(rates_data.get("default_markup_pct", 10.0))

    mb_rates = rates_data.get("multi_blade_rates") or DEFAULT_MULTI_BLADE_RATES
    bo_prices = mb_rates.get("bought_out_prices", DEFAULT_MULTI_BLADE_RATES["bought_out_prices"])
    auto_prices = mb_rates.get("automation_prices", DEFAULT_MULTI_BLADE_RATES["automation_prices"])

    density_table = (rule_tables or {}).get("material_densities") or mb_rates.get("material_densities", DEFAULT_MATERIAL_DENSITIES)
    density_moc = get_material_density(moc, density_table)
    density_shaft = get_material_density(shaft_moc, density_table)

    mat_rate_moc = float(material_rates.get(moc, 72.0))
    mat_rate_shaft = float(material_rates.get(shaft_moc, 95.0))
    l_rate_moc = float(labour_rates.get(moc, 10.0))
    l_rate_shaft = float(labour_rates.get(shaft_moc, 1.0))

    per_line_overrides = per_line_rate_overrides or {}

    # Comprehensive blade geometry calculation
    geometry = calculate_blade_geometry_and_construction(
        config=config,
        frame_width=W,
        frame_height=H,
        frame_depth=D,
        rule_tables=rule_tables,
    )

    blade_count = geometry["blade_count"]
    chord = geometry["blade_chord_mm"]
    pitch = geometry["blade_pitch_mm"]
    blade_length = geometry["blade_length_mm"]
    total_blades = geometry["total_blades_all_sections"]
    t_blade = geometry["blade_thickness_mm"]
    profile_type = geometry["profile_type"]
    prof_details = geometry["profile_details"]

    # ── BOM Template Construction ──
    bom_parts_def = []

    # 1. Frame Top Channel
    bom_parts_def.append({
        "name": "Frame Top Channel", "is_round": False,
        "dim_1": W, "dim_2": D, "dim_3": t_frame, "qty": 1,
        "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
        "density": density_moc, "machining": 500.0, "rolling": 0.0,
    })
    # 2. Frame Bottom Channel
    bom_parts_def.append({
        "name": "Frame Bottom Channel", "is_round": False,
        "dim_1": W, "dim_2": D, "dim_3": t_frame, "qty": 1,
        "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
        "density": density_moc, "machining": 500.0, "rolling": 0.0,
    })
    # 3. Frame Side Channels (2 off)
    bom_parts_def.append({
        "name": "Frame Side Channels", "is_round": False,
        "dim_1": H, "dim_2": D, "dim_3": t_frame, "qty": 2,
        "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
        "density": density_moc, "machining": 800.0, "rolling": 0.0,
    })

    # 4. Flanges (if specified)
    if flange_type != "None":
        n_flange_faces = 2
        bom_parts_def.append({
            "name": f"Flanges - Top & Bottom ({flange_type})", "is_round": False,
            "dim_1": W + (2 * flange_width), "dim_2": flange_width, "dim_3": flange_thick,
            "qty": 2 * n_flange_faces, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 300.0, "rolling": 0.0,
        })
        bom_parts_def.append({
            "name": f"Flanges - Sides ({flange_type})", "is_round": False,
            "dim_1": H, "dim_2": flange_width, "dim_3": flange_thick,
            "qty": 2 * n_flange_faces, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 300.0, "rolling": 0.0,
        })

    # 5. Intermediate Supports (Mullions)
    if sections > 1:
        bom_parts_def.append({
            "name": "Intermediate Section Divider Mullion", "is_round": False,
            "dim_1": H, "dim_2": D, "dim_3": t_frame, "qty": sections - 1,
            "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 600.0, "rolling": 0.0,
        })

    # 6. Damper Blades - Generated by Profile Type
    if profile_type == "Double-skin hollow blade":
        front_w = prof_details.get("front_developed_width_mm", chord)
        rear_w = prof_details.get("rear_developed_width_mm", chord)
        front_t = prof_details.get("front_skin_thick_mm", t_blade)
        rear_t = prof_details.get("rear_skin_thick_mm", t_blade)
        stiff_qty = prof_details.get("internal_stiffener_count", 0)
        stiff_w = prof_details.get("internal_stiffener_width_mm", 0.0)
        stiff_t = prof_details.get("internal_stiffener_thick_mm", 2.0)

        bom_parts_def.append({
            "name": "Damper Blade - Front Skins (Double Skin)", "is_round": False,
            "dim_1": blade_length, "dim_2": front_w, "dim_3": front_t,
            "qty": total_blades, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 250.0, "rolling": 0.0,
        })
        bom_parts_def.append({
            "name": "Damper Blade - Rear Skins (Double Skin)", "is_round": False,
            "dim_1": blade_length, "dim_2": rear_w, "dim_3": rear_t,
            "qty": total_blades, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 250.0, "rolling": 0.0,
        })
        if stiff_qty > 0 and stiff_w > 0:
            bom_parts_def.append({
                "name": "Damper Blade Internal Stiffeners", "is_round": False,
                "dim_1": blade_length, "dim_2": stiff_w, "dim_3": stiff_t,
                "qty": total_blades * stiff_qty, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
                "density": density_moc, "machining": 100.0, "rolling": 0.0,
            })

    elif profile_type == "Folded single-skin blade":
        dev_w = prof_details.get("developed_width_mm", chord * 1.45)
        num_bends = prof_details.get("num_bends", 4)
        bom_parts_def.append({
            "name": f"Damper Blade Skins (Folded Single Skin - {num_bends} Bends)", "is_round": False,
            "dim_1": blade_length, "dim_2": dev_w, "dim_3": t_blade,
            "qty": total_blades, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 250.0, "rolling": 0.0,
        })

    elif profile_type == "Aerofoil blade":
        dev_w = prof_details.get("developed_width_mm", chord * 2.1)
        bom_parts_def.append({
            "name": "Damper Blade Skins (Aerofoil Blade)", "is_round": False,
            "dim_1": blade_length, "dim_2": dev_w, "dim_3": t_blade,
            "qty": total_blades, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 250.0, "rolling": 150.0,
        })

    elif profile_type == "Custom cross-section blade":
        dev_w = prof_details.get("developed_width_mm", chord * 1.6)
        c_shape = prof_details.get("custom_profile_shape", "Custom")
        bom_parts_def.append({
            "name": f"Damper Blade Skins (Custom Cross-Section: {c_shape})", "is_round": False,
            "dim_1": blade_length, "dim_2": dev_w, "dim_3": t_blade,
            "qty": total_blades, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 250.0, "rolling": 50.0,
        })

    else:  # Flat single-skin
        dev_w = chord
        bom_parts_def.append({
            "name": "Damper Blade Skins (Flat Single-Skin Sheet)", "is_round": False,
            "dim_1": blade_length, "dim_2": dev_w, "dim_3": t_blade,
            "qty": total_blades, "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
            "density": density_moc, "machining": 250.0, "rolling": 0.0,
        })

    # 7. Blade Shafts (Round)
    shaft_length = blade_length + 200.0
    bom_parts_def.append({
        "name": f"Blade Through-Shafts (Dia {shaft_dia:.0f} mm)", "is_round": True,
        "dim_1": shaft_dia, "dim_2": shaft_length, "dim_3": 0.0,
        "qty": total_blades, "moc": shaft_moc, "mat_rate": mat_rate_shaft, "labour_rate": l_rate_shaft,
        "density": density_shaft, "machining": 450.0, "rolling": 0.0,
    })

    # 8. Actuator Mount Bracket
    bom_parts_def.append({
        "name": "Actuator Mounting Stool & Drive Bracket", "is_round": False,
        "dim_1": 350.0, "dim_2": 250.0, "dim_3": 6.0, "qty": 1,
        "moc": moc, "mat_rate": mat_rate_moc, "labour_rate": l_rate_moc,
        "density": density_moc, "machining": 1200.0, "rolling": 0.0,
    })

    # Compute Fabricated Lines
    total_steel_weight = 0.0
    total_rm_cost = 0.0
    total_mfg_cost = 0.0
    calculated_lines = []

    single_blade_weight_kg = geometry.get("single_blade_weight_kg", 0.0)

    for idx, p in enumerate(bom_parts_def):
        a = float(p["dim_1"])
        b = float(p["dim_2"])
        t = float(p["dim_3"])
        qty = int(p["qty"])
        is_round = bool(p["is_round"])
        moc_line = p["moc"]
        rho = float(p.get("density", 7850.0))

        if is_round:
            weight = 0.785 * a * a * b * (rho / 1e9) * qty
            plate_labour = 0.0
            plate_labour_rate = 0.0
        else:
            weight = a * b * t * (rho / 1e9) * qty
            plate_labour_rate = float(p["labour_rate"])
            plate_labour = (a + b) * 2.0 * t * plate_labour_rate / 1000.0

        base_mat_rate = float(p["mat_rate"])
        line_mat_rate = per_line_overrides.get(idx, base_mat_rate)

        rm_cost = weight * line_mat_rate
        per_pc_machining = float(p["machining"])
        rolling_cost = float(p["rolling"])
        mfg_per_pc = plate_labour + per_pc_machining + rolling_cost
        mfg_cost_line = mfg_per_pc * qty
        line_total = rm_cost + mfg_cost_line

        total_steel_weight += weight
        total_rm_cost += rm_cost
        total_mfg_cost += mfg_cost_line

        calculated_lines.append({
            "part_id": None,
            "sr_no": idx + 1,
            "part_name": p["name"],
            "is_round": is_round,
            "dim_1": a,
            "dim_2": b,
            "dim_3": t,
            "qty": qty,
            "weight": round(weight, 3),
            "moc": moc_line,
            "material_rate": line_mat_rate,
            "base_material_rate": base_mat_rate,
            "is_rate_overridden": (line_mat_rate != base_mat_rate),
            "rm_cost": round(rm_cost, 2),
            "plate_labour_rate": plate_labour_rate,
            "plate_labour_cost": round(plate_labour, 2),
            "per_piece_machining": per_pc_machining,
            "rolling_cost": rolling_cost,
            "mfg_cost_total": round(mfg_cost_line, 2),
            "line_total": round(line_total, 2),
            "is_scaled": False,
        })

    # ── Bought-Out Lines ──
    bearing_unit_price = float(bo_prices.get("bush_bearing", 450.0))
    if "Ball" in bearing_type:
        bearing_unit_price = float(bo_prices.get("ball_bearing", 1200.0))
    elif "Sealed" in bearing_type:
        bearing_unit_price = float(bo_prices.get("sealed_bearing", 1800.0))
    num_bushes = 2 * total_blades
    bushes_cost = num_bushes * bearing_unit_price

    num_cranks = total_blades if "crank" in linkage_type.lower() else 0
    crank_unit_price = float(bo_prices.get("crank_lever", 650.0))
    cranks_cost = num_cranks * crank_unit_price

    tie_rod_meters = (H / 1000.0) * sections if "tie rod" in linkage_type.lower() else 0.0
    tie_rod_cost = tie_rod_meters * float(bo_prices.get("tie_rod_per_m", 350.0))

    edge_seal_rate = 0.0
    if edge_seal == "Rubber":
        edge_seal_rate = float(bo_prices.get("edge_seal_rubber_per_m", 180.0))
    elif edge_seal == "Metal":
        edge_seal_rate = float(bo_prices.get("edge_seal_metal_per_m", 420.0))
    elif edge_seal == "Ceramic Fibre":
        edge_seal_rate = float(bo_prices.get("edge_seal_ceramic_per_m", 750.0))

    edge_seal_meters = (blade_length / 1000.0) * total_blades if edge_seal != "None" else 0.0
    edge_seal_cost = edge_seal_meters * edge_seal_rate

    side_seal_rate = 0.0
    if side_seal == "Stainless Steel":
        side_seal_rate = float(bo_prices.get("side_seal_ss_per_m", 380.0))
    elif side_seal == "Flexible":
        side_seal_rate = float(bo_prices.get("side_seal_flexible_per_m", 220.0))

    side_seal_meters = 2.0 * (H / 1000.0) * sections if side_seal != "None" else 0.0
    side_seal_cost = side_seal_meters * side_seal_rate

    hardware_cost = float(bo_prices.get("hardware_lump", 15000.0))
    nameplate_cost = float(bo_prices.get("nameplate", 800.0))
    finishing_cost = total_steel_weight * finishing_rate_per_kg

    total_bought_out_cost = (
        bushes_cost + cranks_cost + tie_rod_cost +
        edge_seal_cost + side_seal_cost + hardware_cost + nameplate_cost + finishing_cost
    )

    # ── Automation Lines ──
    actuator_cost = 0.0
    if "Electric" in actuator_type:
        actuator_cost = float(auto_prices.get("electric_actuator", 120000.0))
    elif "Spring" in actuator_type:
        actuator_cost = float(auto_prices.get("pneumatic_spring_return", 68000.0))
    elif "Pneumatic" in actuator_type:
        actuator_cost = float(auto_prices.get("pneumatic_double_acting", 45000.0))
    else:
        actuator_cost = float(auto_prices.get("manual_quadrant", 8500.0))

    positioner_cost = float(auto_prices.get("positioner", 42000.0)) if has_pos else 0.0
    limit_sw_cost = float(auto_prices.get("limit_switch", 14000.0)) if has_limit_sw else 0.0
    solenoid_cost = float(auto_prices.get("solenoid_valve", 18000.0)) if has_solenoid else 0.0

    total_automation_cost = actuator_cost + positioner_cost + limit_sw_cost + solenoid_cost

    # ── Fabrication ──
    total_fabrication_cost = total_steel_weight * fab_rate_per_kg

    # ── Unit & Batch Totals ──
    unit_basic_cost = total_rm_cost + total_mfg_cost + total_bought_out_cost
    unit_total_cost = unit_basic_cost + total_automation_cost + total_fabrication_cost
    unit_quoted_price = round(unit_total_cost * (1.0 + markup_pct / 100.0), 2)
    margin_pct = ((unit_quoted_price - unit_total_cost) / unit_quoted_price) * 100.0 if unit_quoted_price > 0 else 0.0

    # ── Free Area % Calculation ──
    duct_gross_area = (W * H)
    frame_clear_w = max(10.0, W - (2 * t_frame) - ((sections - 1) * t_frame))
    frame_clear_h = max(10.0, H - (2 * t_frame))
    open_blade_proj_area = (total_blades * t_blade * blade_length)
    free_area_mm2 = max(0.0, (frame_clear_w * frame_clear_h) - open_blade_proj_area)
    free_area_pct = round((free_area_mm2 / duct_gross_area) * 100.0, 1) if duct_gross_area > 0 else 0.0

    batch_weight_kg = total_steel_weight * damper_quantity
    batch_rm_cost = total_rm_cost * damper_quantity
    batch_mfg_cost = total_mfg_cost * damper_quantity
    batch_bought_out_cost = total_bought_out_cost * damper_quantity
    batch_basic_cost = unit_basic_cost * damper_quantity
    batch_automation_cost = total_automation_cost * damper_quantity
    batch_fabrication_cost = total_fabrication_cost * damper_quantity
    batch_total_cost = unit_total_cost * damper_quantity
    batch_quoted_price = round(unit_quoted_price * damper_quantity, 2)

    # Validation rules
    errors, warnings = validate_multi_blade_rules(
        config=config,
        geometry=geometry,
        total_weight_kg=total_steel_weight,
        rule_tables=rule_tables,
    )

    is_verified = bool(mb_rates.get("is_verified", False))

    derived_results = {
        "blade_count": blade_count,
        "total_blades_all_sections": total_blades,
        "blade_pitch_mm": pitch,
        "blade_chord_mm": chord,
        "blade_length_mm": blade_length,
        "blade_thickness_mm": t_blade,
        "blade_breadth_depth_mm": geometry.get("blade_depth_mm", t_blade),
        "blade_developed_width_mm": geometry.get("developed_width_mm", chord),
        "free_area_pct": free_area_pct,
        "open_angle_deg": geometry.get("open_angle_deg", 90.0),
        "closed_angle_deg": geometry.get("closed_angle_deg", 0.0),
        "single_blade_weight_kg": round(single_blade_weight_kg, 3),
        "total_blade_material_weight_kg": round(geometry.get("total_blade_weight_kg", 0.0), 2),
        "total_weight_kg": round(total_steel_weight, 2),
        "number_of_shafts": total_blades,
        "number_of_bushes": num_bushes,
        "number_of_cranks": num_cranks,
        "edge_seal_length_m": round(edge_seal_meters, 2),
        "side_seal_length_m": round(side_seal_meters, 2),
        "sections": sections,
        "dimension_sources": geometry.get("dimension_sources", {}),
        "is_estimated_profile": bool(prof_details.get("is_estimated", False)),
    }

    return {
        "damper_type": "multi_blade",
        "damper_type_name": "Multi-Blade (Louvered) Damper",
        "width_mm": W,
        "height_mm": H,
        "depth_mm": D,
        "damper_quantity": damper_quantity,
        "multi_blade_config": config,
        "geometry": geometry,
        "blade_schedule": geometry.get("blade_schedule", []),
        "derived_results": derived_results,
        "validation_errors": errors,
        "validation_warnings": warnings,
        "can_quote": len(errors) == 0,
        "is_data_verified": is_verified,
        "placeholder_notice": None if is_verified else "Placeholder multi-blade data: not company-verified",

        # Unit Cost Summary
        "total_weight_kg": round(total_steel_weight, 2),
        "raw_material_cost": round(total_rm_cost, 2),
        "mfg_cost": round(total_mfg_cost, 2),
        "bought_out_cost": round(total_bought_out_cost, 2),
        "basic_cost": round(unit_basic_cost, 2),
        "automation_cost": round(total_automation_cost, 2),
        "fabrication_cost": round(total_fabrication_cost, 2),
        "total_cost": round(unit_total_cost, 2),
        "markup_pct": round(markup_pct, 2),
        "margin_pct": round(margin_pct, 2),
        "quoted_price": round(unit_quoted_price, 2),

        # Batch Totals
        "batch_totals": {
            "quantity": damper_quantity,
            "total_weight_kg": round(batch_weight_kg, 2),
            "raw_material_cost": round(batch_rm_cost, 2),
            "mfg_cost": round(batch_mfg_cost, 2),
            "bought_out_cost": round(batch_bought_out_cost, 2),
            "basic_cost": round(batch_basic_cost, 2),
            "automation_cost": round(batch_automation_cost, 2),
            "fabrication_cost": round(batch_fabrication_cost, 2),
            "total_cost": round(batch_total_cost, 2),
            "quoted_price": round(batch_quoted_price, 2),
        },

        "is_scaled": True,
        "lines": calculated_lines,
    }
