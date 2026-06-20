import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, User, Palette, Bell, Shield, Monitor,
  Camera, Check, AlertCircle, Eye, EyeOff,
  ChevronDown, Volume2, Smartphone, Loader2,
  Upload,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useThemeStore } from '../../../stores/useThemeStore';
import { usePreferencesStore, ACCENT_PRESETS, AccentColor } from '../../../stores/usePreferencesStore';
import { PageHeader, GlassCard } from '@saybridge/ui';
import './AccountSettings.css';

interface AccountSettingsProps {
  onClose: () => void;
  activeSection?: SectionId;
}

type SectionId = 'profile' | 'preferences' | 'notifications' | 'security' | 'sessions';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

interface ProfileData {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  system_role: string;
  presence_status: string;
  custom_status: string;
}

interface SettingsData {
  language: string;
  theme: string;
  timezone: string;
  notifications_enabled: boolean;
  desktop_notifications: boolean;
  notification_sound: string;
}

interface PasswordForm {
  current: string;
  newPassword: string;
  confirm: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Hồ sơ', icon: <User size={18} /> },
  { id: 'preferences', label: 'Tùy chỉnh', icon: <Palette size={18} /> },
  { id: 'notifications', label: 'Thông báo', icon: <Bell size={18} /> },
  { id: 'security', label: 'Bảo mật', icon: <Shield size={18} /> },
  { id: 'sessions', label: 'Phiên hoạt động', icon: <Monitor size={18} /> },
];

const TIMEZONE_OPTIONS = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Pacific/Auckland',
  'Australia/Sydney',
  'UTC',
];

const LANGUAGE_OPTIONS = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
];

const SOUND_OPTIONS = [
  { value: 'default', label: 'Mặc định' },
  { value: 'chime', label: 'Chime' },
  { value: 'ding', label: 'Ding' },
  { value: 'pop', label: 'Pop' },
  { value: 'none', label: 'Không âm thanh' },
];

export type { SectionId as SettingsSectionId };

export function AccountSettings({ onClose: _onClose, activeSection = 'profile' }: AccountSettingsProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { user, setSession } = useAuthStore();
  const { theme: currentTheme, setTheme: setThemePreference } = useThemeStore();

  // Profile state
  const [profile, setProfile] = useState<ProfileData>({
    id: '',
    username: '',
    email: '',
    display_name: '',
    avatar_url: '',
    system_role: '',
    presence_status: '',
    custom_status: '',
  });

  // Settings state
  const [settings, setSettings] = useState<SettingsData>({
    language: 'vi',
    theme: 'dark',
    timezone: 'Asia/Ho_Chi_Minh',
    notifications_enabled: true,
    desktop_notifications: true,
    notification_sound: 'default',
  });

  // Password state
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current: '',
    newPassword: '',
    confirm: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    newPassword: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch user data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get('/users/me');
        const data = res.data?.data || res.data;
        setProfile({
          id: data.id || '',
          username: data.username || '',
          email: data.email || '',
          display_name: data.display_name || '',
          avatar_url: data.avatar_url || '',
          system_role: data.system_role || '',
          presence_status: data.presence_status || 'online',
          custom_status: data.custom_status || '',
        });
        // Load settings if available from same response or separate call
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          if (data.settings.language && i18n.language !== data.settings.language) {
            i18n.changeLanguage(data.settings.language);
          }
        }
      } catch (err) {
        console.error('[AccountSettings] Failed to fetch profile:', err);
        showToast('error', t('settings.toast_profile_error'));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [showToast, t, i18n]);

  // Save profile
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await api.patch('/users/me', {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        custom_status: profile.custom_status,
      });
      // Update auth store
      if (user) {
        setSession({
          ...user,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          custom_status: profile.custom_status,
        });
      }
      showToast('success', t('settings.toast_profile_success'));
    } catch (err) {
      console.error('[AccountSettings] Failed to save profile:', err);
      showToast('error', t('settings.toast_profile_error'));
    } finally {
      setSaving(false);
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await api.patch('/users/me/settings', settings);
      showToast('success', t('settings.toast_settings_success'));
      if (settings.language) {
        i18n.changeLanguage(settings.language);
      }
    } catch (err) {
      console.error('[AccountSettings] Failed to save settings:', err);
      showToast('error', t('settings.toast_settings_error'));
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPasswordError('');
    if (!passwordForm.current) {
      setPasswordError(t('settings.current_password_placeholder'));
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError(t('settings.password_min_len'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setPasswordError(t('settings.password_mismatch'));
      return;
    }
    try {
      setSaving(true);
      await api.patch('/users/me', {
        current_password: passwordForm.current,
        new_password: passwordForm.newPassword,
      });
      setPasswordForm({ current: '', newPassword: '', confirm: '' });
      showToast('success', t('settings.toast_password_success'));
    } catch (err: any) {
      const msg = err.response?.data?.message || t('settings.toast_password_error');
      setPasswordError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  // Avatar upload handler
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately via data URL
    const reader = new FileReader();
    reader.onload = () => {
      setProfile((prev) => ({ ...prev, avatar_url: reader.result as string }));
    };
    reader.readAsDataURL(file);

    // Upload
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.data?.avatar_url || res.data?.avatar_url;
      if (url) {
        setProfile((prev) => ({ ...prev, avatar_url: url }));
      }
      showToast('success', 'Đã cập nhật ảnh đại diện');
    } catch (err) {
      console.error('[AccountSettings] Avatar upload failed:', err);
      showToast('error', 'Không thể tải ảnh đại diện lên');
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Content — no overlay or sidebar, rendered inline */}
      <div className="acct-content">
        {loading ? (
          <div className="acct-loading">
            <Loader2 size={32} className="acct-spinner" />
            <p>Đang tải thông tin...</p>
          </div>
        ) : (
          <>
            {activeSection === 'profile' && (
              <ProfileSection
                profile={profile}
                setProfile={setProfile}
                onSave={handleSaveProfile}
                saving={saving}
                onAvatarClick={handleAvatarClick}
                getInitials={getInitials}
              />
            )}
            {activeSection === 'preferences' && (
              <PreferencesSection
                settings={settings}
                setSettings={setSettings}
                onSave={handleSaveSettings}
                saving={saving}
              />
            )}
            {activeSection === 'notifications' && (
              <NotificationsSection
                settings={settings}
                setSettings={setSettings}
                onSave={handleSaveSettings}
                saving={saving}
              />
            )}
            {activeSection === 'security' && (
              <SecuritySection
                passwordForm={passwordForm}
                setPasswordForm={setPasswordForm}
                showPasswords={showPasswords}
                setShowPasswords={setShowPasswords}
                passwordError={passwordError}
                onChangePassword={handleChangePassword}
                saving={saving}
              />
            )}
            {activeSection === 'sessions' && <SessionsSection />}
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
      />

      {/* Toast */}
      {toast && (
        <div className={`acct-toast acct-toast--${toast.type}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}

/* ==================== Profile Section ==================== */
function ProfileSection({
  profile,
  setProfile,
  onSave,
  saving,
  onAvatarClick,
  getInitials,
}: {
  profile: ProfileData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  onSave: () => void;
  saving: boolean;
  onAvatarClick: () => void;
  getInitials: (name: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="acct-section">
      <PageHeader
        title={t('settings.profile')}
        subtitle={t('settings.profile_subtitle')}
        icon={<User size={20} />}
      />

      <GlassCard style={{ padding: '28px', marginBottom: '20px' }}>
        {/* Avatar */}
        <div className="acct-avatar-area">
          <div className="acct-avatar-wrapper" onClick={onAvatarClick}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="acct-avatar-img" />
            ) : (
              <div className="acct-avatar-fallback">
                {getInitials(profile.display_name || profile.username || '?')}
              </div>
            )}
            <div className="acct-avatar-overlay">
              <Camera size={20} />
              <span>{t('settings.change_avatar')}</span>
            </div>
          </div>
          <div className="acct-avatar-info">
            <span className="acct-avatar-name">{profile.display_name || profile.username}</span>
            <span className="acct-avatar-role">{profile.system_role || 'Thành viên'}</span>
          </div>
        </div>

        <div className="sb-divider" />

        {/* Form fields */}
        <div className="acct-form-grid">
          <div className="sb-form-group">
            <label className="sb-label">{t('settings.display_name')}</label>
            <input
              className="sb-input"
              type="text"
              value={profile.display_name}
              onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
              placeholder={t('settings.display_name_hint')}
            />
          </div>

          <div className="sb-form-group">
            <label className="sb-label">{t('settings.username')}</label>
            <input type="text" value={profile.username} disabled className="sb-input" />
            <span className="acct-field-hint">{t('settings.username_hint')}</span>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">{t('settings.email')}</label>
            <input type="email" value={profile.email} disabled className="sb-input" />
            <span className="acct-field-hint">{t('settings.email_hint')}</span>
          </div>

          <div className="sb-form-group sb-form-group-full">
            <label className="sb-label">{t('settings.custom_status')}</label>
            <input
              className="sb-input"
              type="text"
              value={profile.custom_status}
              onChange={(e) => setProfile((p) => ({ ...p, custom_status: e.target.value }))}
              placeholder={t('settings.custom_status_hint')}
              maxLength={100}
            />
            <span className="acct-field-counter">{profile.custom_status.length}/100</span>
          </div>
        </div>

        <div className="acct-actions">
          <button className="acct-btn acct-btn--primary" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="acct-spinner" /> : <Check size={16} />}
            {t('settings.save_profile')}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

/* ==================== Preferences Section ==================== */
function PreferencesSection({
  settings,
  setSettings,
  onSave,
  saving,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const { theme: currentTheme, setTheme: setThemePreference } = useThemeStore();
  const prefs = usePreferencesStore();
  const updatePref = usePreferencesStore((s) => s.updatePreference);

  const [customWallpaper, setCustomWallpaper] = useState<string | null>(() => localStorage.getItem('saybridge_custom_wallpaper'));
  const [customWallpaperMode, setCustomWallpaperMode] = useState<'cover' | 'contain' | 'repeat' | 'stretch'>(() => {
    return (localStorage.getItem('saybridge_custom_wallpaper_mode') as any) || 'cover';
  });
  const [customWallpaperScale, setCustomWallpaperScale] = useState<number>(() => {
    return parseInt(localStorage.getItem('saybridge_custom_wallpaper_scale') || '200');
  });
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const handleWallpaperModeChange = (mode: 'cover' | 'contain' | 'repeat' | 'stretch') => {
    localStorage.setItem('saybridge_custom_wallpaper_mode', mode);
    setCustomWallpaperMode(mode);
    usePreferencesStore.getState().applyToDOM();
  };

  const handleWallpaperScaleChange = (scale: number) => {
    localStorage.setItem('saybridge_custom_wallpaper_scale', scale.toString());
    setCustomWallpaperScale(scale);
    usePreferencesStore.getState().applyToDOM();
  };

  const compressAndSaveImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1920;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleWallpaperFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressAndSaveImage(file);
      localStorage.setItem('saybridge_custom_wallpaper', compressedDataUrl);
      setCustomWallpaper(compressedDataUrl);
      updatePref('wallpaper', 'custom');
      usePreferencesStore.getState().applyToDOM();
    } catch (err) {
      console.error('Failed to upload custom wallpaper:', err);
      alert('Không thể tải hoặc xử lý ảnh nền này. Vui lòng chọn ảnh khác.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="acct-section">
      <PageHeader
        title={t('settings.preferences')}
        subtitle={t('settings.preferences_subtitle')}
        icon={<Palette size={20} />}
      />

      {/* ─── Group 1: Giao diện ─── */}
      <GlassCard title="Giao diện" style={{ padding: '28px', marginBottom: '20px' }}>

        {/* Theme picker */}
        <div className="acct-theme-picker">
          <button
            className={`acct-theme-option ${currentTheme === 'dark' ? 'active' : ''}`}
            onClick={() => setThemePreference('dark')}
          >
            <div className="acct-theme-preview acct-theme-preview--dark">
              <div className="acct-theme-bar" />
              <div className="acct-theme-lines"><div /><div /><div /></div>
            </div>
            <span>Tối</span>
          </button>
          <button
            className={`acct-theme-option ${currentTheme === 'light' ? 'active' : ''}`}
            onClick={() => setThemePreference('light')}
          >
            <div className="acct-theme-preview acct-theme-preview--light">
              <div className="acct-theme-bar" />
              <div className="acct-theme-lines"><div /><div /><div /></div>
            </div>
            <span>Sáng</span>
          </button>
          <button
            className={`acct-theme-option ${currentTheme === 'system' ? 'active' : ''}`}
            onClick={() => setThemePreference('system')}
          >
            <div className="acct-theme-preview acct-theme-preview--system">
              <div className="acct-theme-bar" />
              <div className="acct-theme-lines"><div /><div /><div /></div>
            </div>
            <span>Hệ thống</span>
          </button>
        </div>

        {/* Accent Color Picker */}
        <div className="pref-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
          <div className="pref-item-info">
            <span className="pref-item-label">Màu chủ đạo</span>
            <span className="pref-hint">Chọn màu sắc yêu thích cho giao diện</span>
          </div>
          <div className="acct-accent-picker">
            {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map((colorKey) => {
              const preset = ACCENT_PRESETS[colorKey];
              const isActive = prefs.accentColor === colorKey;
              return (
                <button
                  key={colorKey}
                  className={`acct-accent-swatch ${isActive ? 'active' : ''}`}
                  style={{ '--swatch-color': preset.main, '--swatch-hover': preset.hover } as React.CSSProperties}
                  onClick={() => updatePref('accentColor', colorKey)}
                  title={colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
                >
                  <span className="acct-accent-dot" />
                  {isActive && <Check size={12} className="acct-accent-check" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wallpaper Picker */}
        <div className="pref-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px', marginTop: '20px' }}>
          <div className="pref-item-info">
            <span className="pref-item-label">Hình nền</span>
            <span className="pref-hint">Chọn kiểu hình nền phía sau của ứng dụng</span>
          </div>
          <div className="acct-wallpaper-picker">
            {[
              { id: 'ambient', label: 'Ambient', previewClass: 'wp-preview--ambient' },
              { id: 'solid', label: 'Tối giản', previewClass: 'wp-preview--solid' },
              { id: 'aurora', label: 'Cực quang', previewClass: 'wp-preview--aurora' },
              { id: 'sunset', label: 'Hoàng hôn', previewClass: 'wp-preview--sunset' },
              { id: 'bubblegum', label: 'Kẹo ngọt', previewClass: 'wp-preview--bubblegum' },
              { id: 'custom', label: 'Tự chọn...', previewClass: 'wp-preview--custom' },
            ].map((wp) => {
              const isActive = prefs.wallpaper === wp.id || (!prefs.wallpaper && wp.id === 'ambient');
              const onClick = () => {
                if (wp.id === 'custom') {
                  if (!customWallpaper) {
                    wallpaperInputRef.current?.click();
                  } else {
                    updatePref('wallpaper', 'custom');
                  }
                } else {
                  updatePref('wallpaper', wp.id as any);
                }
              };
              return (
                <button
                  key={wp.id}
                  className={`acct-wallpaper-option ${isActive ? 'active' : ''}`}
                  onClick={onClick}
                >
                  <div
                    className={`acct-wallpaper-preview ${wp.previewClass}`}
                    style={
                      wp.id === 'custom' && customWallpaper
                        ? { backgroundImage: `url(${customWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : undefined
                    }
                  >
                    {wp.id === 'custom' && !customWallpaper && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        <Upload size={16} />
                      </div>
                    )}
                  </div>
                  <span>{wp.id === 'custom' && customWallpaper ? 'Tự chọn' : wp.label}</span>
                </button>
              );
            })}
          </div>
          <input
            type="file"
            ref={wallpaperInputRef}
            onChange={handleWallpaperFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          {prefs.wallpaper === 'custom' && customWallpaper && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button
                className="acct-btn acct-btn--outline"
                style={{ padding: '6px 12px', fontSize: '0.8rem', height: '32px' }}
                onClick={() => wallpaperInputRef.current?.click()}
              >
                <Upload size={14} /> Thay đổi ảnh nền...
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pref-hint" style={{ margin: 0, fontSize: '0.8rem' }}>Kiểu hiển thị:</span>
                <div className="pref-toggle-group" style={{ margin: 0, height: '32px' }}>
                  <button
                    className={`pref-toggle-btn ${customWallpaperMode === 'cover' ? 'active' : ''}`}
                    style={{ padding: '0 10px', fontSize: '0.75rem', height: '100%' }}
                    onClick={() => handleWallpaperModeChange('cover')}
                  >
                    Trải rộng
                  </button>
                  <button
                    className={`pref-toggle-btn ${customWallpaperMode === 'contain' ? 'active' : ''}`}
                    style={{ padding: '0 10px', fontSize: '0.75rem', height: '100%' }}
                    onClick={() => handleWallpaperModeChange('contain')}
                  >
                    Vừa vặn
                  </button>
                  <button
                    className={`pref-toggle-btn ${customWallpaperMode === 'repeat' ? 'active' : ''}`}
                    style={{ padding: '0 10px', fontSize: '0.75rem', height: '100%' }}
                    onClick={() => handleWallpaperModeChange('repeat')}
                  >
                    Lặp lại
                  </button>
                  <button
                    className={`pref-toggle-btn ${customWallpaperMode === 'stretch' ? 'active' : ''}`}
                    style={{ padding: '0 10px', fontSize: '0.75rem', height: '100%' }}
                    onClick={() => handleWallpaperModeChange('stretch')}
                  >
                    Kéo giãn
                  </button>
                </div>
              </div>

              {customWallpaperMode === 'repeat' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                  <span className="pref-hint" style={{ margin: 0, fontSize: '0.8rem' }}>Cỡ hình lặp:</span>
                  <input
                    type="range"
                    min={20}
                    max={600}
                    step={10}
                    value={customWallpaperScale}
                    onChange={(e) => handleWallpaperScaleChange(parseInt(e.target.value))}
                    style={{ width: '100px', cursor: 'pointer' }}
                  />
                  <span className="pref-hint" style={{ margin: 0, fontSize: '0.8rem', minWidth: '40px' }}>{customWallpaperScale}px</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Density */}
        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Mật độ tin nhắn</span>
            <span className="pref-hint">
              {prefs.messageDensity === 'cozy' ? 'Thoải mái — khoảng cách lớn giữa các tin nhắn' : 'Gọn — hiển thị nhiều tin nhắn hơn'}
            </span>
          </div>
          <div className="pref-toggle-group">
            <button
              className={`pref-toggle-btn ${prefs.messageDensity === 'cozy' ? 'active' : ''}`}
              onClick={() => updatePref('messageDensity', 'cozy')}
            >
              Thoải mái
            </button>
            <button
              className={`pref-toggle-btn ${prefs.messageDensity === 'compact' ? 'active' : ''}`}
              onClick={() => updatePref('messageDensity', 'compact')}
            >
              Gọn
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Cỡ chữ tin nhắn</span>
            <span className="pref-hint">{prefs.fontSize}px</span>
          </div>
          <div className="pref-slider-wrapper">
            <span className="pref-slider-label">A</span>
            <input
              type="range"
              className="pref-slider"
              min={12}
              max={20}
              step={1}
              value={prefs.fontSize}
              onChange={(e) => updatePref('fontSize', parseInt(e.target.value))}
            />
            <span className="pref-slider-label pref-slider-label--lg">A</span>
          </div>
        </div>

        {/* Reduce Motion */}
        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Giảm chuyển động</span>
            <span className="pref-hint">Tắt animation và hiệu ứng chuyển động</span>
          </div>
          <label className="pref-switch">
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(e) => updatePref('reduceMotion', e.target.checked)}
            />
            <span className="pref-switch-slider" />
          </label>
        </div>

        {/* Compact Mode */}
        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Chế độ thu gọn</span>
            <span className="pref-hint">Hiển thị giao diện thu gọn</span>
          </div>
          <label className="pref-switch">
            <input
              type="checkbox"
              checked={prefs.messageDensity === 'compact'}
              onChange={(e) => updatePref('messageDensity', e.target.checked ? 'compact' : 'cozy')}
            />
            <span className="pref-switch-slider" />
          </label>
        </div>
      </GlassCard>

      {/* ─── Group 2: Soạn tin ─── */}
      <GlassCard title="Soạn tin" style={{ padding: '28px', marginBottom: '20px' }}>

        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Phím Enter gửi tin nhắn</span>
            <span className="pref-hint">
              {prefs.enterBehavior === 'send'
                ? 'Enter gửi tin · Shift+Enter xuống dòng'
                : 'Enter xuống dòng · Ctrl+Enter gửi tin'}
            </span>
          </div>
          <label className="pref-switch">
            <input
              type="checkbox"
              checked={prefs.enterBehavior === 'send'}
              onChange={(e) => updatePref('enterBehavior', e.target.checked ? 'send' : 'newline')}
            />
            <span className="pref-switch-slider" />
          </label>
        </div>
      </GlassCard>

      {/* ─── Group 3: Hiển thị nội dung ─── */}
      <GlassCard title="Hiển thị nội dung" style={{ padding: '28px', marginBottom: '20px' }}>

        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Xem trước liên kết</span>
            <span className="pref-hint">Tự động hiển thị preview khi gửi URL</span>
          </div>
          <label className="pref-switch">
            <input
              type="checkbox"
              checked={prefs.linkPreview}
              onChange={(e) => updatePref('linkPreview', e.target.checked)}
            />
            <span className="pref-switch-slider" />
          </label>
        </div>
      </GlassCard>

      {/* ─── Group 4: Sidebar & Navigation ─── */}
      <GlassCard title="Sidebar & Navigation" style={{ padding: '28px', marginBottom: '20px' }}>

        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Sắp xếp kênh</span>
            <span className="pref-hint">Thứ tự hiển thị kênh trong sidebar</span>
          </div>
          <select
            className="sb-select"
            value={prefs.roomSortOrder}
            onChange={(e) => updatePref('roomSortOrder', e.target.value as any)}
          >
            <option value="activity">Hoạt động gần nhất</option>
            <option value="alphabetical">Theo tên (A-Z)</option>
            <option value="unread">Chưa đọc trước</option>
          </select>
        </div>
      </GlassCard>

      {/* ─── Group 5: Quyền riêng tư ─── */}
      <GlassCard title="Quyền riêng tư" style={{ padding: '28px', marginBottom: '20px' }}>

        <div className="pref-item">
          <div className="pref-item-info">
            <span className="pref-item-label">Xác nhận đã đọc</span>
            <span className="pref-hint">Cho người khác thấy khi bạn đã đọc tin nhắn</span>
          </div>
          <label className="pref-switch">
            <input
              type="checkbox"
              checked={prefs.showReadReceipts}
              onChange={(e) => updatePref('showReadReceipts', e.target.checked)}
            />
            <span className="pref-switch-slider" />
          </label>
        </div>
      </GlassCard>

      {/* ─── Ngôn ngữ & Múi giờ (existing) ─── */}
      <GlassCard title={t('settings.language_timezone', 'Ngôn ngữ & Múi giờ')} style={{ padding: '28px', marginBottom: '20px' }}>
        <div className="acct-form-grid">
          <div className="sb-form-group">
            <label className="sb-label">{t('settings.language')}</label>
            <select
              className="sb-select"
              value={settings.language}
              onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">{t('settings.timezone')}</label>
            <select
              className="sb-select"
              value={settings.timezone}
              onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="acct-actions">
          <button className="acct-btn acct-btn--primary" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="acct-spinner" /> : <Check size={16} />}
            {t('common.save')}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

/* ==================== Notifications Section ==================== */
function NotificationsSection({
  settings,
  setSettings,
  onSave,
  saving,
}: {
  settings: SettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="acct-section">
      <PageHeader
        title="Thông báo"
        subtitle="Quản lý cách bạn nhận thông báo từ Saybridge"
        icon={<Bell size={20} />}
      />

      <GlassCard title="Tùy chọn thông báo" style={{ padding: '28px', marginBottom: '20px' }}>

        <div className="acct-toggle-list">
          {/* Desktop notifications */}
          <div className="acct-toggle-row">
            <div className="acct-toggle-info">
              <Monitor size={18} />
              <div>
                <span className="acct-toggle-label">Thông báo trên máy tính</span>
                <span className="acct-toggle-desc">
                  Hiển thị thông báo popup khi có tin nhắn mới
                </span>
              </div>
            </div>
            <label className="acct-toggle">
              <input
                type="checkbox"
                checked={settings.desktop_notifications}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, desktop_notifications: e.target.checked }))
                }
              />
              <span className="acct-toggle-slider" />
            </label>
          </div>

          {/* Push notifications */}
          <div className="acct-toggle-row">
            <div className="acct-toggle-info">
              <Smartphone size={18} />
              <div>
                <span className="acct-toggle-label">Thông báo đẩy</span>
                <span className="acct-toggle-desc">
                  Nhận thông báo trên điện thoại khi không online
                </span>
              </div>
            </div>
            <label className="acct-toggle">
              <input
                type="checkbox"
                checked={settings.notifications_enabled}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, notifications_enabled: e.target.checked }))
                }
              />
              <span className="acct-toggle-slider" />
            </label>
          </div>
        </div>

        <div className="sb-divider" />

        {/* Sound selection */}
        <div className="acct-form-grid">
          <div className="sb-form-group">
            <label className="sb-label">
              <Volume2 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Âm thanh thông báo
            </label>
            <select
              className="sb-select"
              value={settings.notification_sound}
              onChange={(e) =>
                setSettings((s) => ({ ...s, notification_sound: e.target.value }))
              }
            >
              {SOUND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="acct-actions">
          <button className="acct-btn acct-btn--primary" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="acct-spinner" /> : <Check size={16} />}
            Lưu cài đặt
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

/* ==================== Security Section ==================== */
function SecuritySection({
  passwordForm,
  setPasswordForm,
  showPasswords,
  setShowPasswords,
  passwordError,
  onChangePassword,
  saving,
}: {
  passwordForm: PasswordForm;
  setPasswordForm: React.Dispatch<React.SetStateAction<PasswordForm>>;
  showPasswords: { current: boolean; newPassword: boolean; confirm: boolean };
  setShowPasswords: React.Dispatch<
    React.SetStateAction<{ current: boolean; newPassword: boolean; confirm: boolean }>
  >;
  passwordError: string;
  onChangePassword: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="acct-section">
      <PageHeader
        title={t('settings.security')}
        subtitle={t('settings.security_subtitle')}
        icon={<Shield size={20} />}
      />

      {/* Change password */}
      <GlassCard title={t('settings.change_password')} style={{ padding: '28px', marginBottom: '20px' }}>

        <div className="acct-form-stack">
          <div className="acct-field">
            <label>{t('settings.current_password')}</label>
            <div className="acct-password-input">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordForm.current}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, current: e.target.value }))
                }
                placeholder={t('settings.current_password_placeholder')}
              />
              <button
                type="button"
                className="acct-password-toggle"
                onClick={() =>
                  setShowPasswords((s) => ({ ...s, current: !s.current }))
                }
              >
                {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="acct-field">
            <label>{t('settings.new_password')}</label>
            <div className="acct-password-input">
              <input
                type={showPasswords.newPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                }
                placeholder={t('settings.new_password_placeholder')}
              />
              <button
                type="button"
                className="acct-password-toggle"
                onClick={() =>
                  setShowPasswords((s) => ({ ...s, newPassword: !s.newPassword }))
                }
              >
                {showPasswords.newPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordForm.newPassword && passwordForm.newPassword.length < 8 && (
              <span className="acct-field-error">{t('settings.password_min_len')}</span>
            )}
          </div>

          <div className="acct-field">
            <label>{t('settings.confirm_new_password')}</label>
            <div className="acct-password-input">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordForm.confirm}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, confirm: e.target.value }))
                }
                placeholder={t('settings.confirm_new_password_placeholder')}
              />
              <button
                type="button"
                className="acct-password-toggle"
                onClick={() =>
                  setShowPasswords((s) => ({ ...s, confirm: !s.confirm }))
                }
              >
                {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordForm.confirm &&
              passwordForm.newPassword !== passwordForm.confirm && (
                <span className="acct-field-error">{t('settings.password_mismatch')}</span>
              )}
          </div>
        </div>

        {passwordError && (
          <div className="acct-error-banner">
            <AlertCircle size={16} />
            <span>{passwordError}</span>
          </div>
        )}

        <div className="acct-actions">
          <button
            className="acct-btn acct-btn--primary"
            onClick={onChangePassword}
            disabled={saving || !passwordForm.current || !passwordForm.newPassword || !passwordForm.confirm}
          >
            {saving ? <Loader2 size={16} className="acct-spinner" /> : <Shield size={16} />}
            {t('settings.change_password')}
          </button>
        </div>
      </GlassCard>

      {/* 2FA */}
      <GlassCard title="Xác thực hai yếu tố (2FA)" style={{ padding: '28px', marginBottom: '20px' }}>
        <p className="acct-card-desc">
          Thêm một lớp bảo mật bổ sung cho tài khoản của bạn bằng ứng dụng xác thực.
        </p>
        <div className="acct-actions">
          <button className="acct-btn acct-btn--outline">
            <Shield size={16} />
            Thiết lập 2FA
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

/* ==================== Sessions Section ==================== */
function SessionsSection() {
  const currentSession = {
    device: navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Windows') ? 'Windows' : 'Linux',
    browser: navigator.userAgent.includes('Chrome')
      ? 'Chrome'
      : navigator.userAgent.includes('Firefox')
        ? 'Firefox'
        : navigator.userAgent.includes('Safari')
          ? 'Safari'
          : 'Trình duyệt khác',
    ip: '—',
    lastActive: 'Hiện tại',
  };

  return (
    <div className="acct-section">
      <PageHeader
        title="Phiên hoạt động"
        subtitle="Xem các thiết bị đang đăng nhập vào tài khoản của bạn"
        icon={<Smartphone size={20} />}
      />

      <GlassCard title="Phiên hiện tại" style={{ padding: '28px', marginBottom: '20px' }}>

        <div className="acct-session-card acct-session-card--current">
          <div className="acct-session-icon">
            <Monitor size={24} />
          </div>
          <div className="acct-session-details">
            <span className="acct-session-device">
              {currentSession.device} — {currentSession.browser}
            </span>
            <span className="acct-session-meta">
              IP: {currentSession.ip} · Hoạt động: {currentSession.lastActive}
            </span>
          </div>
          <span className="acct-session-badge acct-session-badge--active">
            Phiên hiện tại
          </span>
        </div>
      </GlassCard>

      <GlassCard title="Các phiên khác" style={{ padding: '28px', marginBottom: '20px' }}>
        <div className="acct-empty-state">
          <Monitor size={32} />
          <p>Không có phiên hoạt động nào khác</p>
          <span className="acct-empty-hint">
            Các thiết bị đăng nhập khác sẽ xuất hiện tại đây
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
