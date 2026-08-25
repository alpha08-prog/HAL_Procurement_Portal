-- ==============================================================================
-- HAL Nashik Procurement Portal — Unified PostgreSQL Schema
-- Covers: Auth, Org Hierarchy, Noting Workflow, File Attachments,
--         Payment Advices (RV & PA), and Contract Generation.
-- ==============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. AUTH & USERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    pb TEXT,
    department TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. ORGANISATION HIERARCHY & PERSONNEL (Module C)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS org_units (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,                         -- corporate | complex | division | department | section
    code TEXT,                                  -- e.g. dept/section code (IMM, FIN, etc.)
    parent_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    pb TEXT NOT NULL UNIQUE,                    -- HAL Personnel/Badge No (e.g. PB-40001)
    name TEXT NOT NULL,
    email TEXT,
    designation TEXT,
    grade TEXT,                                 -- Grade e.g. 2 - HR Officer, 8 - AGM
    app_role TEXT,                              -- maps to client roles.js id
    section_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
    heads_unit_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS postings (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_unit_id INTEGER NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    role_in_unit TEXT,                          -- member | head
    from_date DATE NOT NULL,
    to_date DATE                                -- NULL = current posting
);

-- ==============================================================================
-- 3. E-FILE NOTING WORKFLOW (Module C)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    file_id TEXT NOT NULL UNIQUE,               -- Connected File ID e.g. AOD/IMM/2026/0001
    title TEXT NOT NULL,
    kind TEXT NOT NULL,                         -- MPR | CAR | SPR | CPR | standalone
    car_no TEXT,                                -- NULL for standalone
    standalone BOOLEAN NOT NULL DEFAULT FALSE,
    initiator_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    initiator_unit_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
    parent_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    line_no TEXT,                               -- Line-wise L1 label on a child PP file
    status TEXT NOT NULL DEFAULT 'open',        -- open | closed
    provisioning_start DATE,
    tendering_start DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    file_pk INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,                       -- 1=N1, 2=N2 ...
    ref_no TEXT NOT NULL,                       -- Connected Reference
    txn_id TEXT NOT NULL UNIQUE,                -- Unique Transaction ID (TXN-2026-000001)
    title TEXT NOT NULL,
    stage_id TEXT,                              -- maps to ai/stages.py (provisioning, tec_req ...)
    source TEXT NOT NULL DEFAULT 'manual',       -- ai | manual
    body TEXT,
    classification TEXT NOT NULL DEFAULT 'normal', -- normal | restricted | confidential | secret | top_secret
    status TEXT NOT NULL DEFAULT 'draft',        -- draft | in_check | routed | approved | rejected | closed
    initiator_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    custodian_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    decision TEXT,                              -- approved | rejected
    decided_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS routing_steps (
    id SERIAL PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    from_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    to_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL DEFAULT 'forward',    -- forward | check | approve
    state TEXT NOT NULL DEFAULT 'sent',         -- sent | opened | actioned | sent_back | retracted
    action TEXT,                                -- forward | send_back | approve | reject | concur
    comment TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    actioned_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clarifications (
    id SERIAL PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    asked_by_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    asked_to_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open',        -- open | answered
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clarification_messages (
    id SERIAL PRIMARY KEY,
    clarification_id INTEGER NOT NULL REFERENCES clarifications(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_grants (
    id SERIAL PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    granted_by_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    granted_to_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    state TEXT NOT NULL DEFAULT 'active',        -- active | revoked
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT
);

CREATE TABLE IF NOT EXISTS access_alerts (
    id SERIAL PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    grant_id INTEGER REFERENCES access_grants(id) ON DELETE SET NULL,
    custodian_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    offender_pb TEXT,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cabinet (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    file_pk INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,                       -- initiator | router | approver
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delegations (
    id SERIAL PRIMARY KEY,
    from_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    to_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. REAL DOCUMENT & FILE ATTACHMENTS VAULT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
    contract_id INTEGER,
    rv_no TEXT,
    kind TEXT NOT NULL,                         -- doc | stamping | dop | pm | rv | ftr | invoice
    name TEXT NOT NULL,                         -- User display filename
    ref TEXT,                                   -- Reference string (e.g. for dop/pm)
    storage_path TEXT,                          -- Absolute path or object key on disk/NAS
    file_size_bytes BIGINT,                     -- Size in bytes
    mime_type TEXT,                             -- e.g. application/pdf
    sha256_hash TEXT,                           -- Integrity verification hash
    security_class TEXT DEFAULT 'normal',       -- normal | confidential | secret | top_secret
    uploaded_by_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. PAYMENT ADVICES & RECEIPT VOUCHERS (Module A)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,                        -- e.g. V001
    name TEXT NOT NULL,
    city TEXT,
    gstin TEXT,
    mse_category TEXT,                          -- MSE | Non-MSE
    mse_women TEXT,                             -- Yes | No | NA
    mse_sc_st TEXT,                             -- SC-ST | NA
    code TEXT,
    address TEXT,
    bank JSONB,                                 -- { name, accountNo, ifsc }
    contact TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rvs (
    rv_no TEXT PRIMARY KEY,                     -- e.g. COM/26/148
    ref_no TEXT,
    rv_date DATE NOT NULL,
    gate_entry_no TEXT,
    gate_entry_date DATE,
    qc_date DATE,
    ftr_date DATE,
    po_no TEXT NOT NULL,
    po_date DATE NOT NULL,
    po_value NUMERIC(14,2) NOT NULL,
    delivery_due_date DATE,
    vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    description TEXT,
    rv_value NUMERIC(14,2) NOT NULL,
    pa_status TEXT NOT NULL DEFAULT 'rv_pending',
    po_officer TEXT,
    waybill_no TEXT,
    waybill_date DATE,
    gem_contract_no TEXT,
    gem_contract_date DATE,
    charge_approval_date DATE,
    receipt_date DATE,
    mpr_no TEXT,
    mpr_date DATE,
    invoice_no TEXT,
    invoice_date DATE,
    invoice_value NUMERIC(14,2),
    credit_note_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
    credit_note_no TEXT,
    credit_note_uploaded_date DATE,
    credit_note_file_name TEXT,
    credit_note_remarks TEXT,
    credit_note_waived BOOLEAN NOT NULL DEFAULT FALSE,
    credit_note_waiver_reason TEXT,
    credit_note_decision_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_advices (
    pa_no TEXT PRIMARY KEY,                     -- e.g. PA/26/063
    rv_no TEXT NOT NULL REFERENCES rvs(rv_no) ON DELETE RESTRICT,
    po_no TEXT NOT NULL,
    vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pa_created',  -- rv_pending | pa_created | forwarded_to_officer | at_payment_desk | sent_to_hod | stamped_by_hod | sent_to_cppc | paid
    created_date DATE NOT NULL,
    created_by TEXT,
    created_by_name TEXT,
    created_by_pb TEXT,
    officer TEXT,
    rv_value NUMERIC(14,2) NOT NULL,
    ld_weeks NUMERIC(6,2) NOT NULL DEFAULT 0,
    ld_supply_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ld_ic_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    ld_cap NUMERIC(14,2) NOT NULL DEFAULT 0,
    ld_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    final_payment NUMERIC(14,2) NOT NULL,
    ld_by_gate_entry TEXT NOT NULL DEFAULT 'No',
    ld_by_ftr TEXT NOT NULL DEFAULT 'No',
    invoice_no TEXT,
    invoice_date DATE,
    maker_remark TEXT,
    ppr_no TEXT,
    ppr_date DATE,
    invoice_value NUMERIC(14,2),
    checking_officer_pb_no TEXT,
    ld_applicable TEXT NOT NULL DEFAULT 'No',
    bank_mismatch BOOLEAN NOT NULL DEFAULT FALSE,
    securities JSONB,                           -- { sd, pbg, emd, indemnity, warranty, customHold }
    attachments_checklist JSONB,                -- { originalInvoice, testCertificate, guaranteeCertificate, warrantyCertificate, ... }
    checklist JSONB,                            -- 23-point compliance items array
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. CONTRACT GENERATION MODULE (Module D)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS contract_types (
    id TEXT PRIMARY KEY,                        -- ind_mfg | ind_buy | import_mfg | import_buy | rate_contract | job_work | repair_overhaul | amc_services
    label TEXT NOT NULL,
    sort INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clauses (
    id SERIAL PRIMARY KEY,
    matrix_no INTEGER,                          -- Clause No in matrix (NULL = Option Clause)
    docx_no INTEGER NOT NULL,                   -- Source document number
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    boilerplate BOOLEAN NOT NULL DEFAULT FALSE,
    guideline TEXT,
    optional_extra BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clause_versions (
    id SERIAL PRIMARY KEY,
    clause_id INTEGER NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    prior_body TEXT NOT NULL,
    changed_by_name TEXT,
    changed_by_pb TEXT,
    changed_at TIMESTAMPTZ NOT NULL,
    change_note TEXT NOT NULL,
    reference_doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clause_matrix (
    clause_id INTEGER NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
    contract_type_id TEXT NOT NULL REFERENCES contract_types(id) ON DELETE CASCADE,
    value TEXT NOT NULL,                        -- Y | N | TBD | conditional text
    PRIMARY KEY (clause_id, contract_type_id)
);

CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    contract_no TEXT NOT NULL UNIQUE,           -- HAL/AOD/CTR/<FY>/<po-serial>/<NN>
    po_no TEXT NOT NULL,
    po_date DATE,
    tender_no TEXT NOT NULL,
    contract_type_id TEXT NOT NULL REFERENCES contract_types(id),
    description TEXT,
    classification TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'draft',       -- draft | finalised
    currency TEXT NOT NULL DEFAULT 'INR',
    basic_value NUMERIC(14,2),
    tax_total NUMERIC(14,2),
    landed_value NUMERIC(14,2),
    hal_division TEXT,
    hal_address TEXT,
    vendor_id TEXT,
    vendor_name TEXT,
    vendor_gstin TEXT,
    vendor_address TEXT,
    vendor_contact TEXT,
    car_no TEXT,
    cfa_dop_ref TEXT,
    mode_of_tendering TEXT,
    scope_of_work TEXT,
    tech_specs TEXT,
    period_from DATE,
    period_to DATE,
    validity TEXT,
    generated_by_name TEXT,
    generated_by_pb TEXT,
    generated_by_desig TEXT,
    generated_by_dept TEXT,
    generated_by_division TEXT,
    finalised_at TIMESTAMPTZ,
    finalised_by_name TEXT,
    finalised_by_pb TEXT,
    finalised_by_desig TEXT,
    content_hash TEXT,
    qr_payload TEXT,
    smart_contract BOOLEAN NOT NULL DEFAULT FALSE,
    encrypted_payload TEXT,
    encryption_iv TEXT,
    encryption_tag TEXT,
    encryption_alg TEXT,
    smart_contract_sim TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_clauses (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    clause_id INTEGER REFERENCES clauses(id) ON DELETE SET NULL,
    clause_no INTEGER,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    clause_version INTEGER,
    source TEXT NOT NULL,                       -- auto | extra | custom
    matrix_value TEXT
);

CREATE TABLE IF NOT EXISTS contract_items (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    part_no TEXT,
    description TEXT,
    hsn TEXT,
    qty NUMERIC(12,2),
    uom TEXT,
    unit_price NUMERIC(14,2),
    gst_type TEXT,                              -- IGST | CGST+SGST
    gst_pct NUMERIC(6,2),
    tax_amount NUMERIC(14,2),
    line_total NUMERIC(14,2)
);

CREATE TABLE IF NOT EXISTS contract_formats (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    format_id TEXT NOT NULL,
    label TEXT NOT NULL
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_notes_file_pk ON notes(file_pk);
CREATE INDEX IF NOT EXISTS idx_notes_txn_id ON notes(txn_id);
CREATE INDEX IF NOT EXISTS idx_routing_steps_note_id ON routing_steps(note_id);
CREATE INDEX IF NOT EXISTS idx_routing_steps_to_member ON routing_steps(to_member_id);
CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_payment_advices_rv_no ON payment_advices(rv_no);
CREATE INDEX IF NOT EXISTS idx_contracts_po_no ON contracts(po_no);
