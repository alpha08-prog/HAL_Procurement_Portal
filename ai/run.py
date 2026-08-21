import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pipeline import run_pipeline
from stages import ORDER, STAGES, REF
from tools import pdf_writer
from load_inputs import load, to_stage_inputs

OUT = Path(__file__).parent / "outputs"
CASE_INPUT = Path(__file__).parent / "case_input.json"
SEP = "═" * 60

def print_io(inputs):
    print(f"\n{SEP}\nSTAGE INPUT/OUTPUT MAP (per cascade doc)\n{SEP}")
    for sid in ORDER:
        cfg = STAGES[sid]
        ins = [k for k, v in (inputs.get(sid) or {}).items() if v]
        print(f"\n[{sid}] {cfg['note']}  ({cfg['phase']} | {cfg['resp']})")
        print(f"   IN  : {ins}")
        print(f"   →SLM: {cfg['new']}")
        print(f"   FMT : {cfg['formats']}")
        print(f"   OUT : note prose + {cfg['formats']} annexures" + (f"  [conditional: {cfg['cond']}]" if cfg['cond'] else ""))

def print_outputs(case):
    print(f"\n{SEP}\nFINAL GENERATED NOTES\n{SEP}")
    for sid in ORDER:
        full = case.full_output(sid)
        if not full:
            continue
        print(f"\n{'─'*60}\n  {sid.upper()} — {STAGES[sid]['note']}\n{'─'*60}")
        print(full)
    print(f"\n{SEP}\nANNEXURES (deterministic, not via SLM)\n{SEP}")
    for fid, d in case.formats.items():
        print(f"  [{fid}] {d}")

def run_auto(case_path=None):
    case_path = Path(case_path) if case_path else CASE_INPUT
    print(f"\n{SEP}\nHAL PROCUREMENT PIPELINE — full graph run\n{SEP}")
    print(f"[input] reading external case data → {case_path.name}  (notes F1–F7 are NOT inputs; references only)")
    raw = load(str(case_path))
    if raw.get("_fixture"):
        print(f"[input] ⚠ FIXTURE — this case is fabricated test data, not sampleData")
    inputs = to_stage_inputs(raw)
    OUT.mkdir(parents=True, exist_ok=True)
    print_io(inputs)
    case = run_pipeline(inputs, output_path=str(OUT / "case_full.json"))
    print_outputs(case)
    meta = {sid: {"note": STAGES[sid]["note"], "formats": STAGES[sid]["formats"], "seq": STAGES[sid]["seq"], "ref": REF[sid]} for sid in STAGES}
    pdfs = pdf_writer.write_case_pdf(case, meta, str(OUT / "pdf"))
    print(f"\n{SEP}\nPDF EXPORT — {len(pdfs)} note documents → {OUT/'pdf'}\n{SEP}")
    for p in pdfs:
        print(f"   {p}")
    print(f"\n{SEP}\nPIPELINE COMPLETE\n{SEP}")

def main():
    ap = argparse.ArgumentParser(description="HAL procurement note pipeline")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("-i", "--interactive", action="store_true",
                   help="walk the responsibility cascade one decision at a time (default on a terminal)")
    g.add_argument("-a", "--auto", action="store_true",
                   help="run the whole linear ORDER unattended (the old behaviour)")
    ap.add_argument("--agency", choices=["Indenting", "Tendering"],
                    help="interactive mode: skip the who-are-you prompt")
    ap.add_argument("--case", help="case facts to run (default ai/case_input.json; "
                                   "try ai/fixtures/case_input_E33046.json)")
    args, rest = ap.parse_known_args()

    # Interactive unless asked otherwise — but never when stdin is not a terminal,
    # so scripted/CI invocations keep getting the unattended full-graph run.
    interactive = args.interactive or (not args.auto and sys.stdin.isatty())
    if interactive:
        import interactive as cascade_cli
        argv = (["--agency", args.agency] if args.agency else []) + \
               (["--case", args.case] if args.case else []) + rest
        return cascade_cli.main(argv)
    run_auto(args.case)
    return 0

if __name__ == "__main__":
    sys.exit(main())
