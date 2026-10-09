from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.auth import require_roles
from app.database import get_db
from app.models import AuditLog, PartsLibrary, User, ValidationRule
from app.costing_engine import safe_eval_formula, safe_eval_condition
from app.schemas import PartScalingPreviewRequest

router = APIRouter(prefix="/scaling-rules", tags=["Admin - Scaling Rules"])


def _serialize_part(part: PartsLibrary):
    return {
        "id": part.id,
        "sr_no": part.sr_no,
        "name": part.name,
        "dim1_scale_code": part.dim1_scale_code,
        "dim2_scale_code": part.dim2_scale_code,
        "qty_scale_code": part.qty_scale_code,
        "dim1_custom_formula": part.dim1_custom_formula,
        "dim2_custom_formula": part.dim2_custom_formula,
        "qty_custom_formula": part.qty_custom_formula,
        "base_qty": part.base_qty,
        "dim_l_or_dia": part.dim_l_or_dia,
        "dim_w_or_leng": part.dim_w_or_leng,
        "dim_t": part.dim_t,
    }


@router.get("")
def list_scaling_rules(db: Session = Depends(get_db)):
    parts = db.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all()
    return [_serialize_part(p) for p in parts]


@router.put("/{part_id}", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_scaling_rule(
    part_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    part = db.query(PartsLibrary).filter(PartsLibrary.id == part_id).first()
    if not part:
        raise HTTPException(404, detail="Part not found")
    fields = {"dim1_scale_code", "dim2_scale_code", "qty_scale_code", "dim1_custom_formula", "dim2_custom_formula", "qty_custom_formula"}
    if set(payload) - fields:
        raise HTTPException(400, detail="Unexpected scaling rule field")
    codes = {"blank", "w", "h", "d", "p", "r", "custom"}
    before = _serialize_part(part)
    for key in ("dim1_scale_code", "dim2_scale_code", "qty_scale_code"):
        if key in payload:
            if payload[key] not in codes:
                raise HTTPException(400, detail=f"Invalid scale code for {key}")
            setattr(part, key, payload[key])
    variables = {"W": 3000.0, "H": 3000.0, "D": 450.0, "nR": 4.0}
    for key in ("dim1_custom_formula", "dim2_custom_formula", "qty_custom_formula"):
        if key in payload:
            expression = payload[key]
            if expression is not None:
                try:
                    safe_eval_formula(str(expression), variables)
                except (TypeError, ValueError, ArithmeticError) as exc:
                    raise HTTPException(400, detail=f"Invalid {key}: {exc}")
            setattr(part, key, expression)
    after = _serialize_part(part)
    db.add(AuditLog(
        user_id=current_user.id,
        action="updated_damper_scaling_rule",
        entity_type="parts_library",
        entity_id=part.id,
        details={"before": before, "after": after},
    ))
    db.commit()
    return _serialize_part(part)


@router.post("/preview")
def preview_scaling_rules(payload: PartScalingPreviewRequest, db: Session = Depends(get_db)):
    width_mm = float(payload.width_mm)
    height_mm = float(payload.height_mm)
    depth_mm = float(payload.depth_mm)
    nR = 2 * __import__("math").ceil(width_mm / 1500.0)
    factors = {
        "w": width_mm / 3000.0,
        "h": height_mm / 3000.0,
        "d": depth_mm / 450.0,
        "p": (width_mm + height_mm) / 6000.0,
        "r": nR / 4.0,
        "blank": 1.0,
        "": 1.0,
    }
    rows: List[Dict[str, Any]] = []
    for part in db.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all():
        def resolve(code: str, formula_name: str):
            if code == "custom":
                expr = getattr(part, formula_name)
                if not expr:
                    return 1.0
                return safe_eval_formula(expr, {"W": width_mm, "H": height_mm, "D": depth_mm, "nR": float(nR)})
            return factors.get(code, 1.0)

        f1 = resolve(part.dim1_scale_code, "dim1_custom_formula")
        f2 = resolve(part.dim2_scale_code, "dim2_custom_formula")
        fq = resolve(part.qty_scale_code, "qty_custom_formula")
        base_dimensions = [part.dim_l_or_dia, part.dim_w_or_leng]
        result_dimensions = [base_dimensions[0] * f1, base_dimensions[1] * f2]
        qty = max(1, int(__import__("math").floor(part.base_qty * fq + 0.5)))
        rows.append({
            "part_id": part.id,
            "name": part.name,
            "base_value": base_dimensions,
            "scale_codes": {"dim1": part.dim1_scale_code, "dim2": part.dim2_scale_code, "qty": part.qty_scale_code},
            "factors": {"dim1": f1, "dim2": f2, "qty": fq},
            "result_dimensions": result_dimensions,
            "qty": qty,
        })
    return rows


@router.get("/validation-rules")
def list_validation_rules(db: Session = Depends(get_db)):
    rules = db.query(ValidationRule).order_by(ValidationRule.sort_order.asc(), ValidationRule.id.asc()).all()
    return [{"id": r.id, "rule_name": r.rule_name, "condition_expr": r.condition_expr, "severity": r.severity, "message": r.message, "active": r.active, "sort_order": r.sort_order} for r in rules]


@router.post("/validation-rules", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def add_validation_rule(payload: Dict[str, Any], current_user: User = Depends(require_roles(["Admin", "Manager"])), db: Session = Depends(get_db)):
    expression = payload.get("condition_expr") or "1 == 1"
    severity = payload.get("severity", "warning")
    if severity not in {"error", "warning", "info"}:
        raise HTTPException(400, detail="Severity must be error, warning, or info")
    try:
        safe_eval_condition(expression, {"W": 3000.0, "H": 3000.0, "D": 450.0, "ratio": 1.0, "weight": 0.0})
    except (TypeError, ValueError, ArithmeticError) as exc:
        raise HTTPException(400, detail=f"Invalid condition expression: {exc}")
    rule = ValidationRule(
        rule_name=payload.get("rule_name") or "Custom Rule",
        condition_expr=expression,
        severity=severity,
        message=payload.get("message") or "Validation warning",
        active=bool(payload.get("active", True)),
        sort_order=int(payload.get("sort_order", 0)),
    )
    db.add(rule)
    db.commit()
    db.add(AuditLog(user_id=current_user.id, action="created_validation_rule", entity_type="validation_rule", entity_id=rule.id, details={"rule_name": rule.rule_name}))
    db.commit()
    return {"id": rule.id, "rule_name": rule.rule_name, "severity": rule.severity}


@router.put("/validation-rules/{rule_id}", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_validation_rule(rule_id: int, payload: Dict[str, Any], current_user: User = Depends(require_roles(["Admin", "Manager"])), db: Session = Depends(get_db)):
    rule = db.query(ValidationRule).filter(ValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, detail="Validation rule not found")
    allowed = {"rule_name", "condition_expr", "severity", "message", "active", "sort_order"}
    if set(payload) - allowed:
        raise HTTPException(400, detail="Unexpected validation rule field")
    before = {key: getattr(rule, key) for key in allowed}
    for key, value in payload.items():
        if key == "severity" and value not in {"error", "warning", "info"}:
            raise HTTPException(400, detail="Severity must be error, warning, or info")
        if key == "condition_expr":
            try:
                safe_eval_condition(value, {"W": 3000.0, "H": 3000.0, "D": 450.0, "ratio": 1.0, "weight": 0.0})
            except (TypeError, ValueError, ArithmeticError) as exc:
                raise HTTPException(400, detail=f"Invalid condition expression: {exc}")
        setattr(rule, key, value)
    after = {key: getattr(rule, key) for key in allowed}
    db.add(AuditLog(user_id=current_user.id, action="updated_validation_rule", entity_type="validation_rule", entity_id=rule.id, details={"before": before, "after": after}))
    db.commit()
    return {"id": rule.id, "rule_name": rule.rule_name, "severity": rule.severity, "active": rule.active}


@router.delete("/validation-rules/{rule_id}", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def delete_validation_rule(rule_id: int, current_user: User = Depends(require_roles(["Admin", "Manager"])), db: Session = Depends(get_db)):
    rule = db.query(ValidationRule).filter(ValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, detail="Validation rule not found")
    db.add(AuditLog(user_id=current_user.id, action="deleted_validation_rule", entity_type="validation_rule", entity_id=rule.id, details={"rule_name": rule.rule_name}))
    db.delete(rule)
    db.commit()
    return {"message": "Validation rule deleted"}
