// Bid evaluation — the two decisions that actually eliminate suppliers.
//
// HAL's technical-bid compliance sheet is the return leg of a tender: the bidder writes
// YES or NO against every specification line and every term, states its Udyam number,
// NIC code and EMD position, and fills in a vendor block. Two stages read nothing else:
//
//   EMD stage — is the waiver claim valid? A bidder may skip the deposit only if it
//     MANUFACTURES the offered product in the relevant NIC category. The bidder's own
//     claim is not taken at face value; Nature-of-Firm and the NIC code decide.
//   TEC stage — the offers with a NO row are rejected, citing the specification sl nos
//     they failed, so the rejection can be defended.
//
// Data comes from server/approvals/seed/bids.json, exported by ai/export_web.py from
// ai/fixtures/TechnicalBid_E-33046_FILLED.xlsx. **The bidders and all prices in that
// fixture are FABRICATED** — the tender reference, item, quantity, the 12 specification
// lines and the 18 terms are quoted from sampleData/TechnicalBid E-33046.pdf, which HAL
// issues blank. Every response carries that warning so a screen can show it.
//
// Mirrors ai/bid_sheet.py. The verdicts are recomputed here rather than read from the
// fixture, so the rule is enforced by this module and not by whoever filled the sheet.

import { readFileSync } from 'fs';

const SEED_URL = new URL('./seed/bids.json', import.meta.url);

// NIC 27400 is "manufacture of electric lighting equipment"; 465xx is wholesale trade,
// which is what makes a trader's small-enterprise waiver claim fail.
const MANUFACTURING_NIC = ['27400', '2740', '274'];

let CACHE = null;

function seed() {
  if (!CACHE) CACHE = JSON.parse(readFileSync(SEED_URL, 'utf-8'));
  return CACHE;
}

export const available = () => {
  try {
    seed();
    return true;
  } catch {
    return false;
  }
};

const num = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const t = String(v).replace(/[^\d.]/g, '');
  return t ? Number(t) : null;
};

// The EMD verdict, computed. A bidder who paid is in; a bidder claiming a waiver is in
// only if it manufactures the offered product in the relevant category.
export function emdVerdict(bid) {
  const claim = String(bid.emd_claim ?? '').toLowerCase();
  const paid = claim.includes('paid') && !claim.includes('not paid');
  const seeksWaiver = claim.includes('waiver');
  const isMfr = ['manufacturer', 'oem'].some((k) => String(bid.nature ?? '').toLowerCase().includes(k));
  const nicOk = MANUFACTURING_NIC.some((p) => String(bid.nic ?? '').startsWith(p));

  if (paid) return { emd: 'Accepted', reason: 'EMD paid through SB Collect', isMfr, nicOk };
  if (seeksWaiver && isMfr && nicOk) {
    return {
      emd: 'Accepted',
      reason: `Waiver valid — manufacturer of the offered product in NIC ${bid.nic}`,
      isMfr, nicOk
    };
  }
  if (seeksWaiver) {
    const why = !isMfr
      ? 'not a manufacturer of the offered product'
      : `NIC ${bid.nic} is not the relevant category`;
    return { emd: 'Not Accepted', reason: `Waiver claim rejected — ${why}`, isMfr, nicOk };
  }
  return { emd: 'Not Accepted', reason: 'EMD neither paid nor validly waived', isMfr, nicOk };
}

// One row per bidder with both verdicts and the reason for each.
export function evaluate() {
  const s = seed();
  const rows = s.bidders.map((b) => {
    const v = emdVerdict(b);
    const specFailed = b.spec_failed ?? [];
    const price = b.price ?? {};
    return {
      id: b.id,
      name: b.name,
      nature: b.nature,
      msme: b.msme,
      udyam: b.udyam,
      nic: b.nic,
      gst: b.gst,
      email: b.email,
      address: b.address,
      mfrClass: b.mfr_class,
      emdClaim: b.emd_claim,
      emd: v.emd,
      emdReason: v.reason,
      manufacturer: v.isMfr,
      nicMatch: v.nicOk,
      specFailed,
      specRemarks: b.spec_remarks ?? [],
      termsFailed: b.terms_failed ?? [],
      unitBasic: price.unit_basic ?? null,
      basic: price.basic ?? null,
      landed: price.landed ?? null,
      // The TEC only ever sees the EMD-accepted offers.
      stage: v.emd !== 'Accepted' ? 'out_at_emd' : (specFailed.length ? 'out_at_tec' : 'in'),
      verdict: v.emd !== 'Accepted'
        ? 'REJECTED at EMD'
        : (specFailed.length ? 'REJECTED at TEC' : 'Accepted'),
      verdictReason: v.emd !== 'Accepted'
        ? v.reason
        : (specFailed.length
          ? `Specification sl no ${specFailed.join(', ')} not complied`
          : 'EMD cleared, all specifications complied')
    };
  });

  const emdAccepted = rows.filter((r) => r.emd === 'Accepted');
  const tecAccepted = emdAccepted.filter((r) => !r.specFailed.length);
  const tecRejected = emdAccepted.filter((r) => r.specFailed.length);

  const priced = tecAccepted.filter((r) => r.landed != null).sort((a, b) => a.landed - b.landed);
  const l1 = priced[0] ?? null;

  const ex = s.extras ?? {};
  const estimate = ex.estimate?.landed ?? null;
  const counter = ex.counter?.landed ?? null;
  const lpp = ex.lpp?.landed ?? null;

  const variance = (l1 && estimate)
    ? Math.round(((l1.landed - estimate) / estimate) * 10000) / 100
    : null;
  const savingAmt = (l1 && counter) ? l1.landed - counter : null;
  const savingPct = (l1 && counter)
    ? Math.round(((l1.landed - counter) / l1.landed) * 10000) / 100
    : null;
  const basicOfCounter = counter ? counter / 1.18 : null;

  const raStatus = ex.ra_status ?? '';
  // Advisory only, and the same caveat ai/rules.py carries: a single tender's RA status
  // reads "not applicable", which none of these keywords match.
  const noRa = ['none', 'nil', 'not participated', 'no vendor', 'did not']
    .some((k) => raStatus.toLowerCase().includes(k));
  const pncAdvised = Boolean((l1 && estimate && l1.landed > estimate) || noRa);

  return {
    fixture: true,
    warning: s._warning,
    tenderRef: s.tender_ref,
    source: s._source,
    rows,
    summary: {
      total: rows.length,
      emdRejected: rows.length - emdAccepted.length,
      tecRejected: tecRejected.length,
      accepted: tecAccepted.length
    },
    tec: {
      accepted: tecAccepted.map((r) => r.name),
      rejected: tecRejected.map((r) => ({ name: r.name, specSlNos: r.specFailed.join(', ') }))
    },
    price: {
      l1Vendor: l1?.name ?? null,
      l1Landed: l1?.landed ?? null,
      estimate,
      lpp,
      lppContract: ex.lpp_contract ?? null,
      counter,
      variancePct: variance,
      savingAmount: savingAmt,
      savingPct,
      raStatus,
      pncAdvised,
      pncRule: 'rules.pnc_required — L1 above estimate, or no RA participation',
      sd: basicOfCounter ? Math.round(basicOfCounter * 0.05 * 100) / 100 : null,
      pbg: basicOfCounter ? Math.round(basicOfCounter * 0.10 * 100) / 100 : null
    },
    case: s.case ?? null
  };
}

// The tender's own requirement table, so a screen can show what a bidder was judged
// against. Quoted from the client's PDF, not fabricated.
export function specSheet() {
  const s = seed();
  const first = s.bidders?.[0];
  return {
    tenderRef: s.tender_ref,
    specCount: first ? Math.max(0, ...(first.spec_failed ?? [0])) : 0,
    note: 'The 12 specification lines and 18 terms are quoted from '
      + 'sampleData/TechnicalBid E-33046.pdf; only the bidders’ answers are fabricated.'
  };
}

export default { available, evaluate, emdVerdict, specSheet };
