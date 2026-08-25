"""The HAL personnel directory -- a machine-readable copy of

    sampleData/Dummy HAL Database of Personnals.xlsx   [Sheet1]

One sheet, 1354 people, six columns:

    Division | Department | PB NO | Name | Grade | Designation

`Designation` is mechanically `Grade (Department)` and carries nothing the other two
columns do not (the 104 rows where it differs differ only by a trailing space in the
department name), so nothing here reads it except as a display string.

What this module is for: the approval chain needs to know who exists, what grade they
hold, which unit they sit in, who heads that unit, and who a named authority such as
"GM(AOD)" actually is. That is all here; the chain itself is in approval.py.

Two things the sheet does NOT give, and this module refuses to invent:

  * **No head flag and no reporting line.** `head_of` returns the highest grade in the
    unit *plus every candidate tied with them*, and says so -- 89 of the 273
    division-department pairs have a tie at the top. The caller decides.
  * **No rank for the three non-numeric grades** (CEO, SCH A, SCH B). BOARD_TIER below
    places them above Executive Director; that ordering is an assumption, flagged as one.
"""

import re
import sys
from functools import lru_cache
from pathlib import Path

import openpyxl

XLSX = (Path(__file__).resolve().parents[1] / "sampleData" /
        "Dummy HAL Database of Personnals.xlsx")

SHEET = "Sheet1"
HEADERS = ["Division", "Department", "PB NO", "Name", "Grade", "Designation"]

# Grades with no numeric prefix. The sheet gives no ordering for these three, so this
# is an ASSUMPTION: board-level posts sit above Executive Director (grade 10).
BOARD_TIER = {"CEO": 11, "SCH B": 12, "SCH A": 13}

# Department strings that mean the same unit but are spelled differently. Upper-casing
# and collapsing whitespace already merges Mat PLg/Mat Plg, SHOP/Shop, FINANCE/Finance,
# MARKETING/Marketing and TRANSPORT/Transport; these three need naming:
#   FIN                  -- how the four liaison offices label their finance desk
#   MANUFACTURING SHHOP  -- the sheet's own typo
#   PROJECT PLG          -- abbreviated in DIV8, spelled out in DIV8/DIV10
# 55 raw strings -> 50 after case/whitespace -> 47 after these aliases.
DEPT_ALIASES = {
    "FIN": "FINANCE",
    "MANUFACTURING SHHOP": "MANUFACTURING SHOP",
    "PROJECT PLG": "PROJECT PLANNING",
}

# Designation token -> grade level, read off the sheet's own ladder. Ordered
# longest-first because "GENERAL MANAGER" is a substring of both "ADDL GENERAL
# MANAGER" and "DY GENERAL MANAGER", and "MANAGER" of nearly everything.
DESIG_GRADE = [
    (("EXECUTIVE DIRECTOR", "ED"), 10),
    (("ADDITIONAL GENERAL MANAGER", "ADDL GENERAL MANAGER", "ADDL. GENERAL MANAGER", "AGM"), 8),
    (("DEPUTY GENERAL MANAGER", "DY GENERAL MANAGER", "DY. GENERAL MANAGER", "DGM"), 7),
    (("GENERAL MANAGER", "GM"), 9),
    (("CHIEF MANAGER", "CM"), 6),
    (("SENIOR MANAGER", "SR MANAGER", "SM"), 5),
    (("DEPUTY MANAGER", "DY MANAGER", "DM"), 3),
    (("MANAGER", "MGR"), 4),
    (("ENGINEER", "OFFICER"), 2),
    (("ASSISTANT ENGINEER", "ASST ENGINEER"), 1),
]

_PARENS = re.compile(r"\(.*?\)")

GRADE_LABEL = {
    1: "Assistant Engineer / Officer", 2: "Engineer / Officer", 3: "Deputy Manager",
    4: "Manager", 5: "Senior Manager", 6: "Chief Manager", 7: "Deputy General Manager",
    8: "Additional General Manager", 9: "General Manager", 10: "Executive Director",
    11: "CEO", 12: "Schedule B", 13: "Schedule A",
}


class Person:
    """One row of the sheet."""

    __slots__ = ("pb", "name", "division", "dept_raw", "dept", "grade_label",
                 "grade_level", "designation")

    def __init__(self, pb, name, division, dept_raw, grade_label, designation):
        self.pb = pb
        self.name = name
        self.division = division
        self.dept_raw = dept_raw
        self.dept = norm_dept(dept_raw)
        self.grade_label = grade_label
        self.grade_level = grade_level(grade_label)
        self.designation = designation

    def __repr__(self):
        return f"<{self.pb} {self.name} g{self.grade_level} {self.dept}/{self.division}>"

    @property
    def short(self):
        """One-line form for the routing table."""
        return f"{self.name} ({self.grade_label}) {self.dept_raw} / {self.division}"

    def as_dict(self):
        return {"pb": self.pb, "name": self.name, "division": self.division,
                "dept": self.dept_raw, "dept_norm": self.dept, "grade": self.grade_label,
                "grade_level": self.grade_level, "designation": self.designation}


def norm_dept(s):
    """Department name reduced to its canonical form."""
    if s is None:
        return ""
    t = " ".join(str(s).split()).upper()
    return DEPT_ALIASES.get(t, t)


def grade_level(label):
    """The numeric rank of a grade string; None when it cannot be read.

    The sheet writes grades as "<n> - <title>", with its own inconsistencies:
    "9 -  General Manager" carries a double space, and "1 - Assistant Finance Office"
    is missing the trailing r of Officer. Only the numeric prefix is trusted.
    """
    if label is None:
        return None
    t = " ".join(str(label).split()).upper()
    m = re.match(r"^(\d+)\s*-", t)
    if m:
        return int(m.group(1))
    return BOARD_TIER.get(t)


def desig_level(designation):
    """Grade implied by a designation string, e.g. "GM(AOD)" -> 9. None if unreadable."""
    if not designation:
        return None
    t = " ".join(str(designation).split()).upper()
    # Strip the parenthesised unit so "AGM(IMM-OH)" matches on "AGM", and pad with
    # spaces so token boundaries hold for the short forms (GM, DGM, AGM, CM, SM, DM).
    bare = _PARENS.sub(" ", t)
    head = " " + " ".join(bare.split()) + " "
    for tokens, level in DESIG_GRADE:
        for tok in tokens:
            if f" {tok} " in head:
                return level
    return None


def desig_unit(designation):
    """The unit named in parentheses, e.g. "AGM(IMM-OH)" -> "IMM-OH". "" if none."""
    m = _PARENS.search(str(designation or ""))
    return m.group(0).strip("()").strip().upper() if m else ""


# -- loading -----------------------------------------------------------------
@lru_cache(maxsize=1)
def load(path=None):
    """Every row of the sheet as Person objects, in sheet order."""
    p = Path(path) if path else XLSX
    if not p.exists():
        raise FileNotFoundError(
            f"personnel directory not found: {p}\n"
            "  expected sampleData/Dummy HAL Database of Personnals.xlsx")
    wb = openpyxl.load_workbook(p, data_only=True, read_only=True)
    ws = wb[SHEET]
    people = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        div, dept, pb, name, grade, desig = (
            ("" if c is None else str(c).strip()) for c in row[:6])
        people.append(Person(pb, name, div, dept, grade, desig))
    wb.close()
    return tuple(people)


def divisions():
    """Every unit code in the Division column, in first-seen order."""
    seen = {}
    for p in load():
        seen.setdefault(p.division, None)
    return list(seen)


def unit_tree():
    """division -> sorted list of its canonical department names."""
    tree = {}
    for p in load():
        tree.setdefault(p.division, set()).add(p.dept)
    return {d: sorted(v) for d, v in tree.items()}


def people(division=None, dept=None, min_grade=None, max_grade=None):
    """Directory slice. `dept` is matched against the canonical name."""
    want = norm_dept(dept) if dept else None
    out = []
    for p in load():
        if division and p.division != division:
            continue
        if want and p.dept != want:
            continue
        if min_grade is not None and (p.grade_level or 0) < min_grade:
            continue
        if max_grade is not None and (p.grade_level or 0) > max_grade:
            continue
        out.append(p)
    return out


def by_pb(pb):
    return next((p for p in load() if p.pb == str(pb)), None)


# -- resolution --------------------------------------------------------------
def _top(pool):
    """(winners, everyone) -- the highest-grade people in a pool."""
    if not pool:
        return [], []
    top = max((p.grade_level or 0) for p in pool)
    return [p for p in pool if (p.grade_level or 0) == top], pool


def head_of(division, dept):
    """Who heads a department.

    The sheet has no head flag, so this is the highest grade in the unit -- and when
    more than one person holds it the answer is genuinely unknown, which `ambiguous`
    says. 89 of 273 division-department pairs are in that position, so the caller
    must handle it rather than take candidates[0] on faith.
    """
    pool = people(division=division, dept=dept)
    winners, _ = _top(pool)
    return {"person": winners[0] if len(winners) == 1 else None,
            "candidates": sorted(winners, key=lambda p: p.pb),
            "ambiguous": len(winners) > 1,
            "unit": f"{norm_dept(dept)} / {division}",
            "pool_size": len(pool)}


def head_of_division(division):
    """The senior-most person in a whole division -- the checklist's "Head of Division"."""
    pool = people(division=division)
    winners, _ = _top(pool)
    return {"person": winners[0] if len(winners) == 1 else None,
            "candidates": sorted(winners, key=lambda p: p.pb),
            "ambiguous": len(winners) > 1,
            "unit": division,
            "pool_size": len(pool)}


def match_dept(hint, division):
    """A parenthesised unit hint mapped onto a department this division really has.

    Exact canonical name first, then a prefix match, so "IMM-OH" finds IMM and
    "SEC & FIRE" finds FIRE & SEC's canonical form if one exists. "" when the hint
    names something that is not a department here at all -- "AOD" is a *division* in
    the note texts, and the GM who signs for it sits in "GM office".
    """
    want = norm_dept(hint)
    if not want:
        return ""
    have = set(unit_tree().get(division, []))
    if want in have:
        return want

    def toks(s):
        return {t for t in re.split(r"[^A-Z0-9]+", s) if t}

    # Same words in a different order -- "SEC & FIRE" is "FIRE & SEC".
    mine = toks(want)
    for d in sorted(have):
        if mine and toks(d) == mine:
            return d
    head = re.split(r"[-/&,]", want)[0].strip()
    for d in sorted(have):
        if head and (d == head or d.startswith(head) or head.startswith(d)):
            return d
    # A shared distinctive word, e.g. "SEC & FIRE" -> "FIRE & SEC" if the sets differ.
    for d in sorted(have):
        if mine and mine & toks(d):
            return d
    return ""


def resolve_authority(spec, division, dept=None):
    """Find the person behind a named authority such as "GM(AOD)" or "AGM(IMM-OH)".

    Grade comes from the designation token, unit from the parentheses when it names a
    department this division actually has. If it does but nobody there holds that
    grade, the search widens to the whole division and says so (`widened`) -- silently
    dropping the unit constraint would make the answer look better sourced than it is.

    Returns the same shape as head_of, so callers treat every slot alike.
    """
    want = desig_level(spec)
    unit = match_dept(dept or desig_unit(spec), division)
    pool, widened = [], False
    if unit:
        pool = people(division=division, dept=unit, min_grade=want, max_grade=want)
    if not pool:
        widened = bool(unit)
        pool = people(division=division, min_grade=want, max_grade=want)
    winners, _ = _top(pool)
    return {"person": winners[0] if len(winners) == 1 else None,
            "candidates": sorted(winners, key=lambda p: p.pb),
            "ambiguous": len(winners) > 1,
            "unit": f"{unit or 'any dept'} / {division}",
            "widened": widened,
            "sought": {"designation": spec, "grade_level": want},
            "pool_size": len(pool)}


def next_up(person, within_dept=True):
    """The next rung above someone -- the section-check slot.

    Lowest grade strictly above theirs in the same department (or division), so a
    Manager is checked by a Chief Manager rather than jumping straight to the AGM.
    """
    if person is None or person.grade_level is None:
        return {"person": None, "candidates": [], "ambiguous": False,
                "unit": "", "pool_size": 0}
    pool = people(division=person.division,
                  dept=person.dept_raw if within_dept else None,
                  min_grade=person.grade_level + 1)
    if not pool:
        return {"person": None, "candidates": [], "ambiguous": False,
                "unit": f"{person.dept}/{person.division}", "pool_size": 0}
    step = min((p.grade_level or 99) for p in pool)
    winners = [p for p in pool if p.grade_level == step]
    return {"person": winners[0] if len(winners) == 1 else None,
            "candidates": sorted(winners, key=lambda p: p.pb),
            "ambiguous": len(winners) > 1,
            "unit": f"{person.dept}/{person.division}",
            "pool_size": len(pool)}


def pick(resolution, prefer_pb=None):
    """Collapse a resolution to one person: the unambiguous answer, an explicitly
    preferred PB, or -- as a last resort -- the lowest PB among the candidates.

    Returns (person, chose) where `chose` is True when the tie was broken here rather
    than resolved by the data. Callers record that: it is a guess, not a fact.
    """
    if resolution.get("person"):
        return resolution["person"], False
    cands = resolution.get("candidates") or []
    if not cands:
        return None, False
    if prefer_pb:
        hit = next((p for p in cands if p.pb == str(prefer_pb)), None)
        if hit:
            return hit, False
    return cands[0], True


# -- self-report -------------------------------------------------------------
def summary():
    ppl = load()
    tree = unit_tree()
    raw = {p.dept_raw for p in ppl}
    lines = [
        f"personnel directory: {len(ppl)} people from {XLSX.name}",
        f"  units       : {len(tree)}  ({', '.join(list(tree)[:6])}, ...)",
        f"  departments : {len(raw)} raw -> {len({p.dept for p in ppl})} canonical",
        f"  grades      : {len({p.grade_label for p in ppl})} labels, "
        f"levels {min(p.grade_level for p in ppl if p.grade_level)}"
        f"-{max(p.grade_level for p in ppl if p.grade_level)}",
        f"  PB numbers  : {min(p.pb for p in ppl)}-{max(p.pb for p in ppl)}, "
        f"{len({p.pb for p in ppl})} unique",
    ]
    return "\n".join(lines)


def show(resolution):
    """Human form of a resolution, ambiguity included rather than hidden."""
    tail = "  [widened to the division]" if resolution.get("widened") else ""
    if resolution.get("person"):
        return resolution["person"].short + tail
    cands = resolution.get("candidates") or []
    if not cands:
        return f"nobody found in {resolution.get('unit', '?')}"
    names = ", ".join(p.name for p in cands[:3])
    more = f" +{len(cands) - 3}" if len(cands) > 3 else ""
    return f"AMBIGUOUS -- {len(cands)} tied at the top grade: {names}{more}{tail}"


if __name__ == "__main__":
    print(summary())

    print("\ngrade spread")
    counts = {}
    for p in load():
        counts[p.grade_level] = counts.get(p.grade_level, 0) + 1
    for lvl in sorted(k for k in counts if k):
        print(f"  {lvl:>2}  {GRADE_LABEL.get(lvl, '?'):<32}{counts[lvl]:>5}")

    print("\nnamed authorities on DIV1")
    for spec in ("GM(AOD)", "AGM(IMM-OH)", "DGM(FINANCE)"):
        print(f"  {spec:<14} -> {show(resolve_authority(spec, 'DIV1'))}")

    print("\nunit heads")
    print(f"  {'Head of Division DIV1':<24} -> {show(head_of_division('DIV1'))}")
    for div, dept in (("DIV1", "IMM"), ("DIV5", "IMM"), ("DIV4", "IMM")):
        print(f"  {'head of ' + dept + '/' + div:<24} -> {show(head_of(div, dept))}")

    amb = sum(1 for d, ds in unit_tree().items() for x in ds if head_of(d, x)["ambiguous"])
    total = sum(len(ds) for ds in unit_tree().values())
    print(f"\n  {amb} of {total} division-department pairs have no single top grade")
    sys.exit(0)
