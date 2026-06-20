import React, { useState, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { ComposerPlugin, PluginContext, AutocompleteItem } from '@saybridge/composer';
import { api } from '../services/api';
import type { PluginManifest, ComposerExtensionManifest } from './usePluginManifests';
import './pluginPicker.css';

/**
 * Dynamically resolve a Lucide icon by name.
 * Falls back to a generic icon if not found.
 */
const getIcon = (iconName: string, size = 18): React.ReactNode => {
  // Convert icon name to PascalCase: "smile" → "Smile", "message-square" → "MessageSquare"
  const pascalCase = iconName
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  const IconComponent = (LucideIcons as any)[pascalCase];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  // Fallback: render icon name as emoji if it's an emoji character
  if (/\p{Emoji}/u.test(iconName)) {
    return <span style={{ fontSize: size }}>{iconName}</span>;
  }
  return <LucideIcons.Puzzle size={size} />;
};

// ─── Picker Panel Component ─────────────────────────────────

interface PickerPanelProps {
  endpoint: string;
  renderType: string;
  visible: boolean;
  onSelect: (value: string, label: string) => void;
  onClose: () => void;
}

/** Grid picker for emoji-style data */
const GridPickerPanel: React.FC<PickerPanelProps> = ({ endpoint, visible, onSelect, onClose }) => {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    if (!visible || loaded) return;
    setLoading(true);
    api.get(endpoint)
      .then(res => {
        if (res.data?.success) {
          setItems(res.data.data || []);
        }
        setLoaded(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, endpoint, loaded]);

  if (!visible) return null;

  const filtered = search
    ? items.filter((item: any) =>
        (item.name || item.shortcode || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.aliases || []).some((a: string) => a.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  return (
    <div className="sb-plugin-picker" onClick={e => e.stopPropagation()}>
      <div className="sb-plugin-picker-header">
        <input
          type="text"
          className="sb-plugin-picker-search"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <button className="sb-plugin-picker-close" onClick={onClose}>✕</button>
      </div>
      <div className="sb-plugin-picker-grid">
        {loading && <div className="sb-plugin-picker-loading">Loading...</div>}
        {!loading && filtered.length === 0 && <div className="sb-plugin-picker-empty">No items found</div>}
        {filtered.map((item: any, i: number) => (
          <button
            key={item.id || i}
            className="sb-plugin-picker-item"
            title={item.name || item.shortcode || ''}
            onClick={() => onSelect(
              item.emoji || item.value || item.url || item.name,
              item.name || item.shortcode || ''
            )}
          >
            {item.emoji ? (
              <span className="sb-plugin-picker-emoji">{item.emoji}</span>
            ) : item.url ? (
              <img src={item.url} alt={item.name} className="sb-plugin-picker-img" />
            ) : (
              <span>{item.name || '?'}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Dynamic Action Button Component ─────────────────────────

interface DynamicActionButtonProps {
  ext: ComposerExtensionManifest;
  ctx: PluginContext;
}

const DynamicActionButton: React.FC<DynamicActionButtonProps> = ({ ext, ctx }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleSelect = useCallback((value: string, _label: string) => {
    ctx.insertText(value);
    setShowPicker(false);
  }, [ctx]);

  if (!ext.action_button) return null;

  return (
    <div className="sb-composer-emoji-wrapper">
      <button
        type="button"
        className={`sb-composer-action-btn ${showPicker ? 'active' : ''}`}
        onClick={() => setShowPicker(!showPicker)}
        title={ext.action_button.label}
      >
        {getIcon(ext.action_button.icon)}
      </button>
      {ext.picker_panel && (
        <GridPickerPanel
          endpoint={ext.picker_panel.endpoint}
          renderType={ext.picker_panel.render_type}
          visible={showPicker}
          onSelect={handleSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
};

// ─── Builder ─────────────────────────────────────────────────

/**
 * Converts a backend ComposerExtension manifest into a live ComposerPlugin.
 *
 * This is the bridge between backend plugin declarations and the frontend
 * composer plugin system. The backend declares WHAT it wants (endpoints, triggers),
 * and this builder creates HOW it renders and behaves.
 */
export const buildComposerPlugin = (
  manifest: PluginManifest,
  ext: ComposerExtensionManifest
): ComposerPlugin | null => {
  const plugin: ComposerPlugin = {
    name: `${manifest.id}-composer`,
    priority: 5,
  };

  // ─── Autocomplete from API endpoint ───
  if (ext.autocomplete) {
    const { trigger, min_chars, endpoint } = ext.autocomplete;

    plugin.autocomplete = {
      trigger,
      minChars: min_chars || 2,
      search: async (query): Promise<AutocompleteItem[]> => {
        try {
          const res = await api.get(endpoint, { params: { q: query } });
          if (!res.data?.success) return [];

          return (res.data.data || []).map((item: any) => ({
            id: item.id || item.shortcode || item.name,
            label: item.emoji
              ? `${item.emoji} :${item.shortcode || item.name}:`
              : item.name || item.label,
            sublabel: item.category || item.description,
            value: item.emoji || item.value || item.name,
            icon: item.emoji
              ? <span style={{ fontSize: 18 }}>{item.emoji}</span>
              : item.url
                ? <img src={item.url} alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />
                : undefined,
          }));
        } catch {
          return [];
        }
      },
    };
  }

  // ─── Action button + picker panel ───
  if (ext.action_button) {
    plugin.actionButtons = (ctx) => (
      <DynamicActionButton ext={ext} ctx={ctx} />
    );
  }

  // ─── Keyboard shortcut (e.g., "ctrl+e") ───
  if (ext.action_button?.shortcut) {
    const parts = ext.action_button.shortcut.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const ctrl = parts.includes('ctrl') || parts.includes('cmd');
    const shift = parts.includes('shift');

    plugin.shortcuts = [{
      key,
      ctrl,
      shift,
      handler: (_ctx) => {
        // Toggle picker — dispatch a custom event that DynamicActionButton listens to
        document.dispatchEvent(new CustomEvent(`plugin:toggle:${manifest.id}`));
      },
    }];
  }

  return plugin;
};
