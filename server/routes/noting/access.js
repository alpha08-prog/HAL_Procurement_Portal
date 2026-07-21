// Shared per-request access resolution for a single note, used by EVERY note-scoped read
// (detail, summary, attachments, history) so a need-to-know grant unlocks all of them and
// a re-shared link is caught no matter which endpoint presents it.
//
// Rules (email point 3): routed members / graded heads pass via canView. Otherwise a
// ?grant=<token> link works only for the member it was issued to; anyone else presenting
// an active token is a re-share leak — the grant is revoked for BOTH and the custodian is
// alerted with the offending PB.
import { get, nowISO, run } from '../../noting/db.js';
import { currentMember } from '../../noting/identity.js';
import { canView } from '../../noting/workflow.js';

export function noteAccess(req, note) {
  const me = currentMember(req);
  if (canView(note, me)) return { me, ok: true };

  const token = req.query.grant;
  const grant = token && get(`SELECT * FROM access_grants WHERE token = ? AND note_id = ? AND state = 'active'`, token, note.id);
  if (grant && me && grant.granted_to_id === me.id) return { me, ok: true };
  if (grant) {
    run(`UPDATE access_grants SET state = 'revoked', revoked_at = ?, revoke_reason = 'reshared' WHERE id = ?`, nowISO(), grant.id);
    run(
      `INSERT INTO access_alerts(note_id,grant_id,custodian_id,offender_pb,message,created_at) VALUES(?,?,?,?,?,?)`,
      note.id, grant.id, note.custodian_id, me?.pb || 'unknown',
      `Restricted note ${note.ref_no} link re-shared — access attempted by PB ${me?.pb || 'unknown'}. Grant revoked.`,
      nowISO()
    );
    return { me, ok: false, status: 403, error: 'Restricted note — this link was re-shared and has been revoked.' };
  }
  return { me, ok: false, status: 403, error: 'Restricted note — you are not a routed member.' };
}

// Convenience wrapper: send the 403 and return null, or return {me} on success.
export function requireNoteAccess(req, res, note) {
  const a = noteAccess(req, note);
  if (!a.ok) {
    res.status(a.status).json({ error: a.error });
    return null;
  }
  return a;
}
