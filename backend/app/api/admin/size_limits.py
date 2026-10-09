from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.auth import require_roles
from app.database import get_db
from app.models import AuditLog, DamperSizeLimits, User
from app.schemas import SizeLimitsUpdate

router = APIRouter(prefix="/size-limits", tags=["Admin - Size Limits"])


def _serialize(row: DamperSizeLimits):
    return {
        "id": row.id,
        "width_min_mm": row.width_min_mm,
        "width_max_mm": row.width_max_mm,
        "height_min_mm": row.height_min_mm,
        "height_max_mm": row.height_max_mm,
        "depth_min_mm": row.depth_min_mm,
        "depth_max_mm": row.depth_max_mm,
        "updated_at": row.updated_at,
    }


@router.get("")
def get_size_limits(db: Session = Depends(get_db)):
    row = db.query(DamperSizeLimits).order_by(DamperSizeLimits.id.desc()).first()
    if not row:
        row = DamperSizeLimits()
        db.add(row)
        db.commit()
    return _serialize(row)


@router.put("", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_size_limits(
    payload: SizeLimitsUpdate,
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    if payload.width_min_mm > payload.width_max_mm:
        raise HTTPException(400, detail="Width min cannot exceed width max")
    if payload.height_min_mm > payload.height_max_mm:
        raise HTTPException(400, detail="Height min cannot exceed height max")
    if payload.depth_min_mm > payload.depth_max_mm:
        raise HTTPException(400, detail="Depth min cannot exceed depth max")

    row = db.query(DamperSizeLimits).order_by(DamperSizeLimits.id.desc()).first()
    if not row:
        row = DamperSizeLimits()

    row.width_min_mm = payload.width_min_mm
    row.width_max_mm = payload.width_max_mm
    row.height_min_mm = payload.height_min_mm
    row.height_max_mm = payload.height_max_mm
    row.depth_min_mm = payload.depth_min_mm
    row.depth_max_mm = payload.depth_max_mm
    row.updated_by_id = current_user.id
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()

    db.add(AuditLog(
        user_id=current_user.id,
        action="updated_damper_size_limits",
        entity_type="damper_size_limits",
        entity_id=row.id,
        details={"size_limits": _serialize(row)},
    ))
    db.commit()
    return _serialize(row)
