import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WebDynamicScreen } from '../../../engine/WebDynamicScreen';
import type { UIManifest, UIScreen } from '../../../engine/types';
import { X, Users, Settings, Activity, Package, Code2, Zap, BarChart3, ClipboardList, Globe, Plug, Brain } from 'lucide-react';
import { PageContainer } from '@saybridge/ui';
import { AppPlayground } from '../AppPlayground/AppPlayground';
import { AnalyticsDashboard } from '../AnalyticsDashboard/AnalyticsDashboard';
import { AuditLogViewer } from '../AuditLogViewer/AuditLogViewer';
import { FederationPanel } from '../FederationPanel/FederationPanel';
import { PluginMonitor } from '../PluginMonitor/PluginMonitor';
import { SystemSettings } from '../SystemSettings/SystemSettings';
import { UserManagement } from '../UserManagement/UserManagement';
import { CopilotConfig } from '../CopilotConfig/CopilotConfig';
import { parseUrl, navigateToAdmin } from '../../../hooks/useUrlSync';
import { PluginIframe } from '../../common/PluginIframe/PluginIframe';
import { usePluginStore } from '../../../stores/usePluginStore';
import { api } from '../../../services/api';
import './AdminPanel.css';

export interface AdminTabEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
  isPlugin: boolean;
  pluginSlug?: string;
  render?: 'data_only' | 'sdui' | 'iframe' | 'component';
  sduiScreen?: string;
  iframeSrc?: string;
  screens?: UIScreen[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  store: <span style={{ fontSize: 18 }}>🏪</span>,
  shield: <span style={{ fontSize: 18 }}>🔒</span>,
  webhook: <span style={{ fontSize: 18 }}>🔗</span>,
  message: <span style={{ fontSize: 18 }}>💬</span>,
  smile: <span style={{ fontSize: 18 }}>😀</span>,
  database: <span style={{ fontSize: 18 }}>📦</span>,
  zap: <span style={{ fontSize: 18 }}>⚡</span>,
  sparkles: <span style={{ fontSize: 18 }}>✨</span>,
};

function getPluginIcon(iconName: string): React.ReactNode {
  return ICON_MAP[iconName] || <span style={{ fontSize: 18 }}>📌</span>;
}

/**
 * Hook to build admin tab list and manage active tab state.
 * Used by both AdminSidebar and AdminContent.
 */
export function useAdminTabs() {
  const { t } = useTranslation();
  const initialTab = parseUrl().adminTab || 'overview';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const _pluginsForReactivity = usePluginStore((s) => s.plugins);
  const storeLoaded = usePluginStore((s) => s.loaded);

  useEffect(() => {
    if (!storeLoaded) {
      usePluginStore.getState().fetchPlugins();
    }
  }, [storeLoaded]);

  const allManifests = useMemo<UIManifest[]>(
    () => _pluginsForReactivity as unknown as UIManifest[],
    [_pluginsForReactivity]
  );
  const loading = !storeLoaded && _pluginsForReactivity.length === 0;

  const adminManifests = useMemo(
    () =>
      allManifests
        .filter((m) => m.admin_menu)
        .sort((a, b) => (a.admin_menu!.priority || 99) - (b.admin_menu!.priority || 99)),
    [allManifests]
  );

  const allTabs = useMemo<AdminTabEntry[]>(() => {
    const coreTabs: AdminTabEntry[] = [
      { id: 'overview', label: t('adminPanel.tabOverview'), icon: <Activity size={18} />, isPlugin: false },
      { id: 'plugins', label: 'Plugins', icon: <Package size={18} />, isPlugin: false },
      { id: 'copilot', label: 'Copilot', icon: <Brain size={18} />, isPlugin: false },
    ];

    const pluginTabs: AdminTabEntry[] = [];

    adminManifests.forEach((m) => {
      if ((m as any).enabled === false) return;
      // Check if admin_screens use iframe_src
      const firstScreen = m.admin_screens?.[0];
      const iframeSrc = firstScreen?.iframe_src
        ? firstScreen.iframe_src.replace('{slug}', m.id)
        : undefined;
      pluginTabs.push({
        id: m.id,
        label: m.admin_menu!.label,
        icon: getPluginIcon(m.admin_menu!.icon),
        isPlugin: true,
        pluginSlug: m.id,
        render: iframeSrc ? 'iframe' : undefined,
        iframeSrc,
        screens: iframeSrc ? undefined : m.admin_screens,
      });
    });

    allManifests.forEach((m) => {
      if ((m as any).enabled === false) return;
      const adminPages = (m as any).ui_extensions?.admin_pages || [];
      adminPages.forEach((page: any) => {
        pluginTabs.push({
          id: page.id,
          label: page.label,
          icon: getPluginIcon(page.icon),
          isPlugin: true,
          pluginSlug: m.id,
          render: page.render,
          sduiScreen: page.sdui_screen,
          iframeSrc: page.iframe_src ? page.iframe_src.replace('{slug}', m.id) : undefined,
        });
      });
    });

    const endTabs: AdminTabEntry[] = [
      { id: 'federation', label: 'Federation', icon: <Globe size={18} />, isPlugin: false, pluginSlug: 'federation' },
      { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, isPlugin: false },
      { id: 'audit', label: 'Audit Log', icon: <ClipboardList size={18} />, isPlugin: false },
      { id: 'playground', label: 'App Playground', icon: <Code2 size={18} />, isPlugin: false, pluginSlug: 'ai-agent' },
      { id: 'users', label: t('adminPanel.tabUsers'), icon: <Users size={18} />, isPlugin: false },
      { id: 'settings', label: t('adminPanel.tabSettings'), icon: <Settings size={18} />, isPlugin: false },
    ];

    const isEnabled = usePluginStore.getState().isEnabled;
    const filteredEndTabs = endTabs.filter((tab) => !tab.pluginSlug || isEnabled(tab.pluginSlug));

    return [...coreTabs, ...pluginTabs, ...filteredEndTabs];
  }, [adminManifests, allManifests, _pluginsForReactivity, t]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    navigateToAdmin(tabId);
  };

  return { activeTab, setActiveTab: handleTabChange, allTabs, loading, allManifests };
}

/**
 * Admin content area — renders the active tab's content.
 * No overlay or sidebar — those are handled by the layout.
 */
interface AdminContentProps {
  activeTab: string;
  allTabs: AdminTabEntry[];
  allManifests: UIManifest[];
  onNavigate: (tab: string) => void;
}

export function AdminContent({ activeTab, allTabs, allManifests, onNavigate }: AdminContentProps) {
  const { t } = useTranslation();
  const activePluginTab = allTabs.find((tab) => tab.id === activeTab && tab.isPlugin);

  return (
    <div className="admin-content">
      {/* Core pages */}
      {activeTab === 'overview' && <AdminOverview pluginCount={allManifests.length} onNavigate={onNavigate} />}
      {activeTab === 'plugins' && <PluginMonitor />}
      {activeTab === 'copilot' && <CopilotConfig />}
      {activeTab === 'federation' && <FederationPanel />}
      {activeTab === 'analytics' && <AnalyticsDashboard />}
      {activeTab === 'audit' && <AuditLogViewer />}
      {activeTab === 'playground' && <AppPlayground />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'settings' && <SystemSettings />}

      {/* Plugin pages */}
      {activePluginTab && (
        activePluginTab.render === 'iframe' && activePluginTab.iframeSrc ? (
          <PluginIframe src={activePluginTab.iframeSrc} pluginSlug={activePluginTab.pluginSlug || activePluginTab.id} />
        ) : activePluginTab.render === 'sdui' && activePluginTab.sduiScreen ? (
          <AdminPlaceholder title={activePluginTab.label} description={`SDUI Screen: ${activePluginTab.sduiScreen}`} icon="⚡" />
        ) : activePluginTab.screens && activePluginTab.screens.length > 0 ? (
          <WebDynamicScreen screen={activePluginTab.screens[0]} />
        ) : (
          <AdminPlaceholder
            title={activePluginTab.label}
            description={t('adminPanel.pluginNoAdminUi')}
            icon="📌"
          />
        )
      )}
    </div>
  );
}


/* ===================== Admin Overview ===================== */
function AdminOverview({ pluginCount, onNavigate }: { pluginCount: number; onNavigate: (tab: string) => void }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{
    total_users: number;
    active_users: number;
    admin_count: number;
    total_rooms: number;
    total_storage_bytes?: number;
    max_storage_bytes?: number;
  } | null>(null);

  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => {
        if (res.data?.success) {
          setStats(res.data.data);
        }
      })
      .catch((e) => {
        console.error('Failed to fetch admin stats', e);
      });
  }, []);

  const formatStorage = (bytes?: number) => {
    if (bytes === undefined) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const storageLabel = stats && stats.total_storage_bytes !== undefined && stats.max_storage_bytes !== undefined
    ? `${formatStorage(stats.total_storage_bytes)} / ${formatStorage(stats.max_storage_bytes)}`
    : '—';

  const statCards = [
    { label: t('adminPanel.statUsers'), value: stats ? String(stats.total_users) : '—', icon: '👥', color: 'hsl(220 80% 60%)' },
    { label: t('adminPanel.statActiveChannels'), value: stats ? String(stats.total_rooms) : '—', icon: '💬', color: 'hsl(160 60% 50%)' },
    { label: t('adminPanel.statAdmins'), value: stats ? String(stats.admin_count) : '—', icon: '🛡️', color: 'hsl(280 60% 60%)' },
    { label: t('adminPanel.statStorage'), value: storageLabel, icon: '💾', color: 'hsl(340 70% 55%)' },
    { label: t('adminPanel.statRunningPlugins'), value: String(pluginCount), icon: '📦', color: 'hsl(30 80% 55%)' },
  ];

  return (
    <PageContainer
      title={t('adminPanel.overviewTitle')}
      subtitle={t('adminPanel.overviewSubtitle')}
      icon={<Activity size={24} />}
    >
      <div style={{ maxWidth: '960px' }}>
        <div className="admin-stats-grid">
          {statCards.map((stat) => (
            <div key={stat.label} className="admin-stat-card">
              <div className="stat-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
                {stat.icon}
              </div>
              <div className="stat-info">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-quick-actions">
          <h3>{t('adminPanel.quickActions')}</h3>
          <div className="quick-actions-grid">
            <button className="quick-action-btn" onClick={() => onNavigate('users')}>
              <span>📩</span> {t('adminPanel.manageUsers')}
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate('plugins')}>
              <span>📦</span> {t('adminPanel.managePlugins')}
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate('settings')}>
              <span>⚙️</span> {t('adminPanel.systemSettings')}
            </button>
            <button className="quick-action-btn" onClick={() => onNavigate('analytics')}>
              <span>📊</span> {t('adminPanel.viewAnalytics')}
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function AdminPlaceholder({ title, description, icon }: { title: string; description: string; icon: string }) {
  const { t } = useTranslation();
  return (
    <div className="admin-placeholder">
      <span className="admin-placeholder-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="admin-placeholder-badge">{t('adminPanel.inDevelopment')}</span>
    </div>
  );
}
