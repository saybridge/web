import React, { useState, useEffect, useCallback } from 'react';
import { SDUIRenderer, SDUINode, registerComponent, SDUIAction } from '@saybridge/ui';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { UIComponent } from './types';
import { DEFAULT_API_URL } from '../services/api';
import './WebDynamicRenderer.css';

// Derive the backend origin from the configured API URL so SDUI calls work in every
// environment (dev, staging, prod) instead of being pinned to localhost. DEFAULT_API_URL
// includes the /api/v1 path, while manifest endpoints already carry their own absolute
// path (e.g. "GET /api/v1/..."), so here we only need the scheme + host.
const API_BASE = new URL(DEFAULT_API_URL).origin;

// ─── Utility API fetch ────────────────────────────────────────────────────────

async function apiFetch(apiString: string, params?: Record<string, string>) {
  let url = apiString.replace(/^(GET|POST|PUT|DELETE)\s+/, '');
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    });
  }
  if (!url.startsWith('http')) url = API_BASE + url;
  const token = localStorage.getItem('saybridge_access_token');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data ?? json;
}

// ─── Custom SDUI Components Registered in Web Client ──────────────────────────

function StatusCard({ label, title, api, valueKey, trueText, falseText }: any) {
  const [value, setValue] = useState<any>(null);

  useEffect(() => {
    apiFetch(api).then((data) => {
      setValue(valueKey ? data?.[valueKey] : data);
    }).catch(() => setValue(null));
  }, [api, valueKey]);

  const display = value === true ? (trueText || '✓') : value === false ? (falseText || '✗') : String(value ?? '—');
  const cardLabel = label || title || 'Status';

  return (
    <div className="sdui-status-card">
      <span className="sdui-status-label">{cardLabel}</span>
      <span className="sdui-status-value">{display}</span>
    </div>
  );
}

function CardGrid({ api, columns = 3, onCardClick }: any) {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(api)
      .then((data) => {
        const list = data?.apps ?? data ?? [];
        setItems(Array.isArray(list) ? list : []);
      })
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) return <div className="sdui-loading">{t('sdui.loading', 'Loading...')}</div>;
  if (items.length === 0) return <div className="sdui-empty">{t('sdui.no_data', 'No data available')}</div>;

  return (
    <div className="sdui-card-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((item, i) => (
        <div key={item.id || item.slug || i} className="sdui-card" onClick={() => onCardClick?.(item)}>
          <div className="sdui-card-icon">{item.icon || '📦'}</div>
          <div className="sdui-card-content">
            <h3>{item.name}</h3>
            <p className="sdui-card-developer">{item.developer || item.author || 'Community'}</p>
            <p className="sdui-card-desc">{item.short_description || item.description}</p>
          </div>
          {item.version && <span className="sdui-card-version">v{item.version}</span>}
        </div>
      ))}
    </div>
  );
}

function DataTable({ api, columns, actions }: any) {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    apiFetch(api)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action: any, row: any) => {
    const actionApi = action.api.replace('{id}', row.id);
    const method = (actionApi.match(/^(POST|PUT|DELETE)\s+/) || [])[1] || 'POST';
    const url = actionApi.replace(/^(POST|PUT|DELETE)\s+/, '');
    const token = localStorage.getItem('saybridge_access_token');
    await fetch(API_BASE + url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  };

  if (loading) return <div className="sdui-loading">{t('sdui.loading', 'Loading...')}</div>;

  return (
    <div className="sdui-table-wrap">
      <table className="sdui-table">
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.key} style={{ width: col.width }}>{col.label}</th>
            ))}
            {actions && <th>{t('sdui.actions', 'Actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="sdui-empty">{t('sdui.no_data', 'No data available')}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map((col: any) => (
                  <td key={col.key}>
                    {col.type === 'badge' ? (
                      <span className={`sdui-badge ${row[col.key]}`}>{row[col.key]}</span>
                    ) : col.type === 'date' ? (
                      new Date(row[col.key]).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')
                    ) : (
                      row[col.key]
                    )}
                  </td>
                ))}
                {actions && (
                  <td className="sdui-actions">
                    {actions.map((action: any, j: number) => (
                      <button key={j} className={`sdui-action-btn ${action.variant || ''}`} onClick={() => handleAction(action, row)}>
                        {action.label}
                      </button>
                    ))}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ChipGroup({ api, valueKey, labelKey, onSelect }: any) {
  const { t } = useTranslation();
  const [chips, setChips] = useState<any[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    apiFetch(api).then((data) => setChips(Array.isArray(data) ? data : []));
  }, [api]);

  return (
    <div className="sdui-chip-group">
      <button className={`sdui-chip ${selected === '' ? 'active' : ''}`} onClick={() => { setSelected(''); onSelect?.(''); }}>
        {t('sdui.all', 'All')}
      </button>
      {chips.map((chip) => (
        <button
          key={chip[valueKey]}
          className={`sdui-chip ${selected === chip[valueKey] ? 'active' : ''}`}
          onClick={() => {
            const next = selected === chip[valueKey] ? '' : chip[valueKey];
            setSelected(next);
            onSelect?.(next);
          }}
        >
          {chip.icon && <span>{chip.icon}</span>} {chip[labelKey]}
        </button>
      ))}
    </div>
  );
}

// Register these custom components in the SDUI Registry
registerComponent('status_card', StatusCard);
registerComponent('card_grid', CardGrid);
registerComponent('data_table', DataTable);
registerComponent('chip_group', ChipGroup);

// ─── Adapter: Map old component-driven schema to Atomic SDUI Nodes ────────────

function mapToSDUINode(comp: UIComponent): SDUINode {
  switch (comp.type) {
    case 'section':
      return {
        type: 'Flex',
        styles: { py: 2, borderBottomWidth: 1, borderColor: '#1E1E24', mb: 3, width: '100%' },
        children: [
          {
            type: 'Text',
            styles: { fontSize: 'lg', fontWeight: 'bold', color: 'white' },
            props: { content: comp.props.title },
          },
        ],
      };

    case 'text_input':
      return {
        type: 'Flex',
        styles: { flexDirection: 'column', gap: 2, mb: 4, width: '100%' },
        children: [
          {
            type: 'Text',
            styles: { fontSize: 'xs', fontWeight: 'semibold', color: 'muted' },
            props: { content: comp.props.label },
          },
          {
            type: 'Input',
            props: {
              name: comp.props.key || comp.props.name,
              placeholder: comp.props.placeholder,
              type: comp.props.type || 'text',
              value: comp.props.value,
            },
          },
        ],
      };

    case 'submit_button':
      return {
        type: 'Button',
        styles: { mt: 2, width: '100%', alignItems: 'center' },
        props: {
          label: comp.props.label,
          action: {
            type: 'api_call',
            target: comp.props.api,
            successMessage: comp.props.successMessage || i18n.t('sdui.save_success', 'Configuration saved successfully!'),
          },
        },
      };

    case 'button':
      return {
        type: 'Button',
        styles: { mr: 2, bg: comp.props.variant === 'primary' ? 'primary' : 'card' },
        props: {
          label: comp.props.label,
          action: {
            type: comp.props.action || 'click',
            target: comp.props.target,
          },
        },
      };

    case 'text':
      return {
        type: 'Text',
        styles: { fontSize: 'sm', color: 'muted', mb: 2 },
        props: { content: comp.props.text },
      };

    // Fallback directly to registered custom components
    default:
      return {
        type: comp.type,
        props: comp.props,
      };
  }
}

// ─── Main WebDynamicRenderer Wrapper Component ────────────────────────────────

export function WebDynamicRenderer({ components, onNavigate }: { components: UIComponent[]; onNavigate?: (target: string) => void }) {
  const { t } = useTranslation();
  const sduiSchema = components.map(mapToSDUINode);
  const [initialValues, setInitialValues] = useState<Record<string, any>>({});
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    const hasAiConfigSubmit = components.some(
      (c) => c.type === 'submit_button' && c.props?.api?.includes('/api/v1/ai/config')
    );

    if (hasAiConfigSubmit) {
      setLoadingConfig(true);
      apiFetch('GET /api/v1/ai/config')
        .then((data) => {
          if (data) {
            const mappedValues: Record<string, any> = {};
            Object.entries(data).forEach(([k, v]) => {
              mappedValues[k] = v;
            });
            setInitialValues(mappedValues);
          }
        })
        .catch((err) => console.error('[WebDynamicRenderer] Failed to pre-fetch AI config:', err))
        .finally(() => setLoadingConfig(false));
    }
  }, [components]);

  const handleAction = async (action: SDUIAction, formValues: Record<string, any>) => {
    if (action.type === 'api_call' && action.target) {
      try {
        const method = action.target.match(/^(POST|PUT|PATCH|DELETE)\s+/)?.[1] || 'POST';
        const url = action.target.replace(/^(POST|PUT|PATCH|DELETE)\s+/, '');
        const token = localStorage.getItem('saybridge_access_token');

        // Coerce values to appropriate types
        const coercedValues: Record<string, any> = {};
        Object.entries(formValues).forEach(([key, val]) => {
          if (/^\d+$/.test(val)) {
            coercedValues[key] = parseInt(val, 10);
          } else if (val === 'true') {
            coercedValues[key] = true;
          } else if (val === 'false') {
            coercedValues[key] = false;
          } else {
            coercedValues[key] = val;
          }
        });

        const res = await fetch(url.startsWith('http') ? url : API_BASE + url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(coercedValues),
        });
        const result = await res.json();
        if (result.success !== false) {
          alert(action.successMessage || t('sdui.action_success', 'Action completed successfully!'));
        } else {
          alert(result.error || action.errorMessage || t('sdui.action_failed', 'Action failed'));
        }
      } catch (err) {
        alert(t('sdui.conn_error', 'Cannot connect to server'));
      }
    } else if (action.type === 'navigation' && action.target) {
      onNavigate?.(action.target);
    } else {
      console.log('[WebDynamicRenderer] Unhandled action:', action, formValues);
    }
  };

  if (loadingConfig) {
    return <div className="sdui-loading">{t('sdui.loading_ai', 'Loading AI configuration...')}</div>;
  }

  return (
    <div className="sdui-renderer-wrapper">
      <SDUIRenderer
        key={JSON.stringify(initialValues)}
        schema={sduiSchema}
        onAction={handleAction}
        initialValues={initialValues}
      />
    </div>
  );
}

export default WebDynamicRenderer;
