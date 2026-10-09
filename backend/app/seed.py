import os
import json
import datetime
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal, migrate_db
from app.models import User, Customer, PartsLibrary, RatesVersion, RFQ, Quote, QuoteLine, QuoteRevision, CompanySettings, DamperSizeLimits, VerifiedSize, ValidationRule, MultiBladeRuleTable, MultiBladeChecklist
from app.security import get_password_hash
from app.costing_engine import calculate_damper_cost
from app.multi_blade_engine import DEFAULT_MULTI_BLADE_RATES, DEFAULT_MAX_BLADE_LENGTH_TABLE, DEFAULT_SHAFT_DIAMETER_TABLE, DEFAULT_BLADE_FACTORS, calculate_multi_blade_damper_cost

SEED_JSON_PATH = os.path.join(os.path.dirname(__file__), "damper_seed_data.json")

def load_seed_json():
    with open(SEED_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def seed_database(db: Session):
    Base.metadata.create_all(bind=engine)
    migrate_db(engine)
    seed_data = load_seed_json()
    
    # 1. Seed Users if empty
    if db.query(User).count() == 0:
        admin_user = User(
            email="admin@damperquote.com",
            hashed_password=get_password_hash("DamperQuote2026!"),
            full_name="Pune Plant Admin",
            role="Admin",
            must_change_password=True
        )
        sales_user = User(
            email="sales@damperquote.com",
            hashed_password=get_password_hash("DamperQuote2026!"),
            full_name="Pune Sales Manager",
            role="Sales",
            must_change_password=True
        )
        eng_user = User(
            email="engineer@damperquote.com",
            hashed_password=get_password_hash("DamperQuote2026!"),
            full_name="Pune Chief Estimator",
            role="Estimation Engineer",
            must_change_password=True
        )
        mgr_user = User(
            email="manager@damperquote.com",
            hashed_password=get_password_hash("DamperQuote2026!"),
            full_name="Pune Vice President",
            role="Manager/Approver",
            must_change_password=True
        )
        db.add_all([admin_user, sales_user, eng_user, mgr_user])
        db.commit()

    admin_user = db.query(User).filter(User.role == "Admin").first()

    # 2. Seed RatesVersion 1 from JSON
    if db.query(RatesVersion).count() == 0:
        def_rates = seed_data["default_rates"]
        rates_v1 = RatesVersion(
            version_number=1,
            material_rates=def_rates["material_rate_per_kg"],
            labour_rates=def_rates["labour_rate"],
            bought_out_prices={
                "rack_base": def_rates["bought_out"]["rack_each_at_3000_height"],
                "drive_pinion": def_rates["bought_out"]["drive_pinion"],
                "free_pinion": def_rates["bought_out"]["free_pinion"],
                "bearing": def_rates["bought_out"]["bearing"],
                "hardware": def_rates["bought_out"]["hardware_lump"],
                "gland_packing_unit": def_rates["bought_out"]["gland_packing_each"]
            },
            automation_prices={
                "actuator": def_rates["automation"]["actuator"],
                "gearbox": def_rates["automation"]["gearbox"],
                "misc": def_rates["automation"]["miscellaneous"],
                "manual_override": def_rates["automation"]["manual_override"]
            },
            fabrication_rate_per_kg=def_rates["fabrication_per_kg"],
            finishing_rate_per_kg=def_rates["bought_out"]["finishing_per_kg"],
            default_markup_pct=def_rates["markup_pct"],
            multi_blade_rates=DEFAULT_MULTI_BLADE_RATES,
            min_approval_value=1500000.0,
            min_approval_margin_pct=8.0,
            created_by_id=admin_user.id if admin_user else None
        )
        db.add(rates_v1)
        db.commit()

    rates_v1 = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()

    # 3. Seed Parts Library from JSON
    if db.query(PartsLibrary).count() == 0:
        for p_data in seed_data["parts"]:
            part = PartsLibrary(
                sr_no=p_data["sr_no"],
                name=p_data["name"],
                is_round=p_data["is_round"],
                dim_l_or_dia=float(p_data["dim1"]),
                dim_w_or_leng=float(p_data["dim2"]),
                dim_t=float(p_data.get("thickness_mm", 0.0)),
                base_qty=int(p_data["base_qty"]),
                default_moc=p_data["material"],
                dim1_scale_code=p_data.get("dim1_scale", "blank") or "blank",
                dim2_scale_code=p_data.get("dim2_scale", "blank") or "blank",
                qty_scale_code=p_data.get("qty_scale", "blank") or "blank",
                per_piece_machining=float(p_data.get("per_piece_machining", 0.0)),
                rolling_cost=0.0,
                active=True
            )
            db.add(part)
        db.commit()

    # 4. Seed Customer, RFQ & Base Quote
    if db.query(Customer).count() == 0:
        cust = Customer(
            name="Reliance Industries Limited",
            company="Reliance Jamnagar Energy Project",
            email="procurement@ril.com",
            phone="+91 22 2278 5000",
            city="Jamnagar",
            state="Gujarat",
            country="India"
        )
        db.add(cust)
        db.commit()
        
        sales_usr = db.query(User).filter(User.role == "Sales").first()
        rfq = RFQ(
            rfq_number="RFQ-2026-001",
            customer_id=cust.id,
            project_name="High Temp Exhaust Ducting Damper",
            width_mm=3000.0,
            height_mm=3000.0,
            depth_mm=450.0,
            default_moc="IS 2062",
            actuation_type="Electric Actuator",
            quantity=1,
            notes="Reference quote for 3000x3000x450 Rack and Pinion Damper",
            status="Quoted",
            created_by_id=sales_usr.id if sales_usr else None
        )
        db.add(rfq)
        db.commit()

        db_parts = [
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
                "per_piece_machining": p.per_piece_machining,
                "rolling_cost": p.rolling_cost
            }
            for p in db.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all()
        ]
        
        rates_dict = {
            "material_rates": rates_v1.material_rates,
            "labour_rates": rates_v1.labour_rates,
            "bought_out_prices": rates_v1.bought_out_prices,
            "automation_prices": rates_v1.automation_prices,
            "fabrication_rate_per_kg": rates_v1.fabrication_rate_per_kg,
            "finishing_rate_per_kg": rates_v1.finishing_rate_per_kg,
            "default_markup_pct": rates_v1.default_markup_pct
        }
        
        calc_res = calculate_damper_cost(
            width_mm=3000.0,
            height_mm=3000.0,
            depth_mm=450.0,
            parts_data=db_parts,
            rates_data=rates_dict,
            damper_quantity=1
        )
        
        eng_usr = db.query(User).filter(User.role == "Estimation Engineer").first()
        mgr_usr = db.query(User).filter(User.role == "Manager/Approver").first()
        
        base_quote = Quote(
            quote_number="Q-2026-0001",
            rfq_id=rfq.id,
            customer_id=cust.id,
            width_mm=3000.0,
            height_mm=3000.0,
            depth_mm=450.0,
            actuation_type="Electric Actuator",
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
            status="Approved",
            rate_version_id=rates_v1.id,
            revision_number=1,
            is_scaled=False,
            estimation_verified=True,
            created_by_id=eng_usr.id if eng_usr else None,
            approved_by_id=mgr_usr.id if mgr_usr else None
        )
        db.add(base_quote)
        db.commit()

        for line in calc_res["lines"]:
            ql = QuoteLine(
                quote_id=base_quote.id,
                part_id=line["part_id"],
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
                plate_labour_rate=line["plate_labour_rate"],
                plate_labour_cost=line["plate_labour_cost"],
                per_piece_machining=line["per_piece_machining"],
                rolling_cost=line["rolling_cost"],
                mfg_cost_total=line["mfg_cost_total"],
                line_total=line["line_total"],
                is_scaled=line["is_scaled"]
            )
            db.add(ql)
        db.commit()

        snapshot = {
            "quote_id": base_quote.id,
            "quote_number": base_quote.quote_number,
            "width_mm": base_quote.width_mm,
            "height_mm": base_quote.height_mm,
            "depth_mm": base_quote.depth_mm,
            "totals": calc_res,
            "rates_snapshot": rates_dict,
            "lines": calc_res["lines"]
        }
        rev = QuoteRevision(
            quote_id=base_quote.id,
            revision_number=1,
            snapshot_data=snapshot,
            total_cost=base_quote.total_cost,
            quoted_price=base_quote.quoted_price,
            created_by_id=eng_usr.id if eng_usr else None
        )
        db.add(rev)
        db.commit()

    # Seed Part A defaults if empty
    if db.query(DamperSizeLimits).count() == 0:
        db.add(DamperSizeLimits())
        db.commit()

    if db.query(VerifiedSize).count() == 0:
        base_size = seed_data.get("reference_size_mm", {"width": 3000, "height": 3000, "depth": 450})
        base_calculation = calculate_damper_cost(
            width_mm=float(base_size.get("width", 3000)),
            height_mm=float(base_size.get("height", 3000)),
            depth_mm=float(base_size.get("depth", 450)),
            parts_data=[
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
                    "per_piece_machining": p.per_piece_machining,
                    "rolling_cost": p.rolling_cost,
                }
                for p in db.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all()
            ],
            rates_data={
                "material_rates": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().material_rates,
                "labour_rates": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().labour_rates,
                "bought_out_prices": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().bought_out_prices,
                "automation_prices": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().automation_prices,
                "fabrication_rate_per_kg": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().fabrication_rate_per_kg,
                "finishing_rate_per_kg": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().finishing_rate_per_kg,
                "default_markup_pct": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().default_markup_pct,
            },
            damper_quantity=1,
        )
        db.add(VerifiedSize(
            label="3000x3000x450 Reference",
            width_mm=3000.0,
            height_mm=3000.0,
            depth_mm=450.0,
            verified_weight_kg=base_calculation["total_weight_kg"],
            verified_rm_cost=base_calculation["raw_material_cost"],
            verified_machining_cost=base_calculation["mfg_cost"],
            verified_bought_out_cost=base_calculation["bought_out_cost"],
            verified_fabrication_cost=base_calculation["fabrication_cost"],
            verified_automation_cost=base_calculation["automation_cost"],
            verified_total_cost=base_calculation["total_cost"],
            verified_quoted_price=base_calculation["quoted_price"],
            source_note="Seeded from the company reference damper cost sheet.",
        ))
        db.commit()

    if db.query(ValidationRule).count() == 0:
        db.add_all([
            ValidationRule(rule_name="aspect_ratio_warning", condition_expr="(W/H) < 0.75 or (W/H) > 1.5", severity="warning", message="Aspect ratio is outside the recommended range.", active=True, sort_order=1),
            ValidationRule(rule_name="weight_warning", condition_expr="weight > 5000", severity="warning", message="Estimated total weight exceeds the configured warning threshold.", active=True, sort_order=2),
            ValidationRule(rule_name="size_notice", condition_expr="W < 1000 or H < 1000 or D < 300 or W > 6000 or H > 6000 or D > 800", severity="info", message="Damper size is outside the verified-size reference band.", active=True, sort_order=3),
        ])
        db.commit()

    # Seed Part D Multi-Blade tables and checklist if empty
    if db.query(MultiBladeRuleTable).count() == 0:
        db.add_all([
            MultiBladeRuleTable(
                table_name="max_blade_length",
                rules_data=DEFAULT_MAX_BLADE_LENGTH_TABLE,
                is_verified=False
            ),
            MultiBladeRuleTable(
                table_name="shaft_diameter",
                rules_data=DEFAULT_SHAFT_DIAMETER_TABLE,
                is_verified=False
            ),
            MultiBladeRuleTable(
                table_name="blade_factors",
                rules_data=DEFAULT_BLADE_FACTORS,
                is_verified=False
            ),
        ])
        db.commit()

    if db.query(MultiBladeChecklist).count() == 0:
        checklist_items = [
            ("frame_standards", "1. Frame channel standards by duct size", "Company standard C-channel dimensions & minimum sheet thickness (e.g. 150x50x3 vs 180x60x4 mm) across different duct size bands.", "Engineering"),
            ("blade_forming_factors", "2. Blade profile developed width factors", "Tooling & brake press stretch factors for Single Skin (1.5x), Double Skin (2.2x), and Aerofoil (2.5x) roll-formed sections.", "Manufacturing"),
            ("bearing_bush_pricing", "3. Sintered bronze & sealed bearing supplier rates", "Current purchase price agreements for self-lubricating sintered bronze bushes, PTFE sleeve bearings, and external spherical roller bearings.", "Procurement"),
            ("jamb_seal_extrusion", "4. Stainless steel side jamb spring seal rates", "Supplier rates per meter for 301/304 spring-temper stainless steel flexible jamb seal strips.", "Procurement"),
            ("blade_edge_seal_rates", "5. High-temperature edge seal strip pricing", "Per-meter pricing for continuous EPDM, silicone hollow bulb, and woven ceramic fibre blade tip seals.", "Procurement"),
            ("crank_linkage_specs", "6. Drive linkage crank arm geometry & tie rods", "Standard crank center-to-center radius (e.g. 75 mm / 100 mm), spherical rod-end bearings, and adjustable tie-rod turnbuckles.", "Engineering"),
            ("actuator_sizing_charts", "7. Rotary quarter-turn actuator selection chart", "AUMA / Rotork / Belimo torque sizing chart (Nm) based on duct area, differential pressure, and seal friction.", "Automation"),
            ("torque_coefficients", "8. Dynamic torque coefficients (Ct) and pressure drop", "AMCA 500-D aerodynamic pressure drop curves and dynamic operating torque coefficients.", "Engineering"),
            ("fab_assembly_hours", "9. Pune plant fabrication & assembly labour norms", "Standard shop-floor fabrication, welding, linkage synchronization, and cycle testing man-hours per square meter.", "Production"),
            ("amca_qa_procedures", "10. AMCA 500-D leakage testing procedures", "Factory acceptance test (FAT) procedure for Class I / II / III / IV leakage certification and seat testing.", "Quality Assurance"),
        ]
        for key, title, desc, cat in checklist_items:
            db.add(MultiBladeChecklist(
                item_key=key,
                title=title,
                description=desc,
                category=cat,
                is_completed=False,
                notes=None
            ))
        db.commit()

    # Seed Multi-Blade verified size if not exists
    if db.query(VerifiedSize).filter(VerifiedSize.damper_type == "multi_blade").count() == 0:
        mb_calc = calculate_multi_blade_damper_cost(
            config={
                "width_mm": 2000.0,
                "height_mm": 2000.0,
                "depth_mm": 180.0,
                "sections": 2,
                "blade_thickness_mm": 1.6,
                "frame_thickness_mm": 3.0,
                "blade_type": "Single Skin (Flat)",
                "blade_action": "Opposed",
                "actuator_type": "Electric Actuator",
            },
            rates_data={
                "material_rates": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().material_rates,
                "labour_rates": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().labour_rates,
                "fabrication_rate_per_kg": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().fabrication_rate_per_kg,
                "finishing_rate_per_kg": db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first().finishing_rate_per_kg,
                "default_markup_pct": 10.0,
                "multi_blade_rates": DEFAULT_MULTI_BLADE_RATES,
            },
            damper_quantity=1,
        )
        db.add(VerifiedSize(
            label="2000x2000x180 Multi-Blade Reference (Placeholder)",
            damper_type="multi_blade",
            width_mm=2000.0,
            height_mm=2000.0,
            depth_mm=180.0,
            verified_weight_kg=mb_calc["total_weight_kg"],
            verified_rm_cost=mb_calc["raw_material_cost"],
            verified_machining_cost=mb_calc["mfg_cost"],
            verified_bought_out_cost=mb_calc["bought_out_cost"],
            verified_fabrication_cost=mb_calc["fabrication_cost"],
            verified_automation_cost=mb_calc["automation_cost"],
            verified_total_cost=mb_calc["total_cost"],
            verified_quoted_price=mb_calc["quoted_price"],
            source_note="Placeholder multi-blade reference estimation pending company verification.",
        ))
        db.commit()

    # Seed CompanySettings if empty
    if db.query(CompanySettings).count() == 0:
        cs = CompanySettings()
        db.add(cs)
        db.commit()

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_database(db)
        print("Database successfully seeded from damper_seed_data.json.")
    finally:
        db.close()

