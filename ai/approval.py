"""The internal approval chain -- what happens *inside* one agency.

cascade.py models procurement as two actors handing a file across eight stages. That
is what the responsibility-cascading sheet says, and it is right as far as it goes.
But an agency is not one person. The approved Provisioning Note in sampleData prints
its own routing table:

    sampleData/NOTING/NOTING SEQUENCE/F1 Approved Provisioning Note 6005612025.pdf
    14 hops, 10 people, 7 departments, 35 days -- all of it before the file reaches IMM

An originator (Manager, Security) drafts it; his Chief Manager forwards it; his DGM
concurs; HR, Process Planning, Plant Maintenance, QC and Projects concur; the AGM
(Finance) pushes it *down* to his own DGM to examine; that DGM objects that no value
is stated; the originator answers; Finance concurs twice more; and GM(AOD) approves as
CFA under DoP Annexure III B Sl No 1a.

Three things that chain teaches, and this module is built around them:

  1. **Grade does not gate the sequence.** The real order runs
     4 -> 6 -> 7 -> 7 -> 6 -> 7 -> 8 -> 8 -> 8 -> 7 -> **4** -> 7 -> 8 -> 9.
     It descends twice. Grade decides *authority* (who heads a unit, who is the CFA),
     never *who may come next*.
  2. **Five hop types that "forward / send back / approve / reject" cannot express** --
     concurring with a rider that binds a later stage, delegating downward to be
     examined, and querying the originator without rejecting anything. See HOPS.
  3. **Who is required is decided by the checklist, not by a ladder.** checklist.injected()
     reads the indentor's own answers and names the extra authorities; the release gate
     below will not let the file leave the agency until every one of them has acted.

Money and DOP levels stay in rules.py. Note prose stays in pipeline.py. This module is
structure only.
"""

import hashlib
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import checklist
import org
import rules

# -- hop vocabulary ----------------------------------------------------------
# `advances`  does the file move on to the next planned slot, or stay/return?
# `by`        who may use it: the current holder, or only the CFA
HOPS = {
    "forward": {
        "label": "forward", "advances": True, "by": "holder",
        "help": "pass it along  (F1 N2: \"forwarded for approval pl.\")"},
    "concur": {
        "label": "concur & forward", "advances": True, "by": "holder",
        "help": "record concurrence and move on  (F1 N3, N4, N6, N7)"},
    "concur_with_rider": {
        "label": "concur with a rider", "advances": True, "by": "holder",
        "help": "concur, attaching a condition that binds a LATER stage  "
                "(F1 N8: strip brand/make from the tech spec before the RFQ goes out)"},
    "examine": {
        "label": "send down to examine", "advances": False, "by": "holder",
        "help": "delegate to a junior in your own unit and expect it back  "
                "(F1 N9->N10: AGM(Fin) writes \"Pl examine\")"},
    "query": {
        "label": "query the originator", "advances": False, "by": "holder",
        "help": "bounce a question to the originator -- not a rejection, the chain "
                "keeps its place  (F1 N10->N11)"},
    "return_to": {
        "label": "send back to an earlier hop", "advances": False, "by": "holder",
        "help": "resume the chain from whoever you name"},
    "approve": {
        "label": "approve", "advances": True, "by": "cfa",
        "help": "the CFA's decision  (F1 N14: \"Approved / मंजूर\")"},
    "reject": {
        "label": "reject", "advances": True, "by": "cfa",
        "help": "the CFA's decision -- closes the file"},
}

# F1 N3/N4/N6/N7 all carry this exact string, Hindi half included. The web module's
# noting workflow already auto-fills the English half; the real system writes both.
CONCUR_DEFAULT = "Concurred and Forwarded / सहमत एवं भेजा गया"

# A comment of nothing but punctuation is treated as no comment at all.
_SYMBOLS = set(".,;:*-_/\\|!~`'\"()[]{} \t")

# Annexure 21A Para C, added by Amendment no. 1 dt. 29-01-2024, per
# sampleData/HAL PURCHASE FORMATS dt 22.06.2026/HAL Std Formats/TEC FORMAT.pdf
COI_DECLARATION = ("I/We declare that I/we have no conflict of interest with any of "
                   "the bidder/s in this tender.")

# -- per-note chain shape ----------------------------------------------------
# Only what sampleData actually evidences. `concurrences` for provisioning is read
# off F1's own routing table -- those five departments concurred on that real note.
# Every other note gets an empty set rather than an invented one: the tendering-side
# chains have no sample note in this repo, and guessing them would be worse than
# admitting the gap.
SERIAL, COMMITTEE = "serial", "committee"

#
# Each concurrence names the acceptable departments in preference order, because the
# inspection and project-planning functions are not spelled the same in every division:
# F1's "INSPCTION" is QC in DIV8/DIV10 but QA or QE elsewhere, and its "PROJECTS(O/H)"
# is PROJECT PLANNING in DIV8/DIV10 and plain PLANNING in the rest. First name that
# exists in the division wins; resolution never leaves the department it lands on.
NOTE_CHAINS = {
    "provisioning": {
        "mode": SERIAL,
        "agency": "Indenting",
        "concurrences": [
            (("HR",), 7),                                   # F1 N4  DGM (HR)
            (("PLANNING", "PROJECT PLANNING"), 6),          # F1 N5  CM (PPO)
            (("PLANT MAINTENANCE",), 7),                    # F1 N6  DGM (Maint.)
            (("QC", "QA", "QE"), 8),                        # F1 N7  AGM (QC), Inspection
            (("PROJECT PLANNING", "PLANNING"), 8),          # F1 N8  AGM (Proj & Plg)
        ],
        "finance": True,
        "source": "F1 Approved Provisioning Note 6005612025.pdf -- routing table N1-N14",
    },
    "tec_report": {
        "mode": COMMITTEE,
        "agency": "Indenting",
        "concurrences": [],
        "finance": False,
        "committee_specs": [],   # composition is NOT in sampleData -- must be named
        "source": "HAL Std Formats/TEC FORMAT.pdf (Annexure 21A, Para C + members table)",
    },
    "tec_query": {
        "mode": SERIAL, "agency": "Indenting", "concurrences": [], "finance": False,
        "source": "cascade sheet column H (stage 3) -- no sample note in sampleData",
    },
    "pnc_req": {
        "mode": COMMITTEE, "agency": "Tendering", "concurrences": [], "finance": True,
        "committee_from_case": ("pnc", "committee"),
        "source": "F5 Note for PNC req.docx -- named committee",
    },
    "pnc_rec": {
        "mode": COMMITTEE, "agency": "Tendering", "concurrences": [], "finance": True,
        "committee_from_case": ("pnc", "committee"),
        "source": "F6 Note for PNC Recommendation.docx -- same committee",
    },
}

DEFAULT_CHAIN = {"mode": SERIAL, "agency": "Tendering", "concurrences": [],
                 "finance": True, "source": "no sample note in sampleData for this note"}


def chain_shape(note_id):
    return NOTE_CHAINS.get(note_id, DEFAULT_CHAIN)


# -- slots -------------------------------------------------------------------
class Slot:
    """One position in the chain, and how confidently it was filled."""

    def __init__(self, kind, title, resolution=None, person=None, why="",
                 required=True, external=False, chose=False):
        self.kind = kind
        self.title = title
        self.resolution = resolution or {}
        self.person = person
        self.why = why
        self.required = required
        self.external = external
        self.chose = chose          # True when a tie was broken here, not by the data
        self.actioned = False
        self.action = None

    @property
    def ambiguous(self):
        return bool(self.resolution.get("ambiguous"))

    @property
    def unresolved(self):
        return self.person is None and not self.external

    @property
    def caveats(self):
        """Everything about this slot that is weaker than a fact."""
        out = []
        if self.chose:
            out.append("tie broken here, not by the data")
        if self.resolution.get("widened"):
            out.append("widened past the named unit")
        if self.resolution.get("note"):
            out.append(self.resolution["note"])
        return out

    def describe(self):
        if self.external:
            return f"{self.title}  [EXTERNAL to HAL -- no directory entry]"
        if self.person is None:
            return f"{self.title}  [UNRESOLVED -- {org.show(self.resolution)}]"
        tag = f"   ({'; '.join(self.caveats)})" if self.caveats else ""
        return f"{self.title}  ->  {self.person.short}{tag}"

    def as_dict(self):
        return {"kind": self.kind, "title": self.title, "why": self.why,
                "required": self.required, "external": self.external,
                "ambiguous": self.ambiguous, "tie_broken_here": self.chose,
                "caveats": self.caveats,
                "person": self.person.as_dict() if self.person else None,
                "candidates": [p.pb for p in self.resolution.get("candidates", [])],
                "actioned": self.actioned, "action": self.action}


def _fill(kind, title, resolution, why="", required=True, auto_pick=True, prefer_pb=None):
    person, chose = org.pick(resolution, prefer_pb=prefer_pb) if auto_pick else (None, False)
    return Slot(kind, title, resolution=resolution, person=person, why=why,
                required=required, chose=chose)


# -- the plan ----------------------------------------------------------------
class Plan:
    def __init__(self, note_id, division, originator, shape):
        self.note_id = note_id
        self.division = division
        self.originator = originator
        self.shape = shape
        self.slots = []
        self.cfa = None
        self.dop_level = None
        self.dop_level_source = None
        self.committee_specs = []

    @property
    def mode(self):
        return self.shape["mode"]

    def add(self, slot):
        self.slots.append(slot)
        return slot

    @property
    def unresolved(self):
        return [s for s in self.slots if s.unresolved and s.required]

    @property
    def ambiguous(self):
        return [s for s in self.slots if s.ambiguous]

    @property
    def externals(self):
        return [s for s in self.slots if s.external]

    def as_dict(self):
        return {"note": self.note_id, "mode": self.mode, "division": self.division,
                "agency": self.shape.get("agency"),
                "shape_source": self.shape.get("source"),
                "originator": self.originator.as_dict() if self.originator else None,
                "dop_level": self.dop_level, "dop_level_source": self.dop_level_source,
                "committee_specs": self.committee_specs,
                "slots": [s.as_dict() for s in self.slots]}


def build_plan(note_id, division, ans=None, originator=None, originator_dept=None,
               auto_pick=True, case=None):
    """Resolve every position the chain needs, before anyone is asked to act.

    Order follows F1: originator, his section check, his department head, the
    cross-department concurrences, the two-tier Finance concurrence, then the CFA.
    Whatever checklist.injected() names is added ahead of the CFA -- those are the
    approvals the indentor's own answers made mandatory.

    Nothing is guessed silently. A slot the directory cannot resolve, or resolves to a
    tie, is recorded as such and surfaces in Plan.unresolved / Plan.ambiguous.
    """
    ans = checklist.answers() if ans is None else ans
    shape = chain_shape(note_id)
    plan = Plan(note_id, division, originator, shape)

    # 1 -- originator. Named if given, else the requisitioning department's Manager rung.
    if originator is None and originator_dept:
        pool = org.people(division=division, dept=originator_dept,
                          min_grade=3, max_grade=4)
        res = {"person": pool[0] if len(pool) == 1 else None,
               "candidates": sorted(pool, key=lambda p: p.pb),
               "ambiguous": len(pool) > 1, "unit": f"{originator_dept}/{division}",
               "pool_size": len(pool)}
        s = _fill("originator", "Originator (raises the indent)", res,
                  why="the requisitioning department", auto_pick=auto_pick)
        plan.originator = s.person
        plan.add(s)
    elif originator is not None:
        plan.add(Slot("originator", "Originator (raises the indent)",
                      resolution={"person": originator, "candidates": [originator]},
                      person=originator, why="named"))

    dept = plan.originator.dept_raw if plan.originator else originator_dept

    if plan.mode == SERIAL:
        # 2 -- section check: the next rung up inside the same department.
        if plan.originator is not None:
            plan.add(_fill("section_check", "Section check (next rung, same department)",
                           org.next_up(plan.originator),
                           why="F1 N2 -- Chief Manager (Security) checked the Manager's note",
                           auto_pick=auto_pick))

        # 3 -- department head.
        if dept:
            plan.add(_fill("dept_head", f"Head of {org.norm_dept(dept)}",
                           org.head_of(division, dept),
                           why="F1 N3 -- DGM (Security) cleared it for the department",
                           auto_pick=auto_pick))

        # 4 -- cross-department concurrences.
        for cdepts, min_grade in shape.get("concurrences", []):
            res = _in_dept(division, cdepts, min_grade=min_grade)
            label = org.norm_dept(res["unit"].split("/")[0]) or "/".join(cdepts)
            plan.add(_fill("concurrence", f"Concurrence -- {label}", res,
                           why=f"F1 concurred at {'/'.join(cdepts)} (grade {min_grade}+)",
                           auto_pick=auto_pick))

    # 5 -- Finance, two-tier: the AGM takes it, delegates down to his DGM to examine.
    # Bound to the Finance department -- an AGM from another department is not this.
    if shape.get("finance"):
        fin = ("FINANCE", "ACCOUNTS", "BOOK KEEPING")
        plan.add(_fill("finance_head", "Finance concurrence -- AGM (Finance)",
                       _in_dept(division, fin, want=8),
                       why="F1 N9/N13 -- AGM(Finance) took it and finally concurred",
                       auto_pick=auto_pick))
        plan.add(_fill("finance_examine", "Finance scrutiny -- DGM (Finance)",
                       _in_dept(division, fin, want=7),
                       why="F1 N10/N12 -- \"Pl examine\" sent it down; the DGM raised the query",
                       auto_pick=auto_pick))

    # 6 -- whatever the checklist answers made mandatory.
    for inj in checklist.injected(ans):
        if inj["kind"] == "cfa":
            continue                                     # handled as the CFA slot below
        if inj["external"]:
            plan.add(Slot(inj["kind"], inj["authority"], external=True,
                          why=inj["why"], required=True))
            continue
        if inj["kind"] == "head_of_division":
            res = org.head_of_division(division)
        elif inj["kind"] == "dop_authority":
            res = org.resolve_authority("GM", division)
        elif inj["kind"] == "indigenisation_cell":
            res = _in_dept(division, ("PROJECT PLANNING", "PLANNING", "MSD"), min_grade=7)
        elif inj["kind"] == "committee":
            res = org.head_of_division(division)
        else:
            res = {"person": None, "candidates": [], "ambiguous": False}
        plan.add(_fill(inj["kind"], inj["authority"], res,
                       why=f"checklist {inj['block']} sl {inj['sl']} = "
                           f"\"{inj['answer']}\" -- {inj['why'][:80]}",
                       auto_pick=auto_pick))

    # 7 -- the CFA. The DOP-2025 value bands are not in sampleData, so the level is
    # taken from the checklist / case data and mapped through rules.LEVEL_DESIG. It is
    # never computed here, and the source is recorded as human for exactly that reason.
    plan.dop_level = checklist.dop_level(ans)
    plan.dop_level_source = "checklist provisioning sl 11" if plan.dop_level else None
    if not plan.dop_level and case:
        clause = (case.get("requisition") or {}).get("dop_clause")
        if clause:
            plan.dop_level = "Level I"
            plan.dop_level_source = f"case_input dop_clause \"{clause}\" (assumed Level I)"
    desig = rules.LEVEL_DESIG.get(plan.dop_level or "", "GM(AOD)")
    cfa = _fill("cfa", f"CFA -- {desig} ({plan.dop_level or 'level not stated'})",
                org.resolve_authority(desig, division),
                why=f"DOP level from {plan.dop_level_source or 'nothing on file'}; "
                    f"value bands absent from sampleData, so the level is human-supplied",
                auto_pick=auto_pick)
    plan.cfa = plan.add(cfa)

    # 8 -- committee composition, for the notes that are decided by one.
    if plan.mode == COMMITTEE:
        specs = list(shape.get("committee_specs") or [])
        src = shape.get("committee_from_case")
        if not specs and src and case:
            specs = list((case.get(src[0]) or {}).get(src[1]) or [])
        plan.committee_specs = specs

    return plan


def _res(winners, dept, division, note=""):
    return {"person": winners[0] if len(winners) == 1 else None,
            "candidates": sorted(winners, key=lambda p: p.pb),
            "ambiguous": len(winners) > 1,
            "unit": f"{org.norm_dept(dept)}/{division}",
            "pool_size": len(winners), "widened": False, "note": note}


def _in_dept(division, depts, want=None, min_grade=None):
    """Resolve a slot *inside* a department and never leave it.

    org.resolve_authority widens to the whole division when the sought grade is absent,
    which is right for a named post like GM(AOD) but wrong for a functional concurrence
    -- an AGM from HR is not the Finance concurrence. So this tries each acceptable
    department name in order and, within the first one that exists, prefers the exact
    grade, then the lowest rung at or above `min_grade`, then that department's
    senior-most person -- saying so in `note` when it had to settle.
    """
    names = depts if isinstance(depts, (list, tuple)) else (depts,)
    tried = []
    for d in names:
        pool = org.people(division=division, dept=d)
        if not pool:
            tried.append(org.norm_dept(d))
            continue
        if want is not None:
            exact = [p for p in pool if p.grade_level == want]
            if exact:
                return _res(exact, d, division)
        if min_grade is not None:
            ok = [p for p in pool if (p.grade_level or 0) >= min_grade]
            if ok:
                step = min(p.grade_level for p in ok)
                return _res([p for p in ok if p.grade_level == step], d, division)
        top = max((p.grade_level or 0) for p in pool)
        sought = want if want is not None else min_grade
        return _res([p for p in pool if (p.grade_level or 0) == top], d, division,
                    note=f"no grade-{sought} post in {org.norm_dept(d)}; "
                         f"took its senior-most (grade {top})")
    return {"person": None, "candidates": [], "ambiguous": False,
            "unit": " / ".join(tried) + f" in {division}", "pool_size": 0,
            "widened": False,
            "note": f"none of {', '.join(tried)} exists in {division}"}


# -- the walk ----------------------------------------------------------------
def clean_comment(text, fallback=CONCUR_DEFAULT):
    """A comment that is empty or nothing but punctuation becomes the standard line."""
    t = (text or "").strip()
    if not t or all(ch in _SYMBOLS for ch in t):
        return fallback
    return t


def txn_id(file_id, seq, pb):
    """A per-hop transaction id in HAL's own shape.

    The real note stamps every hop, not every note:
        11F6-669B568D-1DC1C-165F65DF9-0001 ... -000E
    The fourth group is constant across the file; the last is a hex counter. Derived
    from a hash here rather than randomly, so replays and checks are reproducible.
    """
    h = hashlib.md5(f"{file_id}:{seq}:{pb}".encode()).hexdigest().upper()
    f = hashlib.md5(str(file_id).encode()).hexdigest().upper()
    return f"{h[:4]}-{h[4:13]}-{h[13:18]}-{f[:9]}-{seq:04X}"


class Chain:
    """The live walk. Hops are append-only -- a query or a send-back adds a hop, it
    never rewrites one, which is how the real note reads (N11 answers N10 in place)."""

    def __init__(self, plan, file_id="0000000000"):
        self.plan = plan
        self.file_id = file_id
        self.hops = []
        self.riders = []
        self.decision = None
        self.closed = False

    @property
    def holder(self):
        return self.hops[-1]["person"] if self.hops else self.plan.originator

    def add(self, person, action, comment="", slot=None, when=None,
            two_factor=False, rider="", answers=None):
        if action not in HOPS:
            raise ValueError(f"unknown hop type: {action}")
        seq = len(self.hops) + 1
        fallback = CONCUR_DEFAULT if action.startswith("concur") else ""
        hop = {
            "seq": seq,
            "note": f"N{seq}",
            "person": person,
            "slot": slot,
            "action": action,
            "comment": clean_comment(comment, fallback) if fallback else (comment or "").strip(),
            "date": when or date.today().strftime("%d/%m/%Y"),
            "txn_id": txn_id(self.file_id, seq, person.pb if person else "?"),
            "two_factor": bool(two_factor),
            "rider": rider or "",
            "answers": answers,
        }
        self.hops.append(hop)
        if rider:
            self.riders.append({"hop": hop["note"], "by": person.name if person else "?",
                                "condition": rider, "recorded": True})
        if slot is not None:
            slot.actioned = True
            slot.action = action
        if action in ("approve", "reject"):
            self.decision = action
            self.closed = True
        return hop

    # -- the gate ------------------------------------------------------------
    def release_ready(self):
        """May the file leave the agency? Returns (ok, reasons it may not).

        Three conditions, all from the sample data: the CFA has decided, every
        authority the checklist made mandatory has acted, and every rider attached
        along the way is on record.
        """
        why = []
        if self.decision != "approve":
            why.append("the CFA has not approved" if self.decision is None
                       else f"the CFA {self.decision}ed -- the file is closed, not released")
        for s in self.plan.slots:
            if not s.required or s.kind in ("originator", "cfa"):
                continue
            if s.external and not s.actioned:
                why.append(f"{s.title} is outside HAL and has not been recorded as obtained")
            elif not s.actioned:
                why.append(f"{s.title} has not acted")
        for r in self.riders:
            if not r["recorded"]:
                why.append(f"rider from {r['hop']} is not recorded")
        return (not why), why

    # -- reporting -----------------------------------------------------------
    def routing_table(self):
        """The hops in the layout the real note prints them in."""
        rows = []
        for h in self.hops:
            p = h["person"]
            rows.append({
                "sr_no": str(h["seq"]), "note": h["note"],
                "name": p.name if p else "", "designation": p.grade_label if p else "",
                "dept": p.dept_raw if p else "", "division": p.division if p else "",
                "date": h["date"], "action": h["action"],
                "comment": h["comment"], "txn_id": h["txn_id"],
                "two_factor": h["two_factor"], "rider": h["rider"],
            })
        return rows

    def grade_path(self):
        return [h["person"].grade_level for h in self.hops if h["person"]]

    def elapsed_days(self):
        """Days between the first and last hop, when both dates parse."""
        ds = [h["date"] for h in self.hops if h["date"]]
        if len(ds) < 2:
            return None
        try:
            a = date(*[int(x) for x in reversed(ds[0].split("/"))])
            b = date(*[int(x) for x in reversed(ds[-1].split("/"))])
        except (ValueError, TypeError):
            return None
        return (b - a).days

    def as_dict(self):
        ok, why = self.release_ready()
        return {"file_id": self.file_id, "plan": self.plan.as_dict(),
                "hops": self.routing_table(), "riders": self.riders,
                "decision": self.decision, "closed": self.closed,
                "released": ok, "release_blocked_by": why,
                "grade_path": self.grade_path(), "elapsed_days": self.elapsed_days()}


# -- committee mode ----------------------------------------------------------
class Committee:
    """Stage 3 is not a chain. Annexure 21A wants a members table -- signature,
    designation, date -- and since Amendment 1 dt 29-01-2024, a conflict-of-interest
    declaration from each of them. Order does not matter; completeness does."""

    def __init__(self, note_id, purpose, source=""):
        self.note_id = note_id
        self.purpose = purpose
        self.source = source
        self.members = []

    def add_member(self, person, spec="", role="Member", resolution=None, chose=False):
        res = resolution or {}
        caveats = []
        if chose:
            caveats.append("tie broken here, not by the data")
        if res.get("widened"):
            caveats.append(f"no such post in {res.get('unit', 'the named unit')}; "
                           f"widened to the division")
        self.members.append({"person": person, "spec": spec, "role": role,
                             "signed": False, "coi_declared": False,
                             "date": None, "remark": "", "caveats": caveats})
        return self.members[-1]

    def sign(self, index, coi_declared, remark="", when=None):
        m = self.members[index]
        m["signed"] = True
        m["coi_declared"] = bool(coi_declared)
        m["remark"] = remark
        m["date"] = when or date.today().strftime("%d/%m/%Y")
        return m

    def complete(self):
        """(ok, reasons). Every member must have signed AND declared no conflict --
        an unsigned member or an undeclared conflict blocks the report."""
        why = []
        if not self.members:
            why.append("no members named")
        for m in self.members:
            who = m["person"].name if m["person"] else m["spec"] or "?"
            if not m["signed"]:
                why.append(f"{who} has not signed")
            elif not m["coi_declared"]:
                why.append(f"{who} has not made the conflict-of-interest declaration")
        return (not why), why

    def as_dict(self):
        ok, why = self.complete()
        return {"note": self.note_id, "purpose": self.purpose, "source": self.source,
                "declaration": COI_DECLARATION, "complete": ok, "blocked_by": why,
                "members": [{"spec": m["spec"], "role": m["role"],
                             "person": m["person"].as_dict() if m["person"] else None,
                             "signed": m["signed"], "coi_declared": m["coi_declared"],
                             "date": m["date"], "remark": m["remark"],
                             "caveats": m.get("caveats", [])}
                            for m in self.members]}


def committee_from_specs(note_id, specs, division, purpose="", source="", auto_pick=True):
    """Build a committee from designation strings such as "AGM(Fin) - Chairman".

    The PNC composition is real -- F5 names it, and seed_case_input.py already carries
    it into case_input.json. The TEC composition is NOT in sampleData; that list comes
    back empty and the caller has to name the members.
    """
    c = Committee(note_id, purpose or note_id, source)
    for spec in specs:
        head = spec.split("-")[0].strip()
        role = spec.split("-", 1)[1].strip() if "-" in spec else "Member"
        res = org.resolve_authority(head, division)
        person, chose = org.pick(res) if auto_pick else (None, False)
        c.add_member(person, spec=spec, role=role, resolution=res, chose=chose)
    return c


if __name__ == "__main__":
    plan = build_plan("provisioning", "DIV1", originator_dept="FIRE & SEC")
    print(f"plan for {plan.note_id}  ({plan.mode}, {plan.shape['agency']} agency)")
    print(f"  shape source : {plan.shape['source']}")
    print(f"  DOP level    : {plan.dop_level}  <- {plan.dop_level_source}")
    print(f"\n  {len(plan.slots)} slots")
    for s in plan.slots:
        print(f"    {s.describe()}")
    print(f"\n  unresolved {len(plan.unresolved)} | ambiguous {len(plan.ambiguous)} "
          f"| external {len(plan.externals)}")

    ch = Chain(plan, file_id="6005612025")
    for s in plan.slots:
        if s.person is None:
            continue
        act = "approve" if s.kind == "cfa" else "concur"
        ch.add(s.person, act, "", slot=s)
    ok, why = ch.release_ready()
    print(f"\n  after walking every resolved slot: released={ok}")
    for w in why:
        print(f"    blocked: {w}")
    print(f"  grade path: {ch.grade_path()}")
    sys.exit(0)
