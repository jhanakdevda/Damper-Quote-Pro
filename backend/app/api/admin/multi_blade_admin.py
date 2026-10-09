import csv
import io
import math
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.auth import require_roles
from app.database import get_db
from app.models import AuditLog, MultiBladeChecklist, MultiBladeRuleTable, RatesVersion, User, VerifiedSize
from app.multi_blade_engine import (
    DEFAULT_BLADE_FACTORS,
    DEFAULT_MAX_BLADE_LENGTH_TABLE,
    DEFAULT_MULTI_BLADE_RATES,
    DEFAULT_SHAFT_DIAMETER_TABLE,
    DEFAULT_MATERIAL_DENSITIES,
    DEFAULT_BLADE_DIMENSION_LIMITS,
    PERMITTED_BLADE_PROFILES,
)
from app.schemas import MultiBladeChecklistUpdate, MultiBladeRuleTableUpdate

router = APIRouter(prefix="/multi-blade", tags=["Admin - Multi-Blade Damper"])


@router.get("/rule-tables")
def get_rule_tables(db: Session = Depends(get_db)):
    """Returns all multi-blade rule tables and dataset verification status."""
    rows = db.query(MultiBladeRuleTable).all()
    result = {}
    is_dataset_verified = False
    for r in rows:
        result[r.table_name] = {
            "table_name": r.table_name,
            "rules_data": r.rules_data,
            "is_verified": r.is_verified,
            "updated_at": r.updated_at,
        }
        if r.is_verified:
            is_dataset_verified = True

    # Fallback defaults if empty
    if "max_blade_length" not in result:
        result["max_blade_length"] = {"table_name": "max_blade_length", "rules_data": DEFAULT_MAX_BLADE_LENGTH_TABLE, "is_verified": False}
    if "shaft_diameter" not in result:
        result["shaft_diameter"] = {"table_name": "shaft_diameter", "rules_data": DEFAULT_SHAFT_DIAMETER_TABLE, "is_verified": False}
    if "blade_factors" not in result:
        result["blade_factors"] = {"table_name": "blade_factors", "rules_data": DEFAULT_BLADE_FACTORS, "is_verified": False}
    if "material_densities" not in result:
        result["material_densities"] = {"table_name": "material_densities", "rules_data": DEFAULT_MATERIAL_DENSITIES, "is_verified": False}
    if "dimension_limits" not in result:
        result["dimension_limits"] = {"table_name": "dimension_limits", "rules_data": DEFAULT_BLADE_DIMENSION_LIMITS, "is_verified": False}
    if "permitted_profiles" not in result:
        result["permitted_profiles"] = {"table_name": "permitted_profiles", "rules_data": PERMITTED_BLADE_PROFILES, "is_verified": False}

    return {
        "tables": result,
        "is_dataset_verified": is_dataset_verified,
        "notice": None if is_dataset_verified else "Placeholder multi-blade data: not company-verified",
    }


@router.put("/rule-tables/{table_name}", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_rule_table(
    table_name: str,
    payload: MultiBladeRuleTableUpdate,
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    """Updates a rule table (max_blade_length, shaft_diameter, or blade_factors)."""
    table = db.query(MultiBladeRuleTable).filter(MultiBladeRuleTable.table_name == table_name).first()
    if not table:
        table = MultiBladeRuleTable(table_name=table_name, rules_data=payload.rules_data, is_verified=payload.is_verified or False)
        db.add(table)
    else:
        table.rules_data = payload.rules_data
        if payload.is_verified is not None:
            table.is_verified = payload.is_verified
    table.updated_by_id = current_user.id
    table.updated_at = datetime.utcnow()
    db.commit()

    db.add(AuditLog(
        user_id=current_user.id,
        action="updated_multi_blade_rule_table",
        entity_type="multi_blade_rule_tables",
        entity_id=table.id,
        details={"table_name": table_name, "is_verified": table.is_verified},
    ))
    db.commit()

    return {"message": f"Rule table '{table_name}' updated successfully", "table": {"table_name": table.table_name, "rules_data": table.rules_data, "is_verified": table.is_verified}}


@router.post("/verify-toggle", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def toggle_verification_status(
    verified: bool,
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    """Toggles verified status for the multi-blade dataset. When True, placeholder banner is removed."""
    tables = db.query(MultiBladeRuleTable).all()
    for t in tables:
        t.is_verified = verified
        t.updated_by_id = current_user.id
    # Also update active RatesVersion multi_blade_rates
    rv = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    if rv:
        mb = dict(rv.multi_blade_rates or DEFAULT_MULTI_BLADE_RATES)
        mb["is_verified"] = verified
        rv.multi_blade_rates = mb

    db.add(AuditLog(
        user_id=current_user.id,
        action="toggled_multi_blade_verification",
        entity_type="multi_blade",
        entity_id=None,
        details={"is_verified": verified, "toggled_by": current_user.full_name},
    ))
    db.commit()
    return {"is_dataset_verified": verified, "message": "Multi-blade dataset marked verified." if verified else "Dataset marked unverified (placeholder banner active)."}


@router.get("/checklist")
def get_checklist(db: Session = Depends(get_db)):
    """In-app admin checklist: Data we need from the company for multi-blade dampers."""
    items = db.query(MultiBladeChecklist).order_by(MultiBladeChecklist.id.asc()).all()
    return [
        {
            "id": item.id,
            "item_key": item.item_key,
            "title": item.title,
            "description": item.description,
            "category": item.category,
            "is_completed": item.is_completed,
            "notes": item.notes,
            "updated_at": item.updated_at,
        }
        for item in items
    ]


@router.put("/checklist/{item_key}", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_checklist_item(
    item_key: str,
    payload: MultiBladeChecklistUpdate,
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    item = db.query(MultiBladeChecklist).filter(MultiBladeChecklist.item_key == item_key).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    item.is_completed = payload.is_completed
    if payload.notes is not None:
        item.notes = payload.notes
    item.updated_by_id = current_user.id
    item.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Checklist item updated", "item_key": item_key, "is_completed": item.is_completed}


@router.get("/rates")
def get_multi_blade_rates(db: Session = Depends(get_db)):
    """Fetches bought-out, seal, and actuator prices for multi-blade dampers."""
    rv = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    rates = (rv.multi_blade_rates if rv and rv.multi_blade_rates else DEFAULT_MULTI_BLADE_RATES)
    return rates


@router.put("/rates", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_multi_blade_rates(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    """Updates multi-blade prices and blade factors, creating a new rates version."""
    rv = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    if not rv:
        raise HTTPException(status_code=404, detail="Rates version not found")

    new_mb = dict(rv.multi_blade_rates or DEFAULT_MULTI_BLADE_RATES)
    for key in ("bought_out_prices", "automation_prices", "blade_factors"):
        if key in payload and isinstance(payload[key], dict):
            new_mb.setdefault(key, {})
            for sub_k, sub_v in payload[key].items():
                new_mb[key][sub_k] = float(sub_v)
    if "is_verified" in payload:
        new_mb["is_verified"] = bool(payload["is_verified"])

    new_version = RatesVersion(
        version_number=rv.version_number + 1,
        material_rates=rv.material_rates,
        labour_rates=rv.labour_rates,
        bought_out_prices=rv.bought_out_prices,
        automation_prices=rv.automation_prices,
        fabrication_rate_per_kg=rv.fabrication_rate_per_kg,
        finishing_rate_per_kg=rv.finishing_rate_per_kg,
        default_markup_pct=rv.default_markup_pct,
        multi_blade_rates=new_mb,
        created_by_id=current_user.id,
    )
    db.add(new_version)
    db.commit()

    db.add(AuditLog(
        user_id=current_user.id,
        action="updated_multi_blade_rates",
        entity_type="rates_versions",
        entity_id=new_version.id,
        details={"version_number": new_version.version_number},
    ))
    db.commit()

    return {"message": "Multi-blade rates updated in new RatesVersion", "version_number": new_version.version_number, "multi_blade_rates": new_mb}


@router.post("/rule-tables/import/preview", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
async def preview_rule_table_import(
    table_name: str,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    """Parses and validates CSV or XLSX for multi-blade rule tables with before/after comparison."""
    content = await file.read()
    filename = (file.filename or "").lower()
    records: List[Dict[str, Any]] = []

    if filename.endswith(".csv"):
        text = content.decode("utf-8-sig")
        records = list(csv.DictReader(io.StringIO(text)))
    elif filename.endswith((".xlsx", ".xlsm")):
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = wb.active
        values = sheet.iter_rows(values_only=True)
        headers = [str(v).strip() if v is not None else "" for v in next(values, ())]
        records = [dict(zip(headers, row)) for row in values]
        wb.close()
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")

    parsed_rows = []
    if table_name == "max_blade_length":
        for i, row in enumerate(records, start=2):
            try:
                t = float(row.get("thickness_mm") or row.get("thickness") or row.get("t") or 0)
                m = float(row.get("max_length_mm") or row.get("max_length") or row.get("span") or 0)
                if t <= 0 or m <= 0:
                    raise ValueError("Dimensions must be positive")
                parsed_rows.append({"thickness_mm": t, "max_length_mm": m})
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail=f"Invalid numeric data on row {i} for max_blade_length table")
    elif table_name == "shaft_diameter":
        for i, row in enumerate(records, start=2):
            try:
                m = float(row.get("max_blade_length_mm") or row.get("max_length") or 0)
                d = float(row.get("min_shaft_dia_mm") or row.get("dia") or row.get("shaft_dia") or 0)
                if m <= 0 or d <= 0:
                    raise ValueError("Dimensions must be positive")
                parsed_rows.append({"max_blade_length_mm": m, "min_shaft_dia_mm": d})
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail=f"Invalid numeric data on row {i} for shaft_diameter table")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported import table '{table_name}'")

    if not parsed_rows:
        raise HTTPException(status_code=400, detail="File contains no valid rows")

    current = db.query(MultiBladeRuleTable).filter(MultiBladeRuleTable.table_name == table_name).first()
    before_data = current.rules_data if current else []

    return {
        "table_name": table_name,
        "before": before_data,
        "after": parsed_rows,
        "row_count": len(parsed_rows),
    }
