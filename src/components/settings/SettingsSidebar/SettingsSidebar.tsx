import React from 'react';
import { User, Palette, Bell, Shield, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './SettingsSidebar.css';

export type SettingsSectionId = 'profile' | 'preferences' | 'notifications' | 'security' | 'sessions';

interface NavItem {
  id: SettingsSectionId;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', icon: <User size={18} /> },
  { id: 'preferences', icon: <Palette size={18} /> },
  { id: 'notifications', icon: <Bell size={18} /> },
  { id: 'security', icon: <Shield size={18} /> },
  { id: 'sessions', icon: <Monitor size={18} /> },
];

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  onClose: () => void;
}

export function SettingsSidebar({ activeSection, onSectionChange, onClose }: SettingsSidebarProps) {
  const { t } = useTranslation();

  const getNavLabel = (id: SettingsSectionId) => {
    switch (id) {
      case 'profile': return t('settings.profile');
      case 'preferences': return t('settings.preferences');
      case 'notifications': return t('settings.notifications');
      case 'security': return t('settings.security');
      case 'sessions': return t('settings.sessions');
      default: return '';
    }
  };

  return (
    <div className="settings-sidebar-container">
      <div className="settings-sidebar-header" data-tauri-drag-region>
        <h2 data-tauri-drag-region>{t('common.settings')}</h2>
      </div>

      <nav className="settings-sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => onSectionChange(item.id)}
          >
            {item.icon}
            <span>{getNavLabel(item.id)}</span>
          </button>
        ))}
      </nav>

      <div className="settings-sidebar-bottom">
        <button className="settings-back-btn" onClick={onClose}>
          ← {t('settings.back_to_chat', 'Quay lại Chat')}
        </button>
      </div>
    </div>
  );
}
