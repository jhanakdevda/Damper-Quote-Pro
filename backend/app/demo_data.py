import sys
import argparse
from datetime import datetime, timedelta
from app.database import engine, Base, SessionLocal
from app.models import User, Customer, RFQ, Quote, QuoteLine, QuoteRevision, RatesVersion, PartsLibrary, CompanySettings
from app.seed import seed_database, load_seed_json
from app.costing_engine import calculate_damper_cost

SAMPLE_CUSTOMERS = [
    {
        "name": "Tata Steel Limited",
        "company": "Tata Steel Kalinganagar Plant",
        "email": "procurement@tatasteel.com",
        "phone": "+91 6726 261 000",
        "city": "Jajpur",
        "state": "Odisha"
    },
    {
        "name": "JSW Steel Ltd",
        "company": "JSW Steel Vijayanagar Works",
        "email": "purchase.vjn@jsw.in",
        "phone": "+91 8395 250 120",
        "city": "Toranagallu",
        "state": "Karnataka"
    },
    {
        "name": "Reliance Industries Limited",
        "company": "RIL Jamnagar Refining Complex",
        "email": "materials.jmn@ril.com",
        "phone": "+91 288 661 2000",
        "city": "Jamnagar",
        "state": "Gujarat"
    },
    {
        "name": "NTPC Limited",
        "company": "NTPC Ramagundam Super Thermal Power Station",
        "email": "contracts.ramagundam@ntpc.co.in",
        "phone": "+91 8728 272 133",
        "city": "Peddapalli",
        "state": "Telangana"
    },
    {
        "name": "Bharat Heavy Electricals Ltd (BHEL)",
        "company": "BHEL Heavy Electrical Equipment Plant",
        "email": "vendor.heep@bhel.in",
        "phone": "+91 1334 281 300",
        "city": "Haridwar",
        "state": "Uttarakhand"
    }
]

SAMPLE_QUOTES = [
    # 1. Base 3000x3000x450, Qty 1 (Won)
    {
        "cust_idx": 0,
        "project": "Blast Furnace Gas Isolation Line #2",
        "w": 3000, "h": 3000, "d": 450, "qty": 1, "markup": 10.0,
        "status": "Won", "days_ago": 25, "custom_rates": None
    },
    # 2. Base 3000x3000x450, Qty 2 (Sent)
    {
        "cust_idx": 1,
        "project": "Sinter Plant Duct Damper Revamp",
        "w": 3000, "h": 3000, "d": 450, "qty": 2, "markup": 12.0,
        "status": "Sent", "days_ago": 18, "custom_rates": None
    },
    # 3. Compact 2000x2000x400, Qty 1 (Draft)
    {
        "cust_idx": 2,
        "project": "FCCU Flue Gas Cooler Bypass",
        "w": 2000, "h": 2000, "d": 400, "qty": 1, "markup": 15.0,
        "status": "Draft", "days_ago": 12, "custom_rates": None
    },
    # 4. Large 4500x3500x500, Qty 1 (Sent)
    {
        "cust_idx": 3,
        "project": "ESP Inlet Gas Control Damper Unit #5",
        "w": 4500, "h": 3500, "d": 500, "qty": 1, "markup": 10.0,
        "status": "Sent", "days_ago": 8, "custom_rates": None
    },
    # 5. Giant 6000x6000x800, Qty 1 (Draft)
    {
        "cust_idx": 4,
        "project": "Thermal Power FGD Absorber Outlet Isolation",
        "w": 6000, "h": 6000, "d": 800, "qty": 1, "markup": 10.0,
        "status": "Draft", "days_ago": 5, "custom_rates": None
    },
    # 6. Medium 2500x2500x450, Qty 4 (Won)
    {
        "cust_idx": 0,
        "project": "Coke Oven Battery Gas Battery Interconnect",
        "w": 2500, "h": 2500, "d": 450, "qty": 4, "markup": 12.5,
        "status": "Won", "days_ago": 4, "custom_rates": None
    },
    # 7. Custom Rates 3000x3000x450, Qty 1 (Sent) - High steel rate
    {
        "cust_idx": 1,
        "project": "Hot Gas Secondary Isolation Damper",
        "w": 3000, "h": 3000, "d": 450, "qty": 1, "markup": 10.0,
        "status": "Sent", "days_ago": 2,
        "custom_rates": {"material_rates": {"IS 2062": 82.0, "SS 304L": 275.0}}
    },
    # 8. Scaled 3500x3000x500, Qty 2 (Lost - Competitor price match)
    {
        "cust_idx": 3,
        "project": "Boiler ID Fan Discharge Damper",
        "w": 3500, "h": 3000, "d": 500, "qty": 2, "markup": 8.0,
        "status": "Lost", "days_ago": 1, "custom_rates": None
    }
]

def load_demo_data(db):
    print("Loading 5 demo customers and 8 sample quotes...")
    
    # 1. Seed or get users
    eng_user = db.query(User).filter(User.role == "Estimation Engineer").first()
    if not eng_user:
        eng_user = db.query(User).first()
        
    # 2. Rates and parts
    rates_v1 = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    parts_db = db.query(PartsLibrary).order_by(PartsLibrary.sr_no.asc()).all()
    parts_list = [
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
        for p in parts_db
    ]

    base_rates = {
        "material_rates": rates_v1.material_rates,
        "labour_rates": rates_v1.labour_rates,
        "bought_out_prices": rates_v1.bought_out_prices,
        "automation_prices": rates_v1.automation_prices,
        "fabrication_rate_per_kg": rates_v1.fabrication_rate_per_kg,
        "finishing_rate_per_kg": rates_v1.finishing_rate_per_kg,
        "default_markup_pct": rates_v1.default_markup_pct
    }

    # 3. Create customers
    created_customers = []
    for cdata in SAMPLE_CUSTOMERS:
        existing = db.query(Customer).filter(Customer.name == cdata["name"]).first()
        if not existing:
            cust = Customer(**cdata)
            db.add(cust)
            db.commit()
            db.refresh(cust)
            created_customers.append(cust)
        else:
            created_customers.append(existing)

    # 4. Create sample quotes
    for idx, qdef in enumerate(SAMPLE_QUOTES):
        cust = created_customers[qdef["cust_idx"]]
        
        # Merge overrides if any
        eff_rates = dict(base_rates)
        if qdef["custom_rates"]:
            for cat, sub in qdef["custom_rates"].items():
                if isinstance(sub, dict):
                    eff_rates[cat] = {**eff_rates.get(cat, {}), **sub}
                else:
                    eff_rates[cat] = sub

        calc = calculate_damper_cost(
            width_mm=qdef["w"],
            height_mm=qdef["h"],
            depth_mm=qdef["d"],
            damper_quantity=qdef["qty"],
            rates_data=eff_rates,
            parts_data=parts_list,
            markup_pct_override=qdef["markup"]
        )

        quote_date = datetime.utcnow() - timedelta(days=qdef["days_ago"])
        q_num = f"PVDQ-26{idx+101:03d}"
        
        existing_q = db.query(Quote).filter(Quote.quote_number == q_num).first()
        if existing_q:
            continue

        rfq = RFQ(
            rfq_number=f"RFQ-2026-{idx+201:03d}",
            customer_id=cust.id,
            project_name=qdef["project"],
            quantity=qdef["qty"],
            created_at=quote_date
        )
        db.add(rfq)
        db.commit()

        quote = Quote(
            quote_number=q_num,
            rfq_id=rfq.id,
            customer_id=cust.id,
            width_mm=qdef["w"],
            height_mm=qdef["h"],
            depth_mm=qdef["d"],
            total_weight_kg=calc["total_weight_kg"],
            raw_material_cost=calc["raw_material_cost"],
            mfg_cost=calc["mfg_cost"],
            basic_cost=calc["basic_cost"],
            automation_cost=calc["automation_cost"],
            fabrication_cost=calc["fabrication_cost"],
            total_cost=calc["total_cost"],
            markup_pct=qdef["markup"],
            margin_pct=calc["margin_pct"],
            quoted_price=calc["quoted_price"],
            status=qdef["status"],
            rate_version_id=rates_v1.id,
            revision_number=1,
            is_scaled=calc["is_scaled"],
            created_by_id=eng_user.id,
            created_at=quote_date
        )
        db.add(quote)
        db.commit()

        for l in calc["lines"]:
            ql = QuoteLine(
                quote_id=quote.id,
                part_id=l["part_id"],
                sr_no=l["sr_no"],
                part_name=l["part_name"],
                is_round=l["is_round"],
                dim_1=l["dim_1"],
                dim_2=l["dim_2"],
                dim_3=l["dim_3"],
                qty=l["qty"],
                weight=l["weight"],
                moc=l["moc"],
                material_rate=l["material_rate"],
                rm_cost=l["rm_cost"],
                plate_labour_rate=l.get("plate_labour_rate", 0),
                plate_labour_cost=l.get("plate_labour_cost", 0),
                per_piece_machining=l.get("per_piece_machining", 0),
                rolling_cost=l.get("rolling_cost", 0),
                mfg_cost_total=l["mfg_cost_total"],
                line_total=l["line_total"],
                is_scaled=l["is_scaled"]
            )
            db.add(ql)

        snap = {
            "revision_number": 1,
            "width_mm": qdef["w"],
            "height_mm": qdef["h"],
            "depth_mm": qdef["d"],
            "quantity": qdef["qty"],
            "markup_pct": qdef["markup"],
            "rates_snapshot": eff_rates,
            "totals": calc,
            "lines": calc["lines"],
            "saved_at": quote_date.isoformat(),
            "saved_by": eng_user.full_name
        }
        rev = QuoteRevision(
            quote_id=quote.id,
            revision_number=1,
            snapshot_data=snap,
            total_cost=quote.total_cost,
            quoted_price=quote.quoted_price,
            created_by_id=eng_user.id,
            created_at=quote_date
        )
        db.add(rev)
        db.commit()

    print("Demo data loaded successfully! (5 customers, 8 quotes)")

def reset_database(db):
    print("Resetting database to initial clean state...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_database(db)
    print("Database reset and re-seeded successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Damper Quote Pro Demo Data Management")
    parser.add_argument("--load", action="store_true", help="Load 5 customers and 8 demo quotes")
    parser.add_argument("--reset", action="store_true", help="Drop and re-seed database")
    args = parser.parse_args()

    session = SessionLocal()
    try:
        if args.reset:
            reset_database(session)
        if args.load:
            load_demo_data(session)
        if not args.reset and not args.load:
            print("Usage: python -m app.demo_data --load   OR   python -m app.demo_data --reset")
    finally:
        session.close()
