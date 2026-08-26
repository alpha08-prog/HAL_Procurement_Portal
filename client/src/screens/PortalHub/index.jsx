import { Link, useNavigate } from 'react-router-dom';
import ModuleIcon from '../../components/ModuleIcon.jsx';
import { canAccessPath } from '../../config/roles.js';
import { useRole } from '../../context/RoleContext.jsx';

export default function PortalHub() {
  const navigate = useNavigate();
  const { role } = useRole();
  const modules = [
    {
      id: 'noting',
      title: 'E-File Noting & AI Procurement',
      color: '#0e4474',
      badge: 'Core Workflow',
      badgeClass: 'pill-info',
      primaryAction: { label: 'Open E-File System →', path: '/noting/inbox' },
      quickLinks: [
        { label: '+ Create E-File', path: '/noting/initiate' },
        { label: 'My Inbox', path: '/noting/inbox' },
        { label: 'SentBox', path: '/noting/sentbox' },
        { label: 'Cabinet', path: '/noting/cabinet' },
        { label: 'AI Documents', path: '/noting/ai-documents' },
        { label: 'Reports', path: '/noting/reports' }
      ]
    },
    {
      id: 'payments',
      title: 'Bill Processing & Payment Desk',
      color: '#0b6b4e',
      badge: 'Finance & IMM',
      badgeClass: 'pill-success',
      primaryAction: { label: 'Open Payment Desk →', path: '/rv-inbox' },
      quickLinks: [
        { label: 'RV Status Inbox', path: '/rv-inbox' },
        { label: 'Payment Advice', path: '/payment-advice' },
        { label: 'Forward to CPPC', path: '/forward-advice' },
        { label: 'Process Payments', path: '/process-payment' },
        { label: 'HOD Approvals', path: '/hod-approval' },
        { label: 'Payment KPIs & Stats', path: '/payment-kpis' }
      ]
    },
    {
      id: 'approvals',
      title: 'Bid Evaluation & Approvals',
      color: '#b85d19',
      badge: 'Tendering & Indenting',
      badgeClass: 'pill-warning',
      primaryAction: { label: 'Open Approvals Suite →', path: '/approvals/chains' },
      quickLinks: [
        { label: 'Technical Bid Scoring', path: '/approvals/bids' },
        { label: 'Approval Chains', path: '/approvals/chains' },
        { label: 'TEC / PNC Committees', path: '/approvals/committees' },
        { label: 'Indent Checklist', path: '/approvals/intake' },
        { label: 'Personnel Directory', path: '/approvals/directory' },
        { label: 'Approval Files', path: '/approvals/chains' }
      ]
    },
    {
      id: 'contracts',
      title: 'Contract Generation & Clauses',
      color: '#334155',
      badge: 'Commercial & Legal',
      badgeClass: 'pill-neutral',
      primaryAction: { label: 'Open Contracts Suite →', path: '/contracts/register' },
      quickLinks: [
        { label: '+ Generate Contract', path: '/contracts/generate' },
        { label: 'Contract Register', path: '/contracts/register' },
        { label: '72 STC Clause Library', path: '/contracts/library' },
        { label: 'Clause Browser', path: '/contracts/library' },
        { label: 'Standard Terms', path: '/contracts/library' },
        { label: 'Contract Formats', path: '/contracts/register' }
      ]
    }
  ];
  // Filter quick links and whole module cards by role visibility.
  const filteredModules = modules
    .map((m) => ({
      ...m,
      quickLinks: m.quickLinks.filter((link) => canAccessPath(role, link.path))
    }))
    .filter((m) => m.quickLinks.length > 0);

  return (
    <section className="screen portal-hub-screen">
      {/* 2x2 Clean, Large Proportional Grid — Fills Viewport Beautifully */}
      <div className="portal-modules-grid">
        {filteredModules.map((m) => (
          <div className="portal-module-card" key={m.id}>
            {/* Top Bar: Professional SVG Icon + Title + Badge */}
            <div className="portal-card-header">
              <div className="portal-card-icon-wrap" style={{ background: `${m.color}15`, color: m.color }}>
                <ModuleIcon id={m.id} size={22} color={m.color} />
              </div>
              <div className="portal-card-titles">
                <h2 className="portal-card-title">{m.title}</h2>
                <span className={`pill ${m.badgeClass}`}>{m.badge}</span>
              </div>
            </div>

            {/* Quick Action Grid */}
            <div className="portal-shortcuts-grid">
              {m.quickLinks.map((link) => (
                <Link key={link.path + link.label} to={link.path} className="portal-shortcut-btn">
                  <span className="shortcut-label">{link.label}</span>
                </Link>
              ))}
            </div>

            {/* Enter Button */}
            <div className="portal-card-footer">
              <button
                type="button"
                className="btn portal-enter-btn"
                style={{ background: m.color, color: '#fff' }}
                onClick={() => navigate(m.primaryAction.path)}
              >
                {m.primaryAction.label}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
