import React from 'react';
import { useTranslation } from 'react-i18next';
import { Puzzle } from 'lucide-react';
import './AdminSidebar.css';

interface TabEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
  isPlugin: boolean;
  pluginSlug?: string;
}

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onClose: () => void;
  tabs: TabEntry[];
  loading: boolean;
}

export function AdminSidebar({ activeTab, onTabChange, onClose, tabs, loading }: AdminSidebarProps) {
  const { t } = useTranslation();
  const coreTabs = tabs.filter((tab) => !tab.isPlugin);
  const pluginTabs = tabs.filter((tab) => tab.isPlugin);

  return (
    <div className="admin-sidebar-container">
      <div className="admin-sidebar-header" data-tauri-drag-region>
        <h2 data-tauri-drag-region>Admin</h2>
      </div>

      <nav className="admin-sidebar-nav">
        {loading ? (
          <div className="admin-nav-loading">{t('adminSidebar.loading')}</div>
        ) : (
          <>
            {/* Core admin tabs */}
            {coreTabs.map((tab) => (
              <button
                key={tab.id}
                className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}

            {/* Plugin tabs section */}
            {pluginTabs.length > 0 && (
              <>
                <div className="admin-nav-divider" />
                <div className="admin-nav-section-label">
                  <Puzzle size={12} />
                  <span>Plugins</span>
                </div>
                {pluginTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </nav>

      <div className="admin-sidebar-bottom">
        <button className="admin-back-btn" onClick={onClose}>
          ← {t('adminSidebar.backToChat')}
        </button>
      </div>
    </div>
  );
}
