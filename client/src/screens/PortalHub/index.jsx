import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleLabel } from '../../config/roles.js';
import { useRole } from '../../context/RoleContext.jsx';
import { fetchOverview } from '../../lib/notingApi.js';

export default function PortalHub() {
  const { user } = useAuth();
  const { role } = useRole();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchOverview()
      .then((d) => setStats(d.counts))
      .catch(() => setStats(null));
  }, []);

  const modules = [
    {
      id: 'noting',
      title: 'E-File Noting & AI Procurement',
      icon: '🗂️',
      color: '#0e4474',
      badge: 'Core Workflow',
      badgeClass: 'pill-info',
      primaryAction: { label: 'Open E-File System →', path: '/noting/inbox' },
      quickLinks: [
        { label: '+ Create E-File', path: '/noting/initiate', icon: '📝' },
        { label: 'My Inbox', path: '/noting/inbox', icon: '📥' },
        { label: 'SentBox', path: '/noting/sentbox', icon: '📤' },
        { label: 'Cabinet', path: '/noting/cabinet', icon: '🗄️' },
        { label: 'Drafts & Files', path: '/noting/files', icon: '📁' },
        { label: 'Reports', path: '/noting/reports', icon: '📊' }
      ]
    },
    {
      id: 'payments',
      title: 'Bill Processing & Payment Desk',
      icon: '💳',
      color: '#0b6b4e',
      badge: 'Finance & IMM',
      badgeClass: 'pill-success',
      primaryAction: { label: 'Open Payment Desk →', path: '/rv-inbox' },
      quickLinks: [
        { label: 'RV Status Inbox', path: '/rv-inbox', icon: '📋' },
        { label: 'Payment Advice', path: '/payment-advice', icon: '✍️' },
        { label: 'Forward to CPPC', path: '/forward-advice', icon: '➡️' },
        { label: 'Process Payments', path: '/process-payment', icon: '💰' },
        { label: 'HOD Approvals', path: '/hod-approval', icon: '✅' },
        { label: 'Payment Register', path: '/payment-register', icon: '📑' }
      ]
    },
    {
      id: 'approvals',
      title: 'Bid Evaluation & Approvals',
      icon: '⚖️',
      color: '#b85d19',
      badge: 'Tendering & Indenting',
      badgeClass: 'pill-warning',
      primaryAction: { label: 'Open Approvals Suite →', path: '/approvals/chains' },
      quickLinks: [
        { label: 'Technical Bid Scoring', path: '/approvals/bids', icon: '🎯' },
        { label: 'Approval Chains', path: '/approvals/chains', icon: '🔀' },
        { label: 'TEC / PNC Committees', path: '/approvals/committees', icon: '👥' },
        { label: 'Indent Checklist', path: '/approvals/intake', icon: '📑' },
        { label: 'Personnel Directory', path: '/approvals/directory', icon: '📖' },
        { label: 'Approval Files', path: '/approvals/chains', icon: '🔍' }
      ]
    },
    {
      id: 'contracts',
      title: 'Contract Generation & Clauses',
      icon: '📜',
      color: '#334155',
      badge: 'Commercial & Legal',
      badgeClass: 'pill-neutral',
      primaryAction: { label: 'Open Contracts Suite →', path: '/contracts/register' },
      quickLinks: [
        { label: '+ Generate Contract', path: '/contracts/generate', icon: '📄' },
        { label: 'Contract Register', path: '/contracts/register', icon: '📜' },
        { label: '72 STC Clause Library', path: '/contracts/library', icon: '📚' },
        { label: 'Clause Browser', path: '/contracts/library', icon: '🔍' },
        { label: 'Standard Terms', path: '/contracts/library', icon: '📑' },
        { label: 'Contract Formats', path: '/contracts/register', icon: '📝' }
      ]
    }
  ];

  return (
    <section className="screen portal-hub-screen">
      {/* Top Header Banner */}
      <div className="portal-hero">
        <div className="portal-hero-text">
          <span className="portal-eyebrow">HINDUSTAN AERONAUTICS LIMITED · NASHIK</span>
          <h1 className="portal-title">Procurement &amp; Management Portal</h1>
          <span className="portal-welcome-tag">
            Signed in as: <strong>{user?.name || 'Officer'}</strong> ({roleLabel(role)})
          </span>
        </div>
        {stats && (
          <div className="portal-quick-stats">
            <div className="portal-stat-pill">
              <span className="stat-num">{stats.openFiles ?? 0}</span>
              <span className="stat-lbl">Open Files</span>
            </div>
            <div className="portal-stat-pill">
              <span className="stat-num">{stats.draftNotes ?? 0}</span>
              <span className="stat-lbl">Active Drafts</span>
            </div>
            <div className="portal-stat-pill">
              <span className="stat-num">{stats.files ?? 0}</span>
              <span className="stat-lbl">Total E-Files</span>
            </div>
          </div>
        )}
      </div>

      {/* 2x2 Clean, Large Proportional Grid */}
      <div className="portal-modules-grid">
        {modules.map((m) => (
          <div className="portal-module-card" key={m.id}>
            {/* Top Bar: Icon + Title + Badge */}
            <div className="portal-card-header">
              <div className="portal-card-icon-wrap" style={{ background: `${m.color}15`, color: m.color }}>
                <span className="portal-card-icon">{m.icon}</span>
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
                  <span className="shortcut-icon">{link.icon}</span>
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
