import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import { paPickerColumns } from '../../config/paPickerColumns.jsx';

export default function PaPicker() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payment-advices?status=pa_created')
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = paPickerColumns({
    onOpen: (row) => navigate(`/payment-advice?pa=${encodeURIComponent(row.paNo)}`)
  });

  return (
    <section className="screen">
      <h1 className="screen-title">Payment Advice</h1>
      <p className="screen-note">
        Drafts awaiting maker verification. Generate a new advice from the{' '}
        <Link to="/rv-inbox">RV Inbox</Link>.
      </p>
      {error ? (
        <div className="grid-empty">Could not load payment advices: {error}</div>
      ) : (
        <DataGrid
          columns={columns}
          rows={rows}
          rowKey="paNo"
          emptyMessage="No payment advice drafts. Generate one from the RV Inbox."
        />
      )}
    </section>
  );
}
