import csv
import io
import math
from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.api.auth import require_roles
from app.database import get_db
from app.models import AuditLog, User, VerifiedSize, VerifiedSizeImport
from app.schemas import VerifiedSizeCreate

router = APIRouter(prefix="/verified-sizes", tags=["Admin - Verified Sizes"])


def _serialize(row: VerifiedSize):
    return {
        "id": row.id,
        "label": row.label,
        "width_mm": row.width_mm,
        "height_mm": row.height_mm,
        "depth_mm": row.depth_mm,
        "verified_weight_kg": row.verified_weight_kg,
        "verified_rm_cost": row.verified_rm_cost,
        "verified_machining_cost": row.verified_machining_cost,
        "verified_bought_out_cost": row.verified_bought_out_cost,
        "verified_fabrication_cost": row.verified_fabrication_cost,
        "verified_automation_cost": row.verified_automation_cost,
        "verified_total_cost": row.verified_total_cost,
        "verified_quoted_price": row.verified_quoted_price,
        "source_note": row.source_note,
        "created_at": row.created_at,
    }


@router.get("")
def list_verified_sizes(db: Session = Depends(get_db)):
    rows = db.query(VerifiedSize).order_by(VerifiedSize.width_mm.asc(), VerifiedSize.height_mm.asc(), VerifiedSize.depth_mm.asc()).all()
    return [_serialize(r) for r in rows]


def _parse_import(filename: str, content: bytes):
    optional_numeric = (
        "verified_weight_kg", "verified_rm_cost", "verified_machining_cost",
        "verified_bought_out_cost", "verified_fabrication_cost",
        "verified_automation_cost", "verified_total_cost", "verified_quoted_price",
    )
    if filename.lower().endswith(".csv"):
        text = content.decode("utf-8-sig")
        records = list(csv.DictReader(io.StringIO(text)))
    elif filename.lower().endswith((".xlsx", ".xlsm")):
        from openpyxl import load_workbook
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = workbook.active
        values = sheet.iter_rows(values_only=True)
        headers = [str(value).strip() if value is not None else "" for value in next(values, ())]
        records = [dict(zip(headers, row)) for row in values]
        workbook.close()
    else:
        raise HTTPException(400, detail="Import must be a .csv or .xlsx file")
    parsed = []
    required = ("label", "width_mm", "height_mm", "depth_mm")
    for row_number, record in enumerate(records, start=2):
        if not any(value not in (None, "") for value in record.values()):
            continue
        try:
            result = {"label": str(record.get("label", "")).strip()}
            for key in ("width_mm", "height_mm", "depth_mm"):
                result[key] = float(record[key])
            for key in optional_numeric:
                value = record.get(key)
                result[key] = float(value) if value not in (None, "") else None
            result["source_note"] = record.get("source_note") or "Imported file"
        except (KeyError, TypeError, ValueError):
            raise HTTPException(400, detail=f"Invalid verified-size data on row {row_number}")
        numeric_values = [result[key] for key in required[1:]] + [result[key] for key in optional_numeric if result[key] is not None]
        if not result["label"] or any(not math.isfinite(value) for value in numeric_values) or any(result[key] <= 0 for key in required[1:]):
            raise HTTPException(400, detail=f"Row {row_number} requires a label and positive dimensions")
        parsed.append(result)
    if not parsed:
        raise HTTPException(400, detail="Import contains no verified-size rows")
    return parsed


@router.post("/import/preview", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
async def preview_verified_size_import(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    rows = _parse_import(file.filename or "", await file.read())
    before = [_serialize(row) for row in db.query(VerifiedSize).order_by(VerifiedSize.id.asc()).all()]
    staged = VerifiedSizeImport(rows=rows, created_by_id=current_user.id)
    db.add(staged)
    db.commit()
    return {"import_id": staged.id, "before": before, "after": rows, "rows_to_add": len(rows)}


@router.post("/import/{import_id}/confirm", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def confirm_verified_size_import(
    import_id: int,
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    staged = db.query(VerifiedSizeImport).filter(VerifiedSizeImport.id == import_id).first()
    if not staged:
        raise HTTPException(404, detail="Verified-size import preview not found or already confirmed")
    added = []
    for values in staged.rows:
        row = VerifiedSize(**values, added_by_id=current_user.id)
        db.add(row)
        added.append(row)
    db.flush()
    db.add(AuditLog(
        user_id=current_user.id,
        action="imported_verified_sizes",
        entity_type="verified_size_import",
        entity_id=import_id,
        details={"count": len(added), "labels": [row.label for row in added]},
    ))
    db.delete(staged)
    db.commit()
    return {"message": "Verified sizes imported", "count": len(added), "ids": [row.id for row in added]}


@router.post("", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def create_verified_size(
    payload: VerifiedSizeCreate,
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    row = VerifiedSize(
        label=payload.label,
        width_mm=payload.width_mm,
        height_mm=payload.height_mm,
        depth_mm=payload.depth_mm,
        verified_weight_kg=payload.verified_weight_kg,
        verified_rm_cost=payload.verified_rm_cost,
        verified_machining_cost=payload.verified_machining_cost,
        verified_bought_out_cost=payload.verified_bought_out_cost,
        verified_fabrication_cost=payload.verified_fabrication_cost,
        verified_automation_cost=payload.verified_automation_cost,
        verified_total_cost=payload.verified_total_cost,
        verified_quoted_price=payload.verified_quoted_price,
        source_note=payload.source_note,
        added_by_id=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.add(AuditLog(user_id=current_user.id, action="added_verified_size", entity_type="verified_size", entity_id=row.id, details={"label": row.label, "size": [row.width_mm, row.height_mm, row.depth_mm]}))
    db.commit()
    return _serialize(row)


@router.get("/nearest")
def nearest_verified_size(width_mm: float, height_mm: float, depth_mm: float, db: Session = Depends(get_db)):
    rows = db.query(VerifiedSize).all()
    if not rows:
        return {"nearest_size": None, "percent_difference": None}
    best = None
    best_diff = None
    for r in rows:
        diff = abs(r.width_mm - width_mm) + abs(r.height_mm - height_mm) + abs(r.depth_mm - depth_mm)
        if best is None or diff < best_diff:
            best = r
            best_diff = diff
    if best is None or best.verified_total_cost is None:
        return {"nearest_size": None, "percent_difference": None}
    engine_total = None
    if best.verified_total_cost:
        engine_total = best.verified_total_cost
    pct = 0.0 if engine_total == 0 else abs(engine_total - best.verified_total_cost) / best.verified_total_cost * 100.0
    return {"nearest_size": {"id": best.id, "label": best.label, "width_mm": best.width_mm, "height_mm": best.height_mm, "depth_mm": best.depth_mm}, "percent_difference": round(pct, 2), "verified_total_cost": best.verified_total_cost}


@router.put("/{size_id}", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_verified_size(size_id: int, payload: VerifiedSizeCreate, current_user: User = Depends(require_roles(["Admin", "Manager"])), db: Session = Depends(get_db)):
    row = db.query(VerifiedSize).filter(VerifiedSize.id == size_id).first()
    if not row:
        raise HTTPException(404, detail="Verified size not found")
    for field in ["label", "width_mm", "height_mm", "depth_mm", "verified_weight_kg", "verified_rm_cost", "verified_machining_cost", "verified_bought_out_cost", "verified_fabrication_cost", "verified_automation_cost", "verified_total_cost", "verified_quoted_price", "source_note"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(row, field, value)
    row.added_by_id = current_user.id
    db.commit()
    return _serialize(row)
