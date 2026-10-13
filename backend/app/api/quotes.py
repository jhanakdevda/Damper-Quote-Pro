import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import cast, String
from typing import Optional, List, Dict, Any
from app.database import get_db
from app.models import Quote, QuoteLine, QuoteRevision, RatesVersion, PartsLibrary, Customer, RFQ, User, CompanySettings, DamperSizeLimits, VerifiedSize, ValidationRule, CostCalibration
from app.schemas import CalculateRequest, QuoteCreateRequest, QuoteUpdateRequest, QuoteStatusUpdate
from app.api.auth import get_current_user
from app.costing_engine import calculate_damper_cost, safe_eval_condition
from app.multi_blade_engine import calculate_multi_blade_damper_cost, DEFAULT_MULTI_BLADE_RATES
from app.valve_engine import calculate_valve_cost, VALVE_TYPES, STANDARD_VALVE_SIZES
from app.services.excel_service import generate_quote_excel
from app.services.pdf_service import generate_quote_pdf

router = APIRouter(prefix="/quotes", tags=["Quotes"])

def get_parts_from_db(db: Session) -> List[Dict[str, Any]]:
    return [
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
            "dim1_custom_formula": p.dim1_custom_formula,
            "dim2_custom_formula": p.dim2_custom_formula,
            "qty_custom_formula": p.qty_custom_formula,
            "per_piece_machining": p.per_piece_machining,
            "rolling_cost": p.rolling_cost
        }
        for p in db.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all()
    ]


def get_current_size_limits(db: Session) -> Dict[str, float]:
    row = db.query(DamperSizeLimits).order_by(DamperSizeLimits.id.desc()).first()
    if not row:
        row = DamperSizeLimits()
        db.add(row)
        db.commit()
    return {
        "width_min_mm": float(row.width_min_mm),
        "width_max_mm": float(row.width_max_mm),
        "height_min_mm": float(row.height_min_mm),
        "height_max_mm": float(row.height_max_mm),
        "depth_min_mm": float(row.depth_min_mm),
        "depth_max_mm": float(row.depth_max_mm),
    }


def get_verified_size_accuracy(db: Session, width_mm: float, height_mm: float, depth_mm: float, engine_total_cost: float = 0.0, damper_type: str = "rack_and_pinion"):
    rows = db.query(VerifiedSize).filter(VerifiedSize.damper_type == damper_type).all()
    if not rows:
        rows = db.query(VerifiedSize).all()
    if not rows:
        return {"verified_size_id": None, "accuracy_label": "Estimated size", "nearest_verified_size": None, "difference_pct": None}

    nearest = min(rows, key=lambda r: abs(r.width_mm - width_mm) + abs(r.height_mm - height_mm) + abs(r.depth_mm - depth_mm))
    is_exact = (abs(nearest.width_mm - width_mm) < 1e-9 and abs(nearest.height_mm - height_mm) < 1e-9 and abs(nearest.depth_mm - depth_mm) < 1e-9)
    if is_exact:
        return {"verified_size_id": nearest.id, "accuracy_label": "Verified size", "nearest_verified_size": {"label": nearest.label, "width_mm": nearest.width_mm, "height_mm": nearest.height_mm, "depth_mm": nearest.depth_mm}, "difference_pct": 0.0}

    basis = float(nearest.verified_total_cost or 0.0)
    diff_pct = 0.0 if basis <= 0 else abs((engine_total_cost or 0.0) - basis) / basis * 100.0
    return {
        "verified_size_id": None,
        "accuracy_label": f"Estimated size: nearest verified size {nearest.label}, differs by {diff_pct:.2f}%",
        "nearest_verified_size": {"label": nearest.label, "width_mm": nearest.width_mm, "height_mm": nearest.height_mm, "depth_mm": nearest.depth_mm},
        "difference_pct": round(diff_pct, 2),
    }


def apply_manual_bom_edits(calc_res: Dict[str, Any], bom_edits=None, bom_additions=None, rates=None) -> bool:
    original = [dict(line) for line in calc_res["lines"]]
    edits = {int(item["line_index"]): item for item in (bom_edits or []) if "line_index" in item}
    lines = []
    for index, source in enumerate(original):
        edit = edits.get(index, {})
        if edit.get("is_delete"):
            continue
        line = source
        line["source_line_index"] = index
        line["_orig_rm"] = float(source.get("rm_cost") or 0)
        line["_orig_mfg"] = float(source.get("mfg_cost_total") if source.get("mfg_cost_total") is not None else (source.get("mfg_cost") or 0))
        line["_orig_total"] = float(source.get("line_total") if source.get("line_total") is not None else (source.get("total_cost") or (line["_orig_rm"] + line["_orig_mfg"])))
        changed_fields = ("dim_1", "dim_2", "dim_3", "qty", "moc", "material_rate", "plate_labour_rate", "per_piece_machining", "rolling_cost", "line_total")
        changed = any(edit.get(field) is not None for field in changed_fields)
        for field in changed_fields:
            if edit.get(field) is not None and field != "line_total":
                line[field] = edit[field]
        if edit.get("line_total") is not None:
            line["_custom_line_total"] = edit["line_total"]
        if changed:
            line["is_manually_edited"] = True
            line["edit_note"] = edit.get("edit_note") or "Manual BOM edit"
        lines.append(line)

    for added in bom_additions or []:
        name = str(added.get("part_name") or added.get("name") or "").strip()
        required = ("dim_1", "dim_2", "qty", "moc")
        if not name or any(added.get(field) is None for field in required):
            raise ValueError("Custom BOM lines require part_name, dim_1, dim_2, qty, and moc")
        lines.append({
            "part_id": None, "sr_no": len(lines) + 1, "part_name": name,
            "is_round": bool(added.get("is_round", False)), "dim_1": float(added["dim_1"]),
            "dim_2": float(added["dim_2"]), "dim_3": float(added.get("dim_3", 0)),
            "qty": int(added["qty"]), "moc": str(added["moc"]),
            "material_rate": float(added.get("material_rate", 0)),
            "plate_labour_rate": float(added.get("plate_labour_rate", 0)),
            "per_piece_machining": float(added.get("per_piece_machining", 0)),
            "rolling_cost": float(added.get("rolling_cost", 0)), "is_scaled": False,
            "is_manually_edited": True, "edit_note": added.get("edit_note") or "Custom BOM line",
        })

    for line in lines:
        if not line.get("is_manually_edited"):
            line.pop("_orig_rm", None)
            line.pop("_orig_mfg", None)
            line.pop("_orig_total", None)
            line.pop("_custom_line_total", None)
            continue
        qty = int(line.get("qty") or line.get("quantity") or 1)
        dim_1 = float(line.get("dim_1") or 0)
        dim_2 = float(line.get("dim_2") or 0)
        thickness = float(line.get("dim_3") or 0)
        if qty < 1 or dim_1 < 0 or dim_2 < 0:
            raise ValueError("Manual BOM dimensions must be non-negative and quantity must be at least 1")
        line["qty"] = qty
        orig_rm = float(line.pop("_orig_rm", line.get("rm_cost") or 0))
        orig_mfg = float(line.pop("_orig_mfg", line.get("mfg_cost_total") if line.get("mfg_cost_total") is not None else (line.get("mfg_cost") or 0)))
        orig_total = float(line.pop("_orig_total", line.get("line_total") if line.get("line_total") is not None else (line.get("total_cost") or (orig_rm + orig_mfg))))
        custom_line_total = line.pop("_custom_line_total", None)
        if line.get("is_round") and dim_1 > 0 and dim_2 > 0:
            line["weight"] = 0.785 * dim_1 ** 2 * dim_2 * 7.85e-6 * qty
            line["plate_labour_cost"] = 0.0
            line["rm_cost"] = line["weight"] * float(line.get("material_rate") or 0)
            line["mfg_cost_total"] = (float(line.get("plate_labour_cost") or 0) + float(line.get("per_piece_machining") or 0) + float(line.get("rolling_cost") or 0)) * qty
            line["line_total"] = line["rm_cost"] + line["mfg_cost_total"]
        elif dim_1 > 0 and dim_2 > 0 and thickness > 0:
            line["weight"] = dim_1 * dim_2 * thickness * 7.85e-6 * qty
            line["plate_labour_cost"] = (dim_1 + dim_2) * 2 * thickness * float(line.get("plate_labour_rate") or 0) / 1000
            line["rm_cost"] = line["weight"] * float(line.get("material_rate") or 0)
            line["mfg_cost_total"] = (float(line.get("plate_labour_cost") or 0) + float(line.get("per_piece_machining") or 0) + float(line.get("rolling_cost") or 0)) * qty
            line["line_total"] = line["rm_cost"] + line["mfg_cost_total"]
        else:
            base_qty = float(line.get("base_qty") or line.get("quantity") or qty or 1)
            old_wt = float(line.get("weight") or line.get("total_weight") or 0)
            if base_qty > 0 and old_wt > 0:
                line["weight"] = (old_wt / base_qty) * qty
            line["rm_cost"] = float(line.get("weight") or 0) * float(line.get("material_rate") or 0) if line.get("material_rate") is not None else orig_rm
            if line.get("per_piece_machining") is not None:
                line["mfg_cost_total"] = (float(line.get("plate_labour_cost") or 0) + float(line.get("per_piece_machining") or 0) + float(line.get("rolling_cost") or 0)) * qty
            else:
                line["mfg_cost_total"] = orig_mfg
            line["line_total"] = orig_total - orig_rm - orig_mfg + float(line.get("rm_cost") or 0) + float(line.get("mfg_cost_total") or 0)
        if custom_line_total is not None:
            try:
                line["line_total"] = float(custom_line_total)
            except (TypeError, ValueError):
                pass
        line["mfg_cost"] = line.get("mfg_cost_total", orig_mfg)
        line["total_cost"] = line.get("line_total", orig_total)

    if not (bom_edits or bom_additions):
        return False
    old_rm = calc_res.get("raw_material_cost", 0.0)
    old_mfg = calc_res.get("mfg_cost", 0.0)
    old_weight = calc_res.get("total_weight_kg", 0.0)
    rm_cost = sum(float(line.get("rm_cost") or 0) for line in lines)
    mfg_cost = sum(float(line.get("mfg_cost_total") if line.get("mfg_cost_total") is not None else (line.get("mfg_cost") or 0)) for line in lines)
    line_sum = sum(float(line.get("line_total") if line.get("line_total") is not None else (line.get("total_cost") or 0)) for line in lines)
    custom_fab_delta = line_sum - (rm_cost + mfg_cost)
    calc_res["lines"] = lines
    new_weight = sum(line.get("weight", 0) for line in lines)
    weight_delta = new_weight - old_weight
    calc_res["total_weight_kg"] = round(new_weight, 2)
    calc_res["raw_material_cost"] = round(rm_cost, 2)
    calc_res["mfg_cost"] = round(mfg_cost, 2)
    finishing_rate = float((rates or {}).get("finishing_rate_per_kg", 20.0))
    fabrication_rate = float((rates or {}).get("fabrication_rate_per_kg", 96.0))
    bought_out_delta = weight_delta * finishing_rate
    fabrication_delta = weight_delta * fabrication_rate
    if "bought_out_cost" in calc_res:
        calc_res["bought_out_cost"] = round(calc_res["bought_out_cost"] + bought_out_delta, 2)
    if "fabrication_cost" in calc_res:
        calc_res["fabrication_cost"] = round(calc_res["fabrication_cost"] + fabrication_delta, 2)
    if "basic_cost" in calc_res:
        calc_res["basic_cost"] = round(calc_res["basic_cost"] + rm_cost - old_rm + mfg_cost - old_mfg + bought_out_delta + custom_fab_delta, 2)
        calc_res["total_cost"] = round(calc_res["basic_cost"] + calc_res.get("automation_cost", 0.0) + calc_res.get("fabrication_cost", 0.0), 2)
    else:
        calc_res["total_cost"] = round(rm_cost + mfg_cost + custom_fab_delta + calc_res.get("bought_out_cost", 0.0) + calc_res.get("testing_cost", 0.0) + calc_res.get("finishing_cost", 0.0) + calc_res.get("automation_cost", 0.0), 2)
    calc_res["quoted_price"] = round(calc_res["total_cost"] * (1 + calc_res["markup_pct"] / 100), 2)
    calc_res["margin_pct"] = ((calc_res["quoted_price"] - calc_res["total_cost"]) / calc_res["quoted_price"] * 100) if calc_res["quoted_price"] else 0
    quantity = calc_res.get("damper_quantity") or calc_res.get("quantity") or 1
    if "batch_totals" in calc_res:
        for key in ("total_weight_kg", "raw_material_cost", "mfg_cost", "total_cost", "quoted_price"):
            if key in calc_res:
                calc_res["batch_totals"][key] = round(calc_res[key] * quantity, 2)
        if "basic_cost" in calc_res and "basic_cost" in calc_res["batch_totals"]:
            calc_res["batch_totals"]["basic_cost"] = round(calc_res["basic_cost"] * quantity, 2)
    return True


def get_validation_warnings(db: Session, width_mm: float, height_mm: float, depth_mm: float, weight_kg: float):
    variables = {"W": width_mm, "H": height_mm, "D": depth_mm, "ratio": width_mm / height_mm, "weight": weight_kg}
    warnings = []
    rules = db.query(ValidationRule).filter(ValidationRule.active.is_(True)).order_by(ValidationRule.sort_order, ValidationRule.id).all()
    for rule in rules:
        try:
            matched = safe_eval_condition(rule.condition_expr, variables)
        except (ValueError, ArithmeticError):
            continue
        if matched:
            warnings.append({"rule_id": rule.id, "rule_name": rule.rule_name, "severity": rule.severity, "message": rule.message})
    return warnings


def get_active_rates_dict(db: Session, rate_version_id: Optional[int] = None) -> (int, Dict[str, Any]):
    if rate_version_id:
        rv = db.query(RatesVersion).filter(RatesVersion.id == rate_version_id).first()
    else:
        rv = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    if not rv:
        raise HTTPException(status_code=404, detail="Rates version not found")
        
    rates_dict = {
        "version_number": rv.version_number,
        "material_rates": dict(rv.material_rates),
        "labour_rates": dict(rv.labour_rates),
        "bought_out_prices": dict(rv.bought_out_prices),
        "automation_prices": dict(rv.automation_prices),
        "fabrication_rate_per_kg": rv.fabrication_rate_per_kg,
        "finishing_rate_per_kg": rv.finishing_rate_per_kg,
        "default_markup_pct": rv.default_markup_pct
    }
    return rv.id, rates_dict

def get_calibration_factors(db: Session):
    row = db.query(CostCalibration).order_by(CostCalibration.id.desc()).first()
    return row.factors if row else {}

def apply_rate_overrides(base_rates: Dict[str, Any], overrides: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not overrides:
        return base_rates
    merged = json.loads(json.dumps(base_rates))
    for category in ["material_rates", "labour_rates", "bought_out_prices", "automation_prices"]:
        if category in overrides and isinstance(overrides[category], dict):
            for k, v in overrides[category].items():
                if v is not None:
                    merged[category][k] = float(v)
    for field in ["fabrication_rate_per_kg", "finishing_rate_per_kg", "default_markup_pct"]:
        if field in overrides and overrides[field] is not None:
            merged[field] = float(overrides[field])
    return merged

@router.post("/calculate")
def calculate_live(payload: CalculateRequest, db: Session = Depends(get_db)):
    """Live calculation endpoint without saving to database."""
    d_type = payload.damper_type or "rack_and_pinion"
    rv_id, base_rates = get_active_rates_dict(db)
    effective_rates = apply_rate_overrides(base_rates, payload.rate_overrides)
    effective_rates["calibration"] = get_calibration_factors(db)

    is_valve = (getattr(payload, "product_category", "damper") == "valve" or 
                d_type in ("butterfly_valve", "knife_gate_valve", "ball_valve", "globe_valve", "valve") or 
                bool(payload.valve_config))

    if is_valve:
        v_config = dict(payload.valve_config or {})
        if "valve_type" not in v_config:
            v_config["valve_type"] = d_type if d_type in ("butterfly_valve", "knife_gate_valve", "ball_valve", "globe_valve") else "butterfly_valve"
        if "size_dn" not in v_config:
            v_config["size_dn"] = int(payload.width_mm) if (payload.width_mm <= 2000 and payload.width_mm >= 50) else 300
        try:
            calc_res = calculate_valve_cost(
                config=v_config,
                rates_data=effective_rates,
                quantity=payload.quantity,
                markup_pct_override=payload.markup_pct,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        try:
            calc_res["bom_has_edits"] = apply_manual_bom_edits(calc_res, payload.bom_edits, payload.bom_additions, effective_rates)
        except (TypeError, ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        calc_res["rate_version_id"] = rv_id
        calc_res["is_custom_rates"] = bool(payload.rate_overrides) or bool(payload.bom_edits)
        calc_res["accuracy"] = {"verified_size_id": None, "accuracy_label": "Standard Valve Sizing (ASME / EN)", "difference_pct": 0.0}
        return calc_res

    if d_type == "multi_blade":
        mb_config = dict(payload.multi_blade_config or {})
        mb_config.setdefault("width_mm", payload.width_mm)
        mb_config.setdefault("height_mm", payload.height_mm)
        mb_config.setdefault("depth_mm", payload.depth_mm)
        try:
            calc_res = calculate_multi_blade_damper_cost(
                config=mb_config,
                rates_data=effective_rates,
                damper_quantity=payload.quantity,
                markup_pct_override=payload.markup_pct,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        try:
            calc_res["bom_has_edits"] = apply_manual_bom_edits(calc_res, payload.bom_edits, payload.bom_additions, effective_rates)
        except (TypeError, ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        calc_res["rate_version_id"] = rv_id
        calc_res["is_custom_rates"] = bool(payload.rate_overrides)
        calc_res["accuracy"] = get_verified_size_accuracy(db, payload.width_mm, payload.height_mm, payload.depth_mm, calc_res.get("total_cost", 0.0), damper_type=d_type)
        return calc_res

    # Rack and Pinion
    try:
        parts = get_parts_from_db(db)
        size_limits = get_current_size_limits(db)
        calc_res = calculate_damper_cost(
            width_mm=payload.width_mm,
            height_mm=payload.height_mm,
            depth_mm=payload.depth_mm,
            parts_data=parts,
            rates_data=effective_rates,
            damper_quantity=payload.quantity,
            markup_pct_override=payload.markup_pct,
            size_limits=size_limits,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    try:
        calc_res["bom_has_edits"] = apply_manual_bom_edits(calc_res, payload.bom_edits, payload.bom_additions, effective_rates)
    except (TypeError, ValueError, ArithmeticError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    calc_res["damper_type"] = "rack_and_pinion"
    calc_res["rate_version_id"] = rv_id
    calc_res["is_custom_rates"] = bool(payload.rate_overrides)
    calc_res["accuracy"] = get_verified_size_accuracy(db, payload.width_mm, payload.height_mm, payload.depth_mm, calc_res.get("total_cost", 0.0), damper_type="rack_and_pinion")
    calc_res["validation_warnings"] = get_validation_warnings(db, payload.width_mm, payload.height_mm, payload.depth_mm, calc_res["total_weight_kg"])
    return calc_res

@router.post("")
def create_quote(
    payload: QuoteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    d_type = payload.damper_type or "rack_and_pinion"
    rv_id, base_rates = get_active_rates_dict(db)
    effective_rates = apply_rate_overrides(base_rates, payload.rate_overrides)
    effective_rates["calibration"] = get_calibration_factors(db)

    is_valve = (getattr(payload, "product_category", "damper") == "valve" or 
                d_type in ("butterfly_valve", "knife_gate_valve", "ball_valve", "globe_valve", "valve") or 
                bool(payload.valve_config))

    bom_has_edits = False
    if is_valve:
        v_config = dict(payload.valve_config or {})
        if "valve_type" not in v_config:
            v_config["valve_type"] = d_type if d_type in ("butterfly_valve", "knife_gate_valve", "ball_valve", "globe_valve") else "butterfly_valve"
        if "size_dn" not in v_config:
            v_config["size_dn"] = int(payload.width_mm) if (payload.width_mm <= 2000 and payload.width_mm >= 50) else 300
        try:
            calc_res = calculate_valve_cost(
                config=v_config,
                rates_data=effective_rates,
                quantity=payload.quantity,
                markup_pct_override=payload.markup_pct,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        accuracy = {"verified_size_id": None, "accuracy_label": "Standard Valve Sizing (ASME / EN)", "difference_pct": 0.0}
        calc_res["accuracy"] = accuracy
        calc_res["margin_pct"] = round((calc_res["quoted_price"] - calc_res["total_cost"]) / max(1.0, calc_res["quoted_price"]) * 100.0, 2)
        calc_res["fabrication_cost"] = calc_res.get("testing_cost", 0.0) + calc_res.get("finishing_cost", 0.0)
    elif d_type == "multi_blade":
        mb_config = dict(payload.multi_blade_config or {})
        mb_config.setdefault("width_mm", payload.width_mm)
        mb_config.setdefault("height_mm", payload.height_mm)
        mb_config.setdefault("depth_mm", payload.depth_mm)
        try:
            calc_res = calculate_multi_blade_damper_cost(
                config=mb_config,
                rates_data=effective_rates,
                damper_quantity=payload.quantity,
                markup_pct_override=payload.markup_pct,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        if calc_res.get("validation_errors"):
            raise HTTPException(status_code=400, detail="Cannot save quote with blocking validation errors: " + "; ".join(e["message"] for e in calc_res["validation_errors"]))
        try:
            bom_has_edits = apply_manual_bom_edits(calc_res, payload.bom_edits, payload.bom_additions, effective_rates)
        except (TypeError, ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        accuracy = get_verified_size_accuracy(db, payload.width_mm, payload.height_mm, payload.depth_mm, calc_res.get("total_cost", 0.0), damper_type=d_type)
        calc_res["accuracy"] = accuracy
    else:
        parts = get_parts_from_db(db)
        size_limits = get_current_size_limits(db)
        try:
            calc_res = calculate_damper_cost(
                width_mm=payload.width_mm,
                height_mm=payload.height_mm,
                depth_mm=payload.depth_mm,
                parts_data=parts,
                rates_data=effective_rates,
                damper_quantity=payload.quantity,
                markup_pct_override=payload.markup_pct,
                size_limits=size_limits,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        try:
            bom_has_edits = apply_manual_bom_edits(calc_res, payload.bom_edits, payload.bom_additions, effective_rates)
        except (TypeError, ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        accuracy = get_verified_size_accuracy(db, payload.width_mm, payload.height_mm, payload.depth_mm, calc_res.get("total_cost", 0.0), damper_type="rack_and_pinion")
        calc_res["accuracy"] = accuracy
        calc_res["validation_warnings"] = get_validation_warnings(db, payload.width_mm, payload.height_mm, payload.depth_mm, calc_res["total_weight_kg"])

    # Customer record
    cust = db.query(Customer).filter(Customer.company == payload.customer_company).first()
    if not cust:
        cust = Customer(
            name=payload.customer_name,
            company=payload.customer_company,
            email=payload.customer_email,
            phone=payload.customer_phone
        )
        db.add(cust)
        db.commit()

    # Generate sequential quote number
    count = db.query(Quote).count() + 1
    year = datetime.utcnow().year
    quote_number = f"Q-{year}-{count:04d}"

    # Create RFQ
    rfq = RFQ(
        rfq_number=f"RFQ-{year}-{count:04d}",
        customer_id=cust.id,
        project_name=payload.project_name,
        quantity=payload.quantity,
        notes=payload.notes
    )
    db.add(rfq)
    db.commit()

    quote = Quote(
        quote_number=quote_number,
        rfq_id=rfq.id,
        customer_id=cust.id,
        damper_type=d_type,
        multi_blade_config=payload.multi_blade_config if d_type == "multi_blade" else None,
        width_mm=payload.width_mm,
        height_mm=payload.height_mm,
        depth_mm=payload.depth_mm,
        total_weight_kg=calc_res["total_weight_kg"],
        raw_material_cost=calc_res["raw_material_cost"],
        mfg_cost=calc_res["mfg_cost"],
        basic_cost=calc_res["basic_cost"],
        automation_cost=calc_res["automation_cost"],
        fabrication_cost=calc_res["fabrication_cost"],
        total_cost=calc_res["total_cost"],
        markup_pct=calc_res["markup_pct"],
        margin_pct=calc_res["margin_pct"],
        quoted_price=calc_res["quoted_price"],
        status=payload.status or "Draft",
        rate_version_id=rv_id,
        revision_number=1,
        is_scaled=calc_res.get("is_scaled", False),
        flap_material=payload.flap_material or "IS 2062",
        actuation_type=payload.actuation_type or "Electric Actuator",
        verified_size_id=accuracy["verified_size_id"],
        accuracy_label=accuracy["accuracy_label"],
        bom_has_edits=bom_has_edits,
        created_by_id=current_user.id
    )
    db.add(quote)
    db.commit()

    # Quote lines
    for line in calc_res["lines"]:
        ql = QuoteLine(
            quote_id=quote.id,
            part_id=line.get("part_id"),
            sr_no=line["sr_no"],
            part_name=line["part_name"],
            is_round=line.get("is_round", False),
            dim_1=line.get("dim_1", 0.0),
            dim_2=line.get("dim_2", 0.0),
            dim_3=line.get("dim_3", 0.0),
            qty=line.get("qty", 1),
            weight=line.get("weight", 0.0),
            moc=line.get("moc", "WCB"),
            material_rate=line.get("material_rate", 0.0),
            rm_cost=line.get("rm_cost", 0.0),
            plate_labour_rate=line.get("plate_labour_rate", 0.0),
            plate_labour_cost=line.get("plate_labour_cost", 0.0),
            per_piece_machining=line.get("per_piece_machining", 0.0),
            rolling_cost=line.get("rolling_cost", 0.0),
            mfg_cost_total=line.get("mfg_cost_total", line.get("mfg_cost", 0.0)),
            line_total=line.get("line_total", line.get("total_cost", 0.0)),
            is_scaled=line.get("is_scaled", False),
            is_manually_edited=line.get("is_manually_edited", False),
            edit_note=line.get("edit_note")
        )
        db.add(ql)
    db.commit()

    # Save Revision 1 snapshot
    snapshot = {
        "revision_number": 1,
        "damper_type": d_type,
        "multi_blade_config": payload.multi_blade_config if d_type == "multi_blade" else None,
        "derived_results": calc_res.get("derived_results"),
        "width_mm": payload.width_mm,
        "height_mm": payload.height_mm,
        "depth_mm": payload.depth_mm,
        "quantity": payload.quantity,
        "markup_pct": payload.markup_pct,
        "customer": {"name": cust.name, "company": cust.company, "email": cust.email, "phone": cust.phone},
        "project_name": payload.project_name,
        "notes": payload.notes,
        "rates_snapshot": effective_rates,
        "is_custom_rates": bool(payload.rate_overrides),
        "totals": calc_res,
        "lines": calc_res["lines"],
        "accuracy": accuracy,
        "validation_warnings": calc_res.get("validation_warnings", []),
        "bom_has_edits": bom_has_edits,
        "saved_at": datetime.utcnow().isoformat(),
        "saved_by": current_user.full_name
    }
    rev = QuoteRevision(
        quote_id=quote.id,
        revision_number=1,
        snapshot_data=snapshot,
        total_cost=quote.total_cost,
        quoted_price=quote.quoted_price,
        created_by_id=current_user.id
    )
    db.add(rev)
    db.commit()

    return {"message": "Quote created successfully", "quote_id": quote.id, "quote_number": quote.quote_number}

@router.get("")
def list_quotes(
    q: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    size: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Quote).join(Customer).join(RFQ)
    if status and status != "All" and status != "ALL":
        query = query.filter(Quote.status == status)
    
    term = q or search
    if term:
        term_str = f"%{term}%"
        try:
            num = float(term)
            query = query.filter(
                (Quote.quote_number.ilike(term_str)) |
                (Customer.name.ilike(term_str)) |
                (Customer.company.ilike(term_str)) |
                (RFQ.project_name.ilike(term_str)) |
                (Quote.width_mm == num) |
                (Quote.height_mm == num) |
                (Quote.depth_mm == num)
            )
        except ValueError:
            query = query.filter(
                (Quote.quote_number.ilike(term_str)) |
                (Customer.name.ilike(term_str)) |
                (Customer.company.ilike(term_str)) |
                (RFQ.project_name.ilike(term_str))
            )
            
    if date:
        query = query.filter(cast(Quote.created_at, String).ilike(f"%{date}%"))
        
    if size:
        try:
            sz_val = float(size)
            query = query.filter((Quote.width_mm == sz_val) | (Quote.height_mm == sz_val) | (Quote.depth_mm == sz_val))
        except ValueError:
            pass

    quotes = query.order_by(Quote.created_at.desc()).all()
    results = []
    for qt in quotes:
        creator = db.query(User).filter(User.id == qt.created_by_id).first()
        results.append({
            "id": qt.id,
            "quote_number": qt.quote_number,
            "customer_name": qt.customer.name,
            "customer_company": qt.customer.company,
            "project_name": qt.rfq.project_name,
            "damper_type": qt.damper_type or "rack_and_pinion",
            "width_mm": qt.width_mm,
            "height_mm": qt.height_mm,
            "depth_mm": qt.depth_mm,
            "quantity": qt.rfq.quantity,
            "quoted_price": qt.quoted_price,
            "quoted_price_unit": qt.quoted_price,
            "quoted_price_batch": round(qt.quoted_price * qt.rfq.quantity, 2),
            "batch_quoted_price": round(qt.quoted_price * qt.rfq.quantity, 2),
            "margin_pct": qt.margin_pct,
            "status": qt.status,
            "revision_number": qt.revision_number,
            "is_scaled": qt.is_scaled,
            "created_by": creator.full_name if creator else "Unknown",
            "created_at": qt.created_at
        })
    return results

@router.get("/{id}")
def get_quote_detail(id: int, db: Session = Depends(get_db)):
    qt = db.query(Quote).filter(Quote.id == id).first()
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")

    revs = db.query(QuoteRevision).filter(QuoteRevision.quote_id == qt.id).order_by(QuoteRevision.revision_number.desc()).all()
    lines = db.query(QuoteLine).filter(QuoteLine.quote_id == qt.id).order_by(QuoteLine.sr_no.asc()).all()

    # Latest revision snapshot
    latest_rev = revs[0] if revs else None
    rates_used = latest_rev.snapshot_data.get("rates_snapshot", {}) if latest_rev else {}
    d_type = qt.damper_type or (latest_rev.snapshot_data.get("damper_type") if latest_rev else "rack_and_pinion") or "rack_and_pinion"

    return {
        "id": qt.id,
        "quote_number": qt.quote_number,
        "rfq_id": qt.rfq_id,
        "customer_id": qt.customer_id,
        "customer_name": qt.customer.name,
        "customer_company": qt.customer.company,
        "customer_email": qt.customer.email,
        "customer_phone": qt.customer.phone,
        "project_name": qt.rfq.project_name,
        "rfq_notes": qt.rfq.notes,
        "damper_type": d_type,
        "multi_blade_config": qt.multi_blade_config or (latest_rev.snapshot_data.get("multi_blade_config") if latest_rev else None),
        "derived_results": latest_rev.snapshot_data.get("derived_results") if latest_rev else None,
        "placeholder_notice": "Placeholder multi-blade data: not company-verified" if (d_type == "multi_blade" and not rates_used.get("multi_blade_rates", {}).get("is_verified", False)) else None,
        "width_mm": qt.width_mm,
        "height_mm": qt.height_mm,
        "depth_mm": qt.depth_mm,
        "quantity": qt.rfq.quantity,
        "status": qt.status,
        "revision_number": qt.revision_number,
        "is_scaled": qt.is_scaled or (qt.width_mm != 3000 or qt.height_mm != 3000 or qt.depth_mm != 450),
        "accuracy_label": qt.accuracy_label,
        "bom_has_edits": qt.bom_has_edits,
        "quoted_price": qt.quoted_price,
        "quoted_price_unit": qt.quoted_price,
        "quoted_price_batch": round(qt.quoted_price * qt.rfq.quantity, 2),
        "total_weight_kg": qt.total_weight_kg,
        "totals": {
            "total_weight_kg": qt.total_weight_kg,
            "raw_material_cost": qt.raw_material_cost,
            "mfg_cost": qt.mfg_cost,
            "basic_cost": qt.basic_cost,
            "automation_cost": qt.automation_cost,
            "fabrication_cost": qt.fabrication_cost,
            "total_cost": qt.total_cost,
            "markup_pct": qt.markup_pct,
            "margin_pct": qt.margin_pct,
            "quoted_price": qt.quoted_price,
            "batch_totals": {
                "quantity": qt.rfq.quantity,
                "total_cost": round(qt.total_cost * qt.rfq.quantity, 2),
                "quoted_price": round(qt.quoted_price * qt.rfq.quantity, 2)
            }
        },
        "rates_snapshot": rates_used,
        "validation_warnings": latest_rev.snapshot_data.get("validation_warnings", []) if latest_rev else [],
        "lines": [
            {
                "id": l.id,
                "sr_no": l.sr_no,
                "part_name": l.part_name,
                "is_round": l.is_round,
                "dim_1": l.dim_1,
                "dim_2": l.dim_2,
                "dim_3": l.dim_3,
                "qty": l.qty,
                "weight": l.weight,
                "moc": l.moc,
                "material_rate": l.material_rate,
                "rm_cost": l.rm_cost,
                "plate_labour_rate": l.plate_labour_rate,
                "per_piece_machining": l.per_piece_machining,
                "rolling_cost": l.rolling_cost,
                "mfg_cost_total": l.mfg_cost_total,
                "line_total": l.line_total,
                "is_scaled": l.is_scaled,
                "is_manually_edited": l.is_manually_edited,
                "edit_note": l.edit_note
            }
            for l in lines
        ],
        "revisions": [
            {
                "id": r.id,
                "revision_number": r.revision_number,
                "total_cost": r.total_cost,
                "quoted_price": r.quoted_price,
                "created_at": r.created_at,
                "saved_by": r.snapshot_data.get("saved_by", "User")
            }
            for r in revs
        ]
    }

@router.put("/{id}")
def update_quote(
    id: int,
    payload: QuoteUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    qt = db.query(Quote).filter(Quote.id == id).first()
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")

    parts = get_parts_from_db(db)
    rv_id, base_rates = get_active_rates_dict(db, qt.rate_version_id)
    effective_rates = apply_rate_overrides(base_rates, payload.rate_overrides)
    effective_rates["calibration"] = get_calibration_factors(db)

    W = payload.width_mm or qt.width_mm
    H = payload.height_mm or qt.height_mm
    D = payload.depth_mm or qt.depth_mm
    Qty = payload.quantity or qt.rfq.quantity
    Mk = payload.markup_pct if payload.markup_pct is not None else qt.markup_pct
    d_type = payload.damper_type or qt.damper_type or "rack_and_pinion"

    if d_type == "multi_blade":
        mb_config = dict(payload.multi_blade_config or qt.multi_blade_config or {})
        mb_config["width_mm"] = W
        mb_config["height_mm"] = H
        mb_config["depth_mm"] = D
        try:
            calc_res = calculate_multi_blade_damper_cost(
                config=mb_config,
                rates_data=effective_rates,
                damper_quantity=Qty,
                markup_pct_override=Mk,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        if calc_res.get("validation_errors"):
            raise HTTPException(status_code=400, detail="Cannot revise quote with blocking validation errors: " + "; ".join(e["message"] for e in calc_res["validation_errors"]))
        try:
            bom_has_edits = apply_manual_bom_edits(calc_res, payload.bom_edits, payload.bom_additions, effective_rates)
        except (TypeError, ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        accuracy = get_verified_size_accuracy(db, W, H, D, calc_res.get("total_cost", 0.0), damper_type=d_type)
        calc_res["accuracy"] = accuracy
    else:
        try:
            calc_res = calculate_damper_cost(W, H, D, parts, effective_rates, Qty, Mk, size_limits=get_current_size_limits(db))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        try:
            bom_has_edits = apply_manual_bom_edits(calc_res, payload.bom_edits, payload.bom_additions, effective_rates)
        except (TypeError, ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        accuracy = get_verified_size_accuracy(db, W, H, D, calc_res.get("total_cost", 0.0), damper_type="rack_and_pinion")
        calc_res["accuracy"] = accuracy
        calc_res["validation_warnings"] = get_validation_warnings(db, W, H, D, calc_res["total_weight_kg"])

    # Increment revision number
    new_rev_num = qt.revision_number + 1
    qt.revision_number = new_rev_num
    qt.damper_type = d_type
    if d_type == "multi_blade":
        qt.multi_blade_config = mb_config
    qt.width_mm = W
    qt.height_mm = H
    qt.depth_mm = D
    qt.rfq.quantity = Qty
    qt.markup_pct = Mk
    qt.verified_size_id = accuracy["verified_size_id"]
    qt.accuracy_label = accuracy["accuracy_label"]
    qt.total_weight_kg = calc_res["total_weight_kg"]
    qt.raw_material_cost = calc_res["raw_material_cost"]
    qt.mfg_cost = calc_res["mfg_cost"]
    qt.basic_cost = calc_res["basic_cost"]
    qt.automation_cost = calc_res["automation_cost"]
    qt.fabrication_cost = calc_res["fabrication_cost"]
    qt.total_cost = calc_res["total_cost"]
    qt.quoted_price = calc_res["quoted_price"]
    qt.margin_pct = calc_res["margin_pct"]
    qt.is_scaled = calc_res.get("is_scaled", False)
    qt.bom_has_edits = bom_has_edits
    if payload.status:
        qt.status = payload.status
    if payload.notes:
        qt.rfq.notes = payload.notes

    # Clear old lines and insert new
    db.query(QuoteLine).filter(QuoteLine.quote_id == qt.id).delete()
    for line in calc_res["lines"]:
        ql = QuoteLine(
            quote_id=qt.id,
            part_id=line.get("part_id"),
            sr_no=line["sr_no"],
            part_name=line["part_name"],
            is_round=line["is_round"],
            dim_1=line["dim_1"],
            dim_2=line["dim_2"],
            dim_3=line["dim_3"],
            qty=line["qty"],
            weight=line["weight"],
            moc=line["moc"],
            material_rate=line["material_rate"],
            rm_cost=line["rm_cost"],
            plate_labour_rate=line.get("plate_labour_rate", 0.0),
            plate_labour_cost=line.get("plate_labour_cost", 0.0),
            per_piece_machining=line.get("per_piece_machining", 0.0),
            rolling_cost=line.get("rolling_cost", 0.0),
            mfg_cost_total=line["mfg_cost_total"],
            line_total=line["line_total"],
            is_scaled=line.get("is_scaled", False),
            is_manually_edited=line.get("is_manually_edited", False),
            edit_note=line.get("edit_note")
        )
        db.add(ql)

    snapshot = {
        "revision_number": new_rev_num,
        "damper_type": d_type,
        "multi_blade_config": mb_config if d_type == "multi_blade" else None,
        "derived_results": calc_res.get("derived_results"),
        "width_mm": W,
        "height_mm": H,
        "depth_mm": D,
        "quantity": Qty,
        "markup_pct": Mk,
        "rates_snapshot": effective_rates,
        "is_custom_rates": bool(payload.rate_overrides),
        "totals": calc_res,
        "lines": calc_res["lines"],
        "accuracy": accuracy,
        "validation_warnings": calc_res.get("validation_warnings", []),
        "bom_has_edits": bom_has_edits,
        "saved_at": datetime.utcnow().isoformat(),
        "saved_by": current_user.full_name
    }
    rev = QuoteRevision(
        quote_id=qt.id,
        revision_number=new_rev_num,
        snapshot_data=snapshot,
        total_cost=qt.total_cost,
        quoted_price=qt.quoted_price,
        created_by_id=current_user.id
    )
    db.add(rev)
    db.commit()

    return {"message": f"Quote updated to Revision {new_rev_num}", "revision_number": new_rev_num}

@router.patch("/{id}/status")
def update_status(id: int, payload: QuoteStatusUpdate, db: Session = Depends(get_db)):
    valid_statuses = ["Draft", "Sent", "Won", "Lost"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")
    qt = db.query(Quote).filter(Quote.id == id).first()
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")
    qt.status = payload.status
    db.commit()
    return {"message": f"Status updated to {payload.status}"}

@router.post("/{id}/duplicate")
def duplicate_quote(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orig = db.query(Quote).filter(Quote.id == id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Quote not found")

    count = db.query(Quote).count() + 1
    year = datetime.utcnow().year
    new_quote_num = f"Q-{year}-{count:04d}"

    new_rfq = RFQ(
        rfq_number=f"RFQ-{year}-{count:04d}",
        customer_id=orig.customer_id,
        project_name=f"{orig.rfq.project_name} (Copy)",
        quantity=orig.rfq.quantity,
        notes=orig.rfq.notes
    )
    db.add(new_rfq)
    db.commit()

    new_quote = Quote(
        quote_number=new_quote_num,
        rfq_id=new_rfq.id,
        customer_id=orig.customer_id,
        width_mm=orig.width_mm,
        height_mm=orig.height_mm,
        depth_mm=orig.depth_mm,
        total_weight_kg=orig.total_weight_kg,
        raw_material_cost=orig.raw_material_cost,
        mfg_cost=orig.mfg_cost,
        basic_cost=orig.basic_cost,
        automation_cost=orig.automation_cost,
        fabrication_cost=orig.fabrication_cost,
        total_cost=orig.total_cost,
        markup_pct=orig.markup_pct,
        margin_pct=orig.margin_pct,
        quoted_price=orig.quoted_price,
        status="Draft",
        rate_version_id=orig.rate_version_id,
        revision_number=1,
        is_scaled=orig.is_scaled,
        bom_has_edits=orig.bom_has_edits,
        verified_size_id=orig.verified_size_id,
        accuracy_label=orig.accuracy_label,
        created_by_id=current_user.id
    )
    db.add(new_quote)
    db.commit()

    # Clone lines
    orig_lines = db.query(QuoteLine).filter(QuoteLine.quote_id == orig.id).all()
    for ol in orig_lines:
        nl = QuoteLine(
            quote_id=new_quote.id,
            part_id=ol.part_id,
            sr_no=ol.sr_no,
            part_name=ol.part_name,
            is_round=ol.is_round,
            dim_1=ol.dim_1,
            dim_2=ol.dim_2,
            dim_3=ol.dim_3,
            qty=ol.qty,
            weight=ol.weight,
            moc=ol.moc,
            material_rate=ol.material_rate,
            rm_cost=ol.rm_cost,
            plate_labour_rate=ol.plate_labour_rate,
            plate_labour_cost=ol.plate_labour_cost,
            per_piece_machining=ol.per_piece_machining,
            rolling_cost=ol.rolling_cost,
            mfg_cost_total=ol.mfg_cost_total,
            line_total=ol.line_total,
            is_scaled=ol.is_scaled,
            is_manually_edited=ol.is_manually_edited,
            edit_note=ol.edit_note
        )
        db.add(nl)
        
    latest_orig_rev = db.query(QuoteRevision).filter(QuoteRevision.quote_id == orig.id).order_by(QuoteRevision.revision_number.desc()).first()
    snap = dict(latest_orig_rev.snapshot_data) if latest_orig_rev else {}
    snap["revision_number"] = 1
    snap["saved_by"] = current_user.full_name
    
    rev = QuoteRevision(
        quote_id=new_quote.id,
        revision_number=1,
        snapshot_data=snap,
        total_cost=new_quote.total_cost,
        quoted_price=new_quote.quoted_price,
        created_by_id=current_user.id
    )
    db.add(rev)
    db.commit()

    return {"message": "Quote duplicated successfully", "new_quote_id": new_quote.id, "new_quote_number": new_quote.quote_number}

@router.post("/{id}/revisions/{rev_num}/restore")
def restore_revision(id: int, rev_num: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    qt = db.query(Quote).filter(Quote.id == id).first()
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")

    rev = db.query(QuoteRevision).filter(QuoteRevision.quote_id == id, QuoteRevision.revision_number == rev_num).first()
    if not rev:
        raise HTTPException(status_code=404, detail=f"Revision {rev_num} not found")

    snap = rev.snapshot_data
    next_rev_num = qt.revision_number + 1

    qt.revision_number = next_rev_num
    qt.width_mm = snap.get("width_mm", qt.width_mm)
    qt.height_mm = snap.get("height_mm", qt.height_mm)
    qt.depth_mm = snap.get("depth_mm", qt.depth_mm)
    qt.rfq.quantity = snap.get("quantity", qt.rfq.quantity)
    qt.markup_pct = snap.get("markup_pct", qt.markup_pct)
    accuracy = snap.get("accuracy", {})
    qt.verified_size_id = accuracy.get("verified_size_id", qt.verified_size_id)
    qt.accuracy_label = accuracy.get("accuracy_label", qt.accuracy_label)
    qt.bom_has_edits = snap.get("bom_has_edits", qt.bom_has_edits)

    totals = snap.get("totals", {})
    qt.total_weight_kg = totals.get("total_weight_kg", qt.total_weight_kg)
    qt.raw_material_cost = totals.get("raw_material_cost", qt.raw_material_cost)
    qt.mfg_cost = totals.get("mfg_cost", qt.mfg_cost)
    qt.basic_cost = totals.get("basic_cost", qt.basic_cost)
    qt.automation_cost = totals.get("automation_cost", qt.automation_cost)
    qt.fabrication_cost = totals.get("fabrication_cost", qt.fabrication_cost)
    qt.total_cost = totals.get("total_cost", qt.total_cost)
    qt.quoted_price = totals.get("quoted_price", qt.quoted_price)
    qt.margin_pct = totals.get("margin_pct", qt.margin_pct)
    qt.is_scaled = totals.get("is_scaled", qt.is_scaled)

    # Restore lines
    db.query(QuoteLine).filter(QuoteLine.quote_id == qt.id).delete()
    for line in snap.get("lines", []):
        ql = QuoteLine(
            quote_id=qt.id,
            part_id=line.get("part_id"),
            sr_no=line["sr_no"],
            part_name=line["part_name"],
            is_round=line["is_round"],
            dim_1=line["dim_1"],
            dim_2=line["dim_2"],
            dim_3=line["dim_3"],
            qty=line["qty"],
            weight=line["weight"],
            moc=line["moc"],
            material_rate=line["material_rate"],
            rm_cost=line["rm_cost"],
            plate_labour_rate=line.get("plate_labour_rate", 0),
            plate_labour_cost=line.get("plate_labour_cost", 0),
            per_piece_machining=line.get("per_piece_machining", 0),
            rolling_cost=line.get("rolling_cost", 0),
            mfg_cost_total=line["mfg_cost_total"],
            line_total=line["line_total"],
            is_scaled=line.get("is_scaled", False),
            is_manually_edited=line.get("is_manually_edited", False),
            edit_note=line.get("edit_note")
        )
        db.add(ql)

    new_snap = dict(snap)
    new_snap["revision_number"] = next_rev_num
    new_snap["restored_from_revision"] = rev_num
    new_snap["saved_at"] = datetime.utcnow().isoformat()
    new_snap["saved_by"] = current_user.full_name

    new_rev = QuoteRevision(
        quote_id=qt.id,
        revision_number=next_rev_num,
        snapshot_data=new_snap,
        total_cost=qt.total_cost,
        quoted_price=qt.quoted_price,
        created_by_id=current_user.id
    )
    db.add(new_rev)
    db.commit()

    return {"message": f"Restored revision {rev_num} as new Revision {next_rev_num}", "revision_number": next_rev_num}

@router.delete("/{id}")
def delete_quote(id: int, db: Session = Depends(get_db)):
    qt = db.query(Quote).filter(Quote.id == id).first()
    if not qt:
        raise HTTPException(status_code=404, detail="Quote not found")
    if qt.status != "Draft":
        raise HTTPException(status_code=400, detail="Only Draft quotes can be deleted")
    db.delete(qt)
    db.commit()
    return {"message": "Draft quote deleted successfully"}

@router.get("/{id}/pdf")
def download_quote_pdf(id: int, db: Session = Depends(get_db)):
    detail = get_quote_detail(id, db)
    cs_obj = db.query(CompanySettings).first()
    cs_dict = {
        "company_name": cs_obj.company_name,
        "address": cs_obj.address,
        "gstin": cs_obj.gstin,
        "email": cs_obj.email,
        "phone": cs_obj.phone,
        "quote_validity_days": cs_obj.quote_validity_days,
        "payment_terms": cs_obj.payment_terms,
        "delivery_terms": cs_obj.delivery_terms,
        "warranty_terms": cs_obj.warranty_terms,
    } if cs_obj else None
    pdf_bytes = generate_quote_pdf(detail, company_settings=cs_dict)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={detail['quote_number']}.pdf"}
    )

@router.get("/{id}/excel")
def download_quote_excel(id: int, db: Session = Depends(get_db)):
    detail = get_quote_detail(id, db)
    excel_bytes = generate_quote_excel(detail)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={detail['quote_number']}.xlsx"}
    )

@router.post("/export-excel")
def export_live_quote_excel(quote_data: Dict[str, Any]):
    excel_bytes = generate_quote_excel(quote_data)
    q_no = quote_data.get("quote_number") or "LIVE_COST_SHEET"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={q_no}.xlsx"}
    )

@router.post("/export-pdf")
def export_live_quote_pdf(quote_data: Dict[str, Any], db: Session = Depends(get_db)):
    cs_obj = db.query(CompanySettings).first()
    cs_dict = {
        "company_name": cs_obj.company_name,
        "tagline": cs_obj.tagline,
        "address": cs_obj.address,
        "phone": cs_obj.phone,
        "email": cs_obj.email,
        "website": cs_obj.website,
        "gstin": cs_obj.gstin,
        "cin": cs_obj.cin,
        "pan": cs_obj.pan,
        "payment_terms": cs_obj.payment_terms,
        "validity_days": cs_obj.validity_days,
        "delivery_terms": cs_obj.delivery_terms,
        "warranty_terms": cs_obj.warranty_terms,
    } if cs_obj else None
    pdf_bytes = generate_quote_pdf(quote_data, company_settings=cs_dict)
    q_no = quote_data.get("quote_number") or "LIVE_QUOTATION"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={q_no}.pdf"}
    )
