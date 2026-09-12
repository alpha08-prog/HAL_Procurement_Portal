import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PORTAL_TABS } from '../../config/portalStructure.js';
import PortalItemModal from './PortalItemModal.jsx';

/**
 * Maps any pathname to its parent tab in PORTAL_TABS.
 */
function getActiveTabForPath(pathname) {
  if (!pathname || pathname === '/' || pathname === '/portal') return null;

  if (pathname.startsWith('/provisioning')) {
    return PORTAL_TABS.find((t) => t.id === 'provisioning') || null;
  }
  if (
    pathname.startsWith('/noting') ||
    pathname.startsWith('/ai-cases') ||
    pathname.startsWith('/ai-documents') ||
    pathname.startsWith('/approvals/bids') ||
    pathname.startsWith('/approvals/committees') ||
    pathname.startsWith('/approvals/directory') ||
    pathname.startsWith('/approvals/chains')
  ) {
    return PORTAL_TABS.find((t) => t.id === 'procurement') || null;
  }
  if (pathname.startsWith('/approvals/intake')) {
    return PORTAL_TABS.find((t) => t.id === 'provisioning') || null;
  }
  if (pathname.startsWith('/contracts')) {
    return PORTAL_TABS.find((t) => t.id === 'contract_management') || null;
  }
  if (
    pathname === '/rv-inbox' ||
    pathname === '/payment-advice' ||
    pathname === '/forward-advice' ||
    pathname === '/process-payment' ||
    pathname === '/hod-approval' ||
    pathname === '/payment-register' ||
    pathname === '/payment-kpis'
  ) {
    return PORTAL_TABS.find((t) => t.id === 'payment') || null;
  }
  if (pathname.startsWith('/claims')) {
    return PORTAL_TABS.find((t) => t.id === 'claim_management') || null;
  }
  if (pathname.startsWith('/kpis')) {
    return PORTAL_TABS.find((t) => t.id === 'kpi') || null;
  }

  return null;
}

export default function ModuleActionBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeTab = getActiveTabForPath(location.pathname);

  // If on portal hub or login, do not render this ribbon
  if (!activeTab) return null;

  const handleActionClick = (item) => {
    setDrawerOpen(false);
    if (item.type === 'route' && item.route) {
      navigate(item.route);
    } else {
      setActiveModal({ item, tab: activeTab });
    }
  };

  const isCurrentRoute = (item) => {
    if (!item.route) return false;
    const baseRoute = item.route.split('?')[0];
    return location.pathname === baseRoute;
  };

  return (
    <>
      {/* ── Persistent Module Ribbon ── */}
      <aside className="module-action-bar" aria-label="Module options bar">
        <div className="module-bar-inner">
          {/* Left: Breadcrumbs & Back links */}
          <div className="module-bar-left">
            <Link to="/portal" className="module-bar-hub-link" title="Return to Portal Overview">
              <span className="hub-icon">←</span> All Modules
            </Link>
            <span className="module-bar-sep">/</span>
            <div className="module-bar-title-wrap">
              <span className="module-bar-badge">{activeTab.title}</span>
              <button
                type="button"
                className={`module-bar-drawer-btn ${drawerOpen ? 'open' : ''}`}
                onClick={() => setDrawerOpen((v) => !v)}
                title="View all button options for this module"
              >
                <span>All Options ({activeTab.items.length})</span>
                <span className="drawer-arrow">{drawerOpen ? '▲' : '▼'}</span>
              </button>
            </div>
          </div>

          {/* Center/Right: Quick Action Buttons Strip */}
          <div className="module-bar-items-strip">
            {activeTab.items.map((item) => {
              const active = isCurrentRoute(item);
              const isModal = item.type === 'modal';

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`module-pill-btn ${active ? 'active' : ''} ${isModal ? 'is-tool' : ''}`}
                  onClick={() => handleActionClick(item)}
                  title={`${item.code}: ${item.desc}`}
                >
                  {isModal ? <span className="pill-tool-icon">⚙</span> : null}
                  <span className="pill-name">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Right link: Full Hub Tab View */}
          <div className="module-bar-right">
            <Link
              to={`/portal?tab=${activeTab.id}`}
              className="module-bar-full-link"
              title="Open full tab overview with details on Portal Hub"
            >
              Hub View ↗
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Slide-Down "All Options" Drawer ── */}
      {drawerOpen && (
        <div className="module-options-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="module-options-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div className="drawer-pretitle">{activeTab.title} MODULE • COMPLETE OPTION DIRECTORY</div>
                <h3 className="drawer-title">Available Tools, Workflows &amp; Standard Formats</h3>
                <p className="drawer-sub">{activeTab.tagline}</p>
              </div>
              <div className="drawer-header-actions">
                <Link
                  to={`/portal?tab=${activeTab.id}`}
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDrawerOpen(false)}
                >
                  Open in Portal Hub ↗
                </Link>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close options drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="drawer-grid">
              {activeTab.items.map((item) => {
                const active = isCurrentRoute(item);
                const isModal = item.type === 'modal';

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`drawer-item-card ${active ? 'active' : ''}`}
                    onClick={() => handleActionClick(item)}
                  >
                    <div className="drawer-item-top">
                      <span className="drawer-item-code">{item.code}</span>
                      <span className="drawer-item-type">
                        {isModal ? 'Interactive Tool' : 'Workspace Screen'}
                      </span>
                    </div>
                    <div className="drawer-item-name">{item.name}</div>
                    <div className="drawer-item-desc">{item.desc}</div>
                    <div className="drawer-item-footer">
                      <span className="drawer-item-action">
                        {active ? '● Current Screen' : isModal ? 'Launch Tool →' : 'Navigate →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal for In-Place Tools (e.g. LD Calculator, FTR Generator, etc.) ── */}
      {activeModal && (
        <PortalItemModal
          item={activeModal.item}
          tab={activeModal.tab}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}
