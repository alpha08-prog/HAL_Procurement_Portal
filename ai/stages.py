ORDER = ["provisioning","emd","tec_req","tec_report","pbo","pnc_req","pnc_rec","pp","po"]

STAGES = {
 "provisioning": {"seq":0,"phase":"PROVISIONING","note":"Provisioning Note","file":"F1","resp":"Indenting",
   "new":["item_description","car_no","car_date","budget_year","budget_type","amount_figures","amount_in_words","dop_clause","reference_no"],
   "formats":["mpr_car"],"carry":None,"cond":None,"ref":False},
 "tender_doc": {"seq":1,"phase":"TENDERING","note":"Tender Document (Checklist + 72 Clauses)","file":None,"resp":"Tendering",
   "new":["tender_type","commercial_conditions","ifs_enquiry_no","tender_no"],
   "formats":["sd_format","pbg_format"],"carry":None,"cond":None,"ref":False},
 "emd": {"seq":2,"phase":"TENDERING","note":"EMD Stage Acceptance Note","file":"F2","resp":"Tendering",
   "new":["tender_no","tender_date","tender_enquiry","total_bids","emd_accepted_detail","emd_rejected_detail"],
   "formats":[],"carry":None,"cond":None,"ref":False},
 "tec_req": {"seq":3,"phase":"TECHNICAL","note":"TEC Request Note","file":"F3","resp":"Tendering",
   "new":["tec_forwarded_detail"],
   "formats":[],"carry":"emd","cond":None,"ref":False},
 "tec_report": {"seq":4,"phase":"TECHNICAL","note":"TEC Report Note","file":None,"resp":"Indenting",
   "new":["tec_query","tec_accepted_final","tec_rejected_final","spec_non_compliance"],
   "formats":["tec_statement"],"carry":"tec_req","cond":None,"ref":False},
 "pbo": {"seq":5,"phase":"COMMERCIAL","note":"Price Bid Opening Note","file":"F4","resp":"Tendering",
   "new":["pb_accepted","pb_rejected","pm_clause","l1_vendor","l1_price","budget_estimate","ra_status"],
   "formats":["tec_statement"],"carry":"tec_report","cond":None,"ref":True},
 "pnc_req": {"seq":6,"phase":"COMMERCIAL","note":"PNC Request Note","file":"F5","resp":"Tendering",
   "new":["lpp_contract","lpp_price","price_variance_pct","pnc_committee"],
   "formats":["commercial_eval","comparative_statement","price_justification","pnc_agenda"],"carry":"pbo","cond":"pnc_required","ref":True},
 "pnc_rec": {"seq":7,"phase":"COMMERCIAL","note":"PNC Recommendation Note","file":"F6","resp":"Tendering",
   "new":["counter_offer_price","counter_offer_date","savings_amount","savings_pct","recommended_vendor","recommended_qty","final_price"],
   "formats":["pnc_recommendation"],"carry":"pnc_req","cond":"pnc_required","ref":True},
 "pp": {"seq":8,"phase":"COMMERCIAL","note":"Purchase Proposal Note","file":"F7","resp":"Tendering",
   "new":["proposal_id","initiator","initiator_desig","fca_name","fca_designation","cfa_name","cfa_designation","dop_level","final_value","recommended_vendor","recommended_qty"],
   "formats":["purchase_proposal"],"carry":"pnc_rec","cond":None,"ref":True},
 "po": {"seq":9,"phase":"COMMERCIAL","note":"Purchase Order + HAL Contract","file":None,"resp":"Tendering",
   "new":["po_no","recommended_vendor","sd_amount","pbg_amount","warranty","delivery_terms"],
   "formats":["purchase_order","hal_contract"],"carry":None,"cond":None,"ref":True},
}

NEEDBASED = ["retender","short_closure","tec_query","due_date_ext","addendum","advance_payment","po_amendment"]

# The five need-based notes that the responsibility-cascading sheet actually places
# in the post-tender-opening cascade (see cascade.NODES). Same shape as STAGES, so
# pipeline.run_stage() can execute them; they are NOT in ORDER, so the automatic
# full-graph run (run.py --auto) and validate.py are untouched. carry "$last" means
# "carry forward whatever note was raised last", since these are reached out of order.
NEEDBASED_STAGES = {
 "retender": {"seq":10,"phase":"TENDERING","note":"Retender Note","file":None,"resp":"Tendering",
   "new":["retender_reason","tender_no","tender_enquiry","total_bids","retender_approval"],
   "formats":[],"carry":None,"cond":None,"ref":False},
 "short_closure": {"seq":11,"phase":"ANY","note":"Short Closure Note","file":None,"resp":"Tendering",
   "new":["short_closure_reason","reference_no","car_no","item_description"],
   "formats":[],"carry":"$last","cond":None,"ref":False},
 "tec_query": {"seq":12,"phase":"TECHNICAL","note":"TEC Query Note","file":None,"resp":"Indenting",
   "new":["tec_query","tec_query_bidders","tec_query_reply_due"],
   "formats":[],"carry":None,"cond":None,"ref":False},
 "advance_payment": {"seq":13,"phase":"COMMERCIAL","note":"Advance Payment Note","file":None,"resp":"Tendering",
   "new":["recommended_vendor","advance_pct","advance_amount","advance_bg_amount","advance_justification"],
   "formats":["advance_payment"],"carry":"$last","cond":None,"ref":True},
 "po_amendment": {"seq":14,"phase":"COMMERCIAL","note":"PO Amendment Note","file":None,"resp":"Tendering",
   "new":["po_no","amendment_no","amendment_reason","revised_value","recommended_vendor"],
   "formats":[],"carry":"$last","cond":None,"ref":True},
}

# Every note the pipeline can execute: the linear ORDER plus the need-based ones.
ALL_STAGES = {**STAGES, **NEEDBASED_STAGES}

REF = {
 "provisioning":"Provisioning_Note","tender_doc":"Tender_Document","emd":"EMD_Stage_Acceptance",
 "tec_req":"TEC_Req","tec_report":"TEC_Report","pbo":"PBO_Req","pnc_req":"PNC_Req",
 "pnc_rec":"PNC_Recc","pp":"Purchase_Proposal","po":"PO_HAL_Contract",
 "retender":"Retender_Note","short_closure":"Short_Closure_Note","tec_query":"TEC_Query_Note",
 "advance_payment":"Advance_Payment_Note","po_amendment":"PO_Amendment_Note",
}
