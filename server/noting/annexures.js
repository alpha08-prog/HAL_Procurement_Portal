// AI annexures are computed data, not uploaded files. They are kept as `annexure`
// attachments whose payload is the format's JSON, so the note screen can render them as
// tables and nothing pretends a PDF exists on disk.
import { nowISO, run } from './db.js';

export function attachAnnexures(noteId, formatsBuilt = [], uploaderId = null) {
  const today = nowISO();
  for (const fmt of formatsBuilt) {
    run(
      `INSERT INTO attachments(note_id,kind,name,ref,payload,uploaded_by_id,created_at)
       VALUES(?, 'annexure', ?, ?, ?, ?, ?)`,
      noteId, `Annexure: ${fmt.format || fmt.id || 'Format'}`, fmt.id || null,
      JSON.stringify(fmt), uploaderId, today
    );
  }
}
