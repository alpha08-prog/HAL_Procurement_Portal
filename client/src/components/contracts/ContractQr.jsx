import { QRCodeSVG } from 'qrcode.react';

// The tamper-evidence QR: encodes the server-built payload verbatim — contract no,
// SHA-256 content hash, date-time stamp and the HAL signer's credentials. SVG, so it
// survives Chrome's Save-as-PDF background stripping. Drafts get a placeholder.
export default function ContractQr({ payload }) {
  if (!payload) {
    return (
      <div className="contract-qr contract-qr-empty">
        <div className="contract-qr-box">DRAFT<br />not yet finalised</div>
        <div className="contract-qr-caption">QR verification code is stamped on finalisation.</div>
      </div>
    );
  }
  return (
    <div className="contract-qr">
      <QRCodeSVG value={payload} size={110} marginSize={2} />
      <div className="contract-qr-caption">
        Scan to verify — contract no, SHA-256, date-time stamp and signer credentials.
      </div>
    </div>
  );
}
