import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import { cabinetColumns } from '../../config/notingColumns.jsx';
import { addNote, fetchCabinet } from '../../lib/notingApi.js';

// Closed files filed into my cabinet. When a stage is approved, the cabinet prompts the next
// action — one click generates the next-stage note (draft, seeded to seek its inputs) and
// opens it. The deciding authority can retrieve a closed file back from the note screen.
export default function Cabinet() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchCabinet()
      .then((d) => setRows(d.cabinet))
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const advance = async (row) => {
    setBusy(true);
    setError(null);
    try {
      const r = await addNote(row.file_pk, { stageId: row.next_stage, title: row.next_stage_title });
      navigate(`/noting/note/${r.note.txn_id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      <h1 className="screen-title">Cabinet</h1>
      <p className="screen-sub">
        Files you initiated, routed or decided — retained after closure. When a stage is
        approved, generate the next note here.
      </p>
      {error && <div className="banner banner-error">{error}</div>}
      <DataGrid
        columns={cabinetColumns(advance)}
        rows={busy ? null : rows}
        rowKey="file_pk"
        emptyMessage="Your cabinet is empty."
      />
    </section>
  );
}
