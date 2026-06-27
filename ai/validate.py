import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from stages import ORDER, STAGES

# Gold facts taken from the sample notes F1-F7 (the expected outputs).
# typ: "t" = case-insensitive text substring, "n" = digit-normalised match.
CHECKS = {
    "provisioning": [("item", "NIGHT VISION BINOCULAR", "t"), ("CAR no", "CAR/25/229", "t"),
                     ("value", "1594065", "n"), ("DOP clause", "Annexure III B", "t")],
    "emd": [("tender no", "GEM/2025/B/6638737", "t"), ("total bids 08", "08", "t"),
            ("DELLEPSON Udyam", "UDYAM-UP-75-0001380", "t"), ("ANIKA rejected", "ANIKA", "t"),
            ("HAZZALE rejected", "HAZZALE", "t")],
    "tec_req": [("Precitex forwarded", "PRECITEX", "t"), ("Shobha forwarded", "SHOBHA", "t")],
    "tec_report": [("Precitex accepted", "Precitex", "t"), ("Dellepson rejected", "Dellepson", "t"),
                   ("spec sl nos", "1, 4, 6, 15", "t")],
    "pbo": [("L1 Precitex", "Precitex", "t"), ("L1 price 20,00,000", "2000000", "n"),
            ("PM 8.5.6", "8.5.6", "t")],
    "pnc_req": [("variance 25.47", "25.47", "t"), ("LPP contract", "GEM-511687742674336", "t")],
    "pnc_rec": [("counter offer 15,94,065", "1594065", "n"), ("savings 4,05,935", "405935", "n"),
                ("PM 8.20.1", "8.20.1", "t")],
    "pp": [("proposal AODCAP571", "AODCAP571", "t"), ("CFA Deshmukh", "DESHMUKH", "t"),
           ("FCA Jayanta", "JAYANTA", "t"), ("DOP Annexure 3", "ANNEXURE 3", "t")],
    "po": [("SD 67545", "67545", "n"), ("PBG 135090", "135090", "n")],
}

def _digits(s): return "".join(c for c in str(s) if c.isdigit())

def _hit(note, expected, typ):
    if typ == "n":
        return _digits(expected) in _digits(note)
    return expected.lower() in note.lower()

def validate(case_path):
    d = json.loads(Path(case_path).read_text(encoding="utf-8"))
    g, cf = d["generated"], d["carry_forward"]
    def full(s): return (cf.get(s, "") + "\n" + g.get(s, "")).strip()
    total_ok = total = 0
    print(f"{'='*64}\nVALIDATION — generated notes vs gold facts from sample F1-F7\n{'='*64}")
    for sid in ORDER:
        checks = CHECKS.get(sid)
        if not checks:
            continue
        note = full(sid)
        ok = 0
        print(f"\n[{sid}] {STAGES[sid]['note']}")
        for label, exp, typ in checks:
            hit = _hit(note, exp, typ)
            ok += hit
            print(f"   {'✓' if hit else '✗'} {label}: expected '{exp}'")
        total_ok += ok; total += len(checks)
        print(f"   → {ok}/{len(checks)}")
    print(f"\n{'='*64}\nSCORE: {total_ok}/{total} facts correctly rendered ({round(100*total_ok/total)}%)\n{'='*64}")

if __name__ == "__main__":
    validate(str(Path(__file__).parent / "outputs" / "case_full.json"))
