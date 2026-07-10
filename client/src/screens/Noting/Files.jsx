import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import { FILE_COLUMNS } from '../../config/notingColumns.jsx';
import { fetchFiles } from '../../lib/notingApi.js';

// All e-files with their latest note status. Click a File ID to open the note.
export default function Files() {
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchFiles()
      .then((d) => !cancelled && setFiles(d.files))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="screen">
      <div className="screen-head">
        <h1 className="screen-title">Files</h1>
        <Link to="/noting/initiate" className="btn">
          + Initiate Note
        </Link>
      </div>

      {error ? (
        <div className="grid-empty">Could not load files: {error}</div>
      ) : (
        <DataGrid columns={FILE_COLUMNS} rows={files} emptyMessage="No files yet — initiate a note." />
      )}
    </section>
  );
}
