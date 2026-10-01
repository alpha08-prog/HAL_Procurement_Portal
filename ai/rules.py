import json,math
from pathlib import Path

def _num(s):
    if s is None: return None
    if isinstance(s,(int,float)): return float(s)
    if isinstance(s,list): s=s[0] if s else None
    if s is None: return None
    t="".join(ch for ch in str(s) if ch.isdigit() or ch==".")
    return float(t) if t else None

# Case fields each branch rule needs before its answer means anything. The
# interactive cascade shows a rule as "pending" rather than advising off absent
# data (e.g. retender_required() reads EMD facts that stage 1 has not ingested).
RULE_INPUTS = {
    "pnc_required": ["l1_price"],
    "retender_required": ["total_bids"],
}

def pnc_required(c):
    l1=_num(c.get("l1_price")); est=_num(c.get("budget_estimate")) or _num(c.get("amount_figures"))
    ra=str(c.get("ra_status") or "").lower()
    no_ra=any(k in ra for k in ["none","nil","not participated","no vendor","did not"])
    over=l1 is not None and est is not None and l1>est
    return bool(over or no_ra)

def retender_required(c):
    tb=_num(c.get("total_bids")); acc=c.get("emd_accepted") or []
    return tb==0 or len(acc)==0

def pb_accepted(c):
    return len(c.get("pb_accepted") or [])>0

def sd(po_basic): v=_num(po_basic); return round(v*0.05,2) if v else None
def pbg(po_basic): v=_num(po_basic); return round(v*0.10,2) if v else None
def indemnity(po_val): v=_num(po_val); return round(v*0.05,2) if v else None
def ld(rv,weeks,po):
    r=_num(rv); p=_num(po)
    if r is None or p is None: return None
    return min(round(0.005*r*math.ceil(weeks),2), round(0.10*p,2))
def basic_of(total,gst=0.18): v=_num(total); return round(v/(1+gst),2) if v else None
def savings(l1,final):
    a=_num(l1); b=_num(final)
    if a is None or b is None: return None,None
    amt=round(a-b,2); return amt,(round(amt/a*100,2) if a else None)
def variance(l1,est):
    a=_num(l1); b=_num(est)
    if a is None or b is None: return None
    return round((a-b)/b*100,2) if b else None
LEVEL_DESIG = {"Level I":"GM(AOD)","Level II":"AGM(IMM-OH)"}
_DOP=None
def dop_table():
    global _DOP
    if _DOP is None:
        try: _DOP=json.loads((Path(__file__).parent/"dop2025.json").read_text(encoding="utf-8"))
        except Exception: _DOP={"_status":"missing","bands":[],"levelDesig":None,"rows":[]}
    return _DOP
def dop_cfa_level(tender_type="Open",valid_offers=2,value=None):
    t=dop_table();multi=bool(valid_offers and valid_offers>1)
    clause="Annex-3-B-2 (L1 basis, more than one valid offer, Open/Limited tender)" if multi else "Annex-3-B-3 (single valid offer)"
    v=_num(value)
    band=None if v is None else next((b for b in t.get("bands") or [] if (b.get("min") is None or v>=b["min"]) and (b.get("max") is None or v<=b["max"]) and (not b.get("tenderType") or str(b["tenderType"]).lower()==str(tender_type).lower())),None)
    desig=t.get("levelDesig") or LEVEL_DESIG
    return {"clause":clause,"tender_type":tender_type,"valid_offers":valid_offers,"value":v,
            "level":band.get("level") if band else None,"cfa":(band.get("cfa") or desig.get(band.get("level"))) if band else None,
            "pending":band is None,"status":t.get("_status"),
            "note":None if band else "DOP-2025 Annexure-3 value bands are not on file -- the level is taken from the indentor checklist until HAL supplies the table",
            "level_designation_map":desig}
def emd_waiver(b): return bool(b.get("manufacturer") and b.get("nic_match"))
