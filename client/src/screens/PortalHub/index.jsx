import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PortalItemModal from '../../components/portal/PortalItemModal.jsx';
import { PORTAL_TABS } from '../../config/portalStructure.js';
import { fetchFormats } from '../../lib/toolsApi.js';

const TOTAL_ITEMS = PORTAL_TABS.reduce((n, t) => n + t.items.length, 0);
const KPI_COUNT = PORTAL_TABS.find((t) => t.id === 'kpi')?.items.length ?? 0;

export default function PortalHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The formats count is the server library's (GET /api/formats), not a client constant.
  const [formatsSummary, setFormatsSummary] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchFormats()
      .then((d) => !cancelled && setFormatsSummary(d.summary))
      .catch(() => !cancelled && setFormatsSummary(null));
    return () => {
      cancelled = true;
    };
  }, []);

  // Read active tab from URL query param if present
  const initialTabId = searchParams.get('tab');
  const [activeTabId, setActiveTabId] = useState(initialTabId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [activeModal, setActiveModal] = useState(null);

  // Sync tab with URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && PORTAL_TABS.some((t) => t.id === tabFromUrl)) {
      setActiveTabId(tabFromUrl);
    } else if (!tabFromUrl) {
      setActiveTabId(null);
    }
  }, [searchParams]);

  const selectTab = (id) => {
    setActiveTabId(id);
    if (id) {
      setSearchParams({ tab: id });
    } else {
      setSearchParams({});
    }
  };

  const activeTab = PORTAL_TABS.find((t) => t.id === activeTabId) ?? null;

  const handleItemClick = (item, tab) => {
    if ((item.type === 'route' || item.type === 'workflow') && item.route) {
      navigate(item.route);
    } else {
      setActiveModal({ item, tab });
    }
  };

  // Flattened list of all items for global search
  const allPortalItems = useMemo(() => {
    return PORTAL_TABS.flatMap((tab) =>
      tab.items.map((item) => ({ ...item, tabTitle: tab.title, tabId: tab.id, tab }))
    );
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allPortalItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.tabTitle.toLowerCase().includes(q)
    );
  }, [searchQuery, allPortalItems]);

  // Tab detail filtered items
  const filteredTabItems = useMemo(() => {
    if (!activeTab) return [];
    return activeTab.items.filter((item) => {
      if (itemTypeFilter === 'routes') return item.type === 'route' || item.type === 'workflow';
      if (itemTypeFilter === 'tools') return item.type === 'modal';
      return true;
    });
  }, [activeTab, itemTypeFilter]);

  return (
    <section className="screen portal-hub-screen">
      {/* ── Detail View: Single Tab Expanded ── */}
      {activeTab ? (
        <div className="ph-detail-wrapper">
          {/* Breadcrumb & Navigation */}
          <div className="ph-detail-topbar">
            <div className="ph-detail-breadcrumb">
              <button
                type="button"
                className="ph-back-btn"
                onClick={() => selectTab(null)}
              >
                ← All {PORTAL_TABS.length} Lifecycle Modules
              </button>
              <span className="ph-crumb-sep">/</span>
              <span className="ph-crumb-current">{activeTab.title}</span>
            </div>

            <div className="ph-detail-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => selectTab(null)}
              >
                Change Module
              </button>
              <button
                type="button"
                className="btn btn-sm ph-open-ws-btn"
                onClick={() => navigate(activeTab.primaryRoute)}
              >
                Open Primary Workspace →
              </button>
            </div>
          </div>

          {/* Tab Header Banner */}
          <div className="ph-detail-header-card">
            <div className="ph-detail-header-content">
              <div className="ph-detail-pill">
                MODULE {String(PORTAL_TABS.findIndex((t) => t.id === activeTab.id) + 1).padStart(2, '0')}
              </div>
              <h1 className="ph-detail-title">{activeTab.title}</h1>
              <p className="ph-detail-sub">{activeTab.tagline}</p>
            </div>
            <div className="ph-detail-header-stats">
              <div className="ph-stat-chip">
                <span className="ph-stat-chip-val">{activeTab.items.length}</span>
                <span className="ph-stat-chip-lbl">Total Options</span>
              </div>
              <div className="ph-stat-chip">
                <span className="ph-stat-chip-val">
                  {activeTab.items.filter((i) => i.type === 'route' || i.type === 'workflow').length}
                </span>
                <span className="ph-stat-chip-lbl">Workflows</span>
              </div>
              <div className="ph-stat-chip">
                <span className="ph-stat-chip-val">
                  {activeTab.items.filter((i) => i.type === 'modal').length}
                </span>
                <span className="ph-stat-chip-lbl">Tools &amp; Formats</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="ph-detail-filter-bar">
            <div className="ph-filter-tabs">
              <button
                type="button"
                className={`ph-filter-tab ${itemTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setItemTypeFilter('all')}
              >
                All Options ({activeTab.items.length})
              </button>
              <button
                type="button"
                className={`ph-filter-tab ${itemTypeFilter === 'routes' ? 'active' : ''}`}
                onClick={() => setItemTypeFilter('routes')}
              >
                Workflows &amp; Screens (
                {activeTab.items.filter((i) => i.type === 'route' || i.type === 'workflow').length}
                )
              </button>
              <button
                type="button"
                className={`ph-filter-tab ${itemTypeFilter === 'tools' ? 'active' : ''}`}
                onClick={() => setItemTypeFilter('tools')}
              >
                Calculators &amp; Formats (
                {activeTab.items.filter((i) => i.type === 'modal').length}
                )
              </button>
            </div>
          </div>

          {/* Items Grid */}
          <div className="ph-items-grid">
            {filteredTabItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="ph-item-card"
                onClick={() => handleItemClick(item, activeTab)}
              >
                <div className="ph-item-header">
                  <span className="ph-item-code">{item.code}</span>
                  <span className="ph-item-badge">
                    {item.type === 'route' || item.type === 'workflow'
                      ? 'Workflow'
                      : 'Interactive Tool'}
                  </span>
                </div>
                <div className="ph-item-name">{item.name}</div>
                <div className="ph-item-desc">{item.desc}</div>
                <div className="ph-item-footer">
                  <span className="ph-item-action">
                    {item.type === 'route' || item.type === 'workflow'
                      ? 'Open Workflow →'
                      : 'Launch Tool →'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Landing View: Efficient Space Utilization + 6 Modules ── */
        <div className="ph-landing-wrapper">
          {/* Compact Control Bar: Only Search Bar + 4 Metrics */}
          <div className="ph-compact-bar">
            {/* Search Input */}
            <div className="ph-compact-search-wrap">
              <span className="ph-search-icon">🔍</span>
              <input
                type="text"
                className="ph-search-input"
                placeholder={`Search ${TOTAL_ITEMS} tools, formats, calculators, or manuals (e.g. LD, PAC, RV, STC, CAR, FTR)...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ph-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 4 Metric Items */}
            <div className="ph-compact-metrics">
              <div className="ph-metric-item">
                <span className="ph-metric-num">{PORTAL_TABS.length}</span>
                <span className="ph-metric-lbl">Lifecycle Modules</span>
              </div>
              <div className="ph-metric-sep" />
              <div className="ph-metric-item">
                <span className="ph-metric-num">{TOTAL_ITEMS}</span>
                <span className="ph-metric-lbl">Integrated Tools &amp; Notes</span>
              </div>
              <div className="ph-metric-sep" />
              <div className="ph-metric-item">
                <span className="ph-metric-num">{formatsSummary ? formatsSummary.total : '—'}</span>
                <span className="ph-metric-lbl">
                  Standard Formats{formatsSummary ? ` (${formatsSummary.verified} from HAL docs)` : ' (library)'}
                </span>
              </div>
              <div className="ph-metric-sep" />
              <div className="ph-metric-item">
                <span className="ph-metric-num">{KPI_COUNT}</span>
                <span className="ph-metric-lbl">Statutory KPIs &amp; SLAs</span>
              </div>
            </div>
          </div>

          {/* ── Global Search Results View (If User Typed in Search) ── */}
          {searchQuery.trim() ? (
            <div className="ph-search-results-section">
              <div className="ph-search-results-header">
                <h2>
                  Search Results for &ldquo;{searchQuery}&rdquo; ({searchResults.length} matches)
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div className="ph-empty-search">
                  No procurement tools or formats matched &ldquo;{searchQuery}&rdquo;. Try keywords like &ldquo;LD&rdquo;, &ldquo;PAC&rdquo;, &ldquo;Requisition&rdquo;, or &ldquo;Payment&rdquo;.
                </div>
              ) : (
                <div className="ph-items-grid">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="ph-item-card"
                      onClick={() => handleItemClick(item, item.tab)}
                    >
                      <div className="ph-item-header">
                        <span className="ph-item-code">{item.code}</span>
                        <span className="ph-item-badge">{item.tabTitle}</span>
                      </div>
                      <div className="ph-item-name">{item.name}</div>
                      <div className="ph-item-desc">{item.desc}</div>
                      <div className="ph-item-footer">
                        <span className="ph-item-action">
                          {item.type === 'route' || item.type === 'workflow'
                            ? 'Open Workflow →'
                            : 'Launch Tool →'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Rich 6-Module Grid Utilizing Screen Space ── */
            <div className="ph-modules-section">
              <div className="ph-section-head">
                <h2 className="ph-section-title">Procurement Lifecycle Modules</h2>
                <span className="ph-section-hint">
                  Select a module to view all options, or click any direct action shortcut below
                </span>
              </div>

              <div className="ph-modules-grid">
                {PORTAL_TABS.map((tab, i) => {
                  // Get up to 4 top quick-launch shortcuts for each card
                  const quickShortcuts = tab.items.slice(0, 4);

                  return (
                    <div key={tab.id} className="ph-module-card">
                      {/* Card Top */}
                      <div className="ph-card-top" onClick={() => selectTab(tab.id)}>
                        <div className="ph-card-header-row">
                          <span className="ph-card-number">
                            MODULE {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="ph-card-count-badge">
                            {tab.items.length} Options
                          </span>
                        </div>
                        <h3 className="ph-card-title">{tab.title}</h3>
                        <p className="ph-card-tagline">{tab.tagline}</p>
                      </div>

                      {/* Card Middle: Direct Action Shortcuts (Utilizes space & provides high utility) */}
                      <div className="ph-card-shortcuts">
                        <div className="ph-shortcuts-label">QUICK SHORTCUTS:</div>
                        <div className="ph-shortcuts-list">
                          {quickShortcuts.map((sc) => (
                            <button
                              key={sc.id}
                              type="button"
                              className="ph-shortcut-pill"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(sc, tab);
                              }}
                              title={sc.desc}
                            >
                              <span className="ph-shortcut-code">{sc.code}</span>
                              <span className="ph-shortcut-name">{sc.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Card Footer: Explore All Options */}
                      <div className="ph-card-footer">
                        <button
                          type="button"
                          className="ph-explore-btn"
                          onClick={() => selectTab(tab.id)}
                        >
                          <span>Explore All {tab.items.length} Options</span>
                          <span className="ph-explore-arrow">→</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Universal Modal */}
      {activeModal && (
        <PortalItemModal
          item={activeModal.item}
          tab={activeModal.tab}
          onClose={() => setActiveModal(null)}
        />
      )}
    </section>
  );
}
