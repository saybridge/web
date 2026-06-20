import { useMemo } from 'react';
import { usePluginStore } from '../stores/usePluginStore';
import { ComposerPlugin } from '@saybridge/composer';
import { buildComposerPlugin } from './composerPluginBuilder';

/**
 * Manifest types matching backend UIManifest
 */
export interface ComposerExtensionManifest {
  autocomplete?: {
    trigger: string;
    min_chars: number;
    endpoint: string;
  };
  action_button?: {
    icon: string;
    label: string;
    shortcut?: string;
  };
  picker_panel?: {
    endpoint: string;
    render_type: 'grid' | 'list' | 'sdui';
  };
}

export interface UIAction {
  id: string;
  label: string;
  icon: string;
  pluginSlug?: string;
  placement?: 'kebab' | 'header_button';
  section?: 'default' | 'danger';
  hook_event?: string;
  sdui_screen?: string;
}

export interface PageExtension {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
  render: 'data_only' | 'sdui' | 'iframe' | 'component';
  template?: 'item_list' | 'user_list' | 'data_table' | 'settings_form';
  data_endpoint?: string;
  item_actions?: UIAction[];
  sdui_screen?: string;
  iframe_src?: string;
  component?: string;
}

export interface ComponentSlot {
  slot: string;
  mode: 'inject' | 'override' | 'wrap';
  render: 'sdui' | 'iframe';
  sdui_component?: any;
  iframe_src?: string;
  sort_order: number;
}

export interface UIExtensions {
  channel_actions?: UIAction[];
  message_hover_actions?: UIAction[];
  message_context_menu?: UIAction[];
  chat_side_panels?: PageExtension[];
  admin_pages?: PageExtension[];
  settings_sections?: PageExtension[];
  standalone_pages?: PageExtension[];
  component_slots?: ComponentSlot[];
}

export interface PluginManifest {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  version?: string;
  category?: string;
  description?: string;
  composer_extensions?: ComposerExtensionManifest[];
  ui_extensions?: UIExtensions;
}

/**
 * Hook that fetches plugin manifests from backend and builds ComposerPlugin instances.
 *
 * Automatically refetches when a `plugin:manifests:changed` DOM event is dispatched
 * (triggered by the WebSocket `system:plugin_toggled` event from the server).
 *
 * @returns Array of ComposerPlugin instances built from backend manifests
 */
export const usePluginManifests = () => {
  const storePlugins = usePluginStore((s) => s.plugins);
  const storeLoaded = usePluginStore((s) => s.loaded);

  // Map store plugins to PluginManifest shape
  const manifests = useMemo<PluginManifest[]>(() =>
    storePlugins.map((p: any) => ({
      id: p.id,
      name: p.name,
      icon: p.icon || '',
      enabled: p.enabled,
      version: p.version,
      category: p.category,
      description: p.description || p.short_description,
      composer_extensions: p.composer_extensions,
      ui_extensions: p.ui_extensions,
    })),
    [storePlugins]
  );

  const loading = !storeLoaded;
  const error: string | null = null;

  // Build ComposerPlugin instances from manifests that have composer_extensions
  const composerPlugins = useMemo(() => {
    const plugins: ComposerPlugin[] = [];

    for (const manifest of manifests) {
      // Skip disabled plugins
      if (!manifest.enabled) continue;
      if (!manifest.composer_extensions?.length) continue;

      for (const ext of manifest.composer_extensions) {
        const plugin = buildComposerPlugin(manifest, ext);
        if (plugin) plugins.push(plugin);
      }
    }

    return plugins;
  }, [manifests]);

  // Aggregate and sort component slots from all active plugins
  const slots = useMemo(() => {
    const slotMap: Record<string, (ComponentSlot & { id: string; pluginSlug: string })[]> = {};

    for (const manifest of manifests) {
      if (!manifest.enabled) continue;
      const componentSlots = manifest.ui_extensions?.component_slots || [];

      for (const slotDef of componentSlots) {
        if (!slotMap[slotDef.slot]) {
          slotMap[slotDef.slot] = [];
        }

        let iframeSrc = slotDef.iframe_src;
        if (iframeSrc) {
          iframeSrc = iframeSrc.replace('{slug}', manifest.id);
        }

        slotMap[slotDef.slot].push({
          ...slotDef,
          id: `${manifest.id}-${slotDef.slot}-${slotDef.sort_order}`,
          pluginSlug: manifest.id,
          iframe_src: iframeSrc
        });
      }
    }

    // Sort by sort_order ascending
    for (const key in slotMap) {
      slotMap[key].sort((a, b) => a.sort_order - b.sort_order);
    }

    return slotMap;
  }, [manifests]);

  return { composerPlugins, manifests, slots, loading, error };
};
