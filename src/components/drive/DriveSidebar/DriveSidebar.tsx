import React from 'react';
import { Folder, Users, Clock, Database, ArrowLeft, HardDrive } from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useTranslation } from 'react-i18next';
import './DriveSidebar.css';

interface DriveSidebarProps {
  activeTab: 'my' | 'shared' | 'recent' | 'all';
  onTabChange: (tabId: string) => void;
  onClose: () => void;
}

export function DriveSidebar({ activeTab, onTabChange, onClose }: DriveSidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.system_role === 'admin';

  const menuItems = [
    { id: 'my', label: t('drive.tab_my', 'My Files'), icon: <Folder size={18} /> },
    { id: 'shared', label: t('drive.tab_shared', 'Shared'), icon: <Users size={18} /> },
    { id: 'recent', label: t('drive.tab_recent', 'Recent'), icon: <Clock size={18} /> },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'all', label: t('drive.tab_all', 'System (Workspace)'), icon: <Database size={18} /> });
  }

  return (
    <div className="drive-sidebar-container">
      <div className="drive-sidebar-header" data-tauri-drag-region>
        <h2 data-tauri-drag-region>{t('drive.sidebar_title', 'Saybridge Drive')}</h2>
      </div>

      <nav className="drive-sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`drive-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="drive-sidebar-bottom">
        <button className="drive-back-btn" onClick={onClose}>
          <ArrowLeft size={16} />
          <span>{t('drive.back_to_chat', 'Back to Chat')}</span>
        </button>
      </div>
    </div>
  );
}
