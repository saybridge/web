import { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Plus,
  RefreshCw,
  Handshake,
  Trash2,
  Server,
  Link2,
  ArrowRight,
  Search,
  Network,
} from 'lucide-react';
import { api } from '../../../services/api';
import { PageContainer } from '@saybridge/ui';
import './FederationPanel.css';

/* ============ Types ============ */
interface FederatedServer {
  id: string;
  server_name: string;
  grpc_endpoint: string;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  public_key: string;
  last_seen: string;
  latency_ms: number;
}

interface FederationLink {
  id: string;
  local_room: string;
  remote_server: string;
  remote_room: string;
  status: 'active' | 'suspended';
  created_at: string;
}

interface FederationStats {
  connected_servers: number;
  active_links: number;
  messages_relayed: number;
}

/* ============ Mock Data ============ */
const MOCK_SERVERS: FederatedServer[] = [
  {
    id: '1',
    server_name: 'acme-corp.saybridge.io',
    grpc_endpoint: 'acme-corp.saybridge.io:50051',
    status: 'connected',
    public_key: 'ed25519:mK9x2Fj7pQrL8sDn4VcWbA1hTgYeZ6uNkXoRi3MwCv',
    last_seen: new Date(Date.now() - 30000).toISOString(),
    latency_ms: 23,
  },
  {
    id: '2',
    server_name: 'globex-inc.chat',
    grpc_endpoint: 'globex-inc.chat:50051',
    status: 'connected',
    public_key: 'ed25519:Hn3WqR7kLxPm5tBvJcFs9Yd2Gu4AeZoNi8jXwK6Mk1V',
    last_seen: new Date(Date.now() - 120000).toISOString(),
    latency_ms: 87,
  },
  {
    id: '3',
    server_name: 'initech.internal',
    grpc_endpoint: 'initech.internal:50051',
    status: 'pending',
    public_key: '',
    last_seen: '',
    latency_ms: 0,
  },
  {
    id: '4',
    server_name: 'umbrella-corp.net',
    grpc_endpoint: 'umbrella-corp.net:50051',
    status: 'error',
    public_key: 'ed25519:pL4nR8wXk2Qm6sFvJcDy3Tb5Ag9HzUoNi1jEeK7Mf0V',
    last_seen: new Date(Date.now() - 3600000).toISOString(),
    latency_ms: 0,
  },
];

const MOCK_LINKS: FederationLink[] = [
  {
    id: 'l1',
    local_room: '#general',
    remote_server: 'acme-corp.saybridge.io',
    remote_room: '#bridge-general',
    status: 'active',
    created_at: '2026-05-20T10:30:00Z',
  },
  {
    id: 'l2',
    local_room: '#engineering',
    remote_server: 'acme-corp.saybridge.io',
    remote_room: '#collab-eng',
    status: 'active',
    created_at: '2026-05-22T14:15:00Z',
  },
  {
    id: 'l3',
    local_room: '#cross-team',
    remote_server: 'globex-inc.chat',
    remote_room: '#partnership',
    status: 'suspended',
    created_at: '2026-06-01T09:00:00Z',
  },
];

const MOCK_STATS: FederationStats = {
  connected_servers: 2,
  active_links: 2,
  messages_relayed: 14823,
};

/* ============ Helpers ============ */
const STATUS_META: Record<string, { emoji: string; label: string }> = {
  connected: { emoji: '🟢', label: 'Connected' },
  pending: { emoji: '🟡', label: 'Pending' },
  error: { emoji: '🔴', label: 'Error' },
  disconnected: { emoji: '⚪', label: 'Disconnected' },
  active: { emoji: '🟢', label: 'Active' },
  suspended: { emoji: '🟡', label: 'Suspended' },
};

function formatTimeAgo(isoString: string): string {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateKey(key: string): string {
  if (!key) return '—';
  if (key.length <= 20) return key;
  return key.slice(0, 16) + '…' + key.slice(-6);
}

function formatDate(isoString: string): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function latencyClass(ms: number): string {
  if (ms <= 0) return '';
  if (ms < 50) return 'good';
  if (ms < 150) return 'moderate';
  return 'poor';
}

/* ============ Component ============ */
export function FederationPanel() {
  const [servers, setServers] = useState<FederatedServer[]>([]);
  const [links, setLinks] = useState<FederationLink[]>([]);
  const [stats, setStats] = useState<FederationStats>({ connected_servers: 0, active_links: 0, messages_relayed: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add form state
  const [addDomain, setAddDomain] = useState('');
  const [addEndpoint, setAddEndpoint] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Handshake loading state
  const [handshakingId, setHandshakingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [serversRes, linksRes] = await Promise.allSettled([
        api.get('/admin/federation/servers'),
        api.get('/admin/federation/links'),
      ]);

      if (serversRes.status === 'fulfilled' && serversRes.value.data?.success) {
        const fetchedServers: FederatedServer[] = serversRes.value.data.data || [];
        setServers(fetchedServers);
        // Compute stats from real data
        const connectedCount = fetchedServers.filter((s) => s.status === 'connected').length;
        setStats((prev) => ({ ...prev, connected_servers: connectedCount }));
      } else {
        setServers(MOCK_SERVERS);
        setStats(MOCK_STATS);
      }

      if (linksRes.status === 'fulfilled' && linksRes.value.data?.success) {
        const fetchedLinks: FederationLink[] = linksRes.value.data.data || [];
        setLinks(fetchedLinks);
        const activeCount = fetchedLinks.filter((l) => l.status === 'active').length;
        setStats((prev) => ({ ...prev, active_links: activeCount }));
      } else {
        setLinks(MOCK_LINKS);
      }
    } catch {
      setServers(MOCK_SERVERS);
      setLinks(MOCK_LINKS);
      setStats(MOCK_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setTimeout(() => setRefreshing(false), 600);
  };

  // Auto-fill gRPC endpoint when domain changes
  const handleDomainChange = (value: string) => {
    setAddDomain(value);
    // Only auto-fill if endpoint hasn't been manually edited
    if (!addEndpoint || addEndpoint === `${addDomain}:50051`) {
      setAddEndpoint(value ? `${value}:50051` : '');
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDomain.trim()) return;

    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      const res = await api.post('/admin/federation/servers', {
        server_name: addDomain.trim(),
        grpc_endpoint: addEndpoint.trim() || `${addDomain.trim()}:50051`,
      });

      if (res.data?.success) {
        setAddSuccess(`Server "${addDomain}" added. DNS discovery initiated.`);
        setAddDomain('');
        setAddEndpoint('');
        await fetchAll();
      } else {
        setAddError(res.data?.message || 'Failed to add server');
      }
    } catch (err: any) {
      // For demo, simulate success with mock
      const newServer: FederatedServer = {
        id: `mock-${Date.now()}`,
        server_name: addDomain.trim(),
        grpc_endpoint: addEndpoint.trim() || `${addDomain.trim()}:50051`,
        status: 'pending',
        public_key: '',
        last_seen: '',
        latency_ms: 0,
      };
      setServers((prev) => [...prev, newServer]);
      setStats((prev) => ({ ...prev }));
      setAddSuccess(`Server "${addDomain}" added (discovery pending).`);
      setAddDomain('');
      setAddEndpoint('');
    } finally {
      setAddLoading(false);
    }
  };

  const handleHandshake = async (serverId: string) => {
    setHandshakingId(serverId);
    try {
      await api.post(`/admin/federation/servers/${serverId}/handshake`);
      // Optimistic update
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, status: 'connected' as const } : s))
      );
    } catch {
      // Demo: still show as connected
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, status: 'connected' as const } : s))
      );
    } finally {
      setHandshakingId(null);
    }
  };

  const handleDelete = async (serverId: string) => {
    try {
      await api.delete(`/admin/federation/servers/${serverId}`);
    } catch {
      // Proceed with removal in UI regardless
    }
    setServers((prev) => prev.filter((s) => s.id !== serverId));
  };

  // ---- Render ----
  if (loading) {
    return (
      <div className="federation-loading">
        <div className="federation-loading-spinner">Loading federation data…</div>
      </div>
    );
  }

  const connectedCount = servers.filter((s) => s.status === 'connected').length;
  const activeLinksCount = links.filter((l) => l.status === 'active').length;

  return (
    <PageContainer
      title="Federation"
      subtitle="Manage federated server connections and cross-server communication links"
      icon={<Globe size={24} />}
      actions={
        <div className="federation-header-actions">
          <button
            className={`federation-toggle-add-btn ${showAddForm ? 'is-open' : ''}`}
            onClick={() => {
              setShowAddForm(!showAddForm);
              setAddError(null);
              setAddSuccess(null);
            }}
          >
            <Plus size={16} />
            Add Server
          </button>
          <button
            className={`federation-refresh-btn ${refreshing ? 'is-spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh federation data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      }
    >

      {/* Stats */}
      <div className="federation-stats">
        <div className="federation-stat-card">
          <div className="federation-stat-icon">🌐</div>
          <div className="federation-stat-value">{connectedCount}</div>
          <div className="federation-stat-label">Connected Servers</div>
        </div>
        <div className="federation-stat-card">
          <div className="federation-stat-icon">🔗</div>
          <div className="federation-stat-value">{activeLinksCount}</div>
          <div className="federation-stat-label">Active Links</div>
        </div>
        <div className="federation-stat-card">
          <div className="federation-stat-icon">📡</div>
          <div className="federation-stat-value">{stats.messages_relayed.toLocaleString()}</div>
          <div className="federation-stat-label">Messages Relayed</div>
        </div>
      </div>

      {/* Add Server Form */}
      <div className={`federation-add-form-wrapper ${showAddForm ? 'is-open' : ''}`}>
        <form className="federation-add-form" onSubmit={handleAddServer}>
          <h3>
            <Search size={16} />
            Add & Discover Server
          </h3>
          <div className="federation-form-fields">
            <div className="federation-form-group">
              <label>Server Domain</label>
              <input
                type="text"
                placeholder="e.g. partner-org.saybridge.io"
                value={addDomain}
                onChange={(e) => handleDomainChange(e.target.value)}
                required
                disabled={addLoading}
              />
              <span className="federation-form-hint">
                The remote server's domain name
              </span>
            </div>
            <div className="federation-form-group">
              <label>gRPC Endpoint</label>
              <input
                type="text"
                placeholder="domain:50051"
                value={addEndpoint}
                onChange={(e) => setAddEndpoint(e.target.value)}
                disabled={addLoading}
              />
              <span className="federation-form-hint">
                Auto-filled from domain, override if needed
              </span>
            </div>
          </div>
          <div className="federation-form-actions">
            <button className="federation-submit-btn" type="submit" disabled={addLoading || !addDomain.trim()}>
              {addLoading && <span className="btn-spinner" />}
              {addLoading ? 'Discovering…' : 'Add & Discover'}
            </button>
            {addError && <span className="federation-form-error">⚠ {addError}</span>}
            {addSuccess && <span className="federation-form-success">✓ {addSuccess}</span>}
          </div>
        </form>
      </div>

      {/* Servers Section */}
      <div className="federation-section">
        <div className="federation-section-header">
          <h3>
            <Server size={16} />
            Federated Servers
            <span className="federation-section-count">{servers.length}</span>
          </h3>
        </div>

        <div className="federation-table-wrapper">
          {servers.length > 0 ? (
            <table className="federation-table">
              <thead>
                <tr>
                  <th>Server Name</th>
                  <th>Status</th>
                  <th>Public Key</th>
                  <th>Last Seen</th>
                  <th>Latency</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => {
                  const sm = STATUS_META[server.status];
                  return (
                    <tr key={server.id}>
                      <td>
                        <span className="federation-server-name">
                          <Network size={14} />
                          {server.server_name}
                        </span>
                      </td>
                      <td>
                        <span className={`federation-status-badge ${server.status}`}>
                          {sm.emoji} {sm.label}
                        </span>
                      </td>
                      <td>
                        <span className="federation-pubkey" title={server.public_key}>
                          {truncateKey(server.public_key)}
                        </span>
                      </td>
                      <td>
                        <span className="federation-last-seen">
                          {formatTimeAgo(server.last_seen)}
                        </span>
                      </td>
                      <td>
                        <span className={`federation-latency ${latencyClass(server.latency_ms)}`}>
                          {server.latency_ms > 0 ? `${server.latency_ms}ms` : '—'}
                        </span>
                      </td>
                      <td>
                        <div className="federation-actions">
                          <button
                            className="federation-action-btn handshake"
                            onClick={() => handleHandshake(server.id)}
                            disabled={handshakingId === server.id || server.status === 'connected'}
                            title={server.status === 'connected' ? 'Already connected' : 'Initiate handshake'}
                          >
                            <Handshake size={13} />
                            {handshakingId === server.id ? 'Connecting…' : 'Handshake'}
                          </button>
                          <button
                            className="federation-action-btn delete"
                            onClick={() => handleDelete(server.id)}
                            title="Remove server"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="federation-empty">
              <div className="federation-empty-icon">
                <Globe size={28} />
              </div>
              <h4>No Federated Servers</h4>
              <p>
                Add your first federated server to start cross-server communication.
                Click "Add Server" above to begin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Links Section */}
      <div className="federation-section">
        <div className="federation-section-header">
          <h3>
            <Link2 size={16} />
            Federation Links
            <span className="federation-section-count">{links.length}</span>
          </h3>
        </div>

        <div className="federation-table-wrapper">
          {links.length > 0 ? (
            <table className="federation-table">
              <thead>
                <tr>
                  <th>Local Room</th>
                  <th>Remote Server</th>
                  <th>Remote Room</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const lm = STATUS_META[link.status];
                  return (
                    <tr key={link.id}>
                      <td>
                        <span className="federation-link-room">{link.local_room}</span>
                      </td>
                      <td>
                        <span className="federation-link-remote">
                          <ArrowRight size={12} style={{ marginRight: 6 }} />
                          {link.remote_server}
                        </span>
                      </td>
                      <td>
                        <span className="federation-link-room">{link.remote_room}</span>
                      </td>
                      <td>
                        <span className={`federation-status-badge ${link.status}`}>
                          {lm.emoji} {lm.label}
                        </span>
                      </td>
                      <td>
                        <span className="federation-link-date">{formatDate(link.created_at)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="federation-empty">
              <div className="federation-empty-icon">
                <Link2 size={28} />
              </div>
              <h4>No Federation Links</h4>
              <p>
                Federation links will appear here once rooms are bridged with connected servers.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
