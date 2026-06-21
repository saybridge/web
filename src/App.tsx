import React, { useEffect, useState, useRef } from 'react';
import { LazyMotion, domMax } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuthStore } from './stores/useAuthStore';
import { useChatStore, Room } from './stores/useChatStore';
import { usePluginStore } from './stores/usePluginStore';
import { fetchCurrentUser, login, register, verify2FA } from './services/auth';
import { initWebSocket, disconnectWebSocket } from './services/websocket';
import { api } from './services/api';
import { ResizableLayout } from './components/layout/ResizableLayout/ResizableLayout';
import { RoomList, ViewMode } from './components/rooms/RoomList/RoomList';
import { ChatPanel } from './components/chat/ChatPanel/ChatPanel';
import { DetailPanel } from './components/detail/DetailPanel/DetailPanel';
import { ThreadPanel } from './components/chat/ThreadPanel/ThreadPanel';
import { CreateRoomDialog } from './components/rooms/CreateRoomDialog/CreateRoomDialog';
import { StartDMDialog } from './components/rooms/StartDMDialog/StartDMDialog';
import { AdminContent, useAdminTabs } from './components/admin/AdminPanel/AdminPanel';
import { AdminSidebar } from './components/admin/AdminSidebar/AdminSidebar';
import { AccountSettings } from './components/settings/AccountSettings/AccountSettings';
import { SettingsSidebar } from './components/settings/SettingsSidebar/SettingsSidebar';
import type { SettingsSectionId } from './components/settings/SettingsSidebar/SettingsSidebar';
import { requestNotificationPermission } from './services/notifications';
import { useUrlSync, navigateToAdmin, navigateToChat, navigateToDrive, navigateTo, parseUrl } from './hooks/useUrlSync';
import { DriveSidebar } from './components/drive/DriveSidebar/DriveSidebar';
import { DriveContent } from './components/drive/DriveContent/DriveContent';
import { SetupWizard } from './components/setup/SetupWizard/SetupWizard';
import { useThemeStore } from './stores/useThemeStore';
import { usePreferencesStore } from './stores/usePreferencesStore';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, error, tempToken, user, setError } = useAuthStore();
  const { setRooms, activeThreadParentId, setActiveThreadParentId } = useChatStore();

  // Setup wizard state
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null); // null = checking

  // Authentication View states
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Main UI states
  const [showDetail, setShowDetail] = useState(false);
  const openPanelRef = useRef<((panel: 'pinned' | 'starred' | 'files' | 'banned') => void) | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStartDM, setShowStartDM] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  // Settings section state (lifted from AccountSettings)
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('profile');

  // Admin tabs hook
  const adminTabs = useAdminTabs();

  // Drive tab state
  const initialDriveTab = (parseUrl().view === 'drive' ? parseUrl().adminTab : 'my') as 'my' | 'shared' | 'recent' | 'all';
  const [driveTab, setDriveTab] = useState<'my' | 'shared' | 'recent' | 'all'>(initialDriveTab);

  const handleDriveTabChange = (tabId: string) => {
    setDriveTab(tabId as any);
    navigateToDrive(tabId);
  };

  useUrlSync(viewMode, setViewMode, adminTabs.activeTab, adminTabs.setActiveTab, driveTab, (tab: string) => setDriveTab(tab as any));

  // 0. Initialize theme from localStorage / system preference
  const initTheme = useThemeStore((s) => s.initTheme);
  useEffect(() => { initTheme(); }, [initTheme]);

  // 0a. Initialize preferences (apply from localStorage immediately)
  const applyPrefsToDOM = usePreferencesStore((s) => s.applyToDOM);
  useEffect(() => { applyPrefsToDOM(); }, []);

  // 0b. Fetch plugin manifests after auth
  const fetchPlugins = usePluginStore((s) => s.fetchPlugins);
  const fetchPreferences = usePreferencesStore((s) => s.fetchPreferences);

  // 1. Check if workspace needs initial setup
  useEffect(() => {
    fetch('/api/v1/system/setup-check')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setNeedsSetup(!res.data.setup_completed);
        } else {
          setNeedsSetup(false);
        }
      })
      .catch(() => setNeedsSetup(false));
  }, []);

  // 1. Check existing session on load
  useEffect(() => {
    if (needsSetup === false) {
      fetchCurrentUser();
    }
    requestNotificationPermission();

    if (typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined) {
      document.documentElement.classList.add('is-tauri');
      const isMac = navigator.userAgent.toLowerCase().includes('mac');
      if (isMac) {
        document.documentElement.classList.add('is-mac');
      }
    }

    const handleAuthFailed = () => {
      disconnectWebSocket();
    };

    window.addEventListener('saybridge_auth_failed', handleAuthFailed);
    return () => {
      window.removeEventListener('saybridge_auth_failed', handleAuthFailed);
    };
  }, [needsSetup]);

  // 2. Fetch rooms list, plugins & init WebSockets on login
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch plugin manifests now that we have auth token
    fetchPlugins();

    // Fetch user preferences from server
    fetchPreferences();

    const loadRooms = async () => {
      try {
        const res = await api.get('/rooms');
        if (res.data && res.data.success) {
          const rawRooms = res.data.data || [];
          const mapped: Room[] = rawRooms.map((r: any) => ({
            id: r.id,
            name: r.name,
            slug: r.slug || '',
            type: r.type === 'group' ? 'private' : r.type === 'direct' ? 'dm' : 'public',
            unread_count: r.unread_count || 0,
            created_at: r.created_at,
            is_read_only: r.is_read_only || false,
            created_by: r.created_by,
            members: r.members || [],
          }));
          setRooms(mapped);

          // Connect real-time WS connection
          initWebSocket();
        }
      } catch (err) {
        console.error('Failed to load rooms list', err);
      }
    };

    loadRooms();

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated]);

  // View mode switcher
  const handleSwitchView = (mode: ViewMode) => {
    if (mode === 'admin') {
      navigateToAdmin();
    } else if (mode === 'drive') {
      navigateToDrive(driveTab);
    } else if ((viewMode === 'admin' || viewMode === 'drive') && mode === 'chat') {
      navigateToChat();
    }
    // Reset settings section when switching away
    if (mode !== 'settings') {
      setSettingsSection('profile');
    }
    setViewMode(mode);
  };

  // Auth Action handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      // Error handled by store
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(username, email, password, displayName);
    } catch (err) {
      // Error handled by store
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    try {
      await verify2FA(tempToken, totpCode);
    } catch (err) {
      // Error handled by store
    }
  };

  // Setup Wizard — first-time initialization
  if (needsSetup === null) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ alignItems: 'center' }}>
          <h3 className="auth-title">{t('auth.system_checking')}</h3>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupWizard onComplete={() => setNeedsSetup(false)} />;
  }

  if (isLoading && !isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ alignItems: 'center' }}>
          <h3 className="auth-title">{t('auth.connecting')}</h3>
        </div>
      </div>
    );
  }

  // Render Authentication Forms
  if (!isAuthenticated) {
    const renderAuthCard = () => {
      // 2FA verification screen
      if (tempToken) {
        return (
          <div className="auth-card">
            <div className="auth-header">
              <h2 className="auth-title">{t('auth.two_fa_title')}</h2>
              <p className="auth-subtitle">{t('auth.two_fa_subtitle')}</p>
            </div>
            {error && <div className="error-alert">{error}</div>}
            <form onSubmit={handle2FASubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">{t('auth.two_fa_label')}</label>
                <div className="input-icon-wrapper">
                  <input
                    type="text"
                    maxLength={6}
                    className="form-input"
                    placeholder={t('auth.two_fa_placeholder')}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    style={{ textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
                  />
                  <Shield size={16} className="input-icon-left" />
                </div>
              </div>
              <button type="submit" className="auth-btn">{t('auth.two_fa_submit')}</button>
              <button type="button" className="auth-toggle-link" style={{ marginTop: 12 }} onClick={() => useAuthStore.getState().setTempToken(null)}>
                {t('auth.two_fa_back')}
              </button>
            </form>
          </div>
        );
      }

      // Register screen
      if (isRegister) {
        return (
          <div className="auth-card">
            <div className="auth-header">
              <h2 className="auth-title">{t('auth.register_title')}</h2>
              <p className="auth-subtitle">{t('auth.register_subtitle')}</p>
            </div>
            {error && <div className="error-alert">{error}</div>}
            <form onSubmit={handleRegisterSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">{t('auth.display_name')}</label>
                <div className="input-icon-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('auth.display_name_placeholder')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                  <User size={16} className="input-icon-left" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth.username')}</label>
                <div className="input-icon-wrapper">
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('auth.username_placeholder')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <User size={16} className="input-icon-left" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth.email')}</label>
                <div className="input-icon-wrapper">
                  <input
                    type="email"
                    className="form-input"
                    placeholder={t('auth.email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Mail size={16} className="input-icon-left" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth.password')}</label>
                <div className="input-icon-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-input"
                    placeholder={t('auth.password_placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Lock size={16} className="input-icon-left" />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="auth-btn">{t('auth.submit_register')}</button>
              <div className="auth-toggle">
                {t('auth.have_account')}
                <button type="button" className="auth-toggle-link" onClick={() => { setIsRegister(false); setError(null); }}>
                  {t('auth.login_now')}
                </button>
              </div>
            </form>
          </div>
        );
      }

      // Login screen (Default)
      return (
        <div className="auth-card">
          <div className="auth-header">
            <h2 className="auth-title">{t('auth.login_title')}</h2>
            <p className="auth-subtitle">{t('auth.login_subtitle')}</p>
          </div>
          {error && <div className="error-alert">{error}</div>}
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <div className="input-icon-wrapper">
                <input
                  type="email"
                  className="form-input"
                  placeholder={t('auth.email_placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Mail size={16} className="input-icon-left" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('auth.password')}</label>
              <div className="input-icon-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder={t('auth.password_placeholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock size={16} className="input-icon-left" />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="auth-btn">{t('auth.submit_login')}</button>
            <div className="auth-toggle">
              {t('auth.no_account')}
              <button type="button" className="auth-toggle-link" onClick={() => { setIsRegister(true); setError(null); }}>
                {t('auth.register_now')}
              </button>
            </div>
          </form>
        </div>
      );
    };

    return (
      <div className="auth-split-wrapper">
        <div className="auth-brand-side">
          <div className="brand-glow-blob bg-blob-1" />
          <div className="brand-glow-blob bg-blob-2" />
          
          <div className="brand-content">
            <div className="brand-logo-container">
              <svg className="brand-logo-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="url(#brandGrad)" />
                <path d="M35 50 L45 60 L65 40" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <defs>
                  <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="brand-name">Saybridge</h1>
            <p className="brand-tagline">{t('auth.tagline')}</p>
            
            <div className="brand-features">
              <div className="brand-feature-item">
                <span className="feature-icon">✨</span>
                <div>
                  <h4>{t('auth.smooth_experience_title')}</h4>
                  <p>{t('auth.smooth_experience_desc')}</p>
                </div>
              </div>
              <div className="brand-feature-item">
                <span className="feature-icon">⚡</span>
                <div>
                  <h4>{t('auth.sdui_title')}</h4>
                  <p>{t('auth.sdui_desc')}</p>
                </div>
              </div>
              <div className="brand-feature-item">
                <span className="feature-icon">🔒</span>
                <div>
                  <h4>{t('auth.security_title')}</h4>
                  <p>{t('auth.security_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="auth-form-side">
          {renderAuthCard()}
        </div>
      </div>
    );
  }

  // Determine secondary panel and main content based on viewMode
  const isOverrideMode = viewMode !== 'chat';

  const secondaryPanel = viewMode === 'admin' ? (
    <AdminSidebar
      activeTab={adminTabs.activeTab}
      onTabChange={adminTabs.setActiveTab}
      onClose={() => handleSwitchView('chat')}
      tabs={adminTabs.allTabs}
      loading={adminTabs.loading}
    />
  ) : viewMode === 'drive' ? (
    <DriveSidebar
      activeTab={driveTab}
      onTabChange={handleDriveTabChange}
      onClose={() => handleSwitchView('chat')}
    />
  ) : viewMode === 'settings' ? (
    <SettingsSidebar
      activeSection={settingsSection}
      onSectionChange={setSettingsSection}
      onClose={() => handleSwitchView('chat')}
    />
  ) : undefined;

  const mainContent = viewMode === 'admin' ? (
    <AdminContent
      activeTab={adminTabs.activeTab}
      allTabs={adminTabs.allTabs}
      allManifests={adminTabs.allManifests}
      onNavigate={adminTabs.setActiveTab}
    />
  ) : viewMode === 'drive' ? (
    <DriveContent
      activeTab={driveTab}
      onNavigate={handleSwitchView}
    />
  ) : viewMode === 'settings' ? (
    <AccountSettings
      onClose={() => handleSwitchView('chat')}
      activeSection={settingsSection}
    />
  ) : undefined;

  // Main Authenticated Workspace Layout
  return (
    <LazyMotion features={domMax} strict>
      <ResizableLayout
        roomList={
          <RoomList
            onOpenCreateRoom={() => setShowCreateDialog(true)}
            onOpenStartDM={() => setShowStartDM(true)}
            viewMode={viewMode}
            onSwitchView={handleSwitchView}
            showAdminLink={user?.system_role === 'admin'}
          />
        }
        chatPanel={
          <ChatPanel
            onToggleDetail={() => {
              if (activeThreadParentId) {
                setActiveThreadParentId(null);
              } else {
                setShowDetail(!showDetail);
              }
            }}
            onOpenThread={(msg) => {
              setActiveThreadParentId(msg.id);
              setShowDetail(true);
            }}
            openPanelRef={openPanelRef}
          />
        }
        detailPanel={
          activeThreadParentId ? (
            <ThreadPanel onClose={() => {
              setActiveThreadParentId(null);
              setShowDetail(false);
            }} />
          ) : (
            <DetailPanel
              onClose={() => setShowDetail(false)}
              onOpenPanel={(panel) => {
                setShowDetail(false);
                openPanelRef.current?.(panel);
              }}
            />
          )
        }
        showDetail={showDetail}
        secondaryPanel={isOverrideMode ? secondaryPanel : undefined}
        mainContent={isOverrideMode ? mainContent : undefined}
      />

      {showCreateDialog && (
        <CreateRoomDialog onClose={() => setShowCreateDialog(false)} />
      )}

      {showStartDM && (
        <StartDMDialog onClose={() => setShowStartDM(false)} />
      )}
    </LazyMotion>
  );
}
