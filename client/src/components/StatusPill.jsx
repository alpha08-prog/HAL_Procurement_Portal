import { statusMeta } from '../config/statusColors.js';

export default function StatusPill({ status }) {
  const { label, tone } = statusMeta(status);
  return <span className={`pill pill-${tone}`}>{label}</span>;
}
