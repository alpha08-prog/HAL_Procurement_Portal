"""Export the two spreadsheets the web app needs into JSON the Node server can read.

    conda run -n hal python ai/export_web.py

The Express server has no xlsx reader and shouldn't grow one -- the repo already
handles this by seeding JSON from the client's workbooks (see
server/contracts/seed/matrix.json and clauses.json, and server/noting/dummy_employees.json,
which is this same personnel sheet already exported by hand).

This writes the two that were still missing:

    server/approvals/seed/checklist.json    the 67 indentor-checklist rows, their
                                            tech/commercial category, what each feeds
                                            downstream, and the nine rows that name an
                                            approving authority
    server/approvals/seed/bids.json         the filled technical-bid compliance sheets
                                            (FABRICATED bidders -- see fixtures/)

Re-run it whenever the client reissues either workbook. The Node side asserts the
counts it expects, so a silent change in shape fails server/approvals/approvals.check.mjs
rather than quietly altering who has to approve something.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import checklist

OUT_DIR = Path(__file__).resolve().parents[1] / "server" / "approvals" / "seed"


def export_checklist():
    rows = [dict(r) for r in checklist.rows()]
    payload = {
        "_source": ("sampleData/Checklist for Indentor - STANDARD TERMS AND "
                    "CONDITIONS-f.xlsx [Sheet1 rows 4-70, Sheet2]"),
        "_generated_by": "ai/export_web.py -- do not hand-edit; re-run the exporter",
        "_note": ("The sheet's own typos (Indnetor, Evalaution, obatined, Provisioining) "
                  "are preserved verbatim so drift is detectable."),
        "counts": {
            "rows": len(rows),
            "provisioning": len(checklist.block(checklist.PROVISIONING)),
            "tender": len(checklist.block(checklist.TENDER)),
            "technical": len(checklist.by_category("T")),
            "commercial": len(checklist.by_category("C")),
            "feeds_tec_report": len(checklist.consumed_by("tender+tec_report")),
            "feeds_comm_eval": len(checklist.consumed_by("tender+comm_eval")),
            "indentor_only": len(checklist.consumed_by("indentor")),
        },
        "rows": rows,
        "material_classes": list(checklist.material_classes()),
        # Each entry keeps the sheet's own wording as `evidence`, so the Node side can
        # show the user *why* an approver was added, quoting the form they filled in.
        "injections": [
            {**spec,
             "clause": (checklist.find(spec["block"], spec["sl"]) or {}).get("clause", ""),
             "description": (checklist.find(spec["block"], spec["sl"]) or {}).get("description", ""),
             "row": (checklist.find(spec["block"], spec["sl"]) or {}).get("row")}
            for spec in checklist.INJECTIONS
        ],
        "default_answers": checklist.answers(),
        "dop_level_from_answers": checklist.dop_level(),
    }
    path = OUT_DIR / "checklist.json"
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path, payload["counts"]


def export_bids():
    """The filled compliance sheets, if the fixture has been generated."""
    try:
        import bid_sheet
    except ImportError as e:                                    # pragma: no cover
        print(f"  ! cannot import bid_sheet: {e}")
        return None, 0
    if not bid_sheet.DEFAULT_BOOK.exists():
        print(f"  ! {bid_sheet.DEFAULT_BOOK.name} not built yet -- skipping bids.json")
        print("    build it: conda run -n hal python ai/fixtures/make_bid_E33046.py")
        return None, 0

    data = bid_sheet.load()
    case = bid_sheet.to_case_input(data, bid_sheet.META)
    payload = {
        "_source": "ai/fixtures/TechnicalBid_E-33046_FILLED.xlsx",
        "_generated_by": "ai/export_web.py",
        "_warning": ("THE BIDDERS AND ALL PRICES ARE FABRICATED TEST DATA. The tender "
                     "reference, item, quantity, 12 specification lines and 18 terms are "
                     "quoted from sampleData/TechnicalBid E-33046.pdf."),
        "fixture": True,
        "tender_ref": data["tender_ref"],
        "bidders": data["bidders"],
        "extras": data["extras"],
        "case": case,
    }
    path = OUT_DIR / "bids.json"
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path, len(data["bidders"])


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    root = OUT_DIR.parents[2]

    cpath, counts = export_checklist()
    print(f"wrote {cpath.relative_to(root)}")
    for k, v in counts.items():
        print(f"   {k:<18}{v}")

    bpath, n = export_bids()
    if bpath:
        print(f"wrote {bpath.relative_to(root)}")
        print(f"   bidders           {n}   (FABRICATED)")

    print("\nthe Node side asserts these counts -- see server/approvals/approvals.check.mjs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
