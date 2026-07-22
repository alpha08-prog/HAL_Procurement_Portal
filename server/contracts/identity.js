// Generator/signer identity for the contract register: name, PB, designation, dept,
// division. Resolved from the signed-in user via the NOTING member/org directory —
// read-only, one-directional coupling (same spirit as the web → ai/outputs bridge).
// Falls back to the bare JWT user when no noting member is mapped, so contracts still
// work for accounts outside the seeded org tree. Always stamped server-side.
import { findById } from '../auth/users.js';
import { currentMember } from '../noting/identity.js';
import { get as notingGet } from '../noting/db.js';

export function contractActor(req) {
  const member = currentMember(req);
  if (member) {
    let dept = null;
    let division = null;
    let unit = member.section_id && notingGet('SELECT * FROM org_units WHERE id = ?', member.section_id);
    while (unit) {
      if (unit.kind === 'department' && !dept) dept = unit.name;
      if (unit.kind === 'division' && !division) division = unit.name;
      unit = unit.parent_id && notingGet('SELECT * FROM org_units WHERE id = ?', unit.parent_id);
    }
    return { name: member.name, pb: member.pb, designation: member.designation, dept, division };
  }
  const authUser = req.user && findById(req.user.id);
  if (!authUser) return null;
  return { name: authUser.name, pb: authUser.pb || null, designation: null, dept: authUser.department || null, division: 'Aircraft Overhaul Division' };
}
