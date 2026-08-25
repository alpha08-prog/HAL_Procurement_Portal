import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from case_object import CaseObject
from stages import ORDER, STAGES, ALL_STAGES
from tools import slm_client
import rules, formats

_P = json.loads((Path(__file__).parent / "prompts.json").read_text(encoding="utf-8"))
SEP = "─" * 60

def _clean(v): return v not in (None, [], "", {})

def _delta(stage, data):
    return {k: data[k] for k in ALL_STAGES[stage]["new"] if _clean(data.get(k))}

def _prompt(stage, delta, refs):
    t = _P[stage]["user"].replace("{delta_json}", json.dumps(delta, indent=2, ensure_ascii=False))
    ann = "Annexures available to reference by name: " + ", ".join(refs) if refs else ""
    t = t.replace("{annexures}", ann)
    g = _P.get("_GUARD", "")
    return t + ("\n\n" + g if g else "")

def run_stage(stage, case, inp, max_tokens=800):
    cfg = ALL_STAGES[stage]
    print(f"\n{SEP}\n[{stage}] {cfg['note']}  (seq {cfg['seq']} | {cfg['phase']} | {cfg['resp']} Agency)")
    case.update(stage, inp or {})
    print(f"[{stage}] INPUT ingested: {[k for k,v in (inp or {}).items() if _clean(v)]}")

    cond = cfg.get("cond")
    if cond:
        ok = getattr(rules, cond)(case.data)
        print(f"[{stage}] BRANCH rule {cond}() = {ok}")
        if not ok:
            case.skip(stage)
            print(f"[{stage}] SKIPPED (branch condition not met) ✗")
            return None

    for fid in cfg["formats"]:
        case.set_format(fid, formats.build(fid, case.data))
    if cfg["formats"]:
        print(f"[{stage}] FORMATS generated (deterministic, not via SLM): {cfg['formats']}")

    delta = _delta(stage, case.data)
    print(f"[{stage}] DELTA → SLM ({len(delta)} new fields): {list(delta.keys())}")

    carry, carry_src = "", cfg.get("carry")
    if carry_src == "$last":
        # Need-based notes (cascade.NODES) are reached out of ORDER, so they carry
        # forward whatever note was actually raised last on this file.
        src = case.path[-1] if case.path else None
        carry = case.full_output(src) if src else ""
        print(f"[{stage}] CARRY-FORWARD (last raised note '{src}'): {len(carry)} chars (NOT re-sent to SLM)"
              if src else f"[{stage}] CARRY: none (first note on file)")
    elif carry_src:
        src = carry_src if carry_src not in case.skipped else (case.path[-1] if case.path else None)
        carry = case.full_output(src) if src else ""
        if src == carry_src:
            print(f"[{stage}] CARRY-FORWARD (accumulated) from '{src}': {len(carry)} chars (NOT re-sent to SLM)")
        elif src:
            print(f"[{stage}] CARRY: '{carry_src}' skipped → accumulated from '{src}': {len(carry)} chars")
        else:
            print(f"[{stage}] CARRY: none")
    else:
        print(f"[{stage}] CARRY: none (fresh note)")

    refs = [v["format"] for v in case.formats.values()] if cfg.get("ref") else []
    prompt = _prompt(stage, delta, refs)
    print(f"[{stage}] calling SLM (prompt {len(prompt)} chars, {len(refs)} annexure refs)...")
    out = slm_client.generate(prompt, max_tokens=max_tokens)
    case.set_output(stage, out)
    case.set_carry_forward(stage, carry)
    case.add_path(stage)
    full = case.full_output(stage)
    print(f"[{stage}] OUTPUT: {len(carry)} carry + {len(out)} new = {len(full)} chars  ✓")
    return full

def run_pipeline(inputs, output_path=None, max_tokens=800):
    case = CaseObject()
    for sid in ORDER:
        if sid not in inputs and STAGES[sid]["file"]:
            print(f"\n[pipeline] {sid}: no input doc → skipped")
            continue
        run_stage(sid, case, inputs.get(sid, {}), max_tokens=max_tokens)
    print(f"\n[pipeline] executed path: {' → '.join(case.path)}")
    if case.skipped:
        print(f"[pipeline] skipped (branch): {case.skipped}")
    if output_path:
        case.save(output_path)
        print(f"[pipeline] case saved → {output_path}")
    return case
