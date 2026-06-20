import { create } from 'zustand';
import { api } from '../services/api';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icon?: string;
  category?: string;
  short_description?: string;
  [key: string]: any; // Allow extra fields from backend
}

interface PluginStore {
  plugins: PluginManifest[];
  loaded: boolean;
  fetchPlugins: () => Promise<void>;
  isEnabled: (slug: string) => boolean;
  setPluginEnabled: (slug: string, enabled: boolean) => void;
}

// Dedup guard — only one in-flight fetch at a time
let _inflightFetch: Promise<void> | null = null;

export const usePluginStore = create<PluginStore>((set, get) => ({
  plugins: [],
  loaded: false,

  fetchPlugins: () => {
    if (_inflightFetch) return _inflightFetch;
    _inflightFetch = (async () => {
      try {
        const res = await api.get('/plugins/manifest');
        if (res.data?.success && Array.isArray(res.data.data)) {
          set({ plugins: res.data.data, loaded: true });
        }
      } catch (err) {
        console.warn('[PluginStore] Failed to fetch plugins:', err);
      } finally {
        _inflightFetch = null;
      }
    })();
    return _inflightFetch;
  },

  isEnabled: (slug: string) => {
    const { plugins, loaded } = get();
    if (!loaded) return true; // Default to showing until loaded
    const plugin = plugins.find(
      (p) => p.id === slug
    );
    if (!plugin) return true; // Not a plugin feature = always show
    return plugin.enabled;
  },

  setPluginEnabled: (slug: string, enabled: boolean) => {
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.id === slug ? { ...p, enabled } : p
      ),
    }));
  },
}));

// Listen for real-time plugin toggle events from WebSocket
if (typeof window !== 'undefined') {
  window.addEventListener('plugin:manifests:changed', ((e: CustomEvent) => {
    const { slug, enabled } = e.detail || {};
    if (slug != null && enabled != null) {
      usePluginStore.getState().setPluginEnabled(slug, enabled);
    }
  }) as EventListener);
}
