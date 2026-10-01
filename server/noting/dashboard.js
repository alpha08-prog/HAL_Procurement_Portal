// The Noting Home dashboard and the Upcoming list, computed from routing_steps and files.
// Nothing here is a literal: the personal charts count the steps sent to the member and
// the ones they actioned, the application-wide cards count files by created/closed date,
// and "upcoming" reads each note's planned routing to see whether the member is still due.
import { all, nowISO } from './db.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthKey = (d) => String(d).slice(0, 7);
const label = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

function lastMonths(n, today) {
  const [y, m] = today.slice(0, 7).split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    let mm = m - i;
    let yy = y;
    while (mm <= 0) { mm += 12; yy -= 1; }
    out.push(`${yy}-${String(mm).padStart(2, '0')}`);
  }
  return out;
}

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const shift = (today, days) => {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export function dashboardFor(me, today = nowISO()) {
  const months = lastMonths(6, today);
  const steps = me
    ? all(`SELECT sent_at, actioned_at FROM routing_steps WHERE to_member_id = ? AND sent_at IS NOT NULL`, me.id)
    : [];
  const workload = months.map((k) => ({
    month: label(k),
    received: steps.filter((s) => monthKey(s.sent_at) === k).length,
    cleared: steps.filter((s) => s.actioned_at && monthKey(s.actioned_at) === k).length
  }));
  const clearanceRate = months.map((k) => {
    const done = steps.filter((s) => s.actioned_at && monthKey(s.actioned_at) === k);
    const avg = done.length ? done.reduce((n, s) => n + daysBetween(s.sent_at, s.actioned_at), 0) / done.length : 0;
    return { month: label(k), days: Math.round(avg * 10) / 10 };
  });
  const files = all('SELECT created_at, closed_at FROM files');
  const trend = months.map((k) => ({
    month: label(k),
    files: files.filter((f) => f.created_at && monthKey(f.created_at) <= k).length
  }));
  const d30 = shift(today, 30);
  const d7 = shift(today, 7);
  return {
    asOf: today,
    totalFiles: files.length,
    last30Opened: files.filter((f) => f.created_at >= d30).length,
    last30Closed: files.filter((f) => f.closed_at && f.closed_at >= d30).length,
    last7Opened: files.filter((f) => f.created_at >= d7).length,
    last7Closed: files.filter((f) => f.closed_at && f.closed_at >= d7).length,
    workload,
    clearanceRate,
    trend,
    source: 'noting.db — routing steps sent to / actioned by you; files by created and closed date'
  };
}

export const parsePlan = (json) => {
  try {
    return (JSON.parse(json || '[]') || [])
      .map((x) => Number(x && typeof x === 'object' ? x.id : x))
      .filter(Boolean);
  } catch {
    return [];
  }
};

// Open notes whose planned routing still has `me` ahead of the current holder.
export function upcomingFor(me) {
  if (!me) return [];
  const rows = all(
    `SELECT n.id, n.txn_id, n.ref_no, n.title, n.status, n.created_at, n.custodian_id, n.planned_routing,
            COALESCE(n.priority, 'Medium') AS priority, f.file_id, m.name AS custodian_name
     FROM notes n
     JOIN files f ON f.id = n.file_pk
     LEFT JOIN members m ON m.id = n.custodian_id
     WHERE f.status = 'open' AND n.status IN ('draft','in_check','routed')
       AND n.custodian_id != ? AND n.planned_routing IS NOT NULL
     ORDER BY n.created_at DESC`,
    me.id
  );
  const out = [];
  for (const r of rows) {
    const plan = parsePlan(r.planned_routing);
    const mine = plan.indexOf(me.id);
    if (mine < 0) continue;
    const cur = plan.indexOf(r.custodian_id);
    if (cur >= mine) continue;
    const { planned_routing, ...rest } = r;
    out.push({
      ...rest,
      current_step: cur + 1,
      current_step_label: cur < 0 ? 'Initiator' : `Step #${cur + 1}`,
      your_step: mine + 1,
      total_steps: plan.length
    });
  }
  return out;
}
