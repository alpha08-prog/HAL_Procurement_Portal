"""Walk the internal approval chain of one note -- the entry point for Module B's
inside-the-agency layer.

cascade.py / interactive.py answer "which agency may raise which note at which stage".
This answers the question underneath it: **once an agency has the file, who inside it
actually signs, in what order, and what stops the file leaving early.**

    conda run --no-capture-output -n hal python ai/approval_run.py              # interactive
    conda run --no-capture-output -n hal python ai/approval_run.py --auto
    conda run --no-capture-output -n hal python ai/approval_run.py --replay-f1
    conda run --no-capture-output -n hal python ai/approval_run.py --committee --note pnc_req

`--no-capture-output` matters for the interactive modes -- plain `conda run` buffers
stdio and the prompts never appear. `conda activate hal && python ai/approval_run.py`
works too. With stdin not a terminal this falls back to the unattended walk, so scripts
and CI are unaffected, the same way run.py behaves.

`--replay-f1` is the honesty check: it builds a plan from the checklist answers and then
diffs it against the 14 hops the real approved Provisioning Note prints on itself. A
model that cannot represent the one real chain in sampleData is wrong, and the diff says
so out loud rather than quietly passing.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import approval
import checklist
import org
from approval import COI_DECLARATION, HOPS, Chain, Committee, build_plan
from tools.pdf_extractor import extract_routing_chain

SEP = "=" * 78
SUB = "-" * 78
QUIT = "\x00"

HERE = Path(__file__).parent
CASE_INPUT = HERE / "case_input.json"
OUT = HERE / "outputs"
F1_PDF = (HERE.parent / "sampleData" / "NOTING" / "NOTING SEQUENCE" /
          "F1 Approved Provisioning Note 6005612025.pdf")

# The dummy personnel directory numbers its units DIV1..DIV10 and never names them, so
# "Aircraft Overhaul Division, Nashik" cannot be identified in it. DIV9 is the default
# because it is the one division that resolves every slot of the F1-shaped provisioning
# chain -- see --division to use another, and the caveat lines to see what it cost.
DEFAULT_DIVISION = "DIV9"
DEFAULT_DEPT = "FIRE & SEC"


# -- terminal helpers (same shape as interactive.py) --------------------------
def _ask(prompt):
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return QUIT


def _yes(prompt, default=True):
    a = _ask(f"{prompt} [{'Y/n' if default else 'y/N'}]: ")
    if a == QUIT:
        return QUIT
    return default if not a else a.lower().startswith("y")


def _cut(s, n):
    s = " ".join(str(s or "").split())
    return s if len(s) <= n else s[: n - 1] + "…"


# -- printing ----------------------------------------------------------------
def print_plan(plan):
    print(f"\n{SEP}\n THE CHAIN, RESOLVED BEFORE ANYONE IS ASKED TO ACT\n{SEP}")
    print(f" note        : {plan.note_id}   ({plan.mode} mode, {plan.shape.get('agency')} agency)")
    print(f" division    : {plan.division}")
    print(f" shape from  : {plan.shape.get('source')}")
    print(f" DOP level   : {plan.dop_level or 'not stated'}"
          f"   <- {plan.dop_level_source or 'nothing on file'}")
    print(f"\n {len(plan.slots)} positions:\n")
    for i, s in enumerate(plan.slots, 1):
        print(f"  {i:>2}. {s.describe()}")
        if s.why:
            print(f"      why: {_cut(s.why, 92)}")
    bad, amb, ext = plan.unresolved, plan.ambiguous, plan.externals
    print(f"\n unresolved {len(bad)} | ambiguous {len(amb)} | external {len(ext)}")
    for s in bad:
        print(f"   ! cannot fill: {s.title}")
    for s in ext:
        print(f"   ! outside HAL, must be obtained on paper: {s.title}")


def print_routing(rows, title="ROUTING DETAILS"):
    """The layout the real note prints its own chain in."""
    print(f"\n{SUB}\n {title}\n{SUB}")
    print(f" {'Sr':<4}{'Note':<6}{'Name':<22}{'Desig':<30}{'Dept':<16}"
          f"{'Date':<12}{'Action':<19}2FA")
    for r in rows:
        print(f" {r['sr_no']:<4}{r['note']:<6}{_cut(r['name'], 20):<22}"
              f"{_cut(r['designation'], 28):<30}{_cut(r['dept'], 14):<16}"
              f"{r['date']:<12}{r.get('action', ''):<19}"
              f"{'Y' if r.get('two_factor') else ''}")
        if r.get("comment"):
            print(f"      {'':<10}{_cut(r['comment'], 88)}")
        if r.get("rider"):
            print(f"      {'':<10}RIDER -> {_cut(r['rider'], 80)}")


def print_gate(chain):
    ok, why = chain.release_ready()
    print(f"\n{SUB}\n RELEASE GATE -- may the file leave the agency?\n{SUB}")
    print(f"  {'YES -- released to the next agency' if ok else 'NO'}")
    for w in why:
        print(f"   - {w}")
    gp = chain.grade_path()
    if gp:
        mono = all(b >= a for a, b in zip(gp, gp[1:]))
        verdict = ("monotonic" if mono else
                   "NOT monotonic -- as expected; grade decides authority, not order")
        print(f"\n  grade path : {' -> '.join(str(g) for g in gp)}")
        print(f"               {verdict}")
    days = chain.elapsed_days()
    if days is not None:
        print(f"  elapsed    : {days} days over {len(chain.hops)} hops")


# -- the walk ----------------------------------------------------------------
def _queue(plan):
    """Slots that must act, in plan order, minus the originator and the CFA."""
    return [s for s in plan.slots
            if s.kind not in ("originator", "cfa") and s.person is not None]


def _default_action(slot):
    return "concur"


def walk_auto(plan, chain, verbose=True):
    """Straight down the plan: originator drafts, everyone concurs, CFA approves."""
    if plan.originator is not None:
        chain.add(plan.originator, "forward",
                  f"Provisioning proposal submitted for kind approval of "
                  f"{plan.cfa.title.split('--')[-1].strip() if plan.cfa else 'the CFA'}.",
                  slot=plan.slots[0] if plan.slots else None)
    for s in _queue(plan):
        chain.add(s.person, _default_action(s), "", slot=s)
    if plan.cfa and plan.cfa.person:
        chain.add(plan.cfa.person, "approve", "Approved / मंजूर", slot=plan.cfa)
    for s in plan.externals:
        if verbose:
            print(f"\n ! {s.title} is outside HAL -- record it on paper; "
                  f"the gate will hold until then")
    return chain


def walk_interactive(plan, chain):
    """One hop at a time. The holder picks from the hop types actually open to them."""
    queue = _queue(plan)
    pending = list(queue)

    if plan.originator is None:
        print("\n ! no originator resolved -- nothing can be raised. "
              "Try --originator <PB> or another --division.")
        return chain

    print(f"\n{SEP}\n HOP 1 -- the originator drafts\n{SEP}")
    print(f" {plan.originator.short}")
    body = _ask("\n note body / covering remark (Enter for the standard line): ")
    if body == QUIT:
        return chain
    chain.add(plan.originator, "forward",
              body or "Submitted for kind approval please.",
              slot=plan.slots[0])

    while not chain.closed:
        nxt = pending[0] if pending else plan.cfa
        if nxt is None or nxt.person is None:
            print("\n nothing left that can act.")
            break

        print(f"\n{SEP}\n HOP {len(chain.hops) + 1} -- with {nxt.person.name}"
              f"  ({nxt.title})\n{SEP}")
        ok, why = chain.release_ready()
        print(f" gate: {'clear' if ok else str(len(why)) + ' condition(s) outstanding'}")
        print(f" still to act: {len(pending)}"
              + (f"  ({', '.join(_cut(s.title, 26) for s in pending[:3])}"
                 f"{' …' if len(pending) > 3 else ''})" if pending else ""))

        allowed = ["concur", "concur_with_rider", "forward", "examine", "query"]
        if nxt.kind == "cfa" or not pending:
            allowed = ["approve", "reject"] + allowed
        print("\n what does this desk do?")
        for i, h in enumerate(allowed, 1):
            print(f"   {i}) {HOPS[h]['label']:<28} {HOPS[h]['help']}")
        print("   v) view the chain so far     q) save and quit")

        a = _ask("\n choose [1]: ")
        if a == QUIT or a.lower() == "q":
            break
        a = a or "1"
        if a.lower() == "v":
            print_routing(chain.routing_table(), "THE CHAIN SO FAR")
            continue
        if not a.isdigit() or not 1 <= int(a) <= len(allowed):
            print(f" ! 1-{len(allowed)}, or v / q")
            continue

        action = allowed[int(a) - 1]
        rider = ""
        if action == "concur_with_rider":
            rider = _ask(" the condition this rider binds a later stage to: ")
            if rider == QUIT:
                break
        comment = _ask(" remark (Enter for the standard line): ")
        if comment == QUIT:
            break
        tfa = _yes(" two-factor authenticated?", default=False)
        if tfa == QUIT:
            break

        chain.add(nxt.person, action, comment, slot=nxt, two_factor=tfa, rider=rider)

        if action in ("approve", "reject"):
            break
        if action == "examine":
            # Delegate down inside this desk's own unit, then it comes back here.
            junior = next((p for p in org.people(division=nxt.person.division,
                                                 dept=nxt.person.dept_raw)
                           if (p.grade_level or 0) < (nxt.person.grade_level or 0)), None)
            if junior is None:
                print(" ! nobody junior in this unit to examine it -- staying put")
                continue
            back = _ask(f" what does {junior.name} ({junior.grade_label}) report? ")
            if back == QUIT:
                break
            chain.add(junior, "query" if back else "forward", back or "Examined.",
                      slot=None)
            print(f" >> examined by {junior.name}; the file is back with {nxt.person.name}")
            continue
        if action == "query":
            answer = _ask(f" {plan.originator.name} answers: ")
            if answer == QUIT:
                break
            chain.add(plan.originator, "forward", answer or "Refer to the previous note.",
                      slot=None)
            print(f" >> answered; the file returns to {nxt.person.name}")
            continue

        if pending and nxt is pending[0]:
            pending.pop(0)

    return chain


# -- F1 replay ---------------------------------------------------------------
def _classify(hop, first_dept):
    """Which slot kind an observed hop looks like, from its department and grade."""
    dept = org.norm_dept(hop["dept"])
    grade = org.desig_level(hop["designation"]) or 0
    if hop["seq"] == 1:
        return "originator"
    if "FINANCE" in dept or "ACCOUNT" in dept:
        return "finance_head" if grade >= 8 else "finance_examine"
    # Grade alone identifies the CFA. Matching on the department name would catch
    # "OFFICE OF DGM (HR)" too, since DGM contains GM.
    if grade >= 9:
        return "cfa"
    if org.norm_dept(first_dept) == dept:
        return "section_check" if grade <= 6 else "dept_head"
    return "concurrence"


def _observed_person(hop, fallback_division):
    """A Person for someone who appears on the real note but not in the dummy directory.

    The F1 signatories are real AOD Nashik staff; the directory is anonymised dummy
    data, so none of them are in it. Their grade comes from the designation they signed
    with -- which is the whole point of org.desig_level.
    """
    lvl = org.desig_level(hop["designation"])
    p = org.Person(f"F1-{hop['seq']:02d}", hop["name"],
                   hop["division"] or fallback_division, hop["dept"],
                   f"{lvl} - {org.GRADE_LABEL.get(lvl, '?')}" if lvl else hop["designation"],
                   hop["designation"])
    p.grade_level = lvl
    return p


def _infer_action(hop, is_last):
    """The hop type an observed remark reads as."""
    c = (hop["comment"] or "").lower()
    if is_last or c.startswith("approved"):
        return "approve"
    if "pl examine" in c or c.strip() == "examine":
        return "examine"
    if "may please be removed" in c or "with above" in c:
        return "concur_with_rider"
    if "concurred and forwarded" in c:
        return "concur"
    if "refer to n" in c:
        return "forward"                      # the originator answering a query
    if "no whwere" in c or "not mentioned" in c or "?" in c:
        return "query"
    if "concurred" in c or "may be concurred" in c:
        return "concur"
    return "forward"


def replay_f1(plan, division):
    print(f"\n{SEP}\n REPLAY -- the model against the one real chain in sampleData\n{SEP}")
    print(f" source: {F1_PDF.relative_to(HERE.parent)}")
    if not F1_PDF.exists():
        print(" ! not found -- cannot replay")
        return 1

    observed = extract_routing_chain(str(F1_PDF))
    first_dept = observed[0]["dept"] if observed else ""
    print(f" {len(observed)} hops extracted\n")

    print(f" {'':<5}{'grade':<7}{'slot kind inferred':<20}{'hop type inferred':<20}"
          f"{'representable':<14}dept")
    unknown = []
    for h in observed:
        kind = _classify(h, first_dept)
        act = _infer_action(h, h["seq"] == len(observed))
        okk = act in HOPS
        if not okk:
            unknown.append(h["note"])
        print(f" {h['note']:<5}{str(org.desig_level(h['designation']) or '?'):<7}"
              f"{kind:<20}{act:<20}{'yes' if okk else 'NO':<14}{_cut(h['dept'], 22)}")

    # Rebuild the chain from the observed hops, through the real model.
    chain = Chain(plan, file_id="6005612025")
    kinds_seen = []
    for h in observed:
        kind = _classify(h, first_dept)
        kinds_seen.append(kind)
        act = _infer_action(h, h["seq"] == len(observed))
        slot = next((s for s in plan.slots
                     if s.kind == kind and not s.actioned), None)
        person = _observed_person(h, division)
        rider = h["comment"] if act == "concur_with_rider" else ""
        chain.add(person, act, h["comment"], slot=slot, when=h["date"],
                  two_factor=h["two_factor"], rider=rider)

    print_routing(chain.routing_table(), "THE REAL CHAIN, REBUILT THROUGH THE MODEL")

    print(f"\n{SUB}\n WHAT THE REPLAY PROVES (and what it does not)\n{SUB}")
    checks = [
        (len(observed) == 14, f"all 14 hops extracted (got {len(observed)})"),
        (not unknown, f"every hop maps to a known hop type"
                      + (f" -- unmapped: {unknown}" if unknown else "")),
        (chain.grade_path() == [4, 6, 7, 7, 6, 7, 8, 8, 8, 7, 4, 7, 8, 9],
         f"grade path matches the note: {chain.grade_path()}"),
        (chain.decision == "approve", f"the chain ends in a CFA approval"),
        (sum(1 for h in chain.hops if h['two_factor']) == 2,
         f"2 hops carried two-factor authentication (N4, N8)"),
        (any(h["action"] == "examine" for h in chain.hops),
         "the downward delegation at N9 is expressible (\"examine\")"),
        (any(h["action"] == "query" for h in chain.hops),
         "the finance objection at N10 is expressible (\"query\", not a rejection)"),
        (any(h["rider"] for h in chain.hops),
         "the conditional concurrence at N8 is expressible (\"concur_with_rider\")"),
    ]
    passed = 0
    for ok, label in checks:
        print(f"  {'ok  ' if ok else 'FAIL'} {label}")
        passed += bool(ok)

    ok, why = chain.release_ready()
    print(f"\n  release gate after N14: {'clear' if ok else 'held'}")
    for w in why:
        print(f"    - {w}")
    print(f"\n  NOTE: the gate is held by slots this plan requires that the real 2025 note"
          f"\n  did not have -- the checklist answers used here pull in an Indigenisation"
          f"\n  Cell clearance and a DOP proprietary-certificate authority. That is the"
          f"\n  model working, not failing: change the answers and those slots go away.")
    print(f"\n  {passed}/{len(checks)} replay checks passed")
    return 0 if passed == len(checks) else 1


# -- committee mode ----------------------------------------------------------
def run_committee(plan, division, case, interactive):
    shape = approval.chain_shape(plan.note_id)
    print(f"\n{SEP}\n COMMITTEE MODE -- {plan.note_id}\n{SEP}")
    print(f" source: {shape.get('source')}")
    specs = plan.committee_specs

    if not specs:
        print("\n ! this committee's composition is NOT in sampleData.")
        print("   Annexure 21A prints a members table but never says who sits on a TEC,")
        print("   so there is nothing to seed it from. Name the members, or use")
        print("   --note pnc_req / pnc_rec, whose composition F5 does name.")
        if not interactive:
            return 1
        while True:
            s = _ask(" member designation (e.g. \"AGM(QA) - Chairman\", Enter to stop): ")
            if s == QUIT:
                return 1
            if not s:
                break
            specs = specs + [s]

    com = approval.committee_from_specs(
        plan.note_id, specs, division,
        purpose=f"{plan.note_id} decided by committee", source=shape.get("source", ""))

    print(f"\n {len(com.members)} member(s)")
    for i, m in enumerate(com.members, 1):
        who = m["person"].short if m["person"] else "UNRESOLVED in the directory"
        print(f"   {i}. {_cut(m['spec'], 42):<44} {who}")
        for c in m.get("caveats", []):
            print(f"      {'':<44} ! {c}")

    print(f"\n declaration each of them must sign (Annexure 21A Para C):\n   \"{COI_DECLARATION}\"")

    for i, m in enumerate(com.members):
        if m["person"] is None:
            continue
        if interactive:
            coi = _yes(f"\n {m['person'].name}: declares no conflict of interest?", True)
            if coi == QUIT:
                break
            remark = _ask(" remark: ")
            if remark == QUIT:
                break
            com.sign(i, coi, remark)
        else:
            com.sign(i, True, "Signed.")

    ok, why = com.complete()
    print(f"\n{SUB}\n CAN THE REPORT BE RAISED?\n{SUB}")
    print(f"  {'YES -- every member signed and declared' if ok else 'NO'}")
    for w in why:
        print(f"   - {w}")

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"approval_{plan.note_id}_committee.json"
    path.write_text(json.dumps(com.as_dict(), indent=2, ensure_ascii=False),
                    encoding="utf-8")
    print(f"\n saved -> {path}")
    return 0


# -- entry -------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Walk the internal approval chain of one procurement note")
    ap.add_argument("--note", default="provisioning",
                    help="which note's chain (default provisioning)")
    ap.add_argument("--division", default=DEFAULT_DIVISION,
                    help=f"unit from the personnel directory (default {DEFAULT_DIVISION})")
    ap.add_argument("--dept", default=DEFAULT_DEPT,
                    help=f"requisitioning department (default \"{DEFAULT_DEPT}\")")
    ap.add_argument("--originator", help="PB number of the originator, instead of resolving one")
    ap.add_argument("--case", default=str(CASE_INPUT), help="case facts (default ai/case_input.json)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("-a", "--auto", action="store_true", help="walk it unattended")
    g.add_argument("--replay-f1", action="store_true",
                   help="diff the model against the real F1 routing table")
    ap.add_argument("--committee", action="store_true",
                    help="committee mode instead of a serial chain")
    a = ap.parse_args(argv)

    print(f"\n{SEP}\n HAL PROCUREMENT -- INTERNAL APPROVAL CHAIN\n{SEP}")
    print(" directory : sampleData/Dummy HAL Database of Personnals.xlsx")
    print(" checklist : sampleData/Checklist for Indentor - STANDARD TERMS AND CONDITIONS-f.xlsx")
    print(" chain     : who signs inside one agency, before the file crosses to the other")

    case = None
    p = Path(a.case)
    if p.exists():
        case = json.loads(p.read_text(encoding="utf-8"))
        print(f" case      : {p.name}")

    if a.division not in org.divisions():
        print(f"\n ! unknown division {a.division!r}. Available: {', '.join(org.divisions())}")
        return 2

    ans = checklist.answers()
    originator = org.by_pb(a.originator) if a.originator else None
    if a.originator and originator is None:
        print(f"\n ! no such PB number: {a.originator}")
        return 2

    plan = build_plan(a.note, a.division, ans=ans, originator=originator,
                      originator_dept=a.dept if originator is None else None,
                      case=case)

    inj = checklist.injected(ans)
    print(f"\n{SUB}\n WHAT THE CHECKLIST ANSWERS PULLED IN\n{SUB}")
    if not inj:
        print("  nothing beyond the base chain")
    for i in inj:
        ext = "  [EXTERNAL to HAL]" if i["external"] else ""
        print(f"  sl {i['sl']:<3} {i['authority']}{ext}")
        print(f"         answer \"{i['answer']}\" ({i['trigger']} trigger)")

    print_plan(plan)

    if a.replay_f1:
        return replay_f1(plan, a.division)

    if a.committee or plan.mode == approval.COMMITTEE:
        interactive = not a.auto and sys.stdin.isatty()
        return run_committee(plan, a.division, case, interactive)

    chain = Chain(plan, file_id=(case or {}).get("_file_id", "6005612025"))
    interactive = not a.auto and sys.stdin.isatty()
    if interactive:
        walk_interactive(plan, chain)
    else:
        walk_auto(plan, chain)

    if chain.hops:
        print_routing(chain.routing_table())
    print_gate(chain)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"approval_{a.note}.json"
    path.write_text(json.dumps(chain.as_dict(), indent=2, ensure_ascii=False),
                    encoding="utf-8")
    print(f"\n saved -> {path}")
    print(f"\n{SEP}\n DONE\n{SEP}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
