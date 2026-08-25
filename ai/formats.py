import re
def _l(x): return x if isinstance(x,list) else ([x] if x not in (None,"") else [])
def _f(x): return (x[0] if isinstance(x,list) and x else x)
def _vendors(x):
    if isinstance(x,list): return x
    if not x: return []
    return [p.strip(" .,") for p in re.split(r"\s+and\s+(?=M/s)",x) if p.strip()]

def mpr_car(c): return {"format":"MPR/SPR/CAR","car_no":c.get("car_no"),"date":c.get("car_date"),"item":c.get("item_description"),"budget_year":c.get("budget_year"),"value":_f(c.get("amount_figures"))}
def tec_statement(c): return {"format":"Annex 21A TEC Statement","accepted":_vendors(c.get("tec_accepted_final")),"rejected":_l(c.get("tec_rejected_final")),"non_compliance":_l(c.get("spec_non_compliance"))}
def comparative_statement(c): return {"format":"Annex 21B Comparative Statement","l1_vendor":c.get("l1_vendor"),"l1_price":_f(c.get("l1_price")),"estimate":c.get("budget_estimate") or _f(c.get("amount_figures")),"bidders":_l(c.get("pb_accepted"))}
def commercial_eval(c): return {"format":"Annex 21C Commercial Evaluation","l1_vendor":c.get("l1_vendor"),"l1_price":_f(c.get("l1_price")),"ra_status":c.get("ra_status")}
def price_justification(c): return {"format":"Annex 21D Price Justification","l1_price":_f(c.get("l1_price")),"lpp":c.get("lpp_price"),"lpp_contract":c.get("lpp_contract"),"variance_pct":c.get("price_variance_pct"),"estimate":c.get("budget_estimate") or _f(c.get("amount_figures"))}
def pnc_agenda(c): return {"format":"Annex 21E PNC Agenda","committee":c.get("pnc_committee"),"l1_vendor":c.get("l1_vendor"),"l1_price":_f(c.get("l1_price")),"variance_pct":c.get("price_variance_pct")}
def pnc_recommendation(c): return {"format":"Annex 21F PNC Recommendation","vendor":c.get("recommended_vendor") or c.get("l1_vendor"),"qty":c.get("recommended_qty"),"counter_offer":_f(c.get("counter_offer_price")),"final_price":_f(c.get("final_price")),"savings":c.get("savings_amount"),"savings_pct":c.get("savings_pct")}
def purchase_proposal(c): return {"format":"Annex 21 Purchase Proposal","proposal_id":c.get("proposal_id"),"vendor":c.get("recommended_vendor") or c.get("l1_vendor"),"value":c.get("final_value") or _f(c.get("final_price")),"initiator":c.get("initiator"),"fca":c.get("fca_name"),"cfa":c.get("cfa_name"),"dop_level":c.get("dop_level")}
def purchase_order(c): return {"format":"Purchase Order","po_no":c.get("po_no"),"vendor":c.get("recommended_vendor") or c.get("l1_vendor"),"value":c.get("final_value") or _f(c.get("final_price")),"sd":c.get("sd_amount"),"pbg":c.get("pbg_amount"),"warranty":c.get("warranty"),"delivery":c.get("delivery_terms")}
def hal_contract(c): return {"format":"HAL Standard Contract","vendor":c.get("recommended_vendor") or c.get("l1_vendor"),"sd":c.get("sd_amount"),"pbg":c.get("pbg_amount"),"warranty":c.get("warranty")}
def advance_payment(c): return {"format":"Advance Payment Format","vendor":c.get("recommended_vendor") or c.get("l1_vendor"),"pct":c.get("advance_pct"),"advance":_f(c.get("advance_amount")),"bg_amount":_f(c.get("advance_bg_amount")),"justification":c.get("advance_justification")}
def sd_format(c): return {"format":"Bank Guarantee (Security Deposit)","pct":"5% of PO basic value"}
def pbg_format(c): return {"format":"Bank Guarantee (Performance)","pct":"10% of PO basic value"}

REG={"mpr_car":mpr_car,"tec_statement":tec_statement,"comparative_statement":comparative_statement,"commercial_eval":commercial_eval,"price_justification":price_justification,"pnc_agenda":pnc_agenda,"pnc_recommendation":pnc_recommendation,"purchase_proposal":purchase_proposal,"purchase_order":purchase_order,"hal_contract":hal_contract,"advance_payment":advance_payment,"sd_format":sd_format,"pbg_format":pbg_format}

def build(fid,c):
    fn=REG.get(fid)
    return fn(c) if fn else {"format":fid,"_missing":True}
