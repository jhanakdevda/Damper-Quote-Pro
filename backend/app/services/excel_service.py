import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from typing import Dict, Any

def generate_quote_excel(quote_data: Dict[str, Any]) -> bytes:
    """
    Generates an Excel workbook with LIVE formulas matching PVDQ_26046_COST_SHEET.xlsx.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cost Sheet"
    ws.views.sheetView[0].showGridLines = True

    # Styling
    font_bold = Font(name="Calibri", size=11, bold=True)
    font_title = Font(name="Calibri", size=14, bold=True, color="1F497D")
    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_regular = Font(name="Calibri", size=10)
    font_edited = Font(name="Calibri", size=10, bold=True, color="9A3412")
    fill_header = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    fill_subtotal = PatternFill(start_color="DCE6F1", end_color="DCE6F1", fill_type="solid")
    fill_total = PatternFill(start_color="B8CCE4", end_color="B8CCE4", fill_type="solid")
    fill_final = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    fill_edited = PatternFill(start_color="FFEDD5", end_color="FFEDD5", fill_type="solid")
    font_final = Font(name="Calibri", size=11, bold=True, color="006100")
    
    thin_border = Border(
        left=Side(style='thin', color='BFBFBF'),
        right=Side(style='thin', color='BFBFBF'),
        top=Side(style='thin', color='BFBFBF'),
        bottom=Side(style='thin', color='BFBFBF')
    )

    # Title block
    W = quote_data.get("width_mm", 3000)
    H = quote_data.get("height_mm", 3000)
    D = quote_data.get("depth_mm", 450)
    q_no = quote_data.get("quote_number", "DRAFT")
    d_type = quote_data.get("damper_type", "rack_and_pinion")
    d_label = "MULTI-BLADE DAMPER" if d_type == "multi_blade" else "RACK & PINION DAMPER"
    ws.merge_cells("A2:P2")
    ws["A2"] = f"PUNE VALVE & DAMPER MFG - {d_label} COSTING FOR SIZE {int(W)}M X {int(H)}M X {int(D)}MM (QUOTE: {q_no})"
    ws["A2"].font = font_title
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
    
    accuracy_label = quote_data.get("accuracy_label") or quote_data.get("accuracy", {}).get("accuracy_label")
    rates_used = quote_data.get("rates_snapshot") or {}
    is_mb_verified = bool(rates_used.get("multi_blade_rates", {}).get("is_verified", False))
    has_mb_placeholder = (d_type == "multi_blade" and not is_mb_verified)

    cur_row = 3
    if has_mb_placeholder:
        ws.merge_cells(f"A{cur_row}:P{cur_row}")
        ws[f"A{cur_row}"] = "Placeholder multi-blade data: not company-verified"
        ws[f"A{cur_row}"].font = Font(name="Calibri", size=11, bold=True, color="9A3412")
        ws[f"A{cur_row}"].fill = fill_edited
        ws[f"A{cur_row}"].alignment = Alignment(horizontal="center")
        cur_row += 1

    if accuracy_label:
        ws.merge_cells(f"A{cur_row}:P{cur_row}")
        is_estimated = accuracy_label != "Verified size"
        ws[f"A{cur_row}"] = str(accuracy_label)
        ws[f"A{cur_row}"].font = Font(name="Calibri", size=10, bold=True, color="9A3412" if is_estimated else "006100")
        ws[f"A{cur_row}"].fill = fill_edited if is_estimated else fill_final
        ws[f"A{cur_row}"].alignment = Alignment(horizontal="center")
        cur_row += 1
        if is_estimated:
            ws.merge_cells(f"A{cur_row}:P{cur_row}")
            ws[f"A{cur_row}"] = "Estimated - to be verified by engineering"
            ws[f"A{cur_row}"].font = font_edited
            ws[f"A{cur_row}"].fill = fill_edited
            ws[f"A{cur_row}"].alignment = Alignment(horizontal="center")
            cur_row += 1

    # Table headers, dynamically starting after top notices
    header_row = cur_row + 1
    headers_r4 = [
        (f"A{header_row}", "Sr.No"), (f"B{header_row}", "Part Name"), (f"C{header_row}", "SHEET SIZE / DIM"), (f"D{header_row}", ""), (f"E{header_row}", ""),
        (f"F{header_row}", "Qty"), (f"G{header_row}", "Total Weight"), (f"H{header_row}", "MOC"), (f"I{header_row}", "Rate"), (f"J{header_row}", "RM Cost"),
        (f"K{header_row}", "MFG. COST"), (f"L{header_row}", ""), (f"M{header_row}", ""), (f"N{header_row}", ""), (f"O{header_row}", ""), (f"P{header_row}", "")
    ]
    subheader_row = header_row + 1
    headers_r5 = [
        (f"A{subheader_row}", ""), (f"B{subheader_row}", ""), (f"C{subheader_row}", "L / DIA"), (f"D{subheader_row}", "W / LENG"), (f"E{subheader_row}", "T (mm)"),
        (f"F{subheader_row}", ""), (f"G{subheader_row}", "(kg)"), (f"H{subheader_row}", ""), (f"I{subheader_row}", "Rs/kg"), (f"J{subheader_row}", "(Rs)"),
        (f"K{subheader_row}", "LC RATE"), (f"L{subheader_row}", "LC"), (f"M{subheader_row}", "Rolling"), (f"N{subheader_row}", "RC"), (f"O{subheader_row}", "MC"), (f"P{subheader_row}", "TOTAL MC")
    ]
    for cell, text in headers_r4:
        ws[cell] = text
    for cell, text in headers_r5:
        ws[cell] = text

    # Merge header cells
    ws.merge_cells(start_row=header_row, start_column=3, end_row=header_row, end_column=5)
    ws.merge_cells(start_row=header_row, start_column=11, end_row=header_row, end_column=16)
    for r in [header_row, subheader_row]:
        for c in range(1, 17):
            cell = ws.cell(row=r, column=c)
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = Alignment(horizontal="center", vertical="center")

    # Lines data (Rows 6 to 50)
    lines = quote_data.get("lines", [])
    rates = quote_data.get("rates_snapshot", {})
    start_row = subheader_row + 1
    for i, line in enumerate(lines):
        r = start_row + i
        is_round = line.get("is_round", False)
        ws.cell(row=r, column=1, value=line.get("sr_no", i+1)).alignment = Alignment(horizontal="center")
        part_name = line.get("part_name", "")
        if line.get("is_manually_edited"):
            part_name = f"{part_name} [MANUALLY EDITED]"
            if line.get("edit_note"):
                part_name = f"{part_name} - {line['edit_note']}"
        ws.cell(row=r, column=2, value=part_name).alignment = Alignment(horizontal="left")
        d1 = line.get("dim_1") if line.get("dim_1") is not None else line.get("dim1", 0)
        d2 = line.get("dim_2") if line.get("dim_2") is not None else line.get("dim2", 0)
        d3 = line.get("dim_3") if line.get("dim_3") is not None else line.get("dim3", 0)
        q = line.get("qty") if line.get("qty") is not None else line.get("quantity", 1)
        ws.cell(row=r, column=3, value=round(float(d1 or 0), 1)).alignment = Alignment(horizontal="right")
        ws.cell(row=r, column=4, value=round(float(d2 or 0), 1)).alignment = Alignment(horizontal="right")
        ws.cell(row=r, column=5, value=float(d3 or 0) if not is_round else 0).alignment = Alignment(horizontal="right")
        ws.cell(row=r, column=6, value=int(q or 1)).alignment = Alignment(horizontal="center")
        
        # LIVE FORMULA FOR WEIGHT (Column G)
        if is_round:
            ws.cell(row=r, column=7, value=f"=(0.785*C{r}*C{r}*D{r}*0.00000785)*F{r}")
        else:
            ws.cell(row=r, column=7, value=f"=(C{r}*D{r}*E{r}*0.00000785)*F{r}")
            
        ws.cell(row=r, column=8, value=line.get("moc", "IS 2062")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=9, value=float(line.get("material_rate", 72))).alignment = Alignment(horizontal="right")
        
        # LIVE FORMULA FOR RM COST (Column J)
        ws.cell(row=r, column=10, value=f"=G{r}*I{r}")
        
        # LC Rate in K
        ws.cell(row=r, column=11, value=float(line.get("plate_labour_rate", 10))).alignment = Alignment(horizontal="right")
        
        # LIVE FORMULA FOR LC (Column L)
        if is_round:
            ws.cell(row=r, column=12, value=0)
        else:
            ws.cell(row=r, column=12, value=f"=(C{r}+D{r})*2*E{r}*K{r}/1000")
            
        ws.cell(row=r, column=13, value=0) # Rolling rate
        ws.cell(row=r, column=14, value=float(line.get("rolling_cost", 0)))
        ws.cell(row=r, column=15, value=float(line.get("per_piece_machining", 0)))
        
        # LIVE FORMULA FOR TOTAL MC (Column P)
        ws.cell(row=r, column=16, value=f"=(L{r}+N{r}+O{r})*F{r}")
        
        for c in range(1, 17):
            ws.cell(row=r, column=c).font = font_regular
            ws.cell(row=r, column=c).border = thin_border
            if line.get("is_manually_edited"):
                ws.cell(row=r, column=c).fill = fill_edited
                if c == 2:
                    ws.cell(row=r, column=c).font = font_edited

    end_parts_row = start_row + len(lines) - 1
    subtotal_row = end_parts_row + 1

    # Totals Row (Row 52 equiv)
    ws.cell(row=subtotal_row, column=6, value="Total weight").font = font_bold
    ws.cell(row=subtotal_row, column=7, value=f"=SUM(G{start_row}:G{end_parts_row})").font = font_bold
    ws.cell(row=subtotal_row, column=9, value="Total RM Cost").font = font_bold
    ws.cell(row=subtotal_row, column=10, value=f"=SUM(J{start_row}:J{end_parts_row})").font = font_bold
    ws.cell(row=subtotal_row, column=15, value="Total MC Cost").font = font_bold
    ws.cell(row=subtotal_row, column=16, value=f"=SUM(P{start_row}:P{end_parts_row})").font = font_bold
    
    for c in range(1, 17):
        cell = ws.cell(row=subtotal_row, column=c)
        cell.fill = fill_subtotal
        cell.border = thin_border

    # Summary Block (Bought-outs, Automation, Fabrication, Totals)
    sr = subtotal_row + 4
    ws.cell(row=sr, column=1, value="Sr.No").font = font_bold
    ws.cell(row=sr, column=2, value="Description").font = font_bold
    ws.cell(row=sr, column=3, value="Factor/Qty").font = font_bold
    ws.cell(row=sr, column=4, value="Rate (Rs)").font = font_bold
    ws.cell(row=sr, column=5, value="Cost (Rs)").font = font_bold

    bo_breakdown = quote_data.get("bought_out_breakdown", {})
    auto_breakdown = quote_data.get("automation_breakdown", {})
    fab_rate = quote_data.get("rates_snapshot", {}).get("fabrication_rate_per_kg", 96.0)
    fin_rate = quote_data.get("rates_snapshot", {}).get("finishing_rate_per_kg", 20.0)
    markup_pct = quote_data.get("markup_pct", 10.0)
    
    # 1: RM Cost
    r1 = sr + 1
    ws.cell(row=r1, column=1, value=1)
    ws.cell(row=r1, column=2, value="Raw Material Cost")
    ws.cell(row=r1, column=3, value=1)
    ws.cell(row=r1, column=4, value=f"=J{subtotal_row}")
    ws.cell(row=r1, column=5, value=f"=C{r1}*D{r1}")

    # 2: Machining Cost
    r2 = sr + 2
    ws.cell(row=r2, column=1, value=2)
    ws.cell(row=r2, column=2, value="Machining Cost")
    ws.cell(row=r2, column=3, value=1)
    ws.cell(row=r2, column=4, value=f"=P{subtotal_row}")
    ws.cell(row=r2, column=5, value=f"=C{r2}*D{r2}")

    # 3: Rack
    r3 = sr + 3
    ws.cell(row=r3, column=1, value=3)
    ws.cell(row=r3, column=2, value="Rack (scaled with height)")
    ws.cell(row=r3, column=3, value=bo_breakdown.get("racks", {}).get("qty", 4))
    ws.cell(row=r3, column=4, value=bo_breakdown.get("racks", {}).get("unit_price", 20000.0))
    ws.cell(row=r3, column=5, value=f"=C{r3}*D{r3}")

    # 4: Drive Pinion
    r4 = sr + 4
    ws.cell(row=r4, column=1, value=4)
    ws.cell(row=r4, column=2, value="Drive Pinion")
    ws.cell(row=r4, column=3, value=2)
    ws.cell(row=r4, column=4, value=bo_breakdown.get("drive_pinions", {}).get("unit_price", 5000.0))
    ws.cell(row=r4, column=5, value=f"=C{r4}*D{r4}")

    # 5: Free Pinion
    r5 = sr + 5
    ws.cell(row=r5, column=1, value=5)
    ws.cell(row=r5, column=2, value="Free Rotated Pinion")
    ws.cell(row=r5, column=3, value=bo_breakdown.get("free_pinions", {}).get("qty", 14))
    ws.cell(row=r5, column=4, value=bo_breakdown.get("free_pinions", {}).get("unit_price", 5000.0))
    ws.cell(row=r5, column=5, value=f"=C{r5}*D{r5}")

    # 6: Bearing
    r6 = sr + 6
    ws.cell(row=r6, column=1, value=6)
    ws.cell(row=r6, column=2, value="Bearing Cost")
    ws.cell(row=r6, column=3, value=2)
    ws.cell(row=r6, column=4, value=bo_breakdown.get("bearings", {}).get("unit_price", 13000.0))
    ws.cell(row=r6, column=5, value=f"=C{r6}*D{r6}")

    # 7: Hardware
    r7 = sr + 7
    ws.cell(row=r7, column=1, value=7)
    ws.cell(row=r7, column=2, value="Hardware (lump sum)")
    ws.cell(row=r7, column=3, value=1)
    ws.cell(row=r7, column=4, value=bo_breakdown.get("hardware", {}).get("lump_sum", 50000.0))
    ws.cell(row=r7, column=5, value=f"=C{r7}*D{r7}")

    # 8: Finishing Cost
    r8 = sr + 8
    ws.cell(row=r8, column=1, value=8)
    ws.cell(row=r8, column=2, value="Finishing Cost")
    ws.cell(row=r8, column=3, value=f"=G{subtotal_row}")
    ws.cell(row=r8, column=4, value=fin_rate)
    ws.cell(row=r8, column=5, value=f"=C{r8}*D{r8}")

    # 9: Gland packing
    r9 = sr + 9
    ws.cell(row=r9, column=1, value=9)
    ws.cell(row=r9, column=2, value="Gland packing")
    ws.cell(row=r9, column=3, value=bo_breakdown.get("gland_packing", {}).get("qty", 24))
    ws.cell(row=r9, column=4, value=bo_breakdown.get("gland_packing", {}).get("unit_price", 200.0))
    ws.cell(row=r9, column=5, value=f"=C{r9}*D{r9}")

    # Damper Basic Cost
    r_basic = sr + 10
    ws.cell(row=r_basic, column=2, value="Damper Basic Cost").font = font_bold
    ws.cell(row=r_basic, column=5, value=f"=SUM(E{r1}:E{r9})").font = font_bold
    ws.cell(row=r_basic, column=5).fill = fill_subtotal

    # Automation Sub-block
    ra1 = r_basic + 2
    ws.cell(row=ra1, column=1, value=1)
    ws.cell(row=ra1, column=2, value="Electric Actuator (multi-turn)")
    ws.cell(row=ra1, column=5, value=auto_breakdown.get("actuator", 200000.0))

    ra2 = ra1 + 1
    ws.cell(row=ra2, column=1, value=2)
    ws.cell(row=ra2, column=2, value="Gear Box (multi-turn)")
    ws.cell(row=ra2, column=5, value=auto_breakdown.get("gearbox", 100000.0))

    ra3 = ra1 + 2
    ws.cell(row=ra3, column=1, value=3)
    ws.cell(row=ra3, column=2, value="Miscellaneous")
    ws.cell(row=ra3, column=5, value=auto_breakdown.get("misc", 50000.0))

    ra4 = ra1 + 3
    ws.cell(row=ra4, column=1, value=4)
    ws.cell(row=ra4, column=2, value="Manual Override")
    ws.cell(row=ra4, column=5, value=auto_breakdown.get("manual_override", 0.0))

    r_auto = ra4 + 1
    ws.cell(row=r_auto, column=2, value="Damper Automation Cost").font = font_bold
    ws.cell(row=r_auto, column=5, value=f"=SUM(E{ra1}:E{ra4})").font = font_bold
    ws.cell(row=r_auto, column=5).fill = fill_subtotal

    # Fabrication Cost
    r_fab = r_auto + 2
    ws.cell(row=r_fab, column=1, value=10)
    ws.cell(row=r_fab, column=2, value="Fabrication Cost").font = font_bold
    ws.cell(row=r_fab, column=3, value=f"=G{subtotal_row}")
    ws.cell(row=r_fab, column=4, value=fab_rate)
    ws.cell(row=r_fab, column=5, value=f"=C{r_fab}*D{r_fab}").font = font_bold
    ws.cell(row=r_fab, column=5).fill = fill_subtotal

    # Total Cost
    r_total = r_fab + 2
    ws.cell(row=r_total, column=2, value="Total Cost").font = font_bold
    ws.cell(row=r_total, column=5, value=f"=E{r_basic}+E{r_auto}+E{r_fab}").font = font_bold
    ws.cell(row=r_total, column=5).fill = fill_total

    # Quoted Price
    r_quoted = r_total + 2
    ws.cell(row=r_quoted, column=2, value=f"Quoted Price (Markup {markup_pct}%)").font = font_final
    markup_factor = 1.0 + (markup_pct / 100.0)
    ws.cell(row=r_quoted, column=5, value=f"=E{r_total}*{markup_factor}").font = font_final
    ws.cell(row=r_quoted, column=5).fill = fill_final

    # Dedicated Blade Schedule for Multi-Blade Dampers
    if d_type == "multi_blade":
        r_bs = r_quoted + 3
        ws.cell(row=r_bs, column=1, value="MULTI-BLADE DESIGN & BLADE SCHEDULE").font = font_title
        ws.merge_cells(f"A{r_bs}:J{r_bs}")

        r_bsh = r_bs + 1
        headers_sched = ["Mark", "Profile Construction", "Span (mm)", "Chord (mm)", "Depth (mm)", "Thickness (mm)", "Qty", "Single Wt (kg)", "Total Wt (kg)", "Material"]
        for col_idx, h_text in enumerate(headers_sched, start=1):
            cell = ws.cell(row=r_bsh, column=col_idx, value=h_text)
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = Alignment(horizontal="center")

        derived = quote_data.get("derived_results") or {}
        mb_cfg = quote_data.get("multi_blade_config") or {}
        sched_list = quote_data.get("blade_schedule") or []
        if not sched_list:
            sched_list = [{
                "mark": "B-01",
                "profile": mb_cfg.get("blade_type", "Flat single-skin sheet blade"),
                "span_mm": derived.get("blade_length_mm", 0),
                "chord_mm": derived.get("blade_chord_mm", 0),
                "depth_mm": derived.get("blade_breadth_depth_mm", 0),
                "thickness_mm": derived.get("blade_thickness_mm", 1.6),
                "qty": derived.get("total_blades_all_sections", 1),
                "single_weight_kg": derived.get("single_blade_weight_kg", 0),
                "total_weight_kg": derived.get("total_blade_material_weight_kg", 0),
                "material": mb_cfg.get("material", "IS 2062"),
            }]

        for idx, row_data in enumerate(sched_list):
            curr_r = r_bsh + 1 + idx
            ws.cell(row=curr_r, column=1, value=row_data.get("mark", f"B-0{idx+1}"))
            ws.cell(row=curr_r, column=2, value=str(row_data.get("profile", "")))
            ws.cell(row=curr_r, column=3, value=float(row_data.get("span_mm", 0)))
            ws.cell(row=curr_r, column=4, value=float(row_data.get("chord_mm", 0)))
            ws.cell(row=curr_r, column=5, value=float(row_data.get("depth_mm", 0)))
            ws.cell(row=curr_r, column=6, value=float(row_data.get("thickness_mm", 0)))
            ws.cell(row=curr_r, column=7, value=int(row_data.get("qty", 1)))
            ws.cell(row=curr_r, column=8, value=float(row_data.get("single_weight_kg", 0)))
            ws.cell(row=curr_r, column=9, value=f"=G{curr_r}*H{curr_r}")
            ws.cell(row=curr_r, column=10, value=str(row_data.get("material", "IS 2062")))

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
