import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Admin, Sales, Estimation Engineer, Manager
    must_change_password = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    company = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, default="India")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PartsLibrary(Base):
    __tablename__ = "parts_library"
    
    id = Column(Integer, primary_key=True, index=True)
    sr_no = Column(Integer, index=True)
    name = Column(String, nullable=False)
    is_round = Column(Boolean, default=False)
    dim_l_or_dia = Column(Float, nullable=False)
    dim_w_or_leng = Column(Float, nullable=False)
    dim_t = Column(Float, default=0.0)
    base_qty = Column(Integer, default=1)
    default_moc = Column(String, default="IS 2062")
    dim1_scale_code = Column(String, default="blank")  # w, h, d, p, blank, custom
    dim2_scale_code = Column(String, default="blank")  # w, h, d, p, blank, custom
    qty_scale_code = Column(String, default="blank")   # r, h, p, blank, custom
    per_piece_machining = Column(Float, default=0.0)
    rolling_cost = Column(Float, default=0.0)
    active = Column(Boolean, default=True)
    # Part A: custom formula strings (safe evaluator, vars: W H D nR)
    dim1_custom_formula = Column(String, nullable=True)
    dim2_custom_formula = Column(String, nullable=True)
    qty_custom_formula = Column(String, nullable=True)

class RatesVersion(Base):
    __tablename__ = "rates_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version_number = Column(Integer, nullable=False)
    material_rates = Column(JSON, nullable=False)
    labour_rates = Column(JSON, nullable=False)
    bought_out_prices = Column(JSON, nullable=False)
    automation_prices = Column(JSON, nullable=False)
    fabrication_rate_per_kg = Column(Float, default=96.0)
    finishing_rate_per_kg = Column(Float, default=20.0)
    default_markup_pct = Column(Float, default=10.0)
    multi_blade_rates = Column(JSON, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    min_approval_value = Column(Float, nullable=True)
    min_approval_margin_pct = Column(Float, nullable=True)

class RateHistory(Base):
    __tablename__ = "rate_history"
    
    id = Column(Integer, primary_key=True, index=True)
    rate_version_id = Column(Integer, ForeignKey("rates_versions.id"), nullable=False)
    change_description = Column(String, nullable=True)
    previous_rates = Column(JSON, nullable=True)
    new_rates = Column(JSON, nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class RFQ(Base):
    __tablename__ = "rfqs"
    
    id = Column(Integer, primary_key=True, index=True)
    rfq_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    project_name = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    notes = Column(Text, nullable=True)
    width_mm = Column(Float, nullable=True)
    height_mm = Column(Float, nullable=True)
    depth_mm = Column(Float, nullable=True)
    default_moc = Column(String, nullable=True)
    actuation_type = Column(String, nullable=True)
    status = Column(String, default="Open")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Quote(Base):
    __tablename__ = "quotes"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String, unique=True, index=True, nullable=False)
    rfq_id = Column(Integer, ForeignKey("rfqs.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    depth_mm = Column(Float, nullable=False)
    
    total_weight_kg = Column(Float, nullable=False)
    raw_material_cost = Column(Float, nullable=False)
    mfg_cost = Column(Float, nullable=False)
    basic_cost = Column(Float, nullable=False)
    automation_cost = Column(Float, nullable=False)
    fabrication_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    
    markup_pct = Column(Float, default=10.0)
    margin_pct = Column(Float, default=0.0)
    quoted_price = Column(Float, nullable=False)
    
    status = Column(String, default="Draft") # Draft, Sent, Won, Lost
    rate_version_id = Column(Integer, ForeignKey("rates_versions.id"), nullable=False)
    revision_number = Column(Integer, default=1)
    is_scaled = Column(Boolean, default=False)
    # Part A & D
    damper_type = Column(String, default="rack_and_pinion")  # rack_and_pinion | multi_blade
    multi_blade_config = Column(JSON, nullable=True)
    flap_material = Column(String, default="IS 2062")
    actuation_type = Column(String, default="Electric Actuator")
    bom_has_edits = Column(Boolean, default=False)
    verified_size_id = Column(Integer, ForeignKey("verified_sizes.id"), nullable=True)
    accuracy_label = Column(String, nullable=True)
    estimation_verified = Column(Boolean, default=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    customer = relationship("Customer")
    rfq = relationship("RFQ")
    lines = relationship("QuoteLine", back_populates="quote", cascade="all, delete-orphan")
    revisions = relationship("QuoteRevision", back_populates="quote", cascade="all, delete-orphan")

class QuoteRevision(Base):
    __tablename__ = "quote_revisions"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    revision_number = Column(Integer, nullable=False)
    snapshot_data = Column(JSON, nullable=False)
    total_cost = Column(Float, nullable=False)
    quoted_price = Column(Float, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    quote = relationship("Quote", back_populates="revisions")

class QuoteLine(Base):
    __tablename__ = "quote_lines"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts_library.id"), nullable=True)
    sr_no = Column(Integer, nullable=False)
    part_name = Column(String, nullable=False)
    is_round = Column(Boolean, default=False)
    dim_1 = Column(Float, nullable=False)
    dim_2 = Column(Float, nullable=False)
    dim_3 = Column(Float, default=0.0)
    qty = Column(Integer, nullable=False)
    weight = Column(Float, nullable=False)
    moc = Column(String, nullable=False)
    material_rate = Column(Float, nullable=False)
    rm_cost = Column(Float, nullable=False)
    plate_labour_rate = Column(Float, default=0.0)
    plate_labour_cost = Column(Float, default=0.0)
    per_piece_machining = Column(Float, default=0.0)
    rolling_cost = Column(Float, default=0.0)
    mfg_cost_total = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)
    is_scaled = Column(Boolean, default=False)
    is_manually_edited = Column(Boolean, default=False)
    edit_note = Column(String, nullable=True)

    quote = relationship("Quote", back_populates="lines")

class CompanySettings(Base):
    __tablename__ = "company_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, default="PUNE VALVE & DAMPER MFG. CO. PVT. LTD.")
    address = Column(String, default="Plot No. W-45, MIDC Bhosari Industrial Area, Pune 411026, Maharashtra, India")
    gstin = Column(String, default="27AABCP1234F1Z9")
    email = Column(String, default="sales@punevalvedamper.com")
    phone = Column(String, default="+91 20 2712 8899")
    logo_url = Column(String, default="")
    quote_validity_days = Column(Integer, default=30)
    payment_terms = Column(Text, default="30% advance with Purchase Order; 70% against proforma invoice prior to dispatch.")
    delivery_terms = Column(Text, default="8 to 10 weeks from the date of technically and commercially clear order & drawing approval.")
    warranty_terms = Column(Text, default="18 months from date of supply or 12 months from date of commissioning, whichever is earlier.")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

# ── Part A new tables ────────────────────────────────────────────────────────

class DamperSizeLimits(Base):
    """Single-row admin-editable size envelope. Changes logged via AuditLog."""
    __tablename__ = "damper_size_limits"
    id = Column(Integer, primary_key=True, index=True)
    width_min_mm = Column(Float, default=1000.0)
    width_max_mm = Column(Float, default=6000.0)
    height_min_mm = Column(Float, default=1000.0)
    height_max_mm = Column(Float, default=6000.0)
    depth_min_mm = Column(Float, default=300.0)
    depth_max_mm = Column(Float, default=800.0)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class VerifiedSize(Base):
    """Company-costed reference sizes used for accuracy badge computation."""
    __tablename__ = "verified_sizes"
    id = Column(Integer, primary_key=True, index=True)
    damper_type = Column(String, default="rack_and_pinion")  # rack_and_pinion | multi_blade
    label = Column(String, nullable=False)
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    depth_mm = Column(Float, nullable=False)
    verified_weight_kg = Column(Float, nullable=True)
    verified_rm_cost = Column(Float, nullable=True)
    verified_machining_cost = Column(Float, nullable=True)
    verified_bought_out_cost = Column(Float, nullable=True)
    verified_fabrication_cost = Column(Float, nullable=True)
    verified_automation_cost = Column(Float, nullable=True)
    verified_total_cost = Column(Float, nullable=True)
    verified_quoted_price = Column(Float, nullable=True)
    source_note = Column(String, nullable=True)
    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ValidationRule(Base):
    """Editable validation rules evaluated per damper quote request."""
    __tablename__ = "validation_rules"
    id = Column(Integer, primary_key=True, index=True)
    damper_type = Column(String, default="all")  # all | rack_and_pinion | multi_blade
    rule_name = Column(String, nullable=False)
    condition_expr = Column(String, nullable=False)  # safe expr vars: W H D ratio weight
    severity = Column(String, default="warning")     # error | warning | info
    message = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CostCalibration(Base):
    __tablename__ = "cost_calibration"
    id = Column(Integer, primary_key=True, index=True)
    factors = Column(JSON, nullable=False, default=dict)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class VerifiedSizeImport(Base):
    __tablename__ = "verified_size_imports"
    id = Column(Integer, primary_key=True, index=True)
    rows = Column(JSON, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# ── Part D Multi-Blade Admin Tables ──────────────────────────────────────────

class MultiBladeRuleTable(Base):
    """Admin-configurable rule lookup tables for multi-blade dampers."""
    __tablename__ = "multi_blade_rule_tables"
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, unique=True, index=True, nullable=False)  # max_blade_length, shaft_diameter, blade_factors
    rules_data = Column(JSON, nullable=False)
    is_verified = Column(Boolean, default=False)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class MultiBladeChecklist(Base):
    """In-app admin checklist for company data required to verify multi-blade dampers."""
    __tablename__ = "multi_blade_checklist"
    id = Column(Integer, primary_key=True, index=True)
    item_key = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, default="Engineering")
    is_completed = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

