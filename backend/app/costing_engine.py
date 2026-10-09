import math
import ast
import operator as _op
from typing import Dict, Any, List, Optional

# ── Safe expression evaluator ────────────────────────────────────────────
# Whitelisted AST node types - NO eval() used anywhere
_SAFE_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Num, ast.Constant,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.FloorDiv, ast.Mod,
    ast.USub, ast.UAdd, ast.Name, ast.Load,
)

def _safe_eval_node(node, variables: dict):
    """Recursively evaluate a whitelisted AST node."""
    if isinstance(node, ast.Expression):
        return _safe_eval_node(node.body, variables)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Num):          # Python 3.7 compat
        return node.n
    if isinstance(node, ast.Name):
        if node.id not in variables:
            raise ValueError(f"Unknown variable '{node.id}'. Allowed: {list(variables.keys())}")
        return variables[node.id]
    if isinstance(node, ast.BinOp):
        ops = {ast.Add: _op.add, ast.Sub: _op.sub, ast.Mult: _op.mul,
               ast.Div: _op.truediv, ast.Pow: _op.pow,
               ast.FloorDiv: _op.floordiv, ast.Mod: _op.mod}
        fn = ops.get(type(node.op))
        if fn is None:
            raise ValueError(f"Unsupported operator {type(node.op).__name__}")
        return fn(_safe_eval_node(node.left, variables), _safe_eval_node(node.right, variables))
    if isinstance(node, ast.UnaryOp):
        if isinstance(node.op, ast.USub):
            return -_safe_eval_node(node.operand, variables)
        if isinstance(node.op, ast.UAdd):
            return +_safe_eval_node(node.operand, variables)
        if isinstance(node.op, ast.Not):
            return not _safe_eval_node(node.operand, variables)
    if isinstance(node, ast.BoolOp):
        values = [_safe_eval_node(value, variables) for value in node.values]
        return all(values) if isinstance(node.op, ast.And) else any(values)
    if isinstance(node, ast.Compare):
        left = _safe_eval_node(node.left, variables)
        comparisons = {
            ast.Eq: _op.eq, ast.NotEq: _op.ne, ast.Lt: _op.lt,
            ast.LtE: _op.le, ast.Gt: _op.gt, ast.GtE: _op.ge,
        }
        for operator, comparator in zip(node.ops, node.comparators):
            right = _safe_eval_node(comparator, variables)
            compare = comparisons.get(type(operator))
            if compare is None or not compare(left, right):
                return False
            left = right
        return True
    raise ValueError(f"Disallowed expression node: {type(node).__name__}")

def safe_eval_formula(expr: str, variables: dict) -> float:
    """
    Evaluate a formula string with whitelisted AST nodes only.
    Variables: W, H, D, nR (floats). Returns float.
    Raises ValueError on any unsafe or unknown construct.
    """
    if len(expr) > 256:
        raise ValueError("Formula is too long")
    if set(variables) != {"W", "H", "D", "nR"}:
        raise ValueError("Formula variables must be W, H, D, and nR")
    try:
        tree = ast.parse(expr.strip(), mode='eval')
    except SyntaxError as e:
        raise ValueError(f"Formula syntax error: {e}")
    for node in ast.walk(tree):
        if not isinstance(node, _SAFE_NODES):
            raise ValueError(f"Disallowed AST node type: {type(node).__name__}")
        if isinstance(node, ast.Name) and node.id not in {"W", "H", "D", "nR"}:
            raise ValueError(f"Unknown formula variable '{node.id}'")
        if isinstance(node, ast.Constant) and (isinstance(node.value, bool) or not isinstance(node.value, (int, float)) or abs(node.value) > 1e12):
            raise ValueError("Formula constants must be finite numeric values no greater than 1e12")
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow):
            if not isinstance(node.right, (ast.Constant, ast.Num)) or abs(float(node.right.value if isinstance(node.right, ast.Constant) else node.right.n)) > 12:
                raise ValueError("Formula exponents must be numeric constants between -12 and 12")
    try:
        result = float(_safe_eval_node(tree, variables))
    except (ArithmeticError, OverflowError) as exc:
        raise ValueError("Formula evaluation failed") from exc
    if not math.isfinite(result):
        raise ValueError("Formula result must be finite")
    return result


def safe_eval_condition(expr: str, variables: dict) -> bool:
    """Evaluate validation predicates without calls, attributes, or arbitrary code."""
    try:
        tree = ast.parse(expr.strip(), mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Condition syntax error: {exc}")
    allowed = _SAFE_NODES + (ast.Compare, ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
                             ast.BoolOp, ast.And, ast.Or, ast.Not)
    for node in ast.walk(tree):
        if not isinstance(node, allowed):
            raise ValueError(f"Disallowed condition node: {type(node).__name__}")
    return bool(_safe_eval_node(tree, variables))

# ── Costing Engine ───────────────────────────────────────────────────

def calculate_damper_cost(
    width_mm: float,
    height_mm: float,
    depth_mm: float,
    parts_data: List[Dict[str, Any]],
    rates_data: Dict[str, Any],
    damper_quantity: int = 1,
    markup_pct_override: Optional[float] = None,
    per_line_rate_overrides: Optional[Dict[int, float]] = None,
    size_limits: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Costing and scaling engine for Rack and Pinion Sliding-Flap Damper.
    Loads part specs, scaling codes, and rates dynamically from seed data/DB.
    Uses math.floor(x + 0.5) for quantity scaling.
    Rounds to 2 decimal places only at the final result.
    Size limits come from size_limits dict (admin-editable); defaults match originals.
    Custom scale codes evaluate a safe formula via safe_eval_formula.
    """
    # 1. Input Validation against admin-editable limits
    lim = size_limits or {}
    w_min = lim.get("width_min_mm", 1000.0)
    w_max = lim.get("width_max_mm", 6000.0)
    h_min = lim.get("height_min_mm", 1000.0)
    h_max = lim.get("height_max_mm", 6000.0)
    d_min = lim.get("depth_min_mm", 300.0)
    d_max = lim.get("depth_max_mm", 800.0)

    if not (w_min <= width_mm <= w_max):
        raise ValueError(f"Width {width_mm} mm out of range ({w_min} to {w_max} mm)")
    if not (h_min <= height_mm <= h_max):
        raise ValueError(f"Height {height_mm} mm out of range ({h_min} to {h_max} mm)")
    if not (d_min <= depth_mm <= d_max):
        raise ValueError(f"Depth {depth_mm} mm out of range ({d_min} to {d_max} mm)")
    if damper_quantity < 1:
        raise ValueError(f"Quantity {damper_quantity} must be >= 1")

    material_rates = rates_data.get("material_rates", {})
    labour_rates = rates_data.get("labour_rates", {})
    bought_out_prices = rates_data.get("bought_out_prices", {})
    automation_prices = rates_data.get("automation_prices", {})
    
    fab_rate_per_kg = float(rates_data.get("fabrication_rate_per_kg", 96.0))
    finishing_rate_per_kg = float(rates_data.get("finishing_rate_per_kg", 20.0))
    markup_pct = markup_pct_override if markup_pct_override is not None else float(rates_data.get("default_markup_pct", 10.0))
    calibration = rates_data.get("calibration", {})

    def calibrated(block: str, amount: float) -> float:
        setting = calibration.get(block, {})
        return amount * float(setting.get("factor", 1.0)) if setting.get("enabled", False) else amount
    
    # 2. Scaling Factors
    w_factor = width_mm / 3000.0
    h_factor = height_mm / 3000.0
    d_factor = depth_mm / 450.0
    p_factor = (width_mm + height_mm) / 6000.0
    nR = 2 * math.ceil(width_mm / 1500.0)
    r_factor = nR / 4.0
    
    factors = {
        "w": w_factor,
        "h": h_factor,
        "d": d_factor,
        "p": p_factor,
        "r": r_factor,
        "blank": 1.0,
        "": 1.0
    }
    
    is_overall_scaled = (width_mm != 3000.0 or height_mm != 3000.0 or depth_mm != 450.0)
    per_line_overrides = per_line_rate_overrides or {}
    
    total_steel_weight = 0.0
    total_rm_cost = 0.0
    total_mfg_cost = 0.0
    calculated_lines = []
    
    # 3. Fabricated Parts Iteration
    for idx, p in enumerate(parts_data):
        dim1_code = p.get("dim1_scale_code", "blank") or "blank"
        dim2_code = p.get("dim2_scale_code", "blank") or "blank"
        qty_code = p.get("qty_scale_code", "blank") or "blank"

        # Resolve custom formulas
        custom_vars = {"W": width_mm, "H": height_mm, "D": depth_mm, "nR": float(nR)}
        if dim1_code == "custom":
            formula = p.get("dim1_custom_formula") or "1.0"
            f1 = safe_eval_formula(formula, custom_vars)
        else:
            f1 = factors.get(dim1_code, 1.0)
        if dim2_code == "custom":
            formula = p.get("dim2_custom_formula") or "1.0"
            f2 = safe_eval_formula(formula, custom_vars)
        else:
            f2 = factors.get(dim2_code, 1.0)
        if qty_code == "custom":
            formula = p.get("qty_custom_formula") or "1.0"
            fq = safe_eval_formula(formula, custom_vars)
        else:
            fq = factors.get(qty_code, 1.0)
        
        a = p["dim_l_or_dia"] * f1
        b = p["dim_w_or_leng"] * f2
        t = p.get("dim_t", 0.0)
        
        base_qty = p.get("base_qty", 1)
        # Quantity calculation uses math.floor(x + 0.5) to match JS Math.round
        qty = max(1, math.floor(base_qty * fq + 0.5))
        
        moc = p.get("default_moc", "IS 2062")
        is_round = (t == 0)
        
        if is_round:
            weight = 0.785 * a * a * b * 7.85e-6 * qty
            plate_labour = 0.0
            plate_labour_rate = 0.0
        else:
            weight = a * b * t * 7.85e-6 * qty
            l_rate = float(labour_rates.get(moc, 10.0))
            plate_labour_rate = l_rate
            plate_labour = calibrated("mfg", (a + b) * 2.0 * t * l_rate / 1000.0)
            
        base_mat_rate = float(material_rates.get(moc, 72.0))
        # Rate override per line if present
        line_mat_rate = per_line_overrides.get(idx, base_mat_rate)
        if p.get("id") in per_line_overrides:
            line_mat_rate = per_line_overrides[p["id"]]
            
        rm_cost = calibrated("raw_material", weight * line_mat_rate)
        per_pc_machining = calibrated("mfg", float(p.get("per_piece_machining", 0.0)))
        rolling_cost = calibrated("mfg", float(p.get("rolling_cost", 0.0)))
        
        mfg_per_pc = plate_labour + per_pc_machining + rolling_cost
        mfg_cost_line = mfg_per_pc * qty
        line_total = rm_cost + mfg_cost_line
        
        line_scaled = is_overall_scaled and (f1 != 1.0 or f2 != 1.0 or fq != 1.0)
        
        total_steel_weight += weight
        total_rm_cost += rm_cost
        total_mfg_cost += mfg_cost_line
        
        calculated_lines.append({
            "part_id": p.get("id"),
            "sr_no": p.get("sr_no", idx + 1),
            "part_name": p["name"],
            "is_round": is_round,
            "dim_1": a,
            "dim_2": b,
            "dim_3": t,
            "qty": qty,
            "weight": weight,
            "moc": moc,
            "material_rate": line_mat_rate,
            "base_material_rate": base_mat_rate,
            "is_rate_overridden": (line_mat_rate != base_mat_rate),
            "rm_cost": rm_cost,
            "plate_labour_rate": plate_labour_rate,
            "plate_labour_cost": plate_labour,
            "per_piece_machining": per_pc_machining,
            "rolling_cost": rolling_cost,
            "mfg_cost_total": mfg_cost_line,
            "line_total": line_total,
            "is_scaled": line_scaled
        })

    # 4. Bought-Outs
    racks_qty = math.floor(4 * nR / 4.0 + 0.5)
    rack_unit_price = float(bought_out_prices.get("rack_base", 20000.0)) * h_factor
    racks_cost = racks_qty * rack_unit_price
    
    drive_pinions_qty = 2
    drive_pinions_cost = drive_pinions_qty * float(bought_out_prices.get("drive_pinion", 5000.0))
    
    free_pinions_qty = math.floor(14 * nR / 4.0 + 0.5)
    free_pinions_cost = free_pinions_qty * float(bought_out_prices.get("free_pinion", 5000.0))
    
    bearings_qty = 2
    bearings_cost = bearings_qty * float(bought_out_prices.get("bearing", 13000.0))
    
    hardware_cost = float(bought_out_prices.get("hardware", 50000.0))
    finishing_cost = total_steel_weight * finishing_rate_per_kg
    
    gland_packing_qty = math.floor(24 * p_factor + 0.5)
    gland_packing_cost = gland_packing_qty * float(bought_out_prices.get("gland_packing_unit", 200.0))
    
    total_bought_out_cost = calibrated("bought_out", (
        racks_cost + drive_pinions_cost + free_pinions_cost +
        bearings_cost + hardware_cost + finishing_cost + gland_packing_cost
    ))
    
    # 5. Automation
    actuator_cost = float(automation_prices.get("actuator", 200000.0))
    gearbox_cost = float(automation_prices.get("gearbox", 100000.0))
    misc_cost = float(automation_prices.get("misc", 50000.0))
    manual_override_cost = float(automation_prices.get("manual_override", 0.0))
    
    total_automation_cost = calibrated("automation", actuator_cost + gearbox_cost + misc_cost + manual_override_cost)
    
    # 6. Fabrication
    total_fabrication_cost = calibrated("fabrication", total_steel_weight * fab_rate_per_kg)
    
    # 7. Unit Totals
    unit_basic_cost = total_rm_cost + total_mfg_cost + total_bought_out_cost
    unit_total_cost = unit_basic_cost + total_automation_cost + total_fabrication_cost
    unit_quoted_price = round(unit_total_cost * (1.0 + markup_pct / 100.0), 2)
    margin_pct = ((unit_quoted_price - unit_total_cost) / unit_quoted_price) * 100.0 if unit_quoted_price > 0 else 0.0

    # 8. Overall Batch Totals (for quantity >= 1)
    batch_weight_kg = total_steel_weight * damper_quantity
    batch_rm_cost = total_rm_cost * damper_quantity
    batch_mfg_cost = total_mfg_cost * damper_quantity
    batch_bought_out_cost = total_bought_out_cost * damper_quantity
    batch_basic_cost = unit_basic_cost * damper_quantity
    batch_automation_cost = total_automation_cost * damper_quantity
    batch_fabrication_cost = total_fabrication_cost * damper_quantity
    batch_total_cost = unit_total_cost * damper_quantity
    batch_quoted_price = round(unit_quoted_price * damper_quantity, 2)

    return {
        "width_mm": width_mm,
        "height_mm": height_mm,
        "depth_mm": depth_mm,
        "damper_quantity": damper_quantity,
        
        # Unit totals (rounded to 2 decimal places at the end)
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
        
        # Batch totals
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
            "quoted_price": round(batch_quoted_price, 2)
        },
        
        "is_scaled": is_overall_scaled,
        "lines": calculated_lines
    }
