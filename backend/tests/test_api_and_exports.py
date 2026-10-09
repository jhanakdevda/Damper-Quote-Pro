import io
import openpyxl
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import AuditLog, CostCalibration, Quote, QuoteRevision, RatesVersion, VerifiedSize
from app.services.excel_service import generate_quote_excel
from app.services.pdf_service import generate_quote_pdf

client = TestClient(app)

def get_auth_token(email="admin@damperquote.com", password="DamperQuote2026!"):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]

def test_auth_login_and_forbidden_roles():
    """Test login for all roles and permissions"""
    eng_token = get_auth_token("engineer@damperquote.com", "DamperQuote2026!")
    assert eng_token is not None

    # Engineer should be forbidden from updating global rates (403)
    eng_headers = {"Authorization": f"Bearer {eng_token}"}
    rate_update_payload = {
        "change_description": "Unauthorized attempt",
        "material_rates": {"IS 2062": 80.0, "SS 304L": 260.0, "SS 410": 130.0, "EN8": 100.0},
        "labour_rates": {"IS 2062": 10.0, "SS 304L": 15.0, "SS 410": 1.0, "EN8": 1.0},
        "bought_out_prices": {"rack_base": 20000.0, "drive_pinion": 5000.0, "free_pinion": 5000.0, "bearing": 13000.0, "hardware": 50000.0, "gland_packing_unit": 200.0},
        "automation_prices": {"actuator": 200000.0, "gearbox": 100000.0, "misc": 50000.0, "manual_override": 0.0},
        "fabrication_rate_per_kg": 96.0,
        "finishing_rate_per_kg": 20.0,
        "default_markup_pct": 10.0
    }
    r = client.post("/api/v1/rates", json=rate_update_payload, headers=eng_headers)
    assert r.status_code == 403

def test_quote_workflow_save_revise_duplicate_restore():
    """Test full quote lifecycle: create, update/revise, duplicate, restore"""
    token = get_auth_token("engineer@damperquote.com", "DamperQuote2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Calculate live (no save)
    calc_resp = client.post("/api/v1/quotes/calculate", json={
        "width_mm": 3000,
        "height_mm": 3000,
        "depth_mm": 450,
        "quantity": 2,
        "markup_pct": 10.0
    })
    assert calc_resp.status_code == 200
    assert calc_resp.json()["quoted_price"] > 0
    assert calc_resp.json()["batch_totals"]["quoted_price"] == round(calc_resp.json()["quoted_price"] * 2, 2)

    # 2. Save quote
    create_resp = client.post("/api/v1/quotes", json={
        "customer_name": "Tata Power Ltd",
        "customer_company": "Tata Power Trombay Unit 8",
        "customer_email": "procurement@tatapower.com",
        "project_name": "Boiler Flue Gas Isolator",
        "width_mm": 3000,
        "height_mm": 3000,
        "depth_mm": 450,
        "quantity": 1,
        "markup_pct": 10.0
    }, headers=headers)
    assert create_resp.status_code == 200
    quote_id = create_resp.json()["quote_id"]

    # 3. Revise quote
    revise_resp = client.put(f"/api/v1/quotes/{quote_id}", json={
        "width_mm": 3500,
        "height_mm": 3000,
        "depth_mm": 450,
        "quantity": 1,
        "markup_pct": 12.0
    }, headers=headers)
    assert revise_resp.status_code == 200
    assert revise_resp.json()["revision_number"] == 2

    # 4. Duplicate quote
    dup_resp = client.post(f"/api/v1/quotes/{quote_id}/duplicate", headers=headers)
    assert dup_resp.status_code == 200
    dup_id = dup_resp.json()["new_quote_id"]
    assert dup_id != quote_id

    # 5. Restore Revision 1 on original quote
    restore_resp = client.post(f"/api/v1/quotes/{quote_id}/revisions/1/restore", headers=headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["revision_number"] == 3

    # Check that quote width is back to 3000
    detail_resp = client.get(f"/api/v1/quotes/{quote_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["width_mm"] == 3000.0

def test_what_if_and_rate_import_preview():
    """Test what-if simulation and import preview"""
    admin_token = get_auth_token("admin@damperquote.com", "DamperQuote2026!")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # What-if simulation (+5% steel)
    whatif_resp = client.post("/api/v1/rates/what-if", json={
        "width_mm": 3000,
        "height_mm": 3000,
        "depth_mm": 450,
        "quantity": 1,
        "steel_is2062_pct_change": 5.0
    })
    assert whatif_resp.status_code == 200
    data = whatif_resp.json()
    assert data["impact"]["percentage_change"] > 0
    assert data["simulated"]["quoted_price"] > data["baseline"]["quoted_price"]

    # Export CSV
    csv_resp = client.get("/api/v1/rates/export/csv")
    assert csv_resp.status_code == 200
    csv_content = csv_resp.content

    # Preview CSV import
    files = {"file": ("rates.csv", csv_content, "text/csv")}
    prev_resp = client.post("/api/v1/rates/import/preview", files=files, headers=headers)
    assert prev_resp.status_code == 200
    assert "proposed_rates" in prev_resp.json()

def test_live_formula_excel_and_pdf():
    """Test that Excel export has live formulas and PDF generates correctly"""
    detail_resp = client.get("/api/v1/quotes/1")
    assert detail_resp.status_code == 200
    quote_data = detail_resp.json()

    # 1. Test Excel Export
    excel_bytes = generate_quote_excel(quote_data)
    assert len(excel_bytes) > 2000

    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes), data_only=False)
    ws = wb.active
    
    # Check that cells contain formulas, not hardcoded constants
    cell_g6 = ws.cell(row=6, column=7).value
    assert str(cell_g6).startswith("=")
    assert "C6" in str(cell_g6) and "0.00000785" in str(cell_g6)
    
    cell_j6 = ws.cell(row=6, column=10).value
    assert str(cell_j6) == "=G6*I6"
    
    quoted_row = ws.max_row
    cell_quoted = ws.cell(row=quoted_row, column=5).value
    assert str(cell_quoted).startswith("=")

    # 2. Test PDF Export
    pdf_bytes = generate_quote_pdf(quote_data)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")

def test_admin_rate_update():
    """Test Admin updating rates creates new version"""
    admin_token = get_auth_token("admin@damperquote.com", "DamperQuote2026!")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Fetch current
    curr = client.get("/api/v1/rates/current").json()
    new_rates = dict(curr)
    new_rates["change_description"] = "Admin annual revision test"
    new_rates["material_rates"]["IS 2062"] = 75.0
    
    r = client.post("/api/v1/rates", json=new_rates, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["version_number"] > curr["version_number"]


def test_manual_bom_lines_are_quote_local_and_snapshotted():
    token = get_auth_token("engineer@damperquote.com", "DamperQuote2026!")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post("/api/v1/quotes", headers=headers, json={
        "customer_name": "Manual BOM Test", "customer_company": "Manual BOM Test Co",
        "project_name": "Quote-local BOM", "width_mm": 3000, "height_mm": 3000,
        "depth_mm": 450, "quantity": 1,
        "bom_edits": [{"line_index": 0, "qty": 3, "edit_note": "Adjusted quantity"},
                   {"line_index": 1, "is_delete": True}],
        "bom_additions": [{"part_name": "Custom bracket", "dim_1": 100, "dim_2": 50,
                           "dim_3": 5, "qty": 2, "moc": "IS 2062", "material_rate": 72}],
    })
    assert response.status_code == 200, response.text
    quote_id = response.json()["quote_id"]
    detail = client.get(f"/api/v1/quotes/{quote_id}").json()
    assert detail["bom_has_edits"] is True
    assert sum(line["part_name"] == "Custom bracket" for line in detail["lines"]) == 1
    assert not any(line["sr_no"] == 2 for line in detail["lines"])
    assert all(line["is_manually_edited"] for line in detail["lines"] if line["part_name"] == "Custom bracket")
    db = SessionLocal()
    try:
        revision = db.query(QuoteRevision).filter_by(quote_id=quote_id, revision_number=1).one()
        assert revision.snapshot_data["bom_has_edits"] is True
        assert any(line.get("is_manually_edited") for line in revision.snapshot_data["lines"])
        assert db.query(Quote).filter_by(id=quote_id).one().bom_has_edits is True
    finally:
        db.close()


def test_validation_warnings_and_safe_admin_rules():
    result = client.post("/api/v1/quotes/calculate", json={
        "width_mm": 6000, "height_mm": 1000, "depth_mm": 450, "quantity": 1,
    })
    assert result.status_code == 200, result.text
    assert any(warning["rule_name"] == "aspect_ratio_warning" for warning in result.json()["validation_warnings"])
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    rejected = client.post("/api/v1/admin/scaling-rules/validation-rules", headers=headers, json={
        "condition_expr": "__import__('os')", "message": "unsafe"
    })
    assert rejected.status_code == 400


def test_calibration_admin_is_opt_in_and_audited():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    current = client.get("/api/v1/admin/calibration").json()["factors"]
    assert all(not setting["enabled"] for setting in current.values())
    updated = client.put("/api/v1/admin/calibration", headers=headers, json={
        "factors": {"raw_material": {"enabled": True, "factor": 1.05}}
    })
    assert updated.status_code == 200, updated.text
    assert updated.json()["factors"]["raw_material"] == {"enabled": True, "factor": 1.05}
    db = SessionLocal()
    try:
        assert db.query(AuditLog).filter_by(action="updated_damper_cost_calibration").count() >= 1
    finally:
        db.close()
    defaults = {name: {"enabled": False, "factor": 1.0} for name in ("raw_material", "mfg", "bought_out", "automation", "fabrication")}
    reset = client.put("/api/v1/admin/calibration", headers=headers, json={"factors": defaults})
    assert reset.status_code == 200, reset.text


def test_verified_size_import_preview_then_confirm():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    before_count = len(client.get("/api/v1/admin/verified-sizes").json())
    content = b"label,width_mm,height_mm,depth_mm,verified_total_cost\nImport Test,3200,2800,450,123456\n"
    preview = client.post("/api/v1/admin/verified-sizes/import/preview", headers=headers,
                          files={"file": ("verified.csv", content, "text/csv")})
    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert len(data["before"]) == before_count
    assert data["after"][0]["label"] == "Import Test"
    assert len(client.get("/api/v1/admin/verified-sizes").json()) == before_count
    confirmed = client.post(f"/api/v1/admin/verified-sizes/import/{data['import_id']}/confirm", headers=headers)
    assert confirmed.status_code == 200, confirmed.text
    assert len(client.get("/api/v1/admin/verified-sizes").json()) == before_count + 1
    db = SessionLocal()
    try:
        imported = db.query(VerifiedSize).filter_by(label="Import Test").all()
        for row in imported:
            db.delete(row)
        db.commit()
    finally:
        db.close()
