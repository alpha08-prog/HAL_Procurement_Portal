import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import notingRouter from '../server/routes/noting/index.js';
import { signToken } from '../server/auth/jwt.js';
import { get, all } from '../server/noting/db.js';

const app = express();
app.use(express.json());

let currentUser = { id: 'U001', name: 'Indent Cell', role: 'indentor' };

// Mock auth middleware for testing
app.use((req, res, next) => {
  req.user = currentUser;
  next();
});

app.use('/api/noting', notingRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const baseUrl = `http://localhost:${port}/api/noting`;

console.log('Running AI Integration Tests...');

try {
  // Test 1: Create an E-File with AI
  const createRes = await fetch(`${baseUrl}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Procurement of Night Vision Binoculars for HAL Nashik Division',
      kind: 'CAR',
      carNo: 'CAR/25/229',
      source: 'ai',
      sourceCase: 'nvb',
      classification: 'normal',
      priority: 'Medium'
    })
  });

  assert.equal(createRes.status, 201, `Failed to create file: status ${createRes.status}`);
  const created = await createRes.json();
  assert.ok(created.filePk, 'Missing filePk');
  assert.ok(created.note?.txn_id, 'Missing note txn_id');
  assert.ok(created.aiCaseId, 'Missing aiCaseId');
  console.log('✓ Test 1 Passed: E-File initiated with AI Case ID:', created.aiCaseId, 'txn_id:', created.note.txn_id);

  const txnId = created.note.txn_id;

  // Test 2: Fetch Note Detail and AI Cascade state
  const noteRes = await fetch(`${baseUrl}/notes/${txnId}`);
  assert.equal(noteRes.status, 200);
  const noteData = await noteRes.json();
  assert.ok(noteData.allNotes.length >= 1, 'Expected allNotes array');
  console.log('✓ Test 2 Passed: Note details retrieved with allNotes count:', noteData.allNotes.length);

  const cascadeRes = await fetch(`${baseUrl}/notes/${txnId}/ai-cascade`);
  assert.equal(cascadeRes.status, 200);
  const cascadeData = await cascadeRes.json();
  assert.equal(cascadeData.case.nodeId, 'tender_opened', `Expected node tender_opened, got ${cascadeData.case.nodeId}`);
  assert.ok(cascadeData.case.options.length > 0, 'Expected options at tender_opened');
  console.log('✓ Test 3 Passed: AI Cascade state verified at node:', cascadeData.case.nodeId, 'options count:', cascadeData.case.options.length);

  // Test 3: Fetch AI Form for next note (EMD)
  const formRes = await fetch(`${baseUrl}/notes/${txnId}/ai-form/emd`);
  assert.equal(formRes.status, 200);
  const formData = await formRes.json();
  assert.equal(formData.noteId, 'emd');
  assert.ok(formData.fields.length > 0, 'Expected pre-filled fields for EMD note');
  console.log('✓ Test 4 Passed: AI Form pre-fill retrieved for EMD note with fields:', formData.fields.map(f => f.key).join(', '));

  // Test 4: Handover file as Tendering position (U002 Purchase Maker / Tendering Agency)
  currentUser = { id: 'U002', name: 'Yogesh M. (Purchase Maker)', role: 'purchase_maker' };

  const handoverRes = await fetch(`${baseUrl}/notes/${txnId}/ai-handover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toAgency: 'Tendering' })
  });
  assert.equal(handoverRes.status, 200, 'Handover to Tendering agency should succeed');
  const handoverData = await handoverRes.json();
  assert.equal(handoverData.case.holdingAgency, 'Tendering');
  console.log('✓ Test 5 Passed: Custody transferred to Tendering Agency');

  // Test 5: Raise EMD Note (N2) with AI
  const raiseRes = await fetch(`${baseUrl}/notes/${txnId}/ai-raise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      noteId: 'emd',
      fields: {
        total_bids: '4',
        emd_accepted_detail: 'Vendor A, Vendor B, Vendor C',
        emd_rejected_detail: 'Vendor D (EMD BG defective)'
      }
    })
  });
  assert.equal(raiseRes.status, 200, 'Raising EMD note should succeed');
  const raiseData = await raiseRes.json();
  assert.ok(raiseData.txnId, 'Expected new txnId for EMD note');
  assert.equal(raiseData.note.seq, 2, 'Expected note sequence 2 for N2');
  console.log('✓ Test 6 Passed: Note N2 (EMD Stage Acceptance) successfully raised with txn_id:', raiseData.txnId);

  // Test 6: Verify file now has 2 notes in allNotes
  const note2Res = await fetch(`${baseUrl}/notes/${raiseData.txnId}`);
  const note2Data = await note2Res.json();
  assert.equal(note2Data.allNotes.length, 2, 'Expected 2 notes in allNotes tab list');
  console.log('✓ Test 7 Passed: Multi-note list on file now contains:', note2Data.allNotes.map(n => `N${n.seq} (${n.title})`).join(', '));

  console.log('\nAll 7 integration assertions successfully passed!');
} finally {
  server.close();
}
