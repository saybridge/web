import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, RefreshCw, Shield, Cpu, AlertTriangle, ChevronDown, User, X, Monitor, Settings } from 'lucide-react';
import { api } from '../../../services/api';
import { usePluginStore } from '../../../stores/usePluginStore';
import { PageContainer, LiquidModal } from '@saybridge/ui';
import './PluginMonitor.css';

/* ============ Types ============ */
interface PluginManifest {
  id: string;
  name: string;
  icon?: string;
  version?: string;
  description?: string;
  category?: string;
  author?: string;
  license?: string;
  enabled?: boolean;
  hooks?: string[];
  permissions?: string[];
  screens?: PluginScreen[];
  admin_screens?: PluginScreen[];
  admin_menu?: {
    label: string;
    icon: string;
    priority: number;
  };
  composer_extensions?: ComposerExtension[];
  last_error?: string;
}

interface PluginScreen {
  id: string;
  title: string;
  placement: string;
}

interface ComposerExtension {
  id: string;
  label: string;
  trigger: string;
}

/* ============ Component ============ */
export function PluginMonitor() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pluginStorePlugins = usePluginStore((s) => s.plugins);
  const storeLoaded = usePluginStore((s) => s.loaded);
  const { setPluginEnabled } = usePluginStore.getState();

  // Use store as source of truth — cast to local type for display
  const manifests = pluginStorePlugins as unknown as PluginManifest[];
  const loading = !storeLoaded;


  // Manual refresh button — refetches from API and syncs store
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await usePluginStore.getState().fetchPlugins();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh plugins');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const isPluginDisabled = useCallback((id: string) => {
    const p = pluginStorePlugins.find((pp) => pp.id === id);
    return p ? !p.enabled : false;
  }, [pluginStorePlugins]);

  const togglePlugin = useCallback(async (id: string) => {
    const currentlyDisabled = isPluginDisabled(id);
    const willEnable = currentlyDisabled;

    // Optimistic update via global store
    setPluginEnabled(id, willEnable);

    try {
      await api.post(`/plugins/${id}/toggle`, { enabled: willEnable });
      // Refetch from API to get authoritative state from Redis
      await usePluginStore.getState().fetchPlugins();
    } catch {
      // Revert on failure
      setPluginEnabled(id, !willEnable);
    }
  }, [isPluginDisabled, setPluginEnabled]);

  // Derived stats
  const stats = useMemo(() => {
    const total = manifests.length;
    const active = manifests.filter((m) => !isPluginDisabled(m.id)).length;
    return { total, active };
  }, [manifests, isPluginDisabled]);

  // Category filter
  const [filter, setFilter] = useState('all');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginManifest | null>(null);

  const categoryLabels: Record<string, string> = {
    all: t('pluginMonitor.categoryAll'), core: 'Core', communication: t('pluginMonitor.categoryCommunication'), fun: t('pluginMonitor.categoryFun'),
    productivity: t('pluginMonitor.categoryProductivity'), security: t('pluginMonitor.categorySecurity'), integrations: t('pluginMonitor.categoryIntegrations'),
    dev_tools: 'Dev Tools', bots: 'Bots', other: t('pluginMonitor.categoryOther'),
  };

  const categories = useMemo(() => {
    const cats = new Set(manifests.map((m: any) => m.category || 'other'));
    return ['all', ...Array.from(cats)];
  }, [manifests]);

  const filtered = useMemo(() => {
    if (filter === 'all') return manifests;
    return manifests.filter((m: any) => (m.category || 'other') === filter);
  }, [manifests, filter]);

  // ---- Render ----
  if (loading) {
    return (
      <div className="pm-loading">
        <div className="pm-loading-spinner">{t('pluginMonitor.loading')}</div>
      </div>
    );
  }

  if (error && manifests.length === 0) {
    return (
      <div className="pm-error">
        <span>⚠️</span>
        <p>{error}</p>
        <button onClick={handleRefresh}>{t('pluginMonitor.retry')}</button>
      </div>
    );
  }

  return (
    <PageContainer
      title="Plugins"
      subtitle={t('pluginMonitor.subtitle', { active: stats.active, total: stats.total })}
      icon={<Package size={24} />}
      actions={
        <div className="pm-header-actions">
          <button
            className={`pm-refresh-btn ${refreshing ? 'is-spinning' : ''}`}
            onClick={handleRefresh}
            title={t('pluginMonitor.refresh')}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      }
    >

      {/* Category Filter Bar */}
      <div className="pm-filter-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`pm-filter-chip ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      {/* Plugin Cards Section */}
      <div className="pm-section">
        {filtered.length === 0 ? (
          <div className="pm-empty">
            <div className="pm-empty-icon">
              <Package size={28} />
            </div>
            <h4>{t('pluginMonitor.emptyCategory')}</h4>
          </div>
        ) : (
          <div className="pm-cards-grid">
            {filtered.map((manifest, idx) => (
              <PluginCard
                key={manifest.id}
                manifest={manifest}
                enabled={!isPluginDisabled(manifest.id)}
                expanded={expandedId === manifest.id}
                onToggle={() => togglePlugin(manifest.id)}
                onExpand={() => setSelectedPlugin(manifest)}
                animDelay={idx * 0.05}
              />
            ))}
          </div>
        )}
      </div>

      {/* Plugin Detail Modal */}
      {selectedPlugin && (
        <PluginDetailModal
          manifest={selectedPlugin}
          enabled={!isPluginDisabled(selectedPlugin.id)}
          onToggle={() => togglePlugin(selectedPlugin.id)}
          onClose={() => setSelectedPlugin(null)}
        />
      )}
    </PageContainer>
  );
}

/* ============ Plugin Card Sub-Component ============ */
function PluginCard({
  manifest,
  enabled,
  expanded,
  onToggle,
  onExpand,
  animDelay,
}: {
  manifest: PluginManifest;
  enabled: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  animDelay: number;
}) {
  const hooks = manifest.hooks || [];
  const permissions = manifest.permissions || hooks; // fallback to hooks if no permissions
  const screens = manifest.screens || [];
  const adminScreens = manifest.admin_screens || [];
  const composerExts = manifest.composer_extensions || [];
  const allScreens = [...screens, ...adminScreens];

  return (
    <div
      className={`pm-plugin-card ${!enabled ? 'is-disabled' : ''} ${expanded ? 'is-expanded' : ''}`}
      style={{ animationDelay: `${animDelay}s` }}
      onClick={onExpand}
    >
      {/* Card Header */}
      <div className="pm-card-header">
        <div className="pm-card-identity">
          <div className="pm-card-icon">{manifest.icon || '📦'}</div>
          <div className="pm-card-name-group">
            <div className="pm-card-name">{manifest.name}</div>
            <div className="pm-card-version">v{manifest.version || '1.0.0'}</div>
          </div>
        </div>
        <label
          className="pm-toggle"
          onClick={(e) => e.stopPropagation()}
          title={enabled ? 'Disable plugin' : 'Enable plugin'}
        >
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          <span className="pm-toggle-slider" />
        </label>
      </div>

      {/* Status & Category Badges */}
      <div className="pm-badges">
        <span className={`pm-badge ${enabled ? 'status-enabled' : 'status-disabled'}`}>
          {enabled ? '● Active' : '○ Disabled'}
        </span>
        {manifest.category && (
          <span className="pm-badge category">{manifest.category}</span>
        )}
        {manifest.last_error && (
          <span className="pm-badge error">⚠ Error</span>
        )}
      </div>

      {/* Card Info */}
      <div className="pm-card-info">
        <div className="pm-card-developer">
          <User size={12} />
          <span>{manifest.author || 'Saybridge'}</span>
        </div>
        <div className="pm-card-uptime">
          <span className={`pm-uptime-dot ${enabled && !manifest.last_error ? 'healthy' : 'unhealthy'}`} />
          <span>{enabled ? (manifest.last_error ? 'Error' : 'Healthy') : 'Stopped'}</span>
          <ChevronDown
            size={14}
            style={{
              transition: 'transform 0.3s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
              marginLeft: 4,
            }}
          />
        </div>
      </div>

      {/* Last Error */}
      {manifest.last_error && (
        <div className="pm-last-error">
          <AlertTriangle size={11} />
          <code>{manifest.last_error}</code>
        </div>
      )}

      {/* Detail Expander */}
      <div className={`pm-detail-expander ${expanded ? 'is-open' : ''}`}>
        {/* Description */}
        {manifest.description && (
          <div className="pm-detail-section">
            <h5>Description</h5>
            <p className="pm-detail-description">{manifest.description}</p>
          </div>
        )}

        {/* Permissions / Hooks */}
        {permissions.length > 0 && (
          <div className="pm-detail-section">
            <h5>Permissions & Hooks</h5>
            <div className="pm-permissions-list">
              {permissions.map((perm) => (
                <span key={perm} className="pm-permission-pill">
                  <Shield size={10} /> {perm}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Composer Extensions */}
        {composerExts.length > 0 && (
          <div className="pm-detail-section">
            <h5>Composer Extensions</h5>
            <div className="pm-extensions-list">
              {composerExts.map((ext) => (
                <div key={ext.id} className="pm-extension-item">
                  <span>⌨️</span>
                  <span>{ext.label}</span>
                  <span className="pm-extension-placement">{ext.trigger}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Screens */}
        {allScreens.length > 0 && (
          <div className="pm-detail-section">
            <h5>UI Screens</h5>
            <div className="pm-extensions-list">
              {allScreens.map((s) => (
                <div key={s.id} className="pm-extension-item">
                  <span>🖥</span>
                  <span>{s.title}</span>
                  <span className="pm-extension-placement">{s.placement}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Plugin Detail Modal ============ */
function PluginDetailModal({
  manifest,
  enabled,
  onToggle,
  onClose,
}: {
  manifest: PluginManifest;
  enabled: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const infoItems = [
    { label: t('pluginMonitor.infoVersion'), value: `v${manifest.version || '1.0.0'}` },
    { label: t('pluginMonitor.infoCategory'), value: (manifest as any).category || 'core' },
    { label: t('pluginMonitor.infoLicense'), value: (manifest as any).license || 'free' },
    { label: t('pluginMonitor.infoAuthor'), value: manifest.author || 'Saybridge Official' },
  ];

  const hooks: string[] = manifest.hooks || [];
  const adminScreens = (manifest as any).admin_screens || [];
  const screens = manifest.screens || [];
  const description = (manifest as any).description || manifest.name;

  return (
    <LiquidModal
      isOpen={true}
      onClose={onClose}
      title={manifest.name}
    >
      <div className="plugin-modal-body" style={{ padding: 0 }}>
        {/* ── Hero Header ── */}
        <div className="plugin-modal-hero" style={{ padding: '0 0 24px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div className="plugin-modal-icon-wrapper">
            <span className="plugin-modal-icon">{manifest.icon || '📦'}</span>
          </div>
          <p className="plugin-modal-desc">{description}</p>

          {/* Status + Toggle */}
          <div className="plugin-modal-status-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
            <span className={`plugin-modal-status-pill ${enabled ? 'active' : 'inactive'}`}>
              <span className="plugin-status-dot" />
              {enabled ? t('pluginMonitor.statusActive') : t('pluginMonitor.statusDisabled')}
            </span>
            <label className="pref-switch" title={enabled ? t('pluginMonitor.disablePlugin') : t('pluginMonitor.enablePlugin')}>
              <input type="checkbox" checked={enabled} onChange={onToggle} />
              <span className="pref-switch-slider" />
            </label>
          </div>
        </div>

        {/* ── Info Grid ── */}
        <div style={{ marginTop: '24px' }}>
          <div className="plugin-modal-info-grid">
            {infoItems.map((item) => (
              <div key={item.label} className="plugin-info-card">
                <span className="plugin-info-card-label">{item.label}</span>
                <span className="plugin-info-card-value">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Hooks */}
          {hooks.length > 0 && (
            <div className="plugin-modal-section">
              <h4>{t('pluginMonitor.registeredHooks')}</h4>
              <div className="plugin-modal-hooks">
                {hooks.map((hook: string) => (
                  <span key={hook} className="plugin-hook-chip">{hook}</span>
                ))}
              </div>
            </div>
          )}

          {/* Screens */}
          {(screens.length > 0 || adminScreens.length > 0) && (
            <div className="plugin-modal-section">
              <h4>{t('pluginMonitor.uiScreens')}</h4>
              <div className="plugin-modal-screens">
                {screens.map((s: any) => (
                  <div key={s.id} className="plugin-screen-item">
                    <Monitor size={14} />
                    <span>{s.title}</span>
                    <span className="plugin-screen-placement">{s.placement}</span>
                  </div>
                ))}
                {adminScreens.map((s: any) => (
                  <div key={s.id} className="plugin-screen-item">
                    <Settings size={14} />
                    <span>{s.title}</span>
                    <span className="plugin-screen-placement">admin</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plugin ID (subtle) */}
          <div className="plugin-modal-id" style={{ marginTop: '24px' }}>
            <code>{manifest.id}</code>
          </div>
        </div>
      </div>
    </LiquidModal>
  );
}
