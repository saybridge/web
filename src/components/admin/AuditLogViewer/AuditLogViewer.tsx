import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Download } from 'lucide-react';
import { api } from '../../../services/api';
import { PageContainer } from '@saybridge/ui';
import './AuditLogViewer.css';

/* ============ Types ============ */
interface AuditEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name: string;
  action: string;
  resource: string;
  resource_id: string;
  ip_address: string;
  details?: {
    old_value?: Record<string, unknown>;
    new_value?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

interface AuditResponse {
  success: boolean;
  data: {
    entries: AuditEntry[];
    total: number;
    page: number;
    limit: number;
  };
}

interface Filters {
  action: string;
  actor: string;
  resource: string;
  from: string;
  to: string;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'user', label: 'User' },
  { value: 'room', label: 'Room' },
  { value: 'message', label: 'Message' },
  { value: 'plugin', label: 'Plugin' },
  { value: 'setting', label: 'Setting' },
  { value: 'role', label: 'Role' },
];

/* ============ Mock Data ============ */
function generateMockEntries(): AuditEntry[] {
  const actions = ['create', 'update', 'delete', 'login', 'logout'];
  const resources = ['user', 'room', 'message', 'plugin', 'setting'];
  const actors = [
    { id: 'u1', name: 'admin' },
    { id: 'u2', name: 'paul.nguyen' },
    { id: 'u3', name: 'jane.doe' },
    { id: 'u4', name: 'system' },
  ];
  const entries: AuditEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < 42; i++) {
    const actor = actors[Math.floor(Math.random() * actors.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const resource = resources[Math.floor(Math.random() * resources.length)];
    entries.push({
      id: `audit-${i}`,
      timestamp: new Date(now - i * 3600 * 1000 * (1 + Math.random() * 2)).toISOString(),
      actor_id: actor.id,
      actor_name: actor.name,
      action,
      resource,
      resource_id: `${resource}_${Math.random().toString(36).substring(2, 10)}`,
      ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      details:
        action === 'update'
          ? {
              old_value: { status: 'active', name: 'Old Name' },
              new_value: { status: 'inactive', name: 'New Name' },
            }
          : action === 'create'
          ? { new_value: { name: `New ${resource}`, created_by: actor.name } }
          : action === 'delete'
          ? { old_value: { name: `Deleted ${resource}`, id: `${resource}_xyz` } }
          : undefined,
    });
  }

  return entries;
}

/* ============ Helpers ============ */
function getActionBadgeClass(action: string): string {
  switch (action) {
    case 'create':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
      return 'delete';
    case 'login':
      return 'login';
    case 'logout':
      return 'logout';
    default:
      return 'default';
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function entriesToCsv(entries: AuditEntry[]): string {
  const header = 'Timestamp,Actor,Action,Resource,Resource ID,IP Address\n';
  const rows = entries
    .map(
      (e) =>
        `"${e.timestamp}","${e.actor_name}","${e.action}","${e.resource}","${e.resource_id}","${e.ip_address}"`
    )
    .join('\n');
  return header + rows;
}

/* ============ Component ============ */
export function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    action: '',
    actor: '',
    resource: '',
    from: '',
    to: '',
  });

  const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...filters });

  const fetchData = useCallback(
    async (p: number, l: number, f: Filters) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page: p, limit: l };
        if (f.action) params.action = f.action;
        if (f.actor) params.actor_id = f.actor;
        if (f.resource) params.resource = f.resource;
        if (f.from) params.from = f.from;
        if (f.to) params.to = f.to;

        const res = await api.get('/admin/audit', { params });
        const resData = res.data?.data;

        if (res.data?.success && resData) {
          // Handle both formats: { entries: [...], total } or direct array
          const rawEntries = Array.isArray(resData)
            ? resData
            : Array.isArray(resData.entries)
              ? resData.entries
              : Array.isArray(resData.logs)
                ? resData.logs
                : [];
          const rawTotal = typeof resData.total === 'number'
            ? resData.total
            : rawEntries.length;

          // Map backend field names to frontend interface
          const mapped: AuditEntry[] = rawEntries.map((e: any) => ({
            id: e.id || e.ID || '',
            timestamp: e.created_at || e.CreatedAt || e.timestamp || '',
            actor_id: e.actor_id || e.ActorID || '',
            actor_name: e.actor_name || e.ActorName || e.actor_id || 'Unknown',
            action: e.action || e.Action || '',
            resource: e.resource || e.Resource || '',
            resource_id: e.resource_id || e.ResourceID || '',
            ip_address: e.ip_address || e.IPAddress || '',
            details: e.details || e.Details || undefined,
          }));

          setEntries(mapped);
          setTotal(rawTotal);
        } else {
          const mock = generateMockEntries();
          setEntries(mock.slice((p - 1) * l, p * l));
          setTotal(mock.length);
        }
      } catch {
        const mock = generateMockEntries();
        setEntries(mock.slice((p - 1) * l, p * l));
        setTotal(mock.length);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(page, limit, appliedFilters);
  }, [page, limit, appliedFilters, fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...filters });
  };

  const handleReset = () => {
    const empty: Filters = { action: '', actor: '', resource: '', from: '', to: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  };

  const handleExportCsv = () => {
    const csv = entriesToCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <PageContainer
      title="Audit Log"
      subtitle="Track all administrative actions and system events"
      icon={<ClipboardList size={24} />}
      actions={
        <button className="audit-export-btn" onClick={handleExportCsv}>
          <Download size={16} />
          Export CSV
        </button>
      }
    >

      {/* Filter Bar */}
      <div className="audit-filter-bar">
        <div className="audit-filter-group">
          <label className="audit-filter-label">Action</label>
          <select
            className="audit-filter-select"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="audit-filter-group">
          <label className="audit-filter-label">Actor</label>
          <input
            className="audit-filter-input"
            type="text"
            placeholder="Search user…"
            value={filters.actor}
            onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
          />
        </div>

        <div className="audit-filter-group">
          <label className="audit-filter-label">Resource</label>
          <select
            className="audit-filter-select"
            value={filters.resource}
            onChange={(e) => setFilters((f) => ({ ...f, resource: e.target.value }))}
          >
            {RESOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="audit-filter-group">
          <label className="audit-filter-label">From</label>
          <input
            className="audit-filter-input"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>

        <div className="audit-filter-group">
          <label className="audit-filter-label">To</label>
          <input
            className="audit-filter-input"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>

        <div className="audit-filter-actions">
          <button className="audit-filter-apply-btn" onClick={handleApplyFilters}>
            Apply
          </button>
          <button className="audit-filter-reset-btn" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="audit-table-container">
        {loading ? (
          <div className="audit-loading" />
        ) : entries.length === 0 ? (
          <div className="audit-empty">
            <span>📭</span>
            <p>No audit entries found matching your filters</p>
          </div>
        ) : (
          <>
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Resource ID</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className={expandedId === entry.id ? 'expanded' : ''}
                      onClick={() => toggleExpand(entry.id)}
                    >
                      <td>
                        <span className="audit-timestamp">{formatTimestamp(entry.timestamp)}</span>
                      </td>
                      <td>{entry.actor_name}</td>
                      <td>
                        <span className={`audit-action-badge ${getActionBadgeClass(entry.action)}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td>{entry.resource}</td>
                      <td>
                        <span className="audit-resource-id" title={entry.resource_id}>
                          {entry.resource_id}
                        </span>
                      </td>
                      <td>
                        <span className="audit-ip">{entry.ip_address}</span>
                      </td>
                    </tr>
                    {expandedId === entry.id && entry.details && (
                      <tr key={`${entry.id}-detail`} className="audit-detail-row">
                        <td colSpan={6}>
                          <div className="audit-detail-content">
                            <h4>Event Details</h4>
                            {entry.details.old_value && entry.details.new_value ? (
                              <div className="audit-detail-diff">
                                <div>
                                  <div className="audit-detail-json-label old">Old Value</div>
                                  <div className="audit-detail-json old-value">
                                    {JSON.stringify(entry.details.old_value, null, 2)}
                                  </div>
                                </div>
                                <div className="audit-detail-arrow">→</div>
                                <div>
                                  <div className="audit-detail-json-label new">New Value</div>
                                  <div className="audit-detail-json new-value">
                                    {JSON.stringify(entry.details.new_value, null, 2)}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="audit-detail-raw">
                                {JSON.stringify(entry.details, null, 2)}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="audit-pagination">
              <span className="audit-pagination-info">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} entries
              </span>
              <div className="audit-pagination-controls">
                <button
                  className="audit-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      className={`audit-page-btn ${page === pageNum ? 'active' : ''}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  className="audit-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
                <select
                  className="audit-page-size-select"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
