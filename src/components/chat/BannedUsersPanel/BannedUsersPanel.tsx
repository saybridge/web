import { useState, useEffect, useCallback } from 'react';
import { X, Ban, Loader2, UserX } from 'lucide-react';
import { api } from '../../../services/api';
import './BannedUsersPanel.css';

interface BannedUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  banned_at: string;
}

interface BannedUsersPanelProps {
  roomId: string;
  onClose: () => void;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitial(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

export function BannedUsersPanel({ roomId, onClose }: BannedUsersPanelProps) {
  const [users, setUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanningId, setUnbanningId] = useState<string | null>(null);

  const fetchBanned = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/rooms/${roomId}/banned`);
      if (res.data?.success) {
        setUsers(res.data.data || []);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchBanned();
  }, [fetchBanned]);

  const handleUnban = async (userId: string) => {
    setUnbanningId(userId);
    try {
      await api.post(`/rooms/${roomId}/unban/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setUnbanningId(null);
    }
  };

  return (
    <div className="banned-panel">
      <div className="banned-panel-header">
        <div className="banned-panel-title">
          <Ban size={16} />
          <span>Banned Users</span>
        </div>
        <button className="banned-panel-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="banned-panel-content">
        {loading ? (
          <div className="banned-panel-loading">
            <Loader2 size={24} className="banned-spinner" />
            <span>Loading banned users…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="banned-panel-empty">
            <div className="banned-panel-empty-icon">
              <UserX size={28} />
            </div>
            <h4>No banned users</h4>
            <p>There are no banned users in this channel.</p>
          </div>
        ) : (
          <div className="banned-panel-list">
            {users.map((user) => (
              <div className="banned-item" key={user.id}>
                <div className="banned-item-avatar">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} />
                  ) : (
                    <span className="banned-item-initial">
                      {getInitial(user.display_name || user.username)}
                    </span>
                  )}
                </div>
                <div className="banned-item-info">
                  <span className="banned-item-name">
                    {user.display_name || user.username}
                  </span>
                  <span className="banned-item-date">
                    Banned {formatDate(user.banned_at)}
                  </span>
                </div>
                <button
                  className="banned-item-unban"
                  onClick={() => handleUnban(user.id)}
                  disabled={unbanningId === user.id}
                >
                  {unbanningId === user.id ? 'Unbanning…' : 'Unban'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
