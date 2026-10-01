// Delegation of authority — the `delegations` table made real. A member who holds an
// active delegation from another member acts for them: routes what they hold, decides
// what they are the approving authority for. Every such hop is stamped on_behalf_of_id.
import { all, get, nowISO, run } from './db.js';

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Delegations that make `meId` act for somebody else today.
export function activeDelegationsTo(meId, today = nowISO()) {
  return all(
    `SELECT d.*, m.name AS from_name, m.designation AS from_designation
     FROM delegations d JOIN members m ON m.id = d.from_id
     WHERE d.to_id = ? AND d.cancelled_at IS NULL AND d.from_date <= ? AND d.to_date >= ?
     ORDER BY d.id DESC`,
    meId, today, today
  );
}

export const activeDelegatorsOf = (meId) => new Set(activeDelegationsTo(meId).map((d) => d.from_id));

// May `me` act as `memberId`? Themselves, or an active delegation from that member.
export const actsFor = (me, memberId) =>
  Boolean(me) && (me.id === memberId || activeDelegatorsOf(me.id).has(memberId));

export function listDelegations(me) {
  const today = nowISO();
  const decorate = (d) => ({
    ...d,
    active: !d.cancelled_at && d.from_date <= today && d.to_date >= today
  });
  return {
    given: all(
      `SELECT d.*, m.name AS to_name, m.designation AS to_designation
       FROM delegations d JOIN members m ON m.id = d.to_id WHERE d.from_id = ? ORDER BY d.id DESC`,
      me.id
    ).map(decorate),
    received: all(
      `SELECT d.*, m.name AS from_name, m.designation AS from_designation
       FROM delegations d JOIN members m ON m.id = d.from_id WHERE d.to_id = ? ORDER BY d.id DESC`,
      me.id
    ).map(decorate)
  };
}

export function createDelegation(me, { toMemberId, fromDate, toDate, reason } = {}) {
  const toId = Number(toMemberId);
  if (!toId || toId === me.id) fail(422, 'Choose a different member to delegate to');
  if (!get('SELECT id FROM members WHERE id = ?', toId)) fail(422, 'Unknown member');
  if (!ISO_DATE.test(fromDate || '') || !ISO_DATE.test(toDate || '')) fail(422, 'fromDate and toDate must be YYYY-MM-DD');
  if (fromDate > toDate) fail(422, 'fromDate must not be after toDate');
  const overlap = get(
    `SELECT id FROM delegations WHERE from_id = ? AND cancelled_at IS NULL AND from_date <= ? AND to_date >= ?`,
    me.id, toDate, fromDate
  );
  if (overlap) fail(409, 'You already have an active delegation covering these dates — cancel it first');
  const r = run(
    `INSERT INTO delegations(from_id,to_id,from_date,to_date,reason,created_at) VALUES(?,?,?,?,?,?)`,
    me.id, toId, fromDate, toDate, (reason || '').trim() || null, nowISO()
  );
  return get('SELECT * FROM delegations WHERE id = ?', Number(r.lastInsertRowid));
}

export function cancelDelegation(me, id) {
  const d = get('SELECT * FROM delegations WHERE id = ?', Number(id));
  if (!d) fail(404, 'No such delegation');
  if (d.from_id !== me.id) fail(403, 'Only the delegating member can cancel it');
  if (d.cancelled_at) fail(409, 'This delegation is already cancelled');
  run(`UPDATE delegations SET cancelled_at = ? WHERE id = ?`, nowISO(), d.id);
  return get('SELECT * FROM delegations WHERE id = ?', d.id);
}
