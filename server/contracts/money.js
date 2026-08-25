// All contract money is computed HERE, server-side, from the PO's raw item lines —
// the client never sends or derives an amount (same doctrine as server/ld.js).
//
// Per line:   basic     = qty × unitPrice
//             taxAmount = round2(basic × gstPct/100)
//             lineTotal = round2(basic) + taxAmount
// For gstType 'CGST+SGST' the tax is levied as two equal halves (intra-state supply);
// taxAmount stores the COMBINED tax — the half-split is presentation only, derived in
// the document view. 'IGST' is the whole tax as one levy (inter-state).
// Totals:     basicValue = Σ basic, taxTotal = Σ taxAmount, landedValue = Σ lineTotal —
// summed from the rounded per-line figures (invoice-style), then rounded once more to
// absorb float dust. Rounding is half-up to 2 decimals.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeItems(items) {
  const lines = items.map((it, i) => {
    const basic = round2(Number(it.qty) * Number(it.unitPrice));
    const taxAmount = round2(basic * Number(it.gstPct) / 100);
    return {
      lineNo: i + 1,
      basic,
      partNo: it.partNo,
      description: it.description,
      hsn: it.hsn,
      qty: Number(it.qty),
      uom: it.uom,
      unitPrice: Number(it.unitPrice),
      gstType: it.gstType,
      gstPct: Number(it.gstPct),
      taxAmount,
      lineTotal: round2(basic + taxAmount)
    };
  });
  const basicValue = round2(lines.reduce((s, l) => s + l.basic, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
  const landedValue = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  return { lines, totals: { basicValue, taxTotal, landedValue } };
}
