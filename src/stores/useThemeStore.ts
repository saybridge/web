import { create } from 'zustand';

type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

interface ThemeState {
  /** User's chosen preference */
  theme: ThemePreference;
  /** Actual applied theme (system → resolved) */
  resolvedTheme: ResolvedTheme;
  /** Set theme preference and apply to DOM */
  setTheme: (theme: ThemePreference) => void;
  /** Initialize theme on app boot */
  initTheme: () => void;
}

const STORAGE_KEY = 'saybridge-theme';

/**
 * Resolve the effective theme from a preference.
 * 'system' → check `prefers-color-scheme` media query.
 */
function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

/**
 * Apply the resolved theme to the DOM.
 * Sets `data-theme` on `<html>` and updates `<meta name="theme-color">`.
 */
function applyToDOM(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);

  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#f0f0f5' : '#0a0a0f');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  setTheme: (theme: ThemePreference) => {
    const resolved = resolveTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    applyToDOM(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  initTheme: () => {
    // Read stored preference (anti-FOUC script may have already applied it)
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const theme = stored || 'dark';
    const resolved = resolveTheme(theme);
    applyToDOM(resolved);
    set({ theme, resolvedTheme: resolved });

    // Listen for system theme changes (only matters when preference is 'system')
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const current = get();
      if (current.theme === 'system') {
        const newResolved = resolveTheme('system');
        applyToDOM(newResolved);
        set({ resolvedTheme: newResolved });
      }
    };
    mql.addEventListener('change', handler);
  },
}));
