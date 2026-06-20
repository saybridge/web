import { useState, useEffect, useCallback } from 'react';
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
      title="Cài đặt hệ thống"
      subtitle="Quản lý cấu hình workspace, email, lưu trữ, thông báo và bảo mật"
      icon={<Settings size={24} />}
      actions={
        <div className="ss-header-actions">
          {isDirty && (
            <button className="sb-btn sb-btn-ghost ss-reset-btn" onClick={handleReset}>
              <RotateCcw size={14} />
              Hoàn tác
            </button>
          )}
          <button
            className={`sb-btn sb-btn-primary ss-save-btn ${saving ? 'saving' : ''}`}
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {saving ? (
              <>Đang lưu...</>
            ) : (
              <>
                <Save size={15} />
                Lưu thay đổi
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
                <h3>Thông tin Workspace</h3>
                <p>Tên, URL và logo của workspace</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-form-grid">
              <div className="ss-field">
                <label>Tên workspace</label>
                <input
                  type="text"
                  value={settings.workspace.workspaceName}
                  onChange={(e) => updateWorkspace('workspaceName', e.target.value)}
                  placeholder="Nhập tên workspace..."
                />
              </div>
              <div className="ss-field">
                <label>URL workspace</label>
                <input
                  type="text"
                  value={settings.workspace.workspaceUrl}
                  readOnly
                />
                <span className="ss-field-hint">Được xác định tự động từ trình duyệt</span>
              </div>
              <div className="ss-field full-width">
                <label>URL logo</label>
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
                    ? 'Xem trước logo workspace'
                    : 'Nhập URL để xem trước logo'}
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
                <h3>Email & SMTP</h3>
                <p>Cấu hình máy chủ gửi email</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">Bật SMTP</span>
                <span className="ss-toggle-desc">Cho phép gửi email từ hệ thống</span>
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
                <label>Tên đăng nhập</label>
                <input
                  type="text"
                  value={settings.smtp.smtpUsername}
                  onChange={(e) => updateSmtp('smtpUsername', e.target.value)}
                  placeholder="user@gmail.com"
                />
              </div>
              <div className="ss-field">
                <label>Mật khẩu</label>
                <input
                  type="password"
                  value={settings.smtp.smtpPassword}
                  onChange={(e) => updateSmtp('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="ss-field">
                <label>Email gửi đi</label>
                <input
                  type="email"
                  value={settings.smtp.fromEmail}
                  onChange={(e) => updateSmtp('fromEmail', e.target.value)}
                  placeholder="noreply@saybridge.io"
                />
              </div>
              <div className="ss-field">
                <label>Tên người gửi</label>
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
                <h3>Lưu trữ tệp</h3>
                <p>Cấu hình nơi lưu trữ tệp tin tải lên</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-form-grid">
              <div className="ss-field full-width">
                <label>Nhà cung cấp lưu trữ</label>
                <select
                  value={settings.storage.storageProvider}
                  onChange={(e) =>
                    updateStorage('storageProvider', e.target.value as StorageSettings['storageProvider'])
                  }
                >
                  <option value="local">Local (Máy chủ nội bộ)</option>
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
                  <label>Kích thước tệp tối đa</label>
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
                <h3>Thông báo</h3>
                <p>Quản lý kênh thông báo cho người dùng</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">Thông báo đẩy (Push)</span>
                <span className="ss-toggle-desc">Gửi thông báo đến thiết bị di động</span>
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
                <span className="ss-toggle-label">Thông báo qua Email</span>
                <span className="ss-toggle-desc">Gửi email khi có tin nhắn hoặc sự kiện quan trọng</span>
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
                <span className="ss-toggle-label">Thông báo Desktop</span>
                <span className="ss-toggle-desc">Hiển thị thông báo trên trình duyệt và ứng dụng desktop</span>
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
                <h3>Bảo mật</h3>
                <p>Xác thực, phiên đăng nhập và quyền truy cập</p>
              </div>
            </div>
            <ChevronDown size={18} className="ss-section-chevron" />
          </div>
          <div className="ss-section-body">
            <div className="ss-toggle-row">
              <div className="ss-toggle-info">
                <span className="ss-toggle-label">Yêu cầu xác thực 2 yếu tố (2FA)</span>
                <span className="ss-toggle-desc">Bắt buộc tất cả người dùng bật xác thực 2FA</span>
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
                <span className="ss-toggle-label">Cho phép đăng ký</span>
                <span className="ss-toggle-desc">Người dùng mới có thể tự tạo tài khoản</span>
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
                <label>Thời gian hết hạn phiên (phút)</label>
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
                <span className="ss-field-hint">Phiên đăng nhập sẽ hết hạn sau khoảng thời gian này</span>
              </div>
              <div className="ss-field">
                <label>Số lần đăng nhập sai tối đa</label>
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
                <span className="ss-field-hint">Khóa tài khoản sau số lần thử đăng nhập thất bại</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="ss-toast">
          <Check size={16} />
          Cài đặt đã được lưu thành công!
        </div>
      )}
    </PageContainer>
  );
}
