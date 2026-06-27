import re
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def _styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("HALTitle", parent=s["Title"], fontSize=13, spaceAfter=2))
    s.add(ParagraphStyle("HALSub", parent=s["Normal"], fontSize=9, alignment=1, textColor=colors.grey, spaceAfter=8))
    s.add(ParagraphStyle("Head", parent=s["Normal"], fontSize=10, spaceAfter=6, leading=14))
    s.add(ParagraphStyle("Para", parent=s["Normal"], fontSize=10, leading=15, spaceAfter=6, alignment=4))
    return s

def _meta(meta, st):
    rows = [[k, Paragraph(str(v), st["Para"])] for k, v in meta.items() if v]
    t = Table(rows, colWidths=[38*mm, 127*mm])
    t.setStyle(TableStyle([("FONTSIZE", (0,0), (-1,-1), 9), ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LINEBELOW", (0,0), (-1,-1), 0.25, colors.lightgrey), ("BOTTOMPADDING", (0,0), (-1,-1), 3)]))
    return t

def _clean(s):
    s = str(s).replace("₹", "Rs. ")
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"^\s*#+\s*", "", s)
    return s.strip()

def _annex(ann, st):
    rows = [["Field", "Value"]]
    for k, v in ann.items():
        if k == "format":
            continue
        val = ", ".join(map(str, v)) if isinstance(v, list) else str(v)
        rows.append([k, Paragraph(_clean(val), st["Para"])])
    t = Table(rows, colWidths=[48*mm, 117*mm])
    t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0b3d2e")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("FONTSIZE", (0,0), (-1,-1), 8),
        ("GRID", (0,0), (-1,-1), 0.25, colors.grey), ("VALIGN", (0,0), (-1,-1), "TOP")]))
    return t

def write_note_pdf(path, title, meta, body, annexures, signoff="Submitted for kind approval please."):
    st = _styles()
    doc = SimpleDocTemplate(str(path), pagesize=A4, topMargin=18*mm, bottomMargin=18*mm, leftMargin=20*mm, rightMargin=20*mm)
    el = [Paragraph("HINDUSTAN AERONAUTICS LIMITED", st["HALTitle"]),
          Paragraph("Aircraft Overhaul Division, Nashik", st["HALSub"]),
          Paragraph("<b>" + title + "</b>", st["Head"]), _meta(meta, st), Spacer(1, 6*mm)]
    for p in [x.strip() for x in body.split("\n") if x.strip()]:
        el.append(Paragraph(_clean(p), st["Para"]))
    el += [Spacer(1, 5*mm), Paragraph("<b>" + signoff + "</b>", st["Para"])]
    for fid, ann in annexures:
        el += [Spacer(1, 6*mm), Paragraph("Annexure — " + ann.get("format", fid), st["Head"]), _annex(ann, st)]
    doc.build(el)
    return str(path)

def write_case_pdf(case, stage_meta, out_dir):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    d = case.data
    written = []
    for sid in case.path:
        body = case.full_output(sid)
        if not body.strip():
            continue
        m = stage_meta.get(sid, {})
        meta = {"Item": d.get("item_description"), "CAR No.": d.get("car_no"), "Date": d.get("car_date"),
                "MPR Estimate (INR)": d.get("mpr_estimate") or d.get("budget_estimate"), "Tender No.": d.get("tender_no")}
        ann = [(f, case.formats[f]) for f in m.get("formats", []) if f in case.formats]
        path = out / f"{m.get('seq', 0):02d}_{m.get('ref', sid)}.pdf"
        write_note_pdf(path, m.get("note", sid), meta, body, ann)
        written.append(str(path))
    return written
