import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mockDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mock');
const load = (name) => JSON.parse(readFileSync(path.join(mockDir, name), 'utf8'));

// In-memory working copies of the JSON fixtures. Mutations (generate PA, forward,
// remarks) live here until the server restarts; restarting resets the demo.
export const db = {
  rvs: load('rvs.json'),
  vendors: load('vendors.json'),
  paymentAdvices: load('paymentAdvices.json')
};

export const vendorById = (id) => db.vendors.find((v) => v.id === id) ?? {};
export const rvByNo = (rvNo) => db.rvs.find((r) => r.rvNo === rvNo);
export const paByNo = (paNo) => db.paymentAdvices.find((p) => p.paNo === paNo);

export const todayISO = () => new Date().toISOString().slice(0, 10);

const DAY_MS = 24 * 60 * 60 * 1000;
export const daysBetween = (fromISO, toISO) =>
  Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / DAY_MS);
export const daysSince = (iso) => Math.max(0, daysBetween(iso, todayISO()));
