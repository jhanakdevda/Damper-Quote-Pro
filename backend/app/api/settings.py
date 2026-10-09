from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import CompanySettings, User
from app.api.auth import get_current_user, require_roles

router = APIRouter(prefix="/company-settings", tags=["Company Settings"])

class CompanySettingsSchema(BaseModel):
    company_name: str
    address: str
    gstin: str
    email: str
    phone: str
    logo_url: Optional[str] = ""
    quote_validity_days: int = 30
    payment_terms: str
    delivery_terms: str
    warranty_terms: str

def get_or_create_settings(db: Session) -> CompanySettings:
    cs = db.query(CompanySettings).first()
    if not cs:
        cs = CompanySettings()
        db.add(cs)
        db.commit()
        db.refresh(cs)
    return cs

@router.get("", response_model=CompanySettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    return get_or_create_settings(db)

@router.put("", dependencies=[Depends(require_roles(["Admin", "Manager"]))], response_model=CompanySettingsSchema)
def update_settings(
    payload: CompanySettingsSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cs = get_or_create_settings(db)
    cs.company_name = payload.company_name
    cs.address = payload.address
    cs.gstin = payload.gstin
    cs.email = payload.email
    cs.phone = payload.phone
    cs.logo_url = payload.logo_url or ""
    cs.quote_validity_days = payload.quote_validity_days
    cs.payment_terms = payload.payment_terms
    cs.delivery_terms = payload.delivery_terms
    cs.warranty_terms = payload.warranty_terms
    db.commit()
    db.refresh(cs)
    return cs
