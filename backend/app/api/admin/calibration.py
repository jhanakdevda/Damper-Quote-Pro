from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_roles
from app.database import get_db
from app.models import AuditLog, CostCalibration, User

router = APIRouter(prefix="/calibration", tags=["Admin - Cost Calibration"])
BLOCKS = ("raw_material", "mfg", "bought_out", "automation", "fabrication")
DEFAULTS = {block: {"enabled": False, "factor": 1.0} for block in BLOCKS}


def _current(db: Session) -> CostCalibration:
    row = db.query(CostCalibration).order_by(CostCalibration.id.desc()).first()
    if row is None:
        row = CostCalibration(factors=DEFAULTS.copy())
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("")
def get_calibration(db: Session = Depends(get_db)):
    row = _current(db)
    return {"factors": row.factors, "updated_at": row.updated_at}


@router.put("", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_calibration(
    payload: Dict[str, Any],
    current_user: User = Depends(require_roles(["Admin", "Manager"])),
    db: Session = Depends(get_db),
):
    supplied = payload.get("factors")
    if not isinstance(supplied, dict) or set(supplied) - set(BLOCKS):
        raise HTTPException(400, detail=f"factors must contain only: {', '.join(BLOCKS)}")
    row = _current(db)
    before = {**DEFAULTS, **(row.factors or {})}
    after = {block: dict(before[block]) for block in BLOCKS}
    for block, values in supplied.items():
        if not isinstance(values, dict) or set(values) - {"enabled", "factor"}:
            raise HTTPException(400, detail=f"Invalid calibration settings for {block}")
        enabled = values.get("enabled", after[block]["enabled"])
        factor = values.get("factor", after[block]["factor"])
        if not isinstance(enabled, bool):
            raise HTTPException(400, detail=f"{block}.enabled must be boolean")
        try:
            factor = float(factor)
        except (TypeError, ValueError):
            raise HTTPException(400, detail=f"{block}.factor must be a finite positive number")
        if not 0 < factor < float("inf"):
            raise HTTPException(400, detail=f"{block}.factor must be a finite positive number")
        after[block] = {"enabled": enabled, "factor": factor}
    if before != after:
        row.factors = after
        row.updated_by_id = current_user.id
        row.updated_at = datetime.utcnow()
        db.add(AuditLog(
            user_id=current_user.id,
            action="updated_damper_cost_calibration",
            entity_type="cost_calibration",
            entity_id=row.id,
            details={"before": before, "after": after},
        ))
        db.commit()
        db.refresh(row)
    return {"factors": row.factors, "updated_at": row.updated_at}