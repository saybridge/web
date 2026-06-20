import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, ChevronRight, ChevronLeft, Check, Hash, Megaphone, Shuffle, Loader2 } from 'lucide-react';
import './SetupWizard.css';

interface SetupWizardProps {
  onComplete: () => void;
}

interface FormData {
  admin_name: string;
  admin_username: string;
  admin_email: string;
  admin_password: string;
  workspace_name: string;
  workspace_type: string;
  industry: string;
  size: string;
  allow_registration: boolean;
  language: string;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t, i18n } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    admin_name: '',
    admin_username: '',
    admin_email: '',
    admin_password: '',
    workspace_name: '',
    workspace_type: 'enterprise',
    industry: 'technology',
    size: '1-10',
    allow_registration: true,
    language: 'en', // Default to English
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear field error when user types
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // ── Validation ──
  const validateStep = (step: number): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      if (!form.admin_name.trim()) errors.admin_name = t('setup.val_full_name', 'Please enter full name');
      if (!form.admin_username.trim()) errors.admin_username = t('setup.val_username', 'Please enter username');
      else if (!/^[a-zA-Z0-9._-]+$/.test(form.admin_username))
        errors.admin_username = t('setup.val_username_chars', 'Only letters, numbers, dots, and hyphens are allowed');
      if (!form.admin_email.trim()) errors.admin_email = t('setup.val_email', 'Please enter email');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email))
        errors.admin_email = t('setup.val_email_invalid', 'Invalid email address');
      if (!form.admin_password) errors.admin_password = t('setup.val_password', 'Please enter password');
      else if (form.admin_password.length < 8)
        errors.admin_password = t('setup.val_password_len', 'Password must be at least 8 characters long');
    }

    if (step === 2) {
      if (!form.workspace_name.trim()) errors.workspace_name = t('setup.val_workspace_name', 'Please enter workspace name');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:8080/api/v1/system/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `${t('common.error', 'Server error')} (${res.status})`);
      }

      setIsComplete(true);
    } catch (err: any) {
      setError(err.message || t('setup.setup_error_fallback', 'An error occurred during setup. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercent = isComplete ? 100 : ((currentStep - 1) / 4) * 100 + (currentStep === 4 ? 25 : 0);

  // ── Helper to get display label for a dropdown value ──
  const getLabel = (list: { value: string; label: string }[], val: string) =>
    list.find((i) => i.value === val)?.label || val;

  // ── Localized values inside the component ──
  const stepLabels = [
    t('setup.step_admin_info', 'Admin Information'),
    t('setup.step_org_info', 'Organization Information'),
    t('setup.step_options', 'Options'),
    t('setup.step_complete', 'Complete'),
  ];

  const workspaceTypes = [
    { value: 'enterprise', label: t('setup.type_enterprise', 'Enterprise') },
    { value: 'team', label: t('setup.type_team', 'Team') },
    { value: 'personal', label: t('setup.type_personal', 'Personal') },
  ];

  const industries = [
    { value: 'technology', label: t('setup.ind_technology', 'Technology') },
    { value: 'education', label: t('setup.ind_education', 'Education') },
    { value: 'healthcare', label: t('setup.ind_healthcare', 'Healthcare') },
    { value: 'finance', label: t('setup.ind_finance', 'Finance') },
    { value: 'other', label: t('setup.ind_other', 'Other') },
  ];

  const teamSizes = [
    { value: '1-10', label: '1-10' },
    { value: '11-50', label: '11-50' },
    { value: '51-200', label: '51-200' },
    { value: '200+', label: '200+' },
  ];

  const defaultChannels = [
    { name: 'general', desc: t('setup.chan_general_desc', 'General channel for everyone'), icon: Hash },
    { name: 'random', desc: t('setup.chan_random_desc', 'Casual conversation'), icon: Shuffle },
    { name: 'announcements', desc: t('setup.chan_announcements_desc', 'Important announcements'), icon: Megaphone },
  ];

  const handleLanguageChange = (lang: string) => {
    updateField('language', lang);
    i18n.changeLanguage(lang);
  };

  // ══════════════════════════════════════════════════════
  // STEP RENDERERS
  // ══════════════════════════════════════════════════════

  const renderStep1 = () => (
    <div className="setup-step-content" key="step-1">
      <div className="setup-field">
        <label className="setup-label">{t('setup.full_name', 'Full Name')}</label>
        <input
          className={`setup-input ${fieldErrors.admin_name ? 'setup-input--error' : ''}`}
          type="text"
          placeholder={t('setup.full_name_placeholder', 'Nguyễn Văn A')}
          value={form.admin_name}
          onChange={(e) => updateField('admin_name', e.target.value)}
          autoFocus
        />
        {fieldErrors.admin_name && (
          <span className="setup-helper setup-helper--error">{fieldErrors.admin_name}</span>
        )}
      </div>

      <div className="setup-field">
        <label className="setup-label">{t('setup.username', 'Username')}</label>
        <input
          className={`setup-input ${fieldErrors.admin_username ? 'setup-input--error' : ''}`}
          type="text"
          placeholder={t('setup.username_placeholder', 'admin')}
          value={form.admin_username}
          onChange={(e) => updateField('admin_username', e.target.value)}
        />
        {fieldErrors.admin_username && (
          <span className="setup-helper setup-helper--error">{fieldErrors.admin_username}</span>
        )}
      </div>

      <div className="setup-field">
        <label className="setup-label">{t('setup.email', 'Email')}</label>
        <input
          className={`setup-input ${fieldErrors.admin_email ? 'setup-input--error' : ''}`}
          type="email"
          placeholder={t('setup.email_placeholder', 'admin@saybridge.com')}
          value={form.admin_email}
          onChange={(e) => updateField('admin_email', e.target.value)}
        />
        {fieldErrors.admin_email && (
          <span className="setup-helper setup-helper--error">{fieldErrors.admin_email}</span>
        )}
      </div>

      <div className="setup-field">
        <label className="setup-label">{t('setup.password', 'Password')}</label>
        <div className="setup-password-wrapper">
          <input
            className={`setup-input ${fieldErrors.admin_password ? 'setup-input--error' : ''}`}
            type={showPassword ? 'text' : 'password'}
            placeholder={t('setup.password_placeholder', '••••••••')}
            value={form.admin_password}
            onChange={(e) => updateField('admin_password', e.target.value)}
          />
          <button
            type="button"
            className="setup-password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {fieldErrors.admin_password ? (
          <span className="setup-helper setup-helper--error">{fieldErrors.admin_password}</span>
        ) : (
          <span
            className={`setup-helper ${form.admin_password.length >= 8 ? 'setup-helper--valid' : ''}`}
          >
            {form.admin_password.length >= 8 ? (
              <>
                <Check size={12} /> {t('setup.password_valid', 'Password valid')}
              </>
            ) : (
              t('setup.min_characters', 'Min. 8 characters')
            )}
          </span>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="setup-step-content" key="step-2">
      <div className="setup-field">
        <label className="setup-label">{t('setup.workspace_name', 'Workspace Name')}</label>
        <input
          className={`setup-input ${fieldErrors.workspace_name ? 'setup-input--error' : ''}`}
          type="text"
          placeholder={t('setup.workspace_name_placeholder', 'Công ty ABC')}
          value={form.workspace_name}
          onChange={(e) => updateField('workspace_name', e.target.value)}
          autoFocus
        />
        {fieldErrors.workspace_name && (
          <span className="setup-helper setup-helper--error">{fieldErrors.workspace_name}</span>
        )}
      </div>

      <div className="setup-field">
        <label className="setup-label">{t('setup.workspace_type', 'Workspace Type')}</label>
        <select
          className="setup-select"
          value={form.workspace_type}
          onChange={(e) => updateField('workspace_type', e.target.value)}
        >
          {workspaceTypes.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="setup-field-row">
        <div className="setup-field">
          <label className="setup-label">{t('setup.industry', 'Industry')}</label>
          <select
            className="setup-select"
            value={form.industry}
            onChange={(e) => updateField('industry', e.target.value)}
          >
            {industries.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="setup-field">
          <label className="setup-label">{t('setup.team_size', 'Team Size')}</label>
          <select
            className="setup-select"
            value={form.size}
            onChange={(e) => updateField('size', e.target.value)}
          >
            {teamSizes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="setup-step-content" key="step-3">
      <div className="setup-toggle-row">
        <div className="setup-toggle-info">
          <span className="setup-toggle-label">{t('setup.allow_open_reg', 'Allow Open Registration')}</span>
          <span className="setup-toggle-desc">
            {t('setup.allow_open_reg_desc', 'New users can self-register without an invitation')}
          </span>
        </div>
        <label className="setup-toggle">
          <input
            type="checkbox"
            checked={form.allow_registration}
            onChange={(e) => updateField('allow_registration', e.target.checked)}
          />
          <span className="setup-toggle-slider" />
        </label>
      </div>

      <div className="setup-field" style={{ marginTop: 20 }}>
        <label className="setup-label">{t('setup.default_language', 'Default Language')}</label>
        <select
          className="setup-select"
          value={form.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="setup-channels-preview">
        <span className="setup-channels-title">{t('setup.default_channels_title', 'Default channels to be created')}</span>
        <div className="setup-channel-list">
          {defaultChannels.map((ch) => (
            <div key={ch.name} className="setup-channel-item">
              <ch.icon size={18} className="setup-channel-icon" />
              <span className="setup-channel-name">#{ch.name}</span>
              <span className="setup-channel-desc">{ch.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => {
    if (isSubmitting) {
      return (
        <div className="setup-step-content" key="step-4-loading">
          <div className="setup-loading">
            <div className="setup-spinner" />
            <span className="setup-loading-text">{t('setup.setting_up_workspace', 'Setting up your workspace...')}</span>
          </div>
        </div>
      );
    }

    if (isComplete) {
      return (
        <div className="setup-step-content" key="step-4-success">
          <div className="setup-success">
            <div className="setup-success-icon">
              <Check size={36} strokeWidth={3} />
            </div>
            <h3 className="setup-success-title">{t('setup.setup_complete_title', 'Setup Complete!')}</h3>
            <p className="setup-success-desc">
              {t('setup.setup_complete_desc', { name: form.workspace_name })}
            </p>
            <button className="setup-btn setup-btn--success" onClick={onComplete}>
              {t('setup.get_started', 'Get Started')}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="setup-step-content" key="step-4-summary">
        {error && (
          <div className="setup-error">
            <span>⚠</span> {error}
          </div>
        )}
        <div className="setup-summary">
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_admin', 'Administrator')}</span>
            <span className="setup-summary-value">{form.admin_name}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_username', 'Username')}</span>
            <span className="setup-summary-value">@{form.admin_username}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_email', 'Email')}</span>
            <span className="setup-summary-value">{form.admin_email}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_workspace', 'Workspace')}</span>
            <span className="setup-summary-value">{form.workspace_name}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_type', 'Type')}</span>
            <span className="setup-summary-value">{getLabel(workspaceTypes, form.workspace_type)}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_industry', 'Industry')}</span>
            <span className="setup-summary-value">{getLabel(industries, form.industry)}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_size', 'Size')}</span>
            <span className="setup-summary-value">{getLabel(teamSizes, form.size)}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_open_reg', 'Open Registration')}</span>
            <span className="setup-summary-value">{form.allow_registration ? t('setup.yes', 'Yes') : t('setup.no', 'No')}</span>
          </div>
          <div className="setup-summary-row">
            <span className="setup-summary-label">{t('setup.summary_lang', 'Language')}</span>
            <span className="setup-summary-value">{form.language === 'vi' ? 'Tiếng Việt' : 'English'}</span>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════

  const stepTitles = [
    { title: t('setup.admin_info_title', 'Admin Information'), subtitle: t('setup.admin_info_subtitle', 'Create the first Admin account for your workspace') },
    { title: t('setup.org_info_title', 'Organization Information'), subtitle: t('setup.org_info_subtitle', 'Configure your workspace to fit your organization') },
    { title: t('setup.options_title', 'Options'), subtitle: t('setup.options_subtitle', 'Set up access rights and default language') },
    { title: t('setup.complete_title', 'Complete'), subtitle: t('setup.complete_subtitle', 'Review configuration and initialize workspace') },
  ];

  const currentStepInfo = stepTitles[currentStep - 1];

  return (
    <div className="setup-wizard">
      {/* Progress bar at the top */}
      <div className="setup-progress-bar" style={{ width: `${progressPercent}%` }} />

      {/* ── Left Panel: Branding ── */}
      <div className="setup-left">
        {/* Decorative gradient arcs */}
        <div className="setup-arc setup-arc--1" />
        <div className="setup-arc setup-arc--2" />
        <div className="setup-arc setup-arc--3" />

        <div className="setup-brand">
          <div className="setup-logo">
            <div className="setup-logo-icon">S</div>
            <span className="setup-logo-text">Saybridge</span>
          </div>
          <p className="setup-tagline">{t('setup.init_workspace', 'Setup Workspace')}</p>
        </div>

        {/* Step dots */}
        <div className="setup-steps-indicator">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            let dotClass = 'setup-step-dot';
            if (stepNum === currentStep) dotClass += ' setup-step-dot--active';
            else if (stepNum < currentStep || isComplete) dotClass += ' setup-step-dot--completed';

            return (
              <div key={stepNum} className={dotClass}>
                <div className="setup-step-dot__circle">
                  {stepNum < currentStep || isComplete ? <Check size={16} /> : stepNum}
                </div>
                <span className="setup-step-dot__label">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel: Form ── */}
      <div className="setup-right">
        <div className="setup-form-container">
          <div className="setup-step-counter">{t('setup.step_counter', 'Step {{step}} / 4', { step: currentStep })}</div>
          <h2 className="setup-form-title">{currentStepInfo.title}</h2>
          <p className="setup-form-subtitle">{currentStepInfo.subtitle}</p>

          <div className="setup-card">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </div>

          {/* Action buttons — hidden during loading/complete states on step 4 */}
          {!(currentStep === 4 && (isSubmitting || isComplete)) && (
            <div className="setup-actions">
              {currentStep > 1 && (
                <button className="setup-btn setup-btn--secondary" onClick={handleBack}>
                  <ChevronLeft size={16} />
                  {t('setup.back', 'Back')}
                </button>
              )}

              {currentStep < 4 ? (
                <button className="setup-btn setup-btn--primary" onClick={handleNext}>
                  {t('setup.continue', 'Continue')}
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  className="setup-btn setup-btn--primary"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="setup-btn-spin" />
                      {t('setup.processing', 'Processing...')}
                    </>
                  ) : (
                    <>
                      {t('setup.init_workspace', 'Initialize Workspace')}
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
