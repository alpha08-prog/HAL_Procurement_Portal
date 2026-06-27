import json
from pathlib import Path
import rules

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def _det(b):
    return f"{b['name']} | {b['udyam']} | {b.get('mse','')} | NIC {b.get('nic','N/A')}"

def to_stage_inputs(ci):
    req, tn, b = ci["requisition"], ci["tender"], ci["bidders"]
    tec, pb, lpp = ci["tec"], ci["price_bid"], ci["lpp"]
    co, pnc, pr = ci["counter_offer"], ci["pnc"], ci["proposal"]
    acc = [x for x in b if x["emd"] == "Accepted"]
    rej = [x for x in b if x["emd"] != "Accepted"]
    est, l1 = req["mpr_estimate"], pb["l1_price"]
    var = rules.variance(l1, est)
    sav_amt, sav_pct = rules.savings(l1, co["price"])
    basic = rules.basic_of(co["price"])
    return {
        "provisioning": {"item_description": req["item_description"], "car_no": req["car_no"], "car_date": req["car_date"],
            "budget_year": req["budget_year"], "budget_type": req["budget_type"], "amount_figures": est,
            "amount_in_words": req.get("amount_in_words"), "dop_clause": req["dop_clause"], "reference_no": req.get("reference_no")},
        "tender_doc": {"tender_type": tn["tender_type"], "commercial_conditions": "Standard HAL Commercial T&C",
            "ifs_enquiry_no": tn["tender_enquiry"], "tender_no": tn["tender_no"]},
        "emd": {"tender_no": tn["tender_no"], "tender_date": tn["tender_date"], "tender_enquiry": tn["tender_enquiry"],
            "total_bids": tn["total_bids"], "emd_accepted_detail": [_det(x) for x in acc],
            "emd_rejected_detail": [f"{x['name']} | {x['udyam']} | Not qualified for EMD exemption (irrelevant NIC category)" for x in rej],
            "emd_accepted": [x["name"] for x in acc], "emd_rejected": [x["name"] for x in rej]},
        "tec_req": {"tec_forwarded_detail": [_det(x) for x in acc]},
        "tec_report": {"tec_query": tec.get("query"), "tec_accepted_final": tec["accepted"],
            "tec_rejected_final": [r["name"] for r in tec["rejected"]],
            "spec_non_compliance": [f"{r['name']}: sl no {r['spec_slnos']}" for r in tec["rejected"]]},
        "pbo": {"pb_accepted": tec["accepted"], "pb_rejected": [r["name"] for r in tec["rejected"]],
            "pm_clause": tec.get("pm_clause"), "l1_vendor": pb["l1_vendor"], "l1_price": l1,
            "budget_estimate": est, "ra_status": pb["ra_status"]},
        "pnc_req": {"lpp_contract": lpp["contract"], "lpp_price": lpp["price"], "price_variance_pct": var,
            "pnc_committee": "; ".join(pnc["committee"])},
        "pnc_rec": {"counter_offer_price": co["price"], "counter_offer_date": co["date"],
            "savings_amount": co.get("savings_amount") or sav_amt, "savings_pct": sav_pct,
            "recommended_vendor": pr["vendor"], "recommended_qty": req["quantity"], "final_price": co["price"]},
        "pp": {"proposal_id": pr["id"], "initiator": pr["initiator"], "initiator_desig": pr["initiator_desig"],
            "fca_name": pr["fca"], "fca_designation": pr["fca_desig"], "cfa_name": pr["cfa"], "cfa_designation": pr["cfa_desig"],
            "dop_level": pr["dop_level"], "final_value": pr["value"], "recommended_vendor": pr["vendor"], "recommended_qty": req["quantity"]},
        "po": {"po_no": "<from IFS-ERP>", "recommended_vendor": pr["vendor"], "sd_amount": rules.sd(basic), "pbg_amount": rules.pbg(basic),
            "warranty": "12 months from acceptance / 18 from delivery", "delivery_terms": "FOR HAL Nashik"},
    }
