#!/usr/bin/env bash
#
# A walkthrough of one procurement case, from the moment somebody needs something to
# the moment a Purchase Order exists -- with every person who touches it named, and
# every accept/reject decision shown with its reason.
#
# It is a simulation in the sense that the organisation, the rules and the documents
# are the real ones from sampleData; the bidders and their prices are fabricated so
# there is something to decide about.
#
#   ai/demo.sh                  the whole story, straight through
#   ai/demo.sh --pause          stop after each act so you can read it
#   ai/demo.sh --quick          skip the note drafting (no Ollama needed)
#   ai/demo.sh --act 4          jump to one act (0-9)
#   ai/demo.sh --log run.txt    tee everything to a file
#   ai/demo.sh --no-color
#
# Installs nothing, starts no daemon, needs no sudo. It checks what is available and
# tells you the one command to run if something is missing.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

ENV_NAME="hal"
QUICK=0; PAUSE=0; ONLY_ACT=""; LOGFILE=""; USE_COLOR=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick)    QUICK=1; shift ;;
    --pause)    PAUSE=1; shift ;;
    --act)      ONLY_ACT="${2:?--act needs a number 0-9}"; shift 2 ;;
    --no-color) USE_COLOR=0; shift ;;
    --log)      LOGFILE="${2:-demo.log}"; shift 2 ;;
    -h|--help)  sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)          echo "unknown option: $1  (try --help)"; exit 2 ;;
  esac
done

[[ -n "$LOGFILE" ]] && { exec > >(tee -a "$LOGFILE") 2>&1; echo "logging to $LOGFILE"; }

if [[ $USE_COLOR -eq 1 && -t 1 ]]; then
  B=$'\033[1m'; DIM=$'\033[2m'; GRN=$'\033[32m'; RED=$'\033[31m'
  YEL=$'\033[33m'; CYN=$'\033[36m'; MAG=$'\033[35m'; R=$'\033[0m'
else
  B=""; DIM=""; GRN=""; RED=""; YEL=""; CYN=""; MAG=""; R=""
fi

PASS=0; FAIL=0; SKIP=0; FAILED_STEPS=()
CUR_ACT=0

hr()   { printf '%s\n' "$(printf '=%.0s' {1..78})"; }
thin() { printf '%s\n' "$(printf -- '-%.0s' {1..78})"; }

# act <n> <title> <one-line framing>
act() {
  CUR_ACT="$1"
  echo
  echo "${B}${CYN}$(hr)${R}"
  echo "${B}${CYN} ACT $1 -- $2${R}"
  echo "${DIM} $3${R}"
  echo "${B}${CYN}$(hr)${R}"
}

# say -- narration in the voice of the process, not the code. No leading blank line, so
# consecutive calls read as one paragraph; use gap() for a deliberate break.
say()  { echo "${MAG}  $*${R}"; }
note() { echo "${DIM}  $*${R}"; }
gap()  { echo; }

run_act() { [[ -z "$ONLY_ACT" || "$ONLY_ACT" == "$CUR_ACT" ]]; }

pause() {
  run_act || return 0
  [[ $PAUSE -eq 1 && -t 0 ]] || return 0
  echo
  read -rsp "${DIM}  -- press Enter for the next act --${R}" _ && echo
}

py() {
  conda run --no-capture-output -n "$ENV_NAME" python "$@" 2>&1 \
    | grep -vE "UserWarning: Data Validation|warn\(msg\)|pymupdf_layout"
}

# step "what is happening" <cmd...>
step() {
  run_act || return 0
  local label="$1"; shift
  echo
  echo "${B}  > ${label}${R}"
  note "\$ $*"
  thin
  if "$@"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1)); FAILED_STEPS+=("act $CUR_ACT: $label")
    echo "${RED}  [FAILED] ${label}${R}"
  fi
}

# xstep "what is happening" <cmd...>
# For a step whose whole point is to REFUSE. Exiting non-zero is the pass here, so a
# silent success would be the bug -- the TEC committee has no sourced composition and
# must decline rather than invent one.
xstep() {
  run_act || return 0
  local label="$1"; shift
  echo
  echo "${B}  > ${label}${R}"
  note "\$ $*"
  note "(this step is EXPECTED to refuse -- declining is the correct outcome)"
  thin
  if "$@"; then
    FAIL=$((FAIL + 1)); FAILED_STEPS+=("act $CUR_ACT: $label -- it should have refused")
    echo "${RED}  [WRONG] it went ahead instead of refusing${R}"
  else
    PASS=$((PASS + 1))
    echo "${GRN}  [ok] refused, as it should${R}"
  fi
}

skip() {
  run_act || return 0
  SKIP=$((SKIP + 1))
  echo; echo "${YEL}  skipped: $1${R}"; note "$2"
}

# ============================================================== the case
echo "${B}$(hr)${R}"
echo "${B} HAL NASHIK -- ONE PROCUREMENT CASE, END TO END${R}"
echo "${B}$(hr)${R}"
cat <<'TXT'

 THE REQUIREMENT
   Aircraft Overhaul Division, Nashik needs 2150 numbers of 250W High Bay LED
   light fittings. Estimate Rs 1,06,55,400 landed. It will be tendered on GeM as
   a two-bid, line-wise custom bid -- enquiry E-33046.

 WHAT IS REAL HERE
   The organisation (1,354 people, their grades and departments), the indentor's
   checklist and what each answer obliges, the eight-stage cascade and which
   agency owns each stage, the tender's 12 technical specifications and 18 terms,
   and a real approved Provisioning Note with its own 14-hop approval trail.

 WHAT IS FABRICATED
   The six bidders (DV1-DV6), everything they wrote on their compliance sheets,
   and every price. Real suppliers are not named. Without invented bids there is
   nothing for the TEC to accept or reject.

 WHAT YOU ARE WATCHING FOR
   Who raises the file, who concurs, who objects and sends it back, who approves
   it, which bidders are thrown out and on exactly which clause or specification
   line -- and what refuses to let the file move on.
TXT

# ============================================================== preflight
act 0 "SETTING UP" "checking what is available; installing nothing"

if ! command -v conda >/dev/null 2>&1; then
  echo "${RED} conda not on PATH -- this project's Python deps live in the '$ENV_NAME' env.${R}"; exit 1
fi
if ! conda env list | awk '{print $1}' | grep -qx "$ENV_NAME"; then
  echo "${RED} conda env '$ENV_NAME' not found.${R}"
  echo "   create it, then: conda run -n $ENV_NAME pip install pymupdf python-docx requests reportlab openpyxl"
  exit 1
fi
echo " conda env '$ENV_NAME'   ${GRN}ready${R}"

MISSING=$(conda run -n "$ENV_NAME" python - <<'PY' 2>/dev/null
mods = {"openpyxl": "openpyxl", "fitz": "pymupdf", "docx": "python-docx",
        "requests": "requests", "reportlab": "reportlab"}
print(" ".join(p for m, p in mods.items() if not __import__("importlib").util.find_spec(m)))
PY
)
if [[ -n "${MISSING// /}" ]]; then
  echo "${RED} missing packages: $MISSING${R}"
  echo "   run this yourself: conda run -n $ENV_NAME pip install $MISSING"
  exit 1
fi
echo " python packages     ${GRN}present${R}"

OLLAMA_UP=0
if curl -s --max-time 4 http://localhost:11434/api/tags >/dev/null 2>&1; then
  OLLAMA_UP=1
  echo " ollama              ${GRN}up${R}  (drafts the note prose)"
else
  echo " ollama              ${YEL}not running${R}"
  note "start it in another shell if you want the notes drafted:  ollama serve"
  note "every decision in this walkthrough works without it"
fi

for f in "sampleData/Dummy HAL Database of Personnals.xlsx" \
         "sampleData/Checklist for Indentor - STANDARD TERMS AND CONDITIONS-f.xlsx" \
         "sampleData/NOTING/NOTING SEQUENCE/F1 Approved Provisioning Note 6005612025.pdf" \
         "sampleData/TechnicalBid E-33046.pdf"; do
  [[ -f "$f" ]] && echo " ${GRN}have${R} $(basename "$f")" || echo " ${RED}MISSING${R} $f"
done
pause

# ============================================================== act 1
act 1 "THE ORGANISATION" \
      "before anyone can approve anything, the system has to know who exists"
gap
say "HAL Nashik has 1,354 officers across 19 units. Authority comes from grade:"
note "grade 4 Manager -> 6 Chief Manager -> 7 DGM -> 8 AGM -> 9 GM -> 10 ED"
gap
say "Watch the last line: the HR extract has no 'head of department' column, so"
say "for 88 of 272 departments the system cannot say who the head is. It reports"
say "that rather than picking someone."
step "the directory, and where it cannot answer" py ai/org.py
pause

# ============================================================== act 2
act 2 "THE REQUIREMENT IS RAISED" \
      "an officer fills the indentor's checklist -- and the answers decide who must sign"
gap
say "This is the part people find surprising. There is no fixed approval ladder."
say "Nine rows of the checklist name an authority inside their own text. Answer"
say "'yes' to short tendering and the Head of Division is now required. Answer"
say "'yes' to brand-specific procurement and a Committee is. The form decides the"
say "chain."
step "which answers oblige which authority" py ai/checklist.py
pause

# ============================================================== act 3
act 3 "HOW A PROVISIONING NOTE REALLY GETS APPROVED" \
      "replaying the 14-hop trail printed on a genuine approved note from 2025"
gap
say "This is not a mock-up. HAL's eFile system prints its own routing table on"
say "every note, and sampleData has one: 5 Night Vision Binoculars, CAR/25/229."
say "Ten people, seven departments, 34 days. Read the Action column:"
note "concur              -- agreed, passed on"
note "concur_with_rider   -- agreed BUT bound a later stage to a condition (N8)"
note "examine             -- a senior pushed it DOWN to his own junior (N9)"
note "query               -- Finance objected and bounced it back (N10 -> N11)"
note "approve             -- the CFA, GM(AOD), signed it (N14)"
gap
say "Note the grade path: 4 -> 6 -> 7 -> 7 -> 6 -> 7 -> 8 -> 8 -> 8 -> 7 -> 4 -> 7 -> 8 -> 9."
say "It goes DOWN twice. Seniority decides who may approve, never who comes next."
step "the real chain, replayed through the model" py ai/approval_run.py --replay-f1
pause

# ============================================================== act 4
act 4 "THE SAME THING FOR OUR CASE" \
      "the chain the LED requirement would actually travel, and what stops it"
gap
say "Now the system builds the chain itself: originator, his section check, his"
say "department head, five cross-department concurrences, Finance in two tiers,"
say "then the CFA. Plus whatever the checklist answers obliged."
gap
say "At the end, the release gate. A CFA signature alone is not enough -- if any"
say "required concurrence has not acted, the file does not leave the agency."
step "build it, walk it, test the gate" py ai/approval_run.py --auto
pause

# ============================================================== act 5
act 5 "WHERE A COMMITTEE DECIDES INSTEAD" \
      "some stages are not a chain at all"
gap
say "Price negotiation is decided by a committee, not by one person in a queue."
say "Every member signs, and since Amendment 1 of 29-01-2024 every member also"
say "declares no conflict of interest with any bidder. One missing declaration"
say "blocks the report."
step "the PNC committee -- its composition is named in the sample note F5" \
  py ai/approval_run.py --note pnc_req --auto
gap
say "And here is the system refusing to invent something. Annexure 21A prints a"
say "TEC members table but nothing in sampleData says who sits on a TEC. So it"
say "says so instead of guessing."
xstep "the TEC committee -- no source, so no composition" \
  py ai/approval_run.py --note tec_report --auto
pause

# ============================================================== act 6
act 6 "THE TENDER GOES OUT AND THE BIDS COME BACK" \
      "six suppliers return the compliance sheet -- fabricated, so there is something to judge"
gap
say "HAL issues a Technical Bid Compliance Sheet: the item, 12 specification lines"
say "with required values, 18 terms, and a vendor-details block. The real one in"
say "sampleData is blank -- it is what HAL sends out. Here it comes back filled."
step "the six returned bid sheets" py ai/fixtures/make_bid_E33046.py
pause

# ============================================================== act 7
act 7 "WHO IS THROWN OUT, AND ON WHAT" \
      "the two decisions that actually eliminate bidders"
gap
say "FIRST GATE -- EMD. A bidder may skip the deposit only if it MANUFACTURES the"
say "offered product in the relevant category. The system does not take the"
say "bidder's word: it reads Nature-of-Firm and the NIC code. Trading houses on"
say "NIC 46592 claiming a small-enterprise waiver are out -- the same test HAL"
say "applied to two bidders in the real Night Vision Binocular case."
gap
say "SECOND GATE -- TEC. Whatever the bidder marked NO against. The rejection"
say "cites the specification line by number, so it can be defended."
gap
say "Then the price bids open, L1 emerges, and the variance against the estimate"
say "decides whether anyone negotiates."
step "the bids read, judged, and priced" py ai/bid_sheet.py
pause

# ============================================================== act 8
act 8 "THE PAPERWORK THE DECISIONS PRODUCE" \
      "ten notes, each carrying the last one forward"
if [[ $QUICK -eq 1 ]]; then
  skip "note drafting" "--quick was passed"
elif [[ $OLLAMA_UP -eq 0 ]]; then
  skip "note drafting" "Ollama is not running -- 'ollama serve', then re-run"
else
  gap
say "Each note is roughly the previous note plus one new section. The pipeline"
  say "carries the old prose forward untouched, has the language model draft only"
  say "the new part, and computes every figure -- LD, SD, PBG, variance, savings --"
  say "in code. Watch the carry count grow: 686 -> 1439 -> ... -> 4872 characters."
  step "our LED case, all ten stages" \
    py ai/run.py --auto --case ai/fixtures/case_input_E33046.json
  gap
say "And the same pipeline on the real Night Vision Binocular case, scored"
  say "against the facts in the genuine signed notes."
  step "the real case" py ai/run.py --auto
  step "scored against the sample notes" py ai/validate.py
fi
pause

# ============================================================== act 9
act 9 "IS ANY OF THIS FAITHFUL?" \
      "every encoding re-read against the document it came from"
gap
say "The risk in work like this is drifting away from the client's documents."
say "So both encodings are asserted cell by cell against their sources -- the"
say "spreadsheets' own typos included, so a silent rewrite fails the check."
step "the cascade vs the responsibility-cascading spreadsheet" py ai/cascade_check.py
step "the approval layer vs the directory, the checklist and the real note" \
  py ai/approval_check.py
pause

# ============================================================== ledger
if [[ -z "$ONLY_ACT" ]]; then
act 9 "THE LEDGER" "who decided what, in one place"
step "consolidated decisions" py - <<'PY'
import json
from pathlib import Path

def load(p):
    q = Path(p)
    return json.loads(q.read_text(encoding="utf-8")) if q.exists() else None

def head(t):
    print("\n" + t); print("-" * 78)

ch = load("ai/outputs/approval_provisioning.json")
if ch:
    head("WHO HANDLED THE FILE")
    verbs = {"forward": "raised / passed it on", "concur": "concurred",
             "concur_with_rider": "concurred, WITH A CONDITION",
             "examine": "pushed it down to be examined",
             "query": "OBJECTED and sent it back", "approve": "APPROVED",
             "reject": "REJECTED", "return_to": "sent it back"}
    for h in ch["hops"]:
        who = f"{h['name']} ({h['designation']}, {h['dept']})"
        if len(who) > 50:
            who = who[:49] + "…"
        print(f"  {h['note']:<5}{who:<52}{verbs.get(h['action'], h['action'])}")
        if h.get("rider"):
            print(f"       {'':<52}condition: {h['rider'][:56]}")
    print(f"\n  outcome        : {(ch['decision'] or 'still open').upper()}")
    print(f"  left the agency: {'YES' if ch['released'] else 'NO'}")
    for w in ch["release_blocked_by"]:
        print(f"     held up by  : {w}")

    soft = [s for s in ch["plan"]["slots"] if s["caveats"]]
    if soft:
        print(f"\n  {len(soft)} approver(s) the data could not name with confidence:")
        for s in soft:
            print(f"     {s['title'][:42]:<44}{'; '.join(s['caveats'])[:60]}")

ci = load("ai/fixtures/case_input_E33046.json")
if ci:
    head("WHO WAS ACCEPTED OR REJECTED, AND WHY")
    rej = {r["name"]: r["spec_slnos"] for r in ci["tec"]["rejected"]}
    acc = ci["tec"]["accepted"]
    for b in ci["bidders"]:
        if b["emd"] != "Accepted":
            v, why = "OUT at EMD", b.get("emd_reason", "")
        elif b["name"] in rej:
            v, why = "OUT at TEC", f"specification sl no {rej[b['name']]} not met"
        elif b["name"] in acc:
            v, why = "in", "deposit cleared, every specification met"
        else:
            v, why = "-", ""
        print(f"  {b['name'][:36]:<38}{v:<13}{why[:58]}")
    pb, cp = ci["price_bid"], ci["_computed"]
    print(f"\n  lowest bidder  : {pb['l1_vendor']} at {pb['l1_price']}")
    print(f"  against estimate: +{cp['price_variance_pct']}%")
    print(f"  reverse auction: {pb['ra_status']}")
    print(f"  -> negotiation was therefore required")
    print(f"  negotiated down: {ci['counter_offer']['price']}  "
          f"(saved {ci['counter_offer']['savings_amount']}, {cp['savings_pct']}%)")
    print(f"  security 5%    : {cp['sd_amount']:,.0f}")
    print(f"  performance 10%: {cp['pbg_amount']:,.0f}")
    print(f"  approval sought: {ci['proposal']['cfa_desig']} under "
          f"{ci['requisition']['dop_clause']}")

cf = load("ai/outputs/case_full.json")
if cf:
    head("DOCUMENTS PRODUCED")
    print(f"  notes    : {' -> '.join(cf['path'])}")
    if cf.get("skipped"):
        print(f"  skipped  : {', '.join(cf['skipped'])}")
    print(f"  annexures: {len(cf['formats'])}, all computed rather than drafted")

head("WHAT THIS SIMULATION CANNOT HONESTLY DECIDE")
print("  * WHICH officer is the CFA for a given value. DOP-2025's value bands are")
print("    not in sampleData, so the level is taken from the checklist and marked")
print("    human-supplied. Nothing is inferred from the amount.")
print("  * WHO heads a department. The HR extract has no head column; ties at the")
print("    top grade are reported, not resolved (88 of 272 departments).")
print("  * WHO sits on a TEC. No source anywhere in sampleData.")
print("  * The bidders, their compliance answers and every price are FABRICATED.")
print("    The organisation, rules, specifications and terms are the real ones.")
PY
pause
fi

# ============================================================== close
echo
echo "${B}$(hr)${R}"
echo "${B} END OF WALKTHROUGH${R}"
echo "${B}$(hr)${R}"
printf " %s%d step(s) ran clean%s   %s%d failed%s   %s%d skipped%s\n" \
  "$GRN" "$PASS" "$R" "$([[ $FAIL -gt 0 ]] && echo "$RED" || echo "$DIM")" "$FAIL" "$R" \
  "$DIM" "$SKIP" "$R"
if [[ $FAIL -gt 0 ]]; then
  echo
  for s in "${FAILED_STEPS[@]}"; do echo " ${RED}failed:${R} $s"; done
  echo; echo " ${RED}the walkthrough did not complete cleanly${R}"
  exit 1
fi
echo
echo " documents : ai/outputs/    notes, approval chains, PDFs"
echo " the bids  : ai/fixtures/   filled sheets and the case they produce"
echo
echo " ${DIM}re-run one act:  ai/demo.sh --act 7${R}"
echo " ${DIM}read as you go:  ai/demo.sh --pause${R}"
[[ $OLLAMA_UP -eq 0 ]] && echo " ${YEL}the note drafting was skipped -- Ollama was not running${R}"
exit 0
