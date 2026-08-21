// Which agency a signed-in position belongs to.
//
// The responsibility-cascading sheet recognises exactly two actors — the Indenting Agency
// and the Tendering Agency — and decides per stage which of them may raise a note. But the
// sheet never maps HAL job titles onto those two actors, and neither does anything else in
// sampleData. So this mapping is an ASSUMPTION, stated here in one place rather than
// scattered through the routes, and easy for the client to correct:
//
//   Indenting  the user department that raises the requirement
//   Tendering  IMM — the purchase chain that floats and concludes the tender
//
// Evidence it is a reasonable reading: the real approved Provisioning Note in sampleData
// is raised by SECURITY (a user department) and only reaches IMM afterwards; and the
// sheet's block 1 puts the indent, specs and scope on Indenting while commercial
// conditions and the IFS enquiry number sit with Tendering.

export const INDENTING = 'Indenting';
export const TENDERING = 'Tendering';

// role -> the agencies that role may act as. An empty list means read-only.
export const ROLE_AGENCIES = {
  indentor: [INDENTING],
  purchase_maker: [TENDERING],
  purchase_officer: [TENDERING],
  hod_imm: [TENDERING],
  // Admin stands in for either desk, the same way the top-bar role switcher does.
  admin: [INDENTING, TENDERING],
  // Downstream positions: they can read a case but never raise a procurement note.
  stores_inspection: [],
  payment_desk: []
};

export const ROLE_LABEL = {
  indentor: 'Indentor (user department)',
  purchase_maker: 'Purchase Maker (IMM)',
  purchase_officer: 'Purchase Officer (IMM)',
  hod_imm: 'HOD — IMM',
  admin: 'Administrator',
  stores_inspection: 'Stores & Inspection',
  payment_desk: 'Payment Desk'
};

export const agenciesFor = (role) => ROLE_AGENCIES[role] ?? [];

export const canActAs = (role, agency) => agenciesFor(role).includes(agency);

export const isReadOnly = (role) => agenciesFor(role).length === 0;

const other = (a) => (a === INDENTING ? TENDERING : INDENTING);

// What this position may do with this case right now, and why.
//
// `nodeOwner` is the agency the sheet assigns to the stage the file is sitting at. It
// matters separately from custody: a file can be held by Indenting while the next stage
// belongs to Tendering, and in that state nobody may raise a note until it moves. Passing
// it in lets the screen avoid offering an action the server would refuse.
export function permissions(user, kase, nodeOwner = null) {
  const role = user?.role ?? null;
  const mine = agenciesFor(role);
  const holding = kase?.holdingAgency ?? null;
  const closed = kase?.status === 'closed';

  // The stage has moved past the desk holding the file — it must cross before anyone acts.
  const stageElsewhere = Boolean(nodeOwner && holding && nodeOwner !== holding);

  const holdsIt = Boolean(holding && mine.includes(holding));
  const canAct = Boolean(!closed && holdsIt && !stageElsewhere);

  // Who may pull the file across: anyone who can act for an agency OTHER than the one
  // holding it. For a single-agency position that means the other side pulls it, which is
  // what the sheet's row 23 forces. An account covering both agencies (admin) can always
  // move it — otherwise it would be stuck at every boundary.
  const canHandOver = Boolean(!closed && holding && mine.includes(other(holding)));

  let reason;
  if (closed) reason = 'The file is closed — no further action on this requisition.';
  else if (!mine.length) {
    reason = `${ROLE_LABEL[role] ?? role} is a downstream position and does not raise procurement notes.`;
  } else if (stageElsewhere && holdsIt) {
    reason = `The file is with the ${holding} Agency, but this stage belongs to `
      + `${nodeOwner}. It has to cross before the next note can be raised.`;
  } else if (canAct) reason = `The file is with the ${holding} Agency, which is you.`;
  else reason = `The file is with the ${holding} Agency. Take it over to act.`;

  return {
    role,
    roleLabel: ROLE_LABEL[role] ?? role,
    myAgencies: mine,
    holdingAgency: holding,
    stageOwner: nodeOwner,
    stageElsewhere,
    canAct,
    canHandOver,
    canCreate: mine.includes(INDENTING),   // a case starts with the indent
    readOnly: !mine.length,
    // True for an account that covers both desks — the screen labels the button
    // differently, since nobody is really "handing over" to themselves.
    bothAgencies: mine.length > 1,
    reason
  };
}

export default {
  INDENTING, TENDERING, ROLE_AGENCIES, ROLE_LABEL, agenciesFor, canActAs, isReadOnly,
  permissions
};
