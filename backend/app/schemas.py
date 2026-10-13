from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    email: str
    password: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    must_change_password: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Calculation Schemas ---
class CalculateRequest(BaseModel):
    # Size limits enforced at runtime via DamperSizeLimits table, not hardcoded here
    width_mm: Optional[float] = Field(3000.0, ge=1.0)
    height_mm: Optional[float] = Field(3000.0, ge=1.0)
    depth_mm: Optional[float] = Field(450.0, ge=1.0)
    quantity: int = Field(1, ge=1)
    markup_pct: float = Field(10.0, ge=0.0)
    damper_type: Optional[str] = "rack_and_pinion"  # rack_and_pinion | multi_blade | butterfly_valve | knife_gate_valve | ball_valve | globe_valve
    product_category: Optional[str] = "damper"  # damper | valve
    multi_blade_config: Optional[Dict[str, Any]] = None
    valve_config: Optional[Dict[str, Any]] = None
    flap_material: Optional[str] = "IS 2062"   # IS 2062 | SS 304L
    actuation_type: Optional[str] = "Electric Actuator"
    rate_overrides: Optional[Dict[str, Any]] = None
    bom_edits: Optional[List[Dict[str, Any]]] = None
    bom_additions: Optional[List[Dict[str, Any]]] = None

# --- Quote Schemas ---
class QuoteCreateRequest(BaseModel):
    customer_name: str
    customer_company: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    project_name: str
    width_mm: Optional[float] = Field(3000.0, ge=1.0)
    height_mm: Optional[float] = Field(3000.0, ge=1.0)
    depth_mm: Optional[float] = Field(450.0, ge=1.0)
    quantity: int = Field(1, ge=1)
    markup_pct: float = Field(10.0, ge=0.0)
    damper_type: Optional[str] = "rack_and_pinion"
    product_category: Optional[str] = "damper"
    multi_blade_config: Optional[Dict[str, Any]] = None
    valve_config: Optional[Dict[str, Any]] = None
    flap_material: Optional[str] = "IS 2062"
    actuation_type: Optional[str] = "Electric Actuator"
    status: Optional[str] = "Draft"
    notes: Optional[str] = None
    rate_overrides: Optional[Dict[str, Any]] = None
    bom_edits: Optional[List[Dict[str, Any]]] = None  # manual BOM line edits
    bom_additions: Optional[List[Dict[str, Any]]] = None

class QuoteUpdateRequest(BaseModel):
    customer_name: Optional[str] = None
    customer_company: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    project_name: Optional[str] = None
    width_mm: Optional[float] = Field(None, ge=1.0)
    height_mm: Optional[float] = Field(None, ge=1.0)
    depth_mm: Optional[float] = Field(None, ge=1.0)
    quantity: Optional[int] = Field(None, ge=1)
    markup_pct: Optional[float] = Field(None, ge=0.0)
    damper_type: Optional[str] = None
    multi_blade_config: Optional[Dict[str, Any]] = None
    flap_material: Optional[str] = None
    actuation_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    rate_overrides: Optional[Dict[str, Any]] = None
    bom_edits: Optional[List[Dict[str, Any]]] = None
    bom_additions: Optional[List[Dict[str, Any]]] = None

class QuoteStatusUpdate(BaseModel):
    status: str

# --- Rates Schemas ---
class RatesUpdateRequest(BaseModel):
    change_description: str
    material_rates: Dict[str, float]
    labour_rates: Dict[str, float]
    bought_out_prices: Dict[str, float]
    automation_prices: Dict[str, float]
    fabrication_rate_per_kg: float = Field(..., ge=0.0)
    finishing_rate_per_kg: float = Field(..., ge=0.0)
    default_markup_pct: float = Field(..., ge=0.0)

class WhatIfRequest(BaseModel):
    width_mm: float = 3000.0
    height_mm: float = 3000.0
    depth_mm: float = 450.0
    quantity: int = 1
    material_pct_change: Optional[float] = 0.0
    steel_is2062_pct_change: Optional[float] = 0.0
    labour_pct_change: Optional[float] = 0.0
    bought_out_pct_change: Optional[float] = 0.0
    fabrication_pct_change: Optional[float] = 0.0

class RateImportConfirm(BaseModel):
    rates: Dict[str, Any]
    change_description: str

# --- Part A: Admin Schemas ---

class SizeLimitsUpdate(BaseModel):
    width_min_mm: float = Field(1.0, ge=1.0)
    width_max_mm: float = Field(6000.0, ge=1.0)
    height_min_mm: float = Field(1.0, ge=1.0)
    height_max_mm: float = Field(6000.0, ge=1.0)
    depth_min_mm: float = Field(1.0, ge=1.0)
    depth_max_mm: float = Field(6000.0, ge=1.0)

class VerifiedSizeCreate(BaseModel):
    label: str
    width_mm: float
    height_mm: float
    depth_mm: float
    damper_type: Optional[str] = "rack_and_pinion"
    verified_weight_kg: Optional[float] = None
    verified_rm_cost: Optional[float] = None
    verified_machining_cost: Optional[float] = None
    verified_bought_out_cost: Optional[float] = None
    verified_fabrication_cost: Optional[float] = None
    verified_automation_cost: Optional[float] = None
    verified_total_cost: Optional[float] = None
    verified_quoted_price: Optional[float] = None
    source_note: Optional[str] = None

class MultiBladeRuleTableUpdate(BaseModel):
    rules_data: Any
    is_verified: Optional[bool] = None

class MultiBladeChecklistUpdate(BaseModel):
    is_completed: bool
    notes: Optional[str] = None

class ValidationRuleCreate(BaseModel):
    rule_name: str
    condition_expr: str
    severity: str = "warning"  # error | warning | info
    message: str
    active: bool = True
    sort_order: int = 0

class PartScalingPreviewRequest(BaseModel):
    width_mm: float
    height_mm: float
    depth_mm: float

class BomLineEdit(BaseModel):
    """Payload for a manual BOM edit on a single line."""
    line_index: int          # 0-based index into engine lines
    dim_1: Optional[float] = None
    dim_2: Optional[float] = None
    qty: Optional[int] = None
    moc: Optional[str] = None
    per_piece_machining: Optional[float] = None
    edit_note: Optional[str] = None
    is_delete: bool = False  # True = remove this line from BOM
