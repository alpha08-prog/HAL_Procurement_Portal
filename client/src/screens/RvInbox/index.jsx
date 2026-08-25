import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import ReceiptComparisonModal from '../../components/ReceiptComparisonModal.jsx';
import { rvInboxColumns } from '../../config/rvInboxColumns.jsx';
import { useRole } from '../../context/RoleContext.jsx';
import { apiFetch } from '../../lib/api.js';

export default function RvInbox() {
  const navigate = useNavigate();
  const { role } = useRole();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busyRvNo, setBusyRvNo] = useState(null);
  const [cnModalRow, setCnModalRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/rvs?status=pending')
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

  // Generate a PA for the RV, then jump to the maker verification form (Screen 2).
  const onGenerate = async (row) => {
    setBusyRvNo(row.rvNo);
    try {
      const res = await apiFetch('/api/payment-advices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rvNo: row.rvNo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
      navigate(`/payment-advice?pa=${encodeURIComponent(data.paNo)}`);
    } catch (err) {
      window.alert(err.message);
      setBusyRvNo(null);
    }
  };

  const onReceiptComparison = (row) => {
    setCnModalRow(row);
  };

  const handleCnSuccess = (data) => {
    setRows((current) =>
      current?.map((item) =>
        item.rvNo === data.rvNo
          ? {
              ...item,
              creditNoteUploaded: true,
              creditNoteWaived: false,
              creditNoteRequired: true,
              creditNoteNo: data.creditNoteNo,
              creditNoteFileName: data.fileName,
              creditNoteRemarks: data.remarks
            }
          : item
      )
    );
  };

  const handleWaiverSuccess = (data) => {
    setRows((current) =>
      current?.map((item) =>
        item.rvNo === data.rvNo
          ? {
              ...item,
              creditNoteWaived: true,
              creditNoteRequired: false,
              creditNoteWaiverReason: data.creditNoteWaiverReason
            }
          : item
      )
    );
  };

  const onViewDraft = (row) => {
    if (row.paNo) {
      navigate(`/payment-advice?pa=${encodeURIComponent(row.paNo)}&back=/rv-inbox`);
    } else {
      navigate(`/payment-advice`);
    }
  };

  const onViewPa = (row) => {
    if (row.paNo) {
      navigate(`/payment-advice?pa=${encodeURIComponent(row.paNo)}&back=/rv-inbox&view=1`);
    } else {
      navigate(`/payment-register`);
    }
  };

  return (
    <section className="screen">
      <h1 className="screen-title">RV — Payment Status</h1>
      {error ? (
        <div className="grid-empty">Could not load RVs: {error}</div>
      ) : (
        <DataGrid
          columns={rvInboxColumns(role, {
            onGenerate,
            onCreditNote: onReceiptComparison,
            onReceiptComparison,
            onViewDraft,
            onViewPa,
            busyRvNo
          })}
          rows={rows}
          rowKey="rvNo"
          emptyMessage="No RVs pending payment."
        />
      )}

      {cnModalRow && (
        <ReceiptComparisonModal
          row={cnModalRow}
          onClose={() => setCnModalRow(null)}
          onWaiverSuccess={handleWaiverSuccess}
          onCnSuccess={handleCnSuccess}
        />
      )}
    </section>
  );
}
