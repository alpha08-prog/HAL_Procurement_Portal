import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { pool, query, run, withTransaction } from '../db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const mockDir = path.join(here, '..', 'mock');
const contractsSeedDir = path.join(here, '..', 'contracts', 'seed');

const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

export async function runMigration() {
  console.log('🚀 Starting PostgreSQL migration for HAL Procurement Portal...');

  // 1. Run Schema DDL
  const schemaSql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  console.log('📄 Executing database/schema.sql...');
  await query(schemaSql);
  console.log('✅ Schema created successfully.');

  // 2. Seed Users
  console.log('👥 Seeding Users...');
  const users = loadJson(path.join(mockDir, 'users.json'));
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, pb, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         pb = EXCLUDED.pb,
         department = EXCLUDED.department`,
      [u.id, u.name, u.email.toLowerCase(), hash, u.role, u.pb, u.department]
    );
  }
  console.log(`✅ Seeded ${users.length} users.`);

  // 3. Seed Vendors
  console.log('🏢 Seeding Vendors...');
  const vendors = loadJson(path.join(mockDir, 'vendors.json'));
  for (const v of vendors) {
    await query(
      `INSERT INTO vendors (id, name, city, gstin, mse_category, mse_women, mse_sc_st, code, address, bank, contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         city = EXCLUDED.city,
         gstin = EXCLUDED.gstin,
         mse_category = EXCLUDED.mse_category,
         mse_women = EXCLUDED.mse_women,
         mse_sc_st = EXCLUDED.mse_sc_st,
         code = EXCLUDED.code,
         address = EXCLUDED.address,
         bank = EXCLUDED.bank,
         contact = EXCLUDED.contact`,
      [
        v.id,
        v.name,
        v.city,
        v.gstin,
        v.mseCategory,
        v.mseWomen,
        v.mseScSt,
        v.code,
        v.address,
        JSON.stringify(v.bank || {}),
        v.contact
      ]
    );
  }
  console.log(`✅ Seeded ${vendors.length} vendors.`);

  // 4. Seed RVs
  console.log('📦 Seeding Receipt Vouchers (RVs)...');
  const rvs = loadJson(path.join(mockDir, 'rvs.json'));
  for (const r of rvs) {
    await query(
      `INSERT INTO rvs (
         rv_no, ref_no, rv_date, gate_entry_no, gate_entry_date, qc_date, ftr_date,
         po_no, po_date, po_value, delivery_due_date, vendor_id, description, rv_value,
         pa_status, po_officer, waybill_no, waybill_date, gem_contract_no, gem_contract_date,
         charge_approval_date, receipt_date, mpr_no, mpr_date, invoice_no, invoice_date,
         invoice_value, credit_note_uploaded, credit_note_no, credit_note_uploaded_date,
         credit_note_file_name, credit_note_remarks, credit_note_waived, credit_note_waiver_reason,
         credit_note_decision_date
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
       ON CONFLICT (rv_no) DO UPDATE SET
         pa_status = EXCLUDED.pa_status,
         credit_note_uploaded = EXCLUDED.credit_note_uploaded,
         credit_note_no = EXCLUDED.credit_note_no,
         credit_note_uploaded_date = EXCLUDED.credit_note_uploaded_date,
         credit_note_file_name = EXCLUDED.credit_note_file_name,
         credit_note_remarks = EXCLUDED.credit_note_remarks,
         credit_note_waived = EXCLUDED.credit_note_waived,
         credit_note_waiver_reason = EXCLUDED.credit_note_waiver_reason,
         credit_note_decision_date = EXCLUDED.credit_note_decision_date`,
      [
        r.rvNo,
        r.refNo || `REF/${r.rvNo.replace(/\//g, '-')}`,
        r.rvDate,
        r.gateEntryNo || null,
        r.gateEntryDate || null,
        r.qcDate || null,
        r.ftrDate || null,
        r.poNo,
        r.poDate,
        r.poValue,
        r.deliveryDueDate || null,
        r.vendorId,
        r.description || '',
        r.rvValue,
        r.paStatus || 'rv_pending',
        r.poOfficer || null,
        r.waybillNo || null,
        r.waybillDate || null,
        r.gemContractNo || null,
        r.gemContractDate || null,
        r.chargeApprovalDate || null,
        r.receiptDate || null,
        r.mprNo || null,
        r.mprDate || null,
        r.invoiceNo || null,
        r.invoiceDate || null,
        r.invoiceValue || null,
        Boolean(r.creditNoteUploaded),
        r.creditNoteNo || null,
        r.creditNoteUploadedDate || null,
        r.creditNoteFileName || null,
        r.creditNoteRemarks || null,
        Boolean(r.creditNoteWaived),
        r.creditNoteWaiverReason || null,
        r.creditNoteDecisionDate || null
      ]
    );
  }
  console.log(`✅ Seeded ${rvs.length} Receipt Vouchers.`);

  // 5. Seed Payment Advices
  console.log('💳 Seeding Payment Advices...');
  const paymentAdvices = loadJson(path.join(mockDir, 'paymentAdvices.json'));
  for (const pa of paymentAdvices) {
    await query(
      `INSERT INTO payment_advices (
         pa_no, rv_no, po_no, vendor_id, status, created_date, created_by, created_by_name,
         created_by_pb, officer, rv_value, ld_weeks, ld_supply_amount, ld_ic_amount, ld_cap,
         ld_amount, final_payment, ld_by_gate_entry, ld_by_ftr, invoice_no, invoice_date,
         maker_remark, ppr_no, ppr_date, invoice_value, checking_officer_pb_no, ld_applicable,
         bank_mismatch, securities, attachments_checklist, checklist, history
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
       ON CONFLICT (pa_no) DO UPDATE SET
         status = EXCLUDED.status,
         final_payment = EXCLUDED.final_payment,
         ld_amount = EXCLUDED.ld_amount,
         maker_remark = EXCLUDED.maker_remark,
         ppr_no = EXCLUDED.ppr_no,
         ppr_date = EXCLUDED.ppr_date,
         history = EXCLUDED.history,
         securities = EXCLUDED.securities,
         attachments_checklist = EXCLUDED.attachments_checklist,
         checklist = EXCLUDED.checklist,
         updated_at = NOW()`,
      [
        pa.paNo,
        pa.rvNo,
        pa.poNo,
        pa.vendorId,
        pa.status,
        pa.createdDate,
        pa.createdBy || null,
        pa.createdByName || null,
        pa.createdByPb || null,
        pa.officer || null,
        pa.rvValue,
        pa.ldWeeks || 0,
        pa.ldSupplyAmount || 0,
        pa.ldIcAmount || 0,
        pa.ldCap || 0,
        pa.ldAmount || 0,
        pa.finalPayment,
        pa.ldByGateEntry || 'No',
        pa.ldByFtr || 'No',
        pa.invoiceNo || null,
        pa.invoiceDate || null,
        pa.makerRemark || '',
        pa.pprNo || null,
        pa.pprDate || null,
        pa.invoiceValue || null,
        pa.checkingOfficerPbNo || null,
        pa.ldApplicable || 'No',
        Boolean(pa.bankMismatch),
        JSON.stringify(pa.securities || {}),
        JSON.stringify(pa.attachmentsChecklist || {}),
        JSON.stringify(pa.checklist || []),
        JSON.stringify(pa.history || [])
      ]
    );
  }
  console.log(`✅ Seeded ${paymentAdvices.length} Payment Advices.`);

  // 6. Seed Noting Module (Org, Members, Seed Files & Notes)
  console.log('🗂️ Seeding Noting Module Org & Employees...');
  const notingSeedFile = path.join(here, '..', 'noting', 'seed.js');
  if (fs.existsSync(notingSeedFile)) {
    const notingSeed = await import('../noting/seed.js');
    if (typeof notingSeed.seedIfEmpty === 'function') {
      await notingSeed.seedIfEmpty();
    }
  }

  // 7. Seed Contracts Module (Clauses, Matrix, Contracts)
  console.log('📜 Seeding Contract Generation Clauses & Matrix...');
  const matrix = loadJson(path.join(contractsSeedDir, 'matrix.json'));
  const clauses = loadJson(path.join(contractsSeedDir, 'clauses.json'));

  for (const t of matrix.contractTypes) {
    await query(
      `INSERT INTO contract_types (id, label, sort) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, sort = EXCLUDED.sort`,
      [t.id, t.label, t.sort]
    );
  }

  for (const c of clauses) {
    await query(
      `INSERT INTO clauses (id, matrix_no, docx_no, title, body, boilerplate, guideline, optional_extra)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         matrix_no = EXCLUDED.matrix_no,
         docx_no = EXCLUDED.docx_no,
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         boilerplate = EXCLUDED.boilerplate,
         guideline = EXCLUDED.guideline,
         optional_extra = EXCLUDED.optional_extra`,
      [
        c.docxNo,
        c.matrixNo || null,
        c.docxNo,
        c.title,
        c.body,
        Boolean(c.boilerplate),
        c.guideline || null,
        Boolean(c.optionalExtra)
      ]
    );
  }

  for (const [matrixNo, cells] of Object.entries(matrix.cells)) {
    const clauseRes = await query('SELECT id FROM clauses WHERE matrix_no = $1', [Number(matrixNo)]);
    if (clauseRes.rows.length > 0) {
      const clauseId = clauseRes.rows[0].id;
      for (const [typeId, value] of Object.entries(cells)) {
        await query(
          `INSERT INTO clause_matrix (clause_id, contract_type_id, value)
           VALUES ($1, $2, $3)
           ON CONFLICT (clause_id, contract_type_id) DO UPDATE SET value = EXCLUDED.value`,
          [clauseId, typeId, value]
        );
      }
    }
  }

  console.log(`✅ Seeded ${matrix.contractTypes.length} contract types and ${clauses.length} clauses.`);
  console.log('🎉 PostgreSQL database setup and migration complete!');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => {
      console.log('Migration finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
