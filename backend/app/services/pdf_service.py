import io
from html import escape
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from typing import Dict, Any, Optional

def fmt_inr(val: float) -> str:
    """Formats number in Indian Rupees format"""
    return f"Rs. {val:,.2f}"

def generate_quote_pdf(quote_data: Dict[str, Any], company_settings: Optional[Dict[str, Any]] = None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    style_company_name = ParagraphStyle(
        'CompanyName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1E3A8A')
    )
    style_company_sub = ParagraphStyle(
        'CompanySub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#4B5563')
    )
    style_title = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#111827'),
        alignment=1 # Center
    )
    style_sec_head = ParagraphStyle(
        'SecHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#1E3A8A')
    )
    style_body = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1F2937')
    )
    style_body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#111827')
    )
    style_badge = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#9A3412'),
        alignment=1
    )

    story = []

    # Settings fallback
    cs = company_settings or {}
    comp_name = cs.get("company_name", "PUNE VALVE & DAMPER MFG. CO. PVT. LTD.")
    comp_addr = cs.get("address", "Plot No. W-45, MIDC Bhosari Industrial Area, Pune 411026, Maharashtra, India")
    comp_gstin = cs.get("gstin", "27AABCP1234F1Z9")
    comp_email = cs.get("email", "sales@punevalvedamper.com")
    comp_phone = cs.get("phone", "+91 20 2712 8899")
    validity_days = cs.get("quote_validity_days", 30)

    # 1. Header with Company Info & Quote Meta
    comp_info = [
        Paragraph(f"<b>{comp_name}</b>", style_company_name),
        Paragraph(comp_addr, style_company_sub),
        Paragraph(f"Tel: {comp_phone} | Email: {comp_email} | GSTIN: {comp_gstin}", style_company_sub)
    ]
    
    q_num = quote_data.get("quote_number", "DRAFT-001")
    created_at = quote_data.get("created_at") or datetime.now().strftime("%d-%b-%Y")
    
    meta_info = [
        Paragraph(f"<b>QUOTATION REF:</b> {q_num}", style_body_bold),
        Paragraph(f"<b>Date:</b> {created_at}", style_body),
        Paragraph(f"<b>Validity:</b> {validity_days} Days from date of issue", style_body),
        Paragraph(f"<b>Status:</b> {quote_data.get('status', 'Draft')}", style_body)
    ]

    header_table = Table([[comp_info, meta_info]], colWidths=[350, 190])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceBefore=2, spaceAfter=6))

    # Title
    story.append(Paragraph("COMMERCIAL & TECHNICAL QUOTATION", style_title))
    story.append(Spacer(1, 6))

    # Accuracy status is based on the verified-size register, not geometry scaling alone.
    accuracy_label = quote_data.get("accuracy_label") or quote_data.get("accuracy", {}).get("accuracy_label")
    if not accuracy_label:
        accuracy_label = "Verified size" if not quote_data.get("is_scaled", False) else "Estimated size"
    is_estimated = accuracy_label != "Verified size"
    badge_rows = [[Paragraph(f"<b>{escape(str(accuracy_label))}</b>", style_badge)]]
    if is_estimated:
        badge_rows.append([Paragraph("<b>Estimated - to be verified by engineering</b>", style_badge)])
    if quote_data.get("bom_has_edits"):
        badge_rows.append([Paragraph("<b>Quotation includes manually edited BOM lines</b>", style_badge)])
    # Placeholder banner for multi-blade data
    damper_type = quote_data.get("damper_type") or "rack_and_pinion"
    rates_used = quote_data.get("rates_snapshot") or {}
    is_mb_verified = bool(rates_used.get("multi_blade_rates", {}).get("is_verified", False))
    if damper_type == "multi_blade" and not is_mb_verified:
        badge_rows.append([Paragraph("<b>Placeholder multi-blade data: not company-verified</b>", style_badge)])

    badge_table = Table(badge_rows, colWidths=[540])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFEDD5') if is_estimated else colors.HexColor('#DCFCE7')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#F97316') if is_estimated else colors.HexColor('#16A34A')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 6))

    edited_lines = [line for line in quote_data.get("lines", []) if line.get("is_manually_edited")]
    if edited_lines:
        story.append(Paragraph("MANUALLY EDITED BOM LINES", style_sec_head))
        edited_rows = [[
            Paragraph("<b>Part</b>", style_body_bold), Paragraph("<b>Dimensions (mm)</b>", style_body_bold),
            Paragraph("<b>Qty</b>", style_body_bold), Paragraph("<b>Line Total</b>", style_body_bold),
            Paragraph("<b>Edit Note</b>", style_body_bold),
        ]]
        for line in edited_lines:
            edited_rows.append([
                Paragraph(escape(str(line.get("part_name", ""))) + " <b>[MANUALLY EDITED]</b>", style_body),
                Paragraph(f"{line.get('dim_1', 0)} x {line.get('dim_2', 0)} x {line.get('dim_3', 0)}", style_body),
                Paragraph(str(line.get("qty", 0)), style_body),
                Paragraph(fmt_inr(float(line.get("line_total", 0))), style_body),
                Paragraph(escape(str(line.get("edit_note") or "Manual BOM edit")), style_body),
            ])
        edited_table = Table(edited_rows, colWidths=[145, 105, 35, 85, 170], repeatRows=1)
        edited_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FEF3C7')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D97706')),
            ('INNERGRID', (0, 0), (-1, -1), 0.35, colors.HexColor('#E5E7EB')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(Spacer(1, 3))
        story.append(edited_table)
        story.append(Spacer(1, 6))

    # 2. Customer & Project Details
    cust_data = [
        [Paragraph("<b>CUSTOMER / CLIENT:</b>", style_body_bold), Paragraph("<b>PROJECT DETAILS:</b>", style_body_bold)],
        [
            Paragraph(f"<b>Client:</b> {quote_data.get('customer_name', 'M/s Industrial Client')}<br/>"
                      f"<b>Company:</b> {quote_data.get('customer_company', quote_data.get('customer_name', 'Client'))}<br/>"
                      f"<b>Contact:</b> {quote_data.get('customer_email', 'procurement@client.com')} | {quote_data.get('customer_phone', '+91 20 0000 0000')}", style_body),
            Paragraph(f"<b>Project:</b> {quote_data.get('project_name', 'Flue Gas Isolation Damper')}<br/>"
                      f"<b>Application:</b> Industrial Duct Airflow Isolation & Throttling<br/>"
                      f"<b>RFQ Ref:</b> {quote_data.get('rfq_ref', 'RFQ-2026-001')}", style_body)
        ]
    ]
    t_cust = Table(cust_data, colWidths=[270, 270])
    t_cust.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_cust)
    story.append(Spacer(1, 8))

    # 3. Technical Specification
    W = quote_data.get("width_mm", 3000)
    H = quote_data.get("height_mm", 3000)
    D = quote_data.get("depth_mm", 450)
    qty = quote_data.get("quantity") or quote_data.get("rfq", {}).get("quantity") or 1
    total_wt = quote_data.get("total_weight_kg") or quote_data.get("totals", {}).get("total_weight_kg", 0)
    mb_cfg = quote_data.get("multi_blade_config") or {}
    derived = quote_data.get("derived_results") or {}

    if damper_type == "multi_blade":
        dim_src = derived.get("dimension_sources") or {}
        prof_type = mb_cfg.get("blade_type") or derived.get("profile_type") or "Flat single-skin sheet blade"
        is_est = derived.get("is_estimated_profile", False)
        est_tag = " [Approximate/Design Estimate]" if is_est else ""
        
        spec_rows = [
            [Paragraph("<b>Parameter</b>", style_body_bold), Paragraph("<b>Specification Value</b>", style_body_bold)],
            [Paragraph("Equipment Type", style_body), Paragraph(f"Multi-Blade (Louvered) Damper{est_tag}", style_body)],
            [Paragraph("Duct Opening Size", style_body), Paragraph(f"{int(W)} mm (W) x {int(H)} mm (H) x {int(D)} mm (D)", style_body)],
            [Paragraph("Blade Construction Profile", style_body), Paragraph(f"{prof_type} • Mode: {mb_cfg.get('blade_mode', 'AUTO')}", style_body)],
            [Paragraph("Sections & Mullions", style_body), Paragraph(f"{mb_cfg.get('sections', 1)} Section(s) with structural intermediate support", style_body)],
            [Paragraph("Blade Orientation & Action", style_body), Paragraph(f"{mb_cfg.get('blade_orientation', 'Horizontal')} • {mb_cfg.get('blade_action', 'Opposed')} action", style_body)],
            [Paragraph("Blade Dimensions (Finished)", style_body), Paragraph(f"Span: {derived.get('blade_length_mm', '-')} mm • Chord: {derived.get('blade_chord_mm', '-')} mm • Depth: {derived.get('blade_breadth_depth_mm', '-')} mm • Thickness: {derived.get('blade_thickness_mm', mb_cfg.get('blade_thickness_mm', 1.6))} mm", style_body)],
            [Paragraph("Pitch & Overlap", style_body), Paragraph(f"Pitch: {derived.get('blade_pitch_mm', '-')} mm • Overlap: {mb_cfg.get('overlap_pct', 10.0)}% • Dev Sheet Width: {derived.get('blade_developed_width_mm', '-')} mm", style_body)],
            [Paragraph("Shaft & Bearings", style_body), Paragraph(f"Dia {mb_cfg.get('shaft_diameter_mm', 16)} mm {mb_cfg.get('shaft_material', 'EN8')} with {mb_cfg.get('bearing_type', 'Bush')} bearings", style_body)],
            [Paragraph("Seals (Edge & Side)", style_body), Paragraph(f"Edge: {mb_cfg.get('edge_seal', 'Rubber')} • Side: {mb_cfg.get('side_seal', 'Stainless Steel')}", style_body)],
            [Paragraph("Drive & Actuation", style_body), Paragraph(f"{mb_cfg.get('actuator_type', 'Electric Actuator')} with side crank-rod linkage", style_body)],
            [Paragraph("Operating Conditions", style_body), Paragraph(f"Temp: {mb_cfg.get('temperature_c', 40)} °C • Max Press: {mb_cfg.get('max_pressure_pa', 500)} Pa • Free Area: {derived.get('free_area_pct', '-')}%", style_body)],
            [Paragraph("Total Steel Weight (per unit)", style_body), Paragraph(f"{total_wt:,.2f} kg (Blade Material: {derived.get('total_blade_material_weight_kg', '-')} kg)", style_body)],
        ]
        # Blade Schedule Table
        blade_sched_rows = [
            [
                Paragraph("<b>Mark</b>", style_body_bold),
                Paragraph("<b>Construction Profile</b>", style_body_bold),
                Paragraph("<b>Span (mm)</b>", style_body_bold),
                Paragraph("<b>Chord (mm)</b>", style_body_bold),
                Paragraph("<b>Depth (mm)</b>", style_body_bold),
                Paragraph("<b>Thk (mm)</b>", style_body_bold),
                Paragraph("<b>Qty</b>", style_body_bold),
                Paragraph("<b>Unit Wt (kg)</b>", style_body_bold),
                Paragraph("<b>Total Wt (kg)</b>", style_body_bold),
            ],
            [
                Paragraph("B-01", style_body),
                Paragraph(f"{prof_type}{' *' if is_est else ''}", style_body),
                Paragraph(f"{derived.get('blade_length_mm', '-')}", style_body),
                Paragraph(f"{derived.get('blade_chord_mm', '-')}", style_body),
                Paragraph(f"{derived.get('blade_breadth_depth_mm', '-')}", style_body),
                Paragraph(f"{derived.get('blade_thickness_mm', mb_cfg.get('blade_thickness_mm', 1.6))}", style_body),
                Paragraph(f"{derived.get('total_blades_all_sections', derived.get('blade_count', '-'))}", style_body),
                Paragraph(f"{derived.get('single_blade_weight_kg', '-')}", style_body),
                Paragraph(f"{derived.get('total_blade_material_weight_kg', '-')}", style_body),
            ]
        ]
        t_sched = Table(blade_sched_rows, colWidths=[40, 130, 55, 55, 50, 50, 40, 60, 60])
        t_sched.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FEF3C7')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#F59E0B')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#FDE68A')),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
    else:
        spec_rows = [
            [Paragraph("<b>Parameter</b>", style_body_bold), Paragraph("<b>Specification Value</b>", style_body_bold)],
            [Paragraph("Equipment Type", style_body), Paragraph("Rack and Pinion Heavy-Duty Sliding-Flap Damper", style_body)],
            [Paragraph("Nominal Duct Size", style_body), Paragraph(f"{int(W)} mm (Width) x {int(H)} mm (Height) x {int(D)} mm (Depth)", style_body)],
            [Paragraph("Housing Material (MOC)", style_body), Paragraph("IS 2062 Grade B Structural Carbon Steel", style_body)],
            [Paragraph("Blade / Flap Plate MOC", style_body), Paragraph("SS 304L Stainless Steel (12 mm thick reinforced)", style_body)],
            [Paragraph("Shaft & Pinion MOC", style_body), Paragraph("SS 410 Shaft (Dia 90 mm) / EN8 Forged Machined Pinions", style_body)],
            [Paragraph("Sealing & Gland", style_body), Paragraph("SS 304L flexible seals with multi-ring gland packing", style_body)],
            [Paragraph("Drive & Actuation", style_body), Paragraph("Multi-turn Electric Actuator with heavy-duty Bevel Gearbox", style_body)],
            [Paragraph("Total Steel Weight (per unit)", style_body), Paragraph(f"{total_wt:,.2f} kg", style_body)]
        ]
        t_sched = None

    t_spec = Table(spec_rows, colWidths=[200, 340])
    t_spec.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E0E7FF')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#C7D2FE')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E0E7FF')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    story.append(Paragraph("TECHNICAL SPECIFICATION SUMMARY", style_sec_head))
    story.append(Spacer(1, 2))
    story.append(t_spec)
    if t_sched:
        story.append(Spacer(1, 4))
        story.append(Paragraph("BLADE SCHEDULE", style_sec_head))
        story.append(Spacer(1, 2))
        story.append(t_sched)
    story.append(Spacer(1, 8))

    # 4. Commercial Pricing Table (Extract unit price robustly)
    unit_price = float(
        quote_data.get("quoted_price") or 
        quote_data.get("totals", {}).get("quoted_price") or 
        quote_data.get("quoted_price_unit") or 
        0
    )
    total_price = float(
        quote_data.get("quoted_price_batch") or 
        quote_data.get("totals", {}).get("batch_totals", {}).get("quoted_price") or 
        (unit_price * qty)
    )
    gst_amt = total_price * 0.18
    grand_total = total_price + gst_amt

    comm_rows = [
        [Paragraph("<b>Sr</b>", style_body_bold), Paragraph("<b>Item Description</b>", style_body_bold),
         Paragraph("<b>Qty</b>", style_body_bold), Paragraph("<b>Unit Rate (INR)</b>", style_body_bold), Paragraph("<b>Batch Total (INR)</b>", style_body_bold)],
        [
            Paragraph("1", style_body),
            Paragraph(f"Design, engineering, manufacturing and supply of Rack-and-Pinion Sliding-Flap Damper size {int(W)}x{int(H)}x{int(D)} mm with electric actuator & gearbox", style_body),
            Paragraph(f"{qty} No(s)", style_body),
            Paragraph(fmt_inr(unit_price), style_body),
            Paragraph(fmt_inr(total_price), style_body)
        ],
        ["", "", "", Paragraph("<b>Basic Total:</b>", style_body_bold), Paragraph(fmt_inr(total_price), style_body_bold)],
        ["", "", "", Paragraph("<b>GST @ 18%:</b>", style_body_bold), Paragraph(fmt_inr(gst_amt), style_body)],
        ["", "", "", Paragraph("<b>Grand Total:</b>", style_body_bold), Paragraph(f"<b>{fmt_inr(grand_total)}</b>", style_body_bold)]
    ]
    t_comm = Table(comm_rows, colWidths=[25, 275, 45, 95, 100])
    t_comm.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#9CA3AF')),
        ('INNERGRID', (0, 0), (-1, 1), 0.5, colors.HexColor('#E5E7EB')),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#1E3A8A')),
        ('BACKGROUND', (3, 2), (-1, -1), colors.HexColor('#F9FAFB')),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
    ]))
    story.append(Paragraph("COMMERCIAL PRICING BREAKDOWN", style_sec_head))
    story.append(Spacer(1, 2))
    story.append(t_comm)
    story.append(Spacer(1, 8))

    # 5. Terms and Conditions (Using settings)
    p_terms = cs.get("payment_terms", "30% advance with Purchase Order; 70% against proforma invoice prior to dispatch.")
    d_terms = cs.get("delivery_terms", "8 to 10 weeks from the date of technically and commercially clear order & drawing approval.")
    w_terms = cs.get("warranty_terms", "18 months from date of supply or 12 months from date of commissioning, whichever is earlier.")

    terms = [
        [Paragraph("<b>STANDARD TERMS & CONDITIONS:</b>", style_body_bold)],
        [Paragraph(f"• <b>Price Basis:</b> Ex-works Pune, packing included. Freight at actuals extra to client account.<br/>"
                   f"• <b>Taxes:</b> Goods & Services Tax (GST) payable extra as applicable (presently 18%).<br/>"
                   f"• <b>Payment Terms:</b> {p_terms}<br/>"
                   f"• <b>Delivery Period:</b> {d_terms}<br/>"
                   f"• <b>Warranty:</b> {w_terms}<br/>"
                   f"• <b>Exclusions:</b> Civil foundation, duct support structures, site erection, external field cabling.", style_body)]
    ]
    t_terms = Table(terms, colWidths=[540])
    t_terms.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_terms)
    story.append(Spacer(1, 10))

    # 6. Sign-off block
    sign_block = [
        [Paragraph("Prepared by: <b>Estimation Engineering</b>", style_body),
         Paragraph(f"For <b>{comp_name}</b>", style_body_bold)],
        ["", Paragraph("<br/><br/><b>Authorized Signatory</b>", style_body)]
    ]
    t_sign = Table(sign_block, colWidths=[270, 270])
    story.append(t_sign)

    doc.build(story)
    return buffer.getvalue()
