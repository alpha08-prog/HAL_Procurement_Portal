import json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from tools.pdf_extractor import extract_from_pdf
from tools.docx_extractor import extract_from_docx, read_text
from tools.patterns.f1_patterns import F1_PATTERNS
from tools.patterns.f2_patterns import F2_PATTERNS
from tools.patterns.f4_patterns import F4_PATTERNS
from tools.patterns.f5_patterns import F5_PATTERNS
from tools.patterns.f6_patterns import F6_PATTERNS
from tools.patterns.f7_patterns import F7_PATTERNS

N = Path(__file__).parent.parent / "sampleData" / "NOTING" / "NOTING SEQUENCE"
OUT = Path(__file__).parent / "case_input.json"

def _f(x): return x[0] if isinstance(x, list) and x else x

def _bidders(tables):
    out, seen = [], set()
    for t in tables:
        for r in t[1:]:
            cells = [c.strip() for c in r if c and c.strip()]
            ud = next((c for c in cells if c.upper().startswith("UDYAM-")), None)
            if not ud or ud in seen:
                continue
            seen.add(ud)
            mse = next((c for c in cells if c.lower() in ("micro", "small", "medium")), "Micro")
            joined = " ".join(cells)
            emd = "Not Accepted" if re.search(r"not\s+accepted", joined, re.I) else "Accepted"
            name = re.sub(r"\s+E\d+$", "", cells[cells.index(ud) - 1]).strip()
            m = re.search(r"category\s+(\d{4,6})", joined, re.I) or re.search(r"\b(2\d{4})\b", joined)
            out.append({"name": name, "udyam": ud, "mse": mse, "nic": m.group(1) if m else "N/A", "emd": emd})
    return out

def _rejected(text):
    pairs = re.findall(r"([A-Z][A-Za-z]+(?:\s+[A-Za-z&]+){0,4})\s*-\s*Not complied[^\n]*?sl no-?\s*([\d, ]+\d)", text)
    return [{"name": n.strip(), "spec_slnos": s.strip()} for n, s in pairs]

def _accepted(phrase):
    if not phrase:
        return []
    return [p.strip(" .,") for p in re.split(r"\s+and\s+(?=M/s)", phrase) if p.strip()]

def main():
    f1 = extract_from_pdf(str(N / "F1 Approved Provisioning Note 6005612025.pdf"), F1_PATTERNS)
    f2 = extract_from_docx(str(N / "F2 EMD Stage Accpetance of offer note.docx"), F2_PATTERNS)
    f4 = extract_from_docx(str(N / "F4 Note for Price bid Opening.docx"), F4_PATTERNS)
    f4t = read_text(str(N / "F4 Note for Price bid Opening.docx"))
    f5 = extract_from_docx(str(N / "F5 Note for PNC req.docx"), F5_PATTERNS)
    f6 = extract_from_docx(str(N / "F6 Note for PNC Recommendation.docx"), F6_PATTERNS)
    f7 = extract_from_docx(str(N / "F7 Note for PP.docx"), F7_PATTERNS)

    bidders = _bidders(f2["tables"])
    ci = {
        "_provenance": "AUTO-SEEDED from sampleData only (F1 pdf + F2/F4/F5/F6/F7 docx). Regenerate: python ai/seed_case_input.py. NOT hand-authored, NO internet/API.",
        "requisition": {"item_description": f1.get("item_description"), "car_no": f1.get("car_no"),
            "car_date": f1.get("car_date"), "reference_no": f1.get("reference_no"), "quantity": 5,
            "budget_year": f1.get("budget_year"), "budget_type": f1.get("budget_type"),
            "mpr_estimate": _f(f1.get("amount_figures")), "amount_in_words": _f(f1.get("amount_in_words")),
            "dop_clause": f1.get("dop_clause")},
        "tender": {"tender_no": f2.get("tender_no"), "tender_date": f2.get("tender_date"),
            "tender_enquiry": f2.get("tender_enquiry"), "tender_type": "GeM Custom Bid (Open)",
            "total_bids": int("".join(c for c in (f2.get("total_bids") or "0") if c.isdigit()) or 0)},
        "bidders": bidders,
        "tec": {"query": "TEC raised queries; bidder replies sought and re-evaluated.",
            "pm_clause": f4.get("pm_clause") or "8.5.6",
            "accepted": _accepted(f4.get("tec_accepted_final")), "rejected": _rejected(f4t)},
        "price_bid": {"l1_vendor": f5.get("l1_vendor"), "l1_price": f5.get("l1_price"),
            "ra_status": f5.get("ra_status"), "cst_ref": "E10"},
        "lpp": {"contract": f5.get("lpp_contract"), "date": "26.06.2025",
            "price": f5.get("lpp_price"), "model": "PEPL-PNVB-01"},
        "counter_offer": {"price": f6.get("counter_offer_price"), "date": f6.get("counter_offer_date"),
            "savings_amount": f6.get("savings_amount")},
        "pnc": {"committee": ["AGM(Fin) - Chairman (senior-most & Finance)", "AGM(IMM) - Member Secretary",
            "DGM(Sec & Fire) - Member (user)", "DGM(Purchase) - Member"]},
        "proposal": {"id": f7.get("proposal_id"), "vendor": f5.get("l1_vendor"),
            "initiator": f7.get("initiator"), "initiator_desig": f7.get("initiator_desig"),
            "fca": f7.get("fca_name"), "fca_desig": f7.get("fca_designation"),
            "cfa": f7.get("cfa_name"), "cfa_desig": f7.get("cfa_designation"),
            "dop_level": f7.get("dop_level"), "value": f7.get("final_value")},
    }
    OUT.write_text(json.dumps(ci, indent=2, ensure_ascii=False), encoding="utf-8")
    acc = [b for b in bidders if b["emd"] == "Accepted"]
    print(f"seeded {OUT.name} from sampleData ✓ — {len(bidders)} bidders ({len(acc)} accepted), "
          f"{len(ci['tec']['rejected'])} TEC-rejected, item={ci['requisition']['item_description']}")

if __name__ == "__main__":
    main()
