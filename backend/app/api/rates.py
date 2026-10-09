import io
import csv
import json
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.database import get_db
from app.models import RatesVersion, RateHistory, User, PartsLibrary
from app.schemas import RatesUpdateRequest, WhatIfRequest, RateImportConfirm
from app.api.auth import get_current_user, require_roles
from app.costing_engine import calculate_damper_cost

router = APIRouter(prefix="/rates", tags=["Rates Management"])

def validate_rates_dict(data: Dict[str, Any]):
    """Ensure all rate values are non-negative numbers."""
    def check_dict(d, name):
        for k, v in d.items():
            try:
                val = float(v)
                if val < 0:
                    raise ValueError(f"{name} '{k}' cannot be negative: {v}")
            except (TypeError, ValueError):
                raise ValueError(f"{name} '{k}' must be a valid non-negative number: {v}")

    check_dict(data.get("material_rates", {}), "Material rate")
    check_dict(data.get("labour_rates", {}), "Labour rate")
    check_dict(data.get("bought_out_prices", {}), "Bought-out price")
    check_dict(data.get("automation_prices", {}), "Automation price")
    
    if float(data.get("fabrication_rate_per_kg", 0)) < 0:
        raise ValueError("Fabrication rate cannot be negative")
    if float(data.get("finishing_rate_per_kg", 0)) < 0:
        raise ValueError("Finishing rate cannot be negative")
    if float(data.get("default_markup_pct", 0)) < 0:
        raise ValueError("Markup percentage cannot be negative")

@router.get("/current")
def get_current_rates(db: Session = Depends(get_db)):
    latest = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="No rates found in database")
    return {
        "id": latest.id,
        "version_number": latest.version_number,
        "created_at": latest.created_at,
        "created_by_id": latest.created_by_id,
        "material_rates": latest.material_rates,
        "labour_rates": latest.labour_rates,
        "bought_out_prices": latest.bought_out_prices,
        "automation_prices": latest.automation_prices,
        "fabrication_rate_per_kg": latest.fabrication_rate_per_kg,
        "finishing_rate_per_kg": latest.finishing_rate_per_kg,
        "default_markup_pct": latest.default_markup_pct
    }

@router.post("", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def update_rates(
    payload: RatesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    validate_rates_dict(payload.model_dump())
    latest = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    old_version_num = latest.version_number if latest else 0
    new_version_num = old_version_num + 1

    old_rates_snapshot = None
    if latest:
        old_rates_snapshot = {
            "version": latest.version_number,
            "material_rates": latest.material_rates,
            "labour_rates": latest.labour_rates,
            "bought_out_prices": latest.bought_out_prices,
            "automation_prices": latest.automation_prices,
            "fabrication_rate_per_kg": latest.fabrication_rate_per_kg,
            "finishing_rate_per_kg": latest.finishing_rate_per_kg,
            "default_markup_pct": latest.default_markup_pct
        }

    new_rates = RatesVersion(
        version_number=new_version_num,
        material_rates=payload.material_rates,
        labour_rates=payload.labour_rates,
        bought_out_prices=payload.bought_out_prices,
        automation_prices=payload.automation_prices,
        fabrication_rate_per_kg=payload.fabrication_rate_per_kg,
        finishing_rate_per_kg=payload.finishing_rate_per_kg,
        default_markup_pct=payload.default_markup_pct,
        created_by_id=current_user.id
    )
    db.add(new_rates)
    db.commit()

    # Log in RateHistory
    history = RateHistory(
        rate_version_id=new_rates.id,
        change_description=payload.change_description,
        previous_rates=old_rates_snapshot,
        new_rates={
            "version": new_version_num,
            "material_rates": new_rates.material_rates,
            "labour_rates": new_rates.labour_rates,
            "bought_out_prices": new_rates.bought_out_prices,
            "automation_prices": new_rates.automation_prices,
            "fabrication_rate_per_kg": new_rates.fabrication_rate_per_kg,
            "finishing_rate_per_kg": new_rates.finishing_rate_per_kg,
            "default_markup_pct": new_rates.default_markup_pct
        },
        changed_by_id=current_user.id
    )
    db.add(history)
    db.commit()

    return {"message": f"Rates updated to Version {new_version_num}", "version_number": new_version_num}

@router.get("/history")
def get_rate_history(db: Session = Depends(get_db)):
    records = db.query(RateHistory).order_by(RateHistory.created_at.desc()).all()
    out = []
    for r in records:
        user = db.query(User).filter(User.id == r.changed_by_id).first()
        out.append({
            "id": r.id,
            "rate_version_id": r.rate_version_id,
            "change_description": r.change_description,
            "changed_by": user.full_name if user else "System",
            "changed_by_email": user.email if user else "",
            "created_at": r.created_at,
            "previous_rates": r.previous_rates,
            "new_rates": r.new_rates
        })
    return out

@router.post("/what-if")
def calculate_what_if(req: WhatIfRequest, db: Session = Depends(get_db)):
    latest = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    parts = [
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

    base_rates = {
        "material_rates": dict(latest.material_rates),
        "labour_rates": dict(latest.labour_rates),
        "bought_out_prices": dict(latest.bought_out_prices),
        "automation_prices": dict(latest.automation_prices),
        "fabrication_rate_per_kg": latest.fabrication_rate_per_kg,
        "finishing_rate_per_kg": latest.finishing_rate_per_kg,
        "default_markup_pct": latest.default_markup_pct
    }

    # Base calculation
    base_calc = calculate_damper_cost(req.width_mm, req.height_mm, req.depth_mm, parts, base_rates, req.quantity)

    # Simulated rates
    sim_rates = json.loads(json.dumps(base_rates))
    if req.steel_is2062_pct_change:
        sim_rates["material_rates"]["IS 2062"] *= (1.0 + req.steel_is2062_pct_change / 100.0)
    if req.material_pct_change:
        for k in sim_rates["material_rates"]:
            if not (req.steel_is2062_pct_change and k == "IS 2062"):
                sim_rates["material_rates"][k] *= (1.0 + req.material_pct_change / 100.0)
    if req.labour_pct_change:
        for k in sim_rates["labour_rates"]:
            sim_rates["labour_rates"][k] *= (1.0 + req.labour_pct_change / 100.0)
    if req.bought_out_pct_change:
        for k in sim_rates["bought_out_prices"]:
            sim_rates["bought_out_prices"][k] *= (1.0 + req.bought_out_pct_change / 100.0)
    if req.fabrication_pct_change:
        sim_rates["fabrication_rate_per_kg"] *= (1.0 + req.fabrication_pct_change / 100.0)

    sim_calc = calculate_damper_cost(req.width_mm, req.height_mm, req.depth_mm, parts, sim_rates, req.quantity)

    diff_price = sim_calc["quoted_price"] - base_calc["quoted_price"]
    pct_price_change = (diff_price / base_calc["quoted_price"] * 100.0) if base_calc["quoted_price"] else 0.0

    return {
        "parameters": req.model_dump(),
        "baseline": {
            "total_cost": base_calc["total_cost"],
            "quoted_price": base_calc["quoted_price"],
            "raw_material_cost": base_calc["raw_material_cost"],
            "mfg_cost": base_calc["mfg_cost"],
            "bought_out_cost": base_calc["bought_out_cost"],
            "fabrication_cost": base_calc["fabrication_cost"]
        },
        "simulated": {
            "total_cost": sim_calc["total_cost"],
            "quoted_price": sim_calc["quoted_price"],
            "raw_material_cost": sim_calc["raw_material_cost"],
            "mfg_cost": sim_calc["mfg_cost"],
            "bought_out_cost": sim_calc["bought_out_cost"],
            "fabrication_cost": sim_calc["fabrication_cost"]
        },
        "impact": {
            "absolute_change_inr": round(diff_price, 2),
            "percentage_change": round(pct_price_change, 2)
        }
    }

@router.get("/export/csv")
def export_rates_csv(db: Session = Depends(get_db)):
    latest = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Category", "Item / Key", "Rate Value", "Unit / Notes"])

    for k, v in latest.material_rates.items():
        writer.writerow(["Material", k, v, "Rs/kg"])
    for k, v in latest.labour_rates.items():
        writer.writerow(["Labour", k, v, "LC Multiplier"])
    for k, v in latest.bought_out_prices.items():
        writer.writerow(["BoughtOut", k, v, "Rs each / lump"])
    for k, v in latest.automation_prices.items():
        writer.writerow(["Automation", k, v, "Rs each"])
    writer.writerow(["Fabrication", "fabrication_rate_per_kg", latest.fabrication_rate_per_kg, "Rs/kg"])
    writer.writerow(["Finishing", "finishing_rate_per_kg", latest.finishing_rate_per_kg, "Rs/kg"])
    writer.writerow(["Commercial", "default_markup_pct", latest.default_markup_pct, "Percentage %"])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=rates_version_{latest.version_number}.csv"}
    )

@router.get("/export/xlsx")
def export_rates_xlsx(db: Session = Depends(get_db)):
    latest = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Current Rates"
    ws.append(["Category", "Item / Key", "Rate Value", "Unit / Notes"])
    
    for k, v in latest.material_rates.items():
        ws.append(["Material", k, float(v), "Rs/kg"])
    for k, v in latest.labour_rates.items():
        ws.append(["Labour", k, float(v), "LC Multiplier"])
    for k, v in latest.bought_out_prices.items():
        ws.append(["BoughtOut", k, float(v), "Rs each / lump"])
    for k, v in latest.automation_prices.items():
        ws.append(["Automation", k, float(v), "Rs each"])
    ws.append(["Fabrication", "fabrication_rate_per_kg", float(latest.fabrication_rate_per_kg), "Rs/kg"])
    ws.append(["Finishing", "finishing_rate_per_kg", float(latest.finishing_rate_per_kg), "Rs/kg"])
    ws.append(["Commercial", "default_markup_pct", float(latest.default_markup_pct), "Percentage %"])

    stream = io.BytesIO()
    wb.save(stream)
    return Response(
        content=stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=rates_version_{latest.version_number}.xlsx"}
    )

@router.post("/import/preview")
async def preview_rates_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    latest = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    contents = await file.read()
    
    proposed_rates = {
        "material_rates": dict(latest.material_rates),
        "labour_rates": dict(latest.labour_rates),
        "bought_out_prices": dict(latest.bought_out_prices),
        "automation_prices": dict(latest.automation_prices),
        "fabrication_rate_per_kg": latest.fabrication_rate_per_kg,
        "finishing_rate_per_kg": latest.finishing_rate_per_kg,
        "default_markup_pct": latest.default_markup_pct
    }
    
    diffs = []
    
    # Check if CSV or Excel
    if file.filename.endswith(".csv"):
        text = contents.decode("utf-8")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
    elif file.filename.endswith(".xlsx"):
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        ws = wb.active
        rows = [[cell.value for cell in row] for row in ws.rows]
    else:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")

    # Parse rows
    header = True
    for row in rows:
        if not row or not any(row):
            continue
        if header:
            header = False
            continue
        cat = str(row[0]).strip() if row[0] is not None else ""
        key = str(row[1]).strip() if len(row) > 1 and row[1] is not None else ""
        val_raw = row[2] if len(row) > 2 else None
        
        if val_raw is None or str(val_raw).strip() == "":
            continue
            
        try:
            val = float(val_raw)
            if val < 0:
                raise ValueError(f"Value for {key} cannot be negative: {val}")
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid numeric rate for '{key}': {val_raw}")

        old_val = None
        if cat == "Material" and key in proposed_rates["material_rates"]:
            old_val = proposed_rates["material_rates"][key]
            proposed_rates["material_rates"][key] = val
        elif cat == "Labour" and key in proposed_rates["labour_rates"]:
            old_val = proposed_rates["labour_rates"][key]
            proposed_rates["labour_rates"][key] = val
        elif cat == "BoughtOut" and key in proposed_rates["bought_out_prices"]:
            old_val = proposed_rates["bought_out_prices"][key]
            proposed_rates["bought_out_prices"][key] = val
        elif cat == "Automation" and key in proposed_rates["automation_prices"]:
            old_val = proposed_rates["automation_prices"][key]
            proposed_rates["automation_prices"][key] = val
        elif key == "fabrication_rate_per_kg":
            old_val = proposed_rates["fabrication_rate_per_kg"]
            proposed_rates["fabrication_rate_per_kg"] = val
        elif key == "finishing_rate_per_kg":
            old_val = proposed_rates["finishing_rate_per_kg"]
            proposed_rates["finishing_rate_per_kg"] = val
        elif key == "default_markup_pct":
            old_val = proposed_rates["default_markup_pct"]
            proposed_rates["default_markup_pct"] = val
        else:
            raise HTTPException(status_code=400, detail=f"Unknown or rejected rate key: {key}")

        if old_val is not None and old_val != val:
            diffs.append({
                "category": cat,
                "key": key,
                "current_value": old_val,
                "new_value": val,
                "diff": round(val - old_val, 2)
            })

    return {
        "file_name": file.filename,
        "total_changes": len(diffs),
        "changes": diffs,
        "proposed_rates": proposed_rates
    }

@router.post("/import/confirm", dependencies=[Depends(require_roles(["Admin", "Manager"]))])
def confirm_rates_import(
    payload: RateImportConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    validate_rates_dict(payload.rates)
    latest = db.query(RatesVersion).order_by(RatesVersion.version_number.desc()).first()
    old_version_num = latest.version_number if latest else 0
    new_version_num = old_version_num + 1

    old_snapshot = None
    if latest:
        old_snapshot = {
            "version": latest.version_number,
            "material_rates": latest.material_rates,
            "labour_rates": latest.labour_rates,
            "bought_out_prices": latest.bought_out_prices,
            "automation_prices": latest.automation_prices,
            "fabrication_rate_per_kg": latest.fabrication_rate_per_kg,
            "finishing_rate_per_kg": latest.finishing_rate_per_kg,
            "default_markup_pct": latest.default_markup_pct
        }

    new_v = RatesVersion(
        version_number=new_version_num,
        material_rates=payload.rates["material_rates"],
        labour_rates=payload.rates["labour_rates"],
        bought_out_prices=payload.rates["bought_out_prices"],
        automation_prices=payload.rates["automation_prices"],
        fabrication_rate_per_kg=payload.rates["fabrication_rate_per_kg"],
        finishing_rate_per_kg=payload.rates["finishing_rate_per_kg"],
        default_markup_pct=payload.rates["default_markup_pct"],
        created_by_id=current_user.id
    )
    db.add(new_v)
    db.commit()

    history = RateHistory(
        rate_version_id=new_v.id,
        change_description=payload.change_description,
        previous_rates=old_snapshot,
        new_rates=payload.rates,
        changed_by_id=current_user.id
    )
    db.add(history)
    db.commit()

    return {"message": f"Successfully imported rates as Version {new_version_num}", "version_number": new_version_num}
