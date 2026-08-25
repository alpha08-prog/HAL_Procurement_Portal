export default function ModuleIcon({ id, size = 20, color = 'currentColor', className = '' }) {
  const s = size;
  const c = color;

  switch (id) {
    case 'hub':
    case 'overview':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );

    case 'noting':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );

    case 'payments':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="6" y1="15" x2="10" y2="15" />
        </svg>
      );

    case 'approvals':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h18" />
        </svg>
      );

    case 'contracts':
      return (
        <svg
          width={s}
          height={s}
          viewBox="0 0 24 24"
          fill="none"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );

    default:
      return null;
  }
}
