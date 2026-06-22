import { create } from 'zustand';
import { api } from '../services/api';

// ─── Types ───
export type MessageDensity = 'cozy' | 'compact';
export type EnterBehavior = 'send' | 'newline';
export type RoomSortOrder = 'activity' | 'alphabetical' | 'unread';
export type AccentColor = 'gray' | 'indigo' | 'blue' | 'cyan' | 'green' | 'emerald' | 'orange' | 'rose' | 'pink' | 'red';
export type WallpaperOption = 'ambient' | 'solid' | 'aurora' | 'sunset' | 'bubblegum' | 'custom';
export type LiquidGlass = 'off' | 'subtle' | 'medium' | 'strong';

// Liquid-glass intensity presets: SVG displacement scale + backdrop recipe + rim alpha.
export const LIQUID_PRESETS: Record<LiquidGlass, { scale: number; blur: number; sat: number; bright: number; rim: number }> = {
  off:    { scale: 0,  blur: 4, sat: 120, bright: 100, rim: 0.16 },
  subtle: { scale: 22, blur: 6, sat: 130, bright: 103, rim: 0.26 },
  medium: { scale: 42, blur: 5, sat: 140, bright: 104, rim: 0.34 },
  strong: { scale: 66, blur: 4, sat: 125, bright: 102, rim: 0.43 },
};

// Accent color presets: [main, hover, r, g, b]
export const ACCENT_PRESETS: Record<AccentColor, { main: string; hover: string; r: number; g: number; b: number }> = {
  gray:    { main: '#94a3b8', hover: '#cbd5e1', r: 148, g: 163, b: 184 },
  indigo:  { main: '#6366f1', hover: '#818cf8', r: 99,  g: 102, b: 241 },
  blue:    { main: '#3b82f6', hover: '#60a5fa', r: 59,  g: 130, b: 246 },
  cyan:    { main: '#06b6d4', hover: '#22d3ee', r: 6,   g: 182, b: 212 },
  green:   { main: '#22c55e', hover: '#4ade80', r: 34,  g: 197, b: 94  },
  emerald: { main: '#10b981', hover: '#34d399', r: 16,  g: 185, b: 129 },
  orange:  { main: '#f97316', hover: '#fb923c', r: 249, g: 115, b: 22  },
  rose:    { main: '#f43f5e', hover: '#fb7185', r: 244, g: 63,  b: 94  },
  pink:    { main: '#ec4899', hover: '#f472b6', r: 236, g: 72,  b: 153 },
  red:     { main: '#ef4444', hover: '#f87171', r: 239, g: 68,  b: 68  },
};

export interface Preferences {
  messageDensity: MessageDensity;
  fontSize: number;
  reduceMotion: boolean;
  enterBehavior: EnterBehavior;
  linkPreview: boolean;
  roomSortOrder: RoomSortOrder;
  showReadReceipts: boolean;
  accentColor: AccentColor;
  wallpaper: WallpaperOption;
  liquidGlass: LiquidGlass;
}

interface PreferencesStore extends Preferences {
  loaded: boolean;
  fetchPreferences: () => Promise<void>;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  applyToDOM: () => void;
}

const STORAGE_KEY = 'saybridge_preferences';

const DEFAULTS: Preferences = {
  messageDensity: 'cozy',
  fontSize: 14,
  reduceMotion: false,
  enterBehavior: 'send',
  linkPreview: true,
  roomSortOrder: 'activity',
  showReadReceipts: true,
  accentColor: 'gray',
  wallpaper: 'ambient',
  liquidGlass: 'strong',
};

// Load from localStorage as fallback
function loadFromStorage(): Partial<Preferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(prefs: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

// Map backend snake_case keys to frontend camelCase
function mapFromAPI(apiSettings: any): Partial<Preferences> {
  const result: Partial<Preferences> = {};
  if (apiSettings.message_density) result.messageDensity = apiSettings.message_density;
  if (apiSettings.font_size) result.fontSize = apiSettings.font_size;
  if (typeof apiSettings.reduce_motion === 'boolean') result.reduceMotion = apiSettings.reduce_motion;
  if (apiSettings.enter_behavior) result.enterBehavior = apiSettings.enter_behavior;
  if (typeof apiSettings.link_preview === 'boolean') result.linkPreview = apiSettings.link_preview;
  if (apiSettings.room_sort_order) result.roomSortOrder = apiSettings.room_sort_order;
  if (typeof apiSettings.show_read_receipts === 'boolean') result.showReadReceipts = apiSettings.show_read_receipts;
  if (apiSettings.accent_color) result.accentColor = apiSettings.accent_color;
  if (apiSettings.wallpaper) result.wallpaper = apiSettings.wallpaper;
  if (apiSettings.liquid_glass) result.liquidGlass = apiSettings.liquid_glass;
  return result;
}

// Map frontend camelCase to backend snake_case
function mapToAPI(key: keyof Preferences, value: any): Record<string, any> {
  const keyMap: Record<keyof Preferences, string> = {
    messageDensity: 'message_density',
    fontSize: 'font_size',
    reduceMotion: 'reduce_motion',
    enterBehavior: 'enter_behavior',
    linkPreview: 'link_preview',
    roomSortOrder: 'room_sort_order',
    showReadReceipts: 'show_read_receipts',
    accentColor: 'accent_color',
    wallpaper: 'wallpaper',
    liquidGlass: 'liquid_glass',
  };
  return { [keyMap[key]]: value };
}

// Debounced API save
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUpdates: Record<string, any> = {};

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const updates = { ...pendingUpdates };
    pendingUpdates = {};
    try {
      await api.patch('/users/me/settings', updates);
    } catch (err) {
      console.error('[Preferences] Failed to save:', err);
    }
  }, 500);
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  ...DEFAULTS,
  ...loadFromStorage(),
  loaded: false,

  fetchPreferences: async () => {
    try {
      const res = await api.get('/users/me');
      const data = res.data?.data || res.data;
      if (data?.settings) {
        const mapped = mapFromAPI(data.settings);
        // localStorage fills any keys the API doesn't return (e.g. a newer pref the
        // backend doesn't persist yet), so a local choice isn't reset on refresh.
        const merged = { ...DEFAULTS, ...loadFromStorage(), ...mapped };
        set({ ...merged, loaded: true });
        saveToStorage(merged);
        get().applyToDOM();
      } else {
        set({ loaded: true });
        get().applyToDOM();
      }
    } catch (err) {
      console.error('[Preferences] Failed to fetch:', err);
      set({ loaded: true });
      get().applyToDOM();
    }
  },

  updatePreference: (key, value) => {
    set({ [key]: value } as any);

    // Save to localStorage immediately
    const state = get();
    const prefs: Preferences = {
      messageDensity: state.messageDensity,
      fontSize: state.fontSize,
      reduceMotion: state.reduceMotion,
      enterBehavior: state.enterBehavior,
      linkPreview: state.linkPreview,
      roomSortOrder: state.roomSortOrder,
      showReadReceipts: state.showReadReceipts,
      accentColor: state.accentColor,
      wallpaper: state.wallpaper,
      liquidGlass: state.liquidGlass,
    };
    // Apply key update to prefs too since set is async
    (prefs as any)[key] = value;
    saveToStorage(prefs);

    // Debounced API save
    Object.assign(pendingUpdates, mapToAPI(key, value));
    debouncedSave();

    // Apply to DOM immediately
    get().applyToDOM();
  },

  applyToDOM: () => {
    const state = get();
    const root = document.documentElement;

    // Font size
    root.style.setProperty('--msg-font-size', `${state.fontSize}px`);
    root.style.setProperty('--msg-line-height', state.fontSize <= 13 ? '1.4' : '1.5');

    // Density
    root.setAttribute('data-density', state.messageDensity);

    // Reduce motion
    if (state.reduceMotion) {
      root.setAttribute('data-reduce-motion', 'true');
    } else {
      root.removeAttribute('data-reduce-motion');
    }

    // Accent color
    const preset = ACCENT_PRESETS[state.accentColor] || ACCENT_PRESETS.gray;
    // Pick a readable text/icon color for content placed ON the accent fill:
    // dark text on light accents (e.g. slate), white on dark/saturated ones (YIQ).
    const yiq = (preset.r * 299 + preset.g * 587 + preset.b * 114) / 1000;
    const accentContrast = yiq > 150 ? '#0c1020' : '#ffffff';
    root.style.setProperty('--accent', preset.main);
    root.style.setProperty('--accent-hover', preset.hover);
    root.style.setProperty('--accent-rgb', `${preset.r}, ${preset.g}, ${preset.b}`);
    root.style.setProperty('--accent-contrast', accentContrast);
    root.style.setProperty('--accent-muted', `rgba(${preset.r}, ${preset.g}, ${preset.b}, 0.15)`);
    root.style.setProperty('--accent-glow', `rgba(${preset.r}, ${preset.g}, ${preset.b}, 0.30)`);
    root.style.setProperty('--accent-glass', `rgba(${preset.r}, ${preset.g}, ${preset.b}, 0.08)`);

    // Liquid glass intensity — drive the SVG displacement + backdrop recipe + rim.
    const lg = LIQUID_PRESETS[state.liquidGlass] || LIQUID_PRESETS.strong;
    const dispEl = document.querySelector('#sb-liquid-glass feDisplacementMap');
    if (dispEl) dispEl.setAttribute('scale', String(lg.scale));
    root.style.setProperty(
      '--lg-backdrop',
      lg.scale === 0
        ? 'var(--blur-regular)'
        : `blur(${lg.blur}px) saturate(${lg.sat}%) brightness(${lg.bright}%) url("#sb-liquid-glass")`
    );
    root.style.setProperty(
      '--glass-rim',
      `inset 0 1px 1px rgba(255, 255, 255, ${lg.rim}), inset 0 -1px 1px rgba(0, 0, 0, 0.28), inset 1px 0 1px rgba(255, 255, 255, 0.05), inset -1px 0 1px rgba(255, 255, 255, 0.05)`
    );

    // Wallpaper
    root.setAttribute('data-wallpaper', state.wallpaper || 'ambient');
    if (state.wallpaper === 'custom') {
      const customWp = localStorage.getItem('saybridge_custom_wallpaper') || '';
      root.style.setProperty('--custom-wallpaper-url', customWp ? `url(${customWp})` : 'none');
      const wpMode = localStorage.getItem('saybridge_custom_wallpaper_mode') || 'cover';
      const wpScale = localStorage.getItem('saybridge_custom_wallpaper_scale') || '200';
      
      let size = 'cover';
      let repeat = 'no-repeat';
      if (wpMode === 'repeat') {
        size = `${wpScale}px auto`;
        repeat = 'repeat';
      } else if (wpMode === 'contain') {
        size = 'contain';
        repeat = 'no-repeat';
      } else if (wpMode === 'stretch') {
        size = '100% 100%';
        repeat = 'no-repeat';
      }
      
      root.style.setProperty('--custom-wallpaper-size', size);
      root.style.setProperty('--custom-wallpaper-repeat', repeat);
    }
  },
}));
