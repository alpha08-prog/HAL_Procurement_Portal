// Master configuration for the 6-Tab Procurement Portal Welcome Page
// Derived directly from HAL Procurement Portal Architecture Specification.

export const PORTAL_TABS = [
  {
    id: 'provisioning',
    title: 'PROVISIONING',
    color: '#EAB308',
    bgLight: '#FEF9C3',
    borderColor: '#CA8A04',
    textColor: '#854D0E',
    badgeClass: 'tab-badge-provisioning',
    tagline: 'Demand aggregation, technical intake, estimations & statutory certifications',
    primaryRoute: '/provisioning',
    items: [
      {
        id: 'mpr_car_cpr_spr',
        code: 'PRV-01',
        name: 'MPR / CAR / CPR / SPR',
        desc: 'Material Purchase Requisition / Capital Acquisition Request / Consumables / Stores Requisitions intake & tracking',
        type: 'workflow',
        route: '/provisioning?tab=requisitions'
      },
      {
        id: 'indentor_checklist',
        code: 'PRV-02',
        name: 'INDENTOR CHECK LIST',
        desc: 'Comprehensive standard terms & conditions intake checklist per DOP-2025',
        type: 'route',
        route: '/approvals/intake'
      },
      {
        id: 'standard_terms_condts',
        code: 'PRV-03',
        name: 'STANDARD TERMS AND CONDTS',
        desc: 'HAL Master Standard Terms & Conditions library and statutory clauses',
        type: 'route',
        route: '/contracts/library'
      },
      {
        id: 'technical_specifications',
        code: 'PRV-04',
        name: 'TECHNICAL SPECIFICATIONS',
        desc: 'Technical specification builder with parameter-wise compliance matrix',
        type: 'modal',
        action: 'tech_specs'
      },
      {
        id: 'adequacy_statement',
        code: 'PRV-05',
        name: 'ADEQUACY STATEMENT',
        desc: 'Adequacy of requirement justification & technical adequacy certificate generator',
        type: 'modal',
        action: 'adequacy_statement'
      },
      {
        id: 'price_estimation_sheet',
        code: 'PRV-06',
        name: 'PRICE ESTIMATION SHEET',
        desc: 'BQ / LPP / GeM pricing estimation sheet with inflation indexing & taxes',
        type: 'modal',
        action: 'price_estimation'
      },
      {
        id: 'proprietary_certificate',
        code: 'PRV-07',
        name: 'PROPRIETARY CERTIFICATE',
        desc: 'Proprietary Article Certificate (PAC) per HAL PM Issue-4 & DOP-2025',
        type: 'modal',
        action: 'pac_certificate'
      },
      {
        id: 'single_tender_certificate',
        code: 'PRV-08',
        name: 'SINGLE TENDER CERTIFICATE',
        desc: 'Single Tender Certificate under rule-based justification & CFA sanction',
        type: 'modal',
        action: 'single_tender_cert'
      },
      {
        id: 'make_brand_certificate',
        code: 'PRV-09',
        name: 'MAKE / BRAND CERTIFICATE',
        desc: 'OEM brand standardization certificate & technical justification note',
        type: 'modal',
        action: 'brand_cert'
      },
      {
        id: 'provisioning_note',
        code: 'PRV-10',
        name: 'PROVISIONING NOTE',
        desc: 'F1 Provisioning Note generator with budget allocation & CFA approval',
        type: 'route',
        route: '/noting/initiate'
      },
      {
        id: 'dop_manual',
        code: 'PRV-11',
        name: 'DOP (Delegation of Powers)',
        desc: 'DOP-2025 interactive matrix & approval threshold lookup for CFAs/FCAs',
        type: 'modal',
        action: 'dop_lookup'
      },
      {
        id: 'pm_manual',
        code: 'PRV-12',
        name: 'PM (Procurement Manual)',
        desc: 'HAL Purchase Manual Issue-4 guidelines, tender procedures & SOPs',
        type: 'modal',
        action: 'pm_guidelines'
      },
      {
        id: 'mat_plg_os_works_manual',
        code: 'PRV-13',
        name: 'MAT PLG / OS / WORKS MANUAL',
        desc: 'Material Planning, Outsourcing & Works procurement manual reference',
        type: 'modal',
        action: 'works_manual'
      }
    ]
  },
  {
    id: 'procurement',
    title: 'PROCUREMENT',
    color: '#16A34A',
    bgLight: '#DCFCE7',
    borderColor: '#15803D',
    textColor: '#14532D',
    badgeClass: 'tab-badge-procurement',
    tagline: 'Tendering, e-File Noting lifecycle, TEC/PNC committees & 26 standard formats',
    primaryRoute: '/noting/inbox',
    items: [
      {
        id: 'generate_tender_doc',
        code: 'PRO-01',
        name: 'GENERATE TENDER DOCUMENT',
        desc: 'Generates GeM/HAL RFQ tender package with standard internal annexures enclosed',
        type: 'modal',
        action: 'tender_generator'
      },
      {
        id: 'emd_note',
        code: 'PRO-02',
        name: 'EMD NOTE',
        desc: 'F2 EMD verification & waiver acceptance note (Udyam MSE category validation)',
        type: 'route',
        route: '/noting/initiate?stage=emd'
      },
      {
        id: 'tec_req_note',
        code: 'PRO-03',
        name: 'TEC REQ NOTE',
        desc: 'F3 Technical Evaluation Committee forwarding request note',
        type: 'route',
        route: '/noting/initiate?stage=tec_req'
      },
      {
        id: 'tec_query_note',
        code: 'PRO-04',
        name: 'TEC QUERY NOTE',
        desc: 'Technical queries to bidders for specification clarifications',
        type: 'modal',
        action: 'tec_query'
      },
      {
        id: 'tec_report_approval_note',
        code: 'PRO-05',
        name: 'TEC REPORT APPROVAL NOTE',
        desc: 'Approval note for technical evaluation committee report & compliance matrix',
        type: 'route',
        route: '/noting/initiate?stage=tec_report'
      },
      {
        id: 'tec_representation_note',
        code: 'PRO-06',
        name: 'TEC REPRESENTATION NOTE',
        desc: 'Scrutiny and reply note for representations received from rejected bidders',
        type: 'modal',
        action: 'tec_representation'
      },
      {
        id: 'price_bid_opening_note',
        code: 'PRO-07',
        name: 'PRICE BID OPENING NOTE',
        desc: 'F4 Price Bid Opening approval note under PM 8.5.6',
        type: 'route',
        route: '/noting/initiate?stage=pbo'
      },
      {
        id: 'price_negotiation_approval_note',
        code: 'PRO-08',
        name: 'PRICE NEGOTIATION APPROVAL NOTE',
        desc: 'F5 Price Negotiation Committee constitution & negotiation sanction note',
        type: 'route',
        route: '/noting/initiate?stage=pnc_req'
      },
      {
        id: 'pnc_recommendation_note',
        code: 'PRO-09',
        name: 'PNC RECOMMENDATION NOTE',
        desc: 'F6 PNC counter-offer, price justification & savings recommendation note',
        type: 'route',
        route: '/noting/initiate?stage=pnc_rec'
      },
      {
        id: 'purchase_proposal_note',
        code: 'PRO-10',
        name: 'PURCHASE PROPOSAL NOTE',
        desc: 'F7 Purchase Proposal (PP) / DPC note to Competent Financial Authority',
        type: 'route',
        route: '/noting/initiate?stage=pp'
      },
      {
        id: 'po_amendment_note',
        code: 'PRO-11',
        name: 'PO AMENDMENT NOTE',
        desc: 'Delivery period extension, specification revision & PO amendment note',
        type: 'modal',
        action: 'po_amendment'
      },
      {
        id: 'short_closure_note',
        code: 'PRO-12',
        name: 'SHORT CLOSURE NOTE',
        desc: 'Tender / PO short closure & contract foreclosure justification note',
        type: 'modal',
        action: 'short_closure'
      },
      {
        id: 'retender_note',
        code: 'PRO-13',
        name: 'RETENDER NOTE',
        desc: 'Retender justification note with revised scope & price benchmark',
        type: 'modal',
        action: 'retender_note'
      },
      {
        id: 'bank_detail_insertion_note',
        code: 'PRO-14',
        name: 'BANK DETAIL INSERTION NOTE',
        desc: 'Vendor bank account detail insertion & IFSC mandate confirmation note',
        type: 'modal',
        action: 'bank_insertion'
      },
      {
        id: 'vendor_id_creation_note',
        code: 'PRO-15',
        name: 'VENDOR ID CREATION NOTE',
        desc: 'New vendor code creation in IFS-ERP & PAN/GST compliance note',
        type: 'modal',
        action: 'vendor_creation'
      },
      {
        id: 'vendor_registration_note',
        code: 'PRO-16',
        name: 'VENDOR REGISTRATION NOTE',
        desc: 'Formal vendor registration, assessment & categorization approval note',
        type: 'modal',
        action: 'vendor_registration'
      },
      {
        id: 'advance_payment_note',
        code: 'PRO-17',
        name: 'ADVANCE PAYMENT NOTE',
        desc: 'Sanction note for mobilization advance against bank guarantee',
        type: 'modal',
        action: 'advance_payment_note'
      },
      {
        id: 'misc_standalone_note',
        code: 'PRO-18',
        name: 'MISC / STANDALONE NOTE',
        desc: 'Ad-hoc administrative noting and inter-departmental concurrence',
        type: 'route',
        route: '/noting/initiate?stage=misc'
      },
      {
        id: 'admin_approval_26_formats',
        code: 'PRO-19',
        name: 'ADMIN APPROVAL NOTE + 26 TYPES OF FORMATS',
        desc: 'Administrative Approval Note plus comprehensive 26 standard HAL formats library',
        type: 'modal',
        action: 'formats_26_library'
      },
      {
        id: 'indemnity_bond_proc',
        code: 'PRO-20',
        name: 'INDEMNITY BOND',
        desc: 'Proforma Indemnity Bond format per Indian Contract Act',
        type: 'modal',
        action: 'indemnity_bond'
      },
      {
        id: 'nda_proc',
        code: 'PRO-21',
        name: 'NDA (Non-Disclosure Agreement)',
        desc: 'Proprietary technology & defense manufacturing non-disclosure agreement',
        type: 'modal',
        action: 'nda_agreement'
      },
      {
        id: 'non_poaching_clause',
        code: 'PRO-22',
        name: 'NON POACHING CLAUSE',
        desc: 'Statutory non-poaching commitment for defense contractor personnel',
        type: 'modal',
        action: 'non_poaching'
      },
      {
        id: 'integrity_pact',
        code: 'PRO-23',
        name: 'INTEGRITY PACT',
        desc: 'Independent External Monitor (IEM) Integrity Pact for high-value tenders',
        type: 'modal',
        action: 'integrity_pact'
      },
      {
        id: 'board_paper_generator',
        code: 'PRO-24',
        name: 'BOARD PAPER GENERATOR',
        desc: 'Executive Board Paper generator for CMD & Board of Directors approval',
        type: 'modal',
        action: 'board_paper'
      },
      {
        id: 'summary_of_proposal',
        code: 'PRO-25',
        name: 'SUMMARY OF PROPOSAL',
        desc: 'Executive summary sheet for financial concurrence & CFA briefing',
        type: 'modal',
        action: 'proposal_summary'
      },
      {
        id: 'advance_payment_format',
        code: 'PRO-26',
        name: 'ADVANCE PAYMENT FORMAT',
        desc: 'Standard Bank Guarantee proforma for advance payment release',
        type: 'modal',
        action: 'adv_bg_format'
      }
    ]
  },
  {
    id: 'contract_management',
    title: 'CONTRACT MANAGEMENT',
    color: '#0891B2',
    bgLight: '#CFFAFE',
    borderColor: '#0E7490',
    textColor: '#164E63',
    badgeClass: 'tab-badge-contracts',
    tagline: 'Purchase Order release, 72 STC contracts, GeM sync & security deposits',
    primaryRoute: '/contracts/register',
    items: [
      {
        id: 'pp_approved_list',
        code: 'CON-01',
        name: 'PP APPROVED LIST',
        desc: 'Queue of CFA-approved Purchase Proposals ready for PO issuance',
        type: 'route',
        route: '/contracts/register?filter=approved_pp'
      },
      {
        id: 'erelease_po',
        code: 'CON-02',
        name: 'ERELEASE PO',
        desc: 'Electronic release of Purchase Orders to IFS-ERP & GeM portal',
        type: 'modal',
        action: 'erelease_po'
      },
      {
        id: 'contract_generator',
        code: 'CON-03',
        name: 'CONTRACT GENERATOR',
        desc: 'Draft HAL Standard Contract incorporating the 72 STC clause matrix',
        type: 'route',
        route: '/contracts/generate'
      },
      {
        id: 'update_gem_contract',
        code: 'CON-04',
        name: 'UPDATE GEM CONTRACT',
        desc: 'Synchronize GeM contract numbers, delivery dates & amendments',
        type: 'modal',
        action: 'update_gem'
      },
      {
        id: 'live_po_status',
        code: 'CON-05',
        name: 'LIVE PO STATUS',
        desc: 'Active purchase orders live dashboard across manufacturing & supply stages',
        type: 'route',
        route: '/contracts/register'
      },
      {
        id: 'po_due',
        code: 'CON-06',
        name: 'PO DUE',
        desc: 'Delivery schedule tracking with delivery countdown and expediting triggers',
        type: 'modal',
        action: 'po_due_tracker'
      },
      {
        id: 'dp_expired',
        code: 'CON-07',
        name: 'DP EXPIRED',
        desc: 'Delivery Period expired POs with LD calculation & extension workflows',
        type: 'modal',
        action: 'dp_expired_tracker'
      },
      {
        id: 'generate_supplier_letters',
        code: 'CON-08',
        name: 'GENERATE MAIL / LETTERS FOR SUPPLIER',
        desc: 'Official letters generator (expediting, reminder, show-cause notices)',
        type: 'modal',
        action: 'supplier_letters'
      },
      {
        id: 'po_receipt_information',
        code: 'CON-09',
        name: 'PO RECEIPT INFORMATION',
        desc: 'Stores inward goods receipt tracking (GRN / RR / RV linkage)',
        type: 'modal',
        action: 'po_receipts'
      },
      {
        id: 'emd_sd_pbg',
        code: 'CON-10',
        name: 'EMD, SD, PBG',
        desc: 'Securities tracker: Earnest Money, 5% Security Deposit & 10% PBG bank guarantees',
        type: 'modal',
        action: 'securities_tracker'
      },
      {
        id: 'indemnity_bond_con',
        code: 'CON-11',
        name: 'INDEMNITY BOND',
        desc: 'Third-party liability & intellectual property indemnity tracker',
        type: 'modal',
        action: 'indemnity_bond'
      },
      {
        id: 'nda_con',
        code: 'CON-12',
        name: 'NDA',
        desc: 'Contractor non-disclosure agreement repository & compliance record',
        type: 'modal',
        action: 'nda_agreement'
      },
      {
        id: 'non_poaching_con',
        code: 'CON-13',
        name: 'NON POACHING CLAUSE',
        desc: 'Contract-specific non-poaching covenants and undertakings',
        type: 'modal',
        action: 'non_poaching'
      }
    ]
  },
  {
    id: 'payment',
    title: 'PAYMENT',
    color: '#DC2626',
    bgLight: '#FEE2E2',
    borderColor: '#B91C1C',
    textColor: '#7F1D1D',
    badgeClass: 'tab-badge-payment',
    tagline: 'Receipt Voucher processing, LD math, payment advice desk & CPPC clearance',
    primaryRoute: '/rv-inbox',
    items: [
      {
        id: 'live_rv_status',
        code: 'PAY-01',
        name: 'LIVE RV STATUS',
        desc: 'Real-time RV inbox with gate entry, pending aging, MSE priority & PA trigger',
        type: 'route',
        route: '/rv-inbox'
      },
      {
        id: 'ftr_generator',
        code: 'PAY-02',
        name: 'FTR GENERATOR',
        desc: 'Final Test Report / Quality Inspection acceptance certificate generator',
        type: 'modal',
        action: 'ftr_generator'
      },
      {
        id: 'ld_calculator',
        code: 'PAY-03',
        name: 'LD CALCULATOR',
        desc: 'Interactive Liquidated Damages calculator (Supply delay + I&C delay, max 10%)',
        type: 'modal',
        action: 'ld_calculator'
      },
      {
        id: 'payment_advicing',
        code: 'PAY-04',
        name: 'PAYMENT ADVICING',
        desc: 'Payment Advice creation desk with deductions, securities and multi-tier signoff',
        type: 'route',
        route: '/payment-advice'
      },
      {
        id: 'payment_history_status',
        code: 'PAY-05',
        name: 'PAYMENT HISTORY / STATUS',
        desc: 'Complete payment register with audit trail, CPPC dispatch and cycle times',
        type: 'route',
        route: '/payment-register'
      },
      {
        id: 'balance_outstanding_payment',
        code: 'PAY-06',
        name: 'BALANCE / OUTSTANDING PAYMENT',
        desc: 'Outstanding vendor dues, retention amounts and aged liability analysis',
        type: 'modal',
        action: 'balance_outstanding'
      },
      {
        id: 'payment_kpi_desk',
        code: 'PAY-07',
        name: 'KPI (Payment Desk)',
        desc: 'Payment Desk turnaround time, RV processing velocity & bill aging analytics',
        type: 'route',
        route: '/payment-kpis'
      }
    ]
  },
  {
    id: 'claim_management',
    title: 'CLAIM MANAGEMENT',
    color: '#EA580C',
    bgLight: '#FFEDD5',
    borderColor: '#C2410C',
    textColor: '#7C2D12',
    badgeClass: 'tab-badge-claims',
    tagline: 'Material rejection claims, vendor warranty dispatches & replacement inward',
    primaryRoute: '/claims',
    items: [
      {
        id: 'claim_generator',
        code: 'CLM-01',
        name: 'CLAIM GENERATOR',
        desc: 'Rejection, transit damage, shortage and warranty claim form generator',
        type: 'modal',
        action: 'claim_generator'
      },
      {
        id: 'claim_status',
        code: 'CLM-02',
        name: 'CLAIM STATUS',
        desc: 'Live tracking of claims (Raised, Acknowledged, Dispatched, Resolved)',
        type: 'route',
        route: '/claims?tab=status'
      },
      {
        id: 'units_dispatched_under_claim',
        code: 'CLM-03',
        name: 'UNITS DISPATCHED UNDER CLAIM',
        desc: 'Tracking gate passes & items dispatched back to supplier for repair/replacement',
        type: 'route',
        route: '/claims?tab=dispatched'
      },
      {
        id: 'item_received_against_claim',
        code: 'CLM-04',
        name: 'ITEM RECEIVED AGAINST CLAIM',
        desc: 'Stores inward & technical re-inspection of rectified/replaced claim items',
        type: 'route',
        route: '/claims?tab=received'
      },
      {
        id: 'claims_closed',
        code: 'CLM-05',
        name: 'CLAIMS CLOSED',
        desc: 'Settled claims archive with vendor credit notes and financial adjustments',
        type: 'route',
        route: '/claims?tab=closed'
      }
    ]
  },
  {
    id: 'kpi',
    title: 'KPI',
    color: '#9333EA',
    bgLight: '#F3E8FF',
    borderColor: '#7E22CE',
    textColor: '#581C87',
    badgeClass: 'tab-badge-kpi',
    tagline: 'Executive procurement MIS, monthly velocity, statutory reservations & lead times',
    primaryRoute: '/kpis',
    items: [
      {
        id: 'mis_report',
        code: 'KPI-01',
        name: 'MIS REPORT',
        desc: 'Executive monthly procurement MIS report generator with PDF/Excel export',
        type: 'modal',
        action: 'kpi_mis_report'
      },
      {
        id: 'no_mpr_received_per_month',
        code: 'KPI-02',
        name: 'NO OF MPR RECEIVED PER MONTH',
        desc: 'Monthly trend of Material Purchase Requisitions initiated across divisions',
        type: 'modal',
        action: 'kpi_mpr_received'
      },
      {
        id: 'no_mpr_converted_to_po',
        code: 'KPI-03',
        name: 'NO OF MPR CONVERTED TO PO',
        desc: 'Monthly conversion velocity from requisition intake to released Purchase Order',
        type: 'modal',
        action: 'kpi_mpr_converted'
      },
      {
        id: 'mpr_outstanding_end_month',
        code: 'KPI-04',
        name: 'MPR OUTSTANDING AT END OF MONTH',
        desc: 'Requisition backlog count and aging analysis at closing of each month',
        type: 'modal',
        action: 'kpi_mpr_outstanding'
      },
      {
        id: 'po_outstanding_start_month',
        code: 'KPI-05',
        name: 'PO OUTSTANDING AT START OF MONTH',
        desc: 'Active Purchase Orders carried forward at commencement of the monthly cycle',
        type: 'modal',
        action: 'kpi_po_start_month'
      },
      {
        id: 'po_placed_month_value',
        code: 'KPI-06',
        name: 'PO PLACED IN A MONTH AND THEIR VALUE',
        desc: 'Count and monetary value (₹ Lakh/Crore) of Purchase Orders issued in the month',
        type: 'modal',
        action: 'kpi_po_placed'
      },
      {
        id: 'po_closed_month_value',
        code: 'KPI-07',
        name: 'PO CLOSED DURING A MONTH AND ITS VALUE',
        desc: 'Count and monetary value of orders fully fulfilled, inspected and closed',
        type: 'modal',
        action: 'kpi_po_closed'
      },
      {
        id: 'po_outstanding_end_month',
        code: 'KPI-08',
        name: 'PO OUTSTANDING AT END OF MONTH',
        desc: 'Active purchase orders closing balance pending fulfillment',
        type: 'modal',
        action: 'kpi_po_end_month'
      },
      {
        id: 'tenders_floated_month',
        code: 'KPI-09',
        name: 'TENDERS FLOATED IN A MONTH',
        desc: 'Enquiries and tenders published on GeM and HAL e-Procurement portal',
        type: 'modal',
        action: 'kpi_tenders_floated'
      },
      {
        id: 'tenders_opened_month',
        code: 'KPI-10',
        name: 'TENDER OPENED IN MONTH',
        desc: 'Technical and commercial price bids opened during the monthly reporting window',
        type: 'modal',
        action: 'kpi_tenders_opened'
      },
      {
        id: 'po_placed_sc_st',
        code: 'KPI-11',
        name: 'PO PLACED ON SC/ST',
        desc: 'Public Procurement Policy mandate compliance (4% target for SC/ST entrepreneurs)',
        type: 'modal',
        action: 'kpi_sc_st'
      },
      {
        id: 'po_placed_women_entrepreneur',
        code: 'KPI-12',
        name: 'PO PLACED ON WOMEN ENTREPRENEUR',
        desc: 'Public Procurement Policy mandate compliance (3% target for Women entrepreneurs)',
        type: 'modal',
        action: 'kpi_women_ent'
      },
      {
        id: 'po_placed_msme',
        code: 'KPI-13',
        name: 'PO PLACED ON MSME SUPPLIERS',
        desc: 'Annual MSE procurement compliance tracking against the 25% statutory target',
        type: 'modal',
        action: 'kpi_msme'
      },
      {
        id: 'po_placed_gem',
        code: 'KPI-14',
        name: 'PO PLACED ON GEM',
        desc: 'Percentage and value of procurement routed through Government e-Marketplace',
        type: 'modal',
        action: 'kpi_gem'
      },
      {
        id: 'time_taken_payment_processing',
        code: 'KPI-15',
        name: 'TIME TAKEN FOR PAYMENT PROCESSING',
        desc: 'Average cycle time from RV generation in stores to CPPC payment release (target < 30 days)',
        type: 'modal',
        action: 'kpi_payment_time'
      },
      {
        id: 'time_taken_mpr_to_po',
        code: 'KPI-16',
        name: 'TIME TAKEN FOR CONVERTING MPR TO PO',
        desc: 'Procurement velocity from requisition intake to Purchase Order release (lead time)',
        type: 'modal',
        action: 'kpi_mpr_po_time'
      }
    ]
  }
];

// The 26 Standard Types of Formats used in HAL Procurement
export const STANDARD_FORMATS_26 = [
  { id: 'F01', code: 'F-PRV-01', title: 'Provisioning Note Format (Generalized)', category: 'Provisioning', annexure: 'Annex 1' },
  { id: 'F02', code: 'F-EMD-02', title: 'EMD Stage Bidder Scrutiny & Acceptance Statement', category: 'Procurement', annexure: 'Annex 2' },
  { id: 'F03', code: 'F-TEC-03', title: 'Technical Evaluation Committee (TEC) Request Note', category: 'Procurement', annexure: 'Annex 3' },
  { id: 'F04', code: 'F-TEC-04', title: 'Technical Compliance Statement & Disqualification Format', category: 'Procurement', annexure: 'Annex 4' },
  { id: 'F05', code: 'F-PBO-05', title: 'Price Bid Opening (PBO) Concurrence Note', category: 'Procurement', annexure: 'Annex 5' },
  { id: 'F06', code: 'F-CST-06', title: 'Comparative Statement of Tenders (CST / PJS)', category: 'Commercial', annexure: 'Annex 6' },
  { id: 'F07', code: 'F-PNC-07', title: 'Price Negotiation Committee (PNC) Constitution Note', category: 'Commercial', annexure: 'Annex 7' },
  { id: 'F08', code: 'F-PNC-08', title: 'PNC Recommendation & Counter-Offer Justification Note', category: 'Commercial', annexure: 'Annex 8' },
  { id: 'F09', code: 'F-PP-09', title: 'Purchase Proposal (PP) / DPC Approval Note', category: 'Commercial', annexure: 'Annex 9' },
  { id: 'F10', code: 'F-PO-10', title: 'Purchase Order Standard Template & General Conditions', category: 'Contract', annexure: 'Annex 10' },
  { id: 'F11', code: 'F-CTR-11', title: 'HAL Standard Bilateral Contract Agreement', category: 'Contract', annexure: 'Annex 11' },
  { id: 'F12', code: 'F-IB-12', title: 'Indemnity Bond Format (5% PSU Exemption / Third Party)', category: 'Statutory', annexure: 'Annex 12' },
  { id: 'F13', code: 'F-NDA-13', title: 'Mutual Non-Disclosure Agreement (Defense Projects)', category: 'Statutory', annexure: 'Annex 13' },
  { id: 'F14', code: 'F-NPC-14', title: 'Non-Poaching & Conflict of Interest Declaration', category: 'Statutory', annexure: 'Annex 14' },
  { id: 'F15', code: 'F-IP-15', title: 'Integrity Pact Agreement with Independent External Monitor', category: 'Statutory', annexure: 'Annex 15' },
  { id: 'F16', code: 'F-BP-16', title: 'Board Paper Format for High-Value Capital Procurement', category: 'Governance', annexure: 'Annex 16' },
  { id: 'F17', code: 'F-SP-17', title: 'Summary of Proposal (Financial Concurrence Sheet)', category: 'Governance', annexure: 'Annex 17' },
  { id: 'F18', code: 'F-ADV-18', title: 'Advance Payment Request & Justification Format', category: 'Finance', annexure: 'Annex 18' },
  { id: 'F19', code: 'F-PBG-19', title: 'Performance Bank Guarantee (PBG) Standard Proforma (10%)', category: 'Banking', annexure: 'Annex 19' },
  { id: 'F20', code: 'F-SDBG-20', title: 'Security Deposit Bank Guarantee Standard Proforma (5%)', category: 'Banking', annexure: 'Annex 20' },
  { id: 'F21', code: 'F-ABG-21', title: 'Advance Payment Bank Guarantee Standard Proforma (110%)', category: 'Banking', annexure: 'Annex 21' },
  { id: 'F22', code: 'F-DP-22', title: 'Delivery Period Extension with LD Applicability Format', category: 'Contract', annexure: 'Annex 22' },
  { id: 'F23', code: 'F-SC-23', title: 'Short Closure & Mutual Settlement Format', category: 'Contract', annexure: 'Annex 23' },
  { id: 'F24', code: 'F-RT-24', title: 'Retender Approval & Specification Relaxation Format', category: 'Procurement', annexure: 'Annex 24' },
  { id: 'F25', code: 'F-FTR-25', title: 'Final Test Report (FTR) & Quality Clearance Certificate', category: 'Inspection', annexure: 'Annex 25' },
  { id: 'F26', code: 'F-CLM-26', title: 'Discrepancy / Rejection Claim Initiation Form', category: 'Claims', annexure: 'Annex 26' }
];
