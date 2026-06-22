import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, ChevronDown, Save, RotateCcw, Check, Image } from 'lucide-react';
import { PageContainer } from '@saybridge/ui';
import './SystemSettings.css';

/* ============ Types ============ */
interface WorkspaceSettings {
  workspaceName: string;
  workspaceUrl: string;
  logoUrl: string;
}

interface SmtpSettings {
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  smtpEnabled: boolean;
}

interface StorageSettings {
  storageProvider: 'local' | 's3' | 'minio';
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
  maxFileSizeMb: number;
}

interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  desktopEnabled: boolean;
}

interface SecuritySettings {
  require2fa: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  allowRegistration: boolean;
}

interface AllSettings {
  workspace: WorkspaceSettings;
  smtp: SmtpSettings;
  storage: StorageSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
}

const STORAGE_KEY = 'saybridge_system_settings';

const DEFAULT_SETTINGS: AllSettings = {
  workspace: {
    workspaceName: 'Saybridge Workspace',
    workspaceUrl: window.location.origin,
    logoUrl: '',
  },
  smtp: {
    smtpHost: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: 'Saybridge',
    smtpEnabled: false,
  },
  storage: {
    storageProvider: 'local',
    s3Bucket: '',
    s3Region: 'us-east-1',
    s3AccessKey: '',
    s3SecretKey: '',
    maxFileSizeMb: 50,
  },
  notifications: {
    pushEnabled: true,
    emailEnabled: true,
    desktopEnabled: true,
  },
  security: {
    require2fa: false,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    allowRegistration: true,
  },
};

function loadSettings(): AllSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        workspace: { ...DEFAULT_SETTINGS.workspace, ...parsed.workspace },
        smtp: { ...DEFAULT_SETTINGS.smtp, ...parsed.smtp },
        storage: { ...DEFAULT_SETTINGS.storage, ...parsed.storage },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
        security: { ...DEFAULT_SETTINGS.security, ...parsed.security },
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

/* ============ Component ============ */
export function SystemSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AllSettings>(loadSettings);
  const [savedSettings, setSavedSettings] = useState<AllSettings>(loadSettings);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['workspace']));
  const [showToast, setShowToast] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const updateWorkspace = useCallback((key: keyof WorkspaceSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      workspace: { ...prev.workspace, [key]: value },
    }));
  }, []);

  const updateSmtp = useCallback((key: keyof SmtpSettings, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      smtp: { ...prev.smtp, [key]: value },
    }));
  }, []);

  const updateStorage = useCallback((key: keyof StorageSettings, value: string | number) => {
    setSettings((prev) => ({
      ...prev,
      storage: { ...prev.storage, [key]: value },
    }));
  }, []);

  const updateNotifications = useCallback((key: keyof NotificationSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  }, []);

  const updateSecurity = useCallback((key: keyof SecuritySettings, value: boolean | number) => {
    setSettings((prev) => ({
      ...prev,
      security: { ...prev.security, [key]: value },
    }));
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    // Simulate a small delay for UX
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSavedSettings({ ...settings });
      setSaving(false);
      setShowToast(true);
    }, 400);
  }, [settings]);

  const handleReset = useCallback(() => {
    setSettings({ ...savedSettings });
  }, [savedSettings]);

  // Toast auto-dismiss
  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  return (
    <PageContainer
      title={t('systemSettings.title')}
      subtitle={t('systemSettings.subtitle')}
      icon={<Settings size={24} />}
      actions={
        <div className="ss-header-actions">
          {isDirty && (
            <button className="sb-btn sb-btn-ghost ss-reset-btn" onClick={handleReset}>
              <RotateCcw size={14} />
              {t('systemSettings.undo')}
            </button>
          )}
          <button
            className={`sb-btn sb-btn-primary ss-save-btn ${saving ? 'saving' : ''}`}
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {saving ? (
              <>{t('systemSettings.saving')}</>
            ) : (
              <>
                <Save size={15} />
                {t('systemSettings.saveChanges')}
                {isDirty && <span className="ss-dirty-dot" />}
              </>
            )}
          </button>
        </div>
      }
    >

      {/* Sections */}
      <div className="ss-sections">
        {/* ======== 1. Workspace Info ======== */}
        <div className={`ss-section ${openSections.has('workspace') ? 'is-open' : ''}`}>
          <div className="ss-section-header" onClick={() => toggleSection('workspace')}>
            <div className="ss-section-header-left">
              <div className="ss-section-icon workspace">🏢</div>
              <div className="ss-section-title">
                <h3>{t('systemSettings.workspaceInfoTitle')}</h3>
                <p>{t('systemSettings.workspaceInfoDesc')}</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-form-grid">
              <div className="ss-field">
                <label>{t('systemSettings.workspaceNameLabel')}</label>
                <input
                  type="text"
                  value={settings.workspace.workspaceName}
                  onChange={(e) => updateWorkspace('workspaceName', e.target.value)}
                  placeholder={t('systemSettings.workspaceNamePlaceholder')}
                />
              </div>
              <div className="ss-field">
                <label>{t('systemSettings.workspaceUrlLabel')}</label>
                <input
                  type="text"
                  value={settings.workspace.workspaceUrl}
                  readOnly
                />
                <span className="ss-field-hint">{t('systemSettings.workspaceUrlHint')}</span>
              </div>
              <div className="ss-field full-width">
                <label>{t('systemSettings.logoUrlLabel')}</label>
                <input
                  type="text"
                  value={settings.workspace.logoUrl}
                  onChange={(e) => updateWorkspace('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="ss-logo-preview">
                {settings.workspace.logoUrl ? (
                  <img
                    className="ss-logo-preview-img"
                    src={settings.workspace.logoUrl}
                    alt="Logo preview"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : (
                  <div className="ss-logo-preview-placeholder">
                    <Image size={22} />
                  </div>
                )}
                <span className="ss-logo-preview-text">
                  {settings.workspace.logoUrl
                    ? t('systemSettings.logoPreviewActive')
                    : t('systemSettings.logoPreviewEmpty')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======== 2. Email & SMTP ======== */}
        <div className={`ss-section ${openSections.has('smtp') ? 'is-open' : ''}`}>
          <div className="ss-section-header" onClick={() => toggleSection('smtp')}>
            <div className="ss-section-header-left">
              <div className="ss-section-icon email">📧</div>
              <div className="ss-section-title">
                <h3>{t('systemSettings.smtpTitle')}</h3>
                <p>{t('systemSettings.smtpDesc')}</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">{t('systemSettings.smtpEnableLabel')}</span>
                <span className="ss-toggle-desc">{t('systemSettings.smtpEnableDesc')}</span>
              </div>
              <label className="ss-toggle">
                <input
                  type="checkbox"
                  checked={settings.smtp.smtpEnabled}
                  onChange={(e) => updateSmtp('smtpEnabled', e.target.checked)}
                />
                <span className="ss-toggle-slider" />
              </label>
            </div>
            <hr className="ss-divider" />
            <div className="ss-form-grid">
              <div className="ss-field">
                <label>SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtp.smtpHost}
                  onChange={(e) => updateSmtp('smtpHost', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="ss-field">
                <label>SMTP Port</label>
                <input
                  type="text"
                  value={settings.smtp.smtpPort}
                  onChange={(e) => updateSmtp('smtpPort', e.target.value)}
                  placeholder="587"
                />
              </div>
              <div className="ss-field">
                <label>{t('systemSettings.smtpUsernameLabel')}</label>
                <input
                  type="text"
                  value={settings.smtp.smtpUsername}
                  onChange={(e) => updateSmtp('smtpUsername', e.target.value)}
                  placeholder="user@gmail.com"
                />
              </div>
              <div className="ss-field">
                <label>{t('systemSettings.smtpPasswordLabel')}</label>
                <input
                  type="password"
                  value={settings.smtp.smtpPassword}
                  onChange={(e) => updateSmtp('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="ss-field">
                <label>{t('systemSettings.fromEmailLabel')}</label>
                <input
                  type="email"
                  value={settings.smtp.fromEmail}
                  onChange={(e) => updateSmtp('fromEmail', e.target.value)}
                  placeholder="noreply@saybridge.io"
                />
              </div>
              <div className="ss-field">
                <label>{t('systemSettings.fromNameLabel')}</label>
                <input
                  type="text"
                  value={settings.smtp.fromName}
                  onChange={(e) => updateSmtp('fromName', e.target.value)}
                  placeholder="Saybridge"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ======== 3. File Storage ======== */}
        <div className={`ss-section ${openSections.has('storage') ? 'is-open' : ''}`}>
          <div className="ss-section-header" onClick={() => toggleSection('storage')}>
            <div className="ss-section-header-left">
              <div className="ss-section-icon storage">💾</div>
              <div className="ss-section-title">
                <h3>{t('systemSettings.storageTitle')}</h3>
                <p>{t('systemSettings.storageDesc')}</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-form-grid">
              <div className="ss-field full-width">
                <label>{t('systemSettings.storageProviderLabel')}</label>
                <select
                  value={settings.storage.storageProvider}
                  onChange={(e) =>
                    updateStorage('storageProvider', e.target.value as StorageSettings['storageProvider'])
                  }
                >
                  <option value="local">{t('systemSettings.storageProviderLocal')}</option>
                  <option value="s3">Amazon S3</option>
                  <option value="minio">MinIO</option>
                </select>
              </div>

              {(settings.storage.storageProvider === 's3' ||
                settings.storage.storageProvider === 'minio') && (
                <>
                  <div className="ss-field">
                    <label>S3 Bucket</label>
                    <input
                      type="text"
                      value={settings.storage.s3Bucket}
                      onChange={(e) => updateStorage('s3Bucket', e.target.value)}
                      placeholder="saybridge-uploads"
                    />
                  </div>
                  <div className="ss-field">
                    <label>Region</label>
                    <input
                      type="text"
                      value={settings.storage.s3Region}
                      onChange={(e) => updateStorage('s3Region', e.target.value)}
                      placeholder="us-east-1"
                    />
                  </div>
                  <div className="ss-field">
                    <label>Access Key</label>
                    <input
                      type="text"
                      value={settings.storage.s3AccessKey}
                      onChange={(e) => updateStorage('s3AccessKey', e.target.value)}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                    />
                  </div>
                  <div className="ss-field">
                    <label>Secret Key</label>
                    <input
                      type="password"
                      value={settings.storage.s3SecretKey}
                      onChange={(e) => updateStorage('s3SecretKey', e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </>
              )}

              <div className="ss-slider-field">
                <div className="ss-slider-header">
                  <label>{t('systemSettings.maxFileSizeLabel')}</label>
                  <span className="ss-slider-value">{settings.storage.maxFileSizeMb} MB</span>
                </div>
                <input
                  type="range"
                  className="ss-slider-track"
                  min={1}
                  max={500}
                  step={1}
                  value={settings.storage.maxFileSizeMb}
                  onChange={(e) => updateStorage('maxFileSizeMb', Number(e.target.value))}
                />
                <div className="ss-slider-labels">
                  <span>1 MB</span>
                  <span>100 MB</span>
                  <span>250 MB</span>
                  <span>500 MB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======== 4. Notifications ======== */}
        <div className={`ss-section ${openSections.has('notifications') ? 'is-open' : ''}`}>
          <div className="ss-section-header" onClick={() => toggleSection('notifications')}>
            <div className="ss-section-header-left">
              <div className="ss-section-icon notifications">🔔</div>
              <div className="ss-section-title">
                <h3>{t('systemSettings.notificationsTitle')}</h3>
                <p>{t('systemSettings.notificationsDesc')}</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">{t('systemSettings.pushNotifLabel')}</span>
                <span className="ss-toggle-desc">{t('systemSettings.pushNotifDesc')}</span>
              </div>
              <label className="ss-toggle">
                <input
                  type="checkbox"
                  checked={settings.notifications.pushEnabled}
                  onChange={(e) => updateNotifications('pushEnabled', e.target.checked)}
                />
                <span className="ss-toggle-slider" />
              </label>
            </div>
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">{t('systemSettings.emailNotifLabel')}</span>
                <span className="ss-toggle-desc">{t('systemSettings.emailNotifDesc')}</span>
              </div>
              <label className="ss-toggle">
                <input
                  type="checkbox"
                  checked={settings.notifications.emailEnabled}
                  onChange={(e) => updateNotifications('emailEnabled', e.target.checked)}
                />
                <span className="ss-toggle-slider" />
              </label>
            </div>
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">{t('systemSettings.desktopNotifLabel')}</span>
                <span className="ss-toggle-desc">{t('systemSettings.desktopNotifDesc')}</span>
              </div>
              <label className="ss-toggle">
                <input
                  type="checkbox"
                  checked={settings.notifications.desktopEnabled}
                  onChange={(e) => updateNotifications('desktopEnabled', e.target.checked)}
                />
                <span className="ss-toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* ======== 5. Security ======== */}
        <div className={`ss-section ${openSections.has('security') ? 'is-open' : ''}`}>
          <div className="ss-section-header" onClick={() => toggleSection('security')}>
            <div className="ss-section-header-left">
              <div className="ss-section-icon security">🔒</div>
              <div className="ss-section-title">
                <h3>{t('systemSettings.securityTitle')}</h3>
                <p>{t('systemSettings.securityDesc')}</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">{t('systemSettings.require2faLabel')}</span>
                <span className="ss-toggle-desc">{t('systemSettings.require2faDesc')}</span>
              </div>
              <label className="ss-toggle">
                <input
                  type="checkbox"
                  checked={settings.security.require2fa}
                  onChange={(e) => updateSecurity('require2fa', e.target.checked)}
                />
                <span className="ss-toggle-slider" />
              </label>
            </div>
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">{t('systemSettings.allowRegistrationLabel')}</span>
                <span className="ss-toggle-desc">{t('systemSettings.allowRegistrationDesc')}</span>
              </div>
              <label className="ss-toggle">
                <input
                  type="checkbox"
                  checked={settings.security.allowRegistration}
                  onChange={(e) => updateSecurity('allowRegistration', e.target.checked)}
                />
                <span className="ss-toggle-slider" />
              </label>
            </div>
            <hr className="ss-divider" />
            <div className="ss-form-grid">
              <div className="ss-field">
                <label>{t('systemSettings.sessionTimeoutLabel')}</label>
                <input
                  type="number"
                  value={settings.security.sessionTimeoutMinutes}
                  onChange={(e) =>
                    updateSecurity('sessionTimeoutMinutes', Math.max(1, Number(e.target.value)))
                  }
                  min={1}
                  max={10080}
                  placeholder="60"
                />
                <span className="ss-field-hint">{t('systemSettings.sessionTimeoutHint')}</span>
              </div>
              <div className="ss-field">
                <label>{t('systemSettings.maxLoginAttemptsLabel')}</label>
                <input
                  type="number"
                  value={settings.security.maxLoginAttempts}
                  onChange={(e) =>
                    updateSecurity('maxLoginAttempts', Math.max(1, Number(e.target.value)))
                  }
                  min={1}
                  max={100}
                  placeholder="5"
                />
                <span className="ss-field-hint">{t('systemSettings.maxLoginAttemptsHint')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="ss-toast">
          <Check size={16} />
          {t('systemSettings.saveSuccessToast')}
        </div>
      )}
    </PageContainer>
  );
}
