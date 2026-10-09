from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Quote, Customer, RFQ

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
@router.get("/stats")
def get_dashboard_summary(db: Session = Depends(get_db)):
    quotes = db.query(Quote).all()
    total_quotes = len(quotes)
    
    now = datetime.utcnow()
    quotes_this_month = [
        q for q in quotes if q.created_at and q.created_at.year == now.year and q.created_at.month == now.month
    ]
    
    total_quoted_value = sum(q.quoted_price * (q.rfq.quantity if q.rfq else 1) for q in quotes)
    avg_quote_value = (total_quoted_value / total_quotes) if total_quotes > 0 else 0.0

    status_counts = {"Draft": 0, "Sent": 0, "Won": 0, "Lost": 0}
    for q in quotes:
        st = q.status if q.status in status_counts else "Draft"
        status_counts[st] += 1

    recent = db.query(Quote).order_by(Quote.created_at.desc()).limit(8).all()
    recent_list = []
    for q in recent:
        qty = q.rfq.quantity if q.rfq else 1
        recent_list.append({
            "id": q.id,
            "quote_number": q.quote_number,
            "customer_name": q.customer.name if q.customer else "N/A",
            "customer_company": q.customer.company if q.customer else "N/A",
            "project_name": q.rfq.project_name if q.rfq else "N/A",
            "width_mm": q.width_mm,
            "height_mm": q.height_mm,
            "depth_mm": q.depth_mm,
            "dimensions": f"{int(q.width_mm)} × {int(q.height_mm)} × {int(q.depth_mm)} mm",
            "quantity": qty,
            "quoted_price": q.quoted_price,
            "quoted_price_unit": q.quoted_price,
            "quoted_price_batch": round(q.quoted_price * qty, 2),
            "status": q.status,
            "created_at": q.created_at
        })

    kpis_data = {
        "total_quotes_this_month": len(quotes_this_month),
        "total_quoted_value_month": round(total_quoted_value, 2),
        "avg_quote_value": round(avg_quote_value, 2),
        "status_counts": status_counts
    }

    return {
        "kpis": kpis_data,
        "quotes_this_month": len(quotes_this_month),
        "total_quoted_value": round(total_quoted_value, 2),
        "average_quote_value": round(avg_quote_value, 2),
        "status_counts": status_counts,
        "recent_quotes": recent_list
    }
