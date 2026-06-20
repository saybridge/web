import { useState, useEffect, useCallback } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import './StarredMessagesPanel.css';

interface StarredMessage {
  id: string;
  content: string;
  sender_name: string;
  starred_at: string;
  created_at: string;
}

interface StarredMessagesPanelProps {
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

export function StarredMessagesPanel({ roomId, onClose }: StarredMessagesPanelProps) {
  const [messages, setMessages] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unstarringId, setUnstarringId] = useState<string | null>(null);

  const fetchStarred = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/rooms/${roomId}/starred`);
      if (res.data?.success) {
        setMessages(res.data.data || []);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchStarred();
  }, [fetchStarred]);

  const handleUnstar = async (messageId: string) => {
    setUnstarringId(messageId);
    try {
      await api.post(`/messages/${messageId}/star`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } finally {
      setUnstarringId(null);
    }
  };

  return (
    <div className="starred-panel">
      <div className="starred-panel-header">
        <div className="starred-panel-title">
          <Star size={16} />
          <span>Starred Messages</span>
        </div>
        <button className="starred-panel-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="starred-panel-content">
        {loading ? (
          <div className="starred-panel-loading">
            <Loader2 size={24} className="starred-spinner" />
            <span>Loading starred messages…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="starred-panel-empty">
            <div className="starred-panel-empty-icon">
              <Star size={28} />
            </div>
            <h4>No starred messages</h4>
            <p>Star messages you want to find easily later.</p>
          </div>
        ) : (
          <div className="starred-panel-list">
            {messages.map((msg) => (
              <div className="starred-item" key={msg.id}>
                <div className="starred-item-header">
                  <span className="starred-item-sender">{msg.sender_name}</span>
                  <span className="starred-item-date">{formatDate(msg.starred_at || msg.created_at)}</span>
                </div>
                <p className="starred-item-content">{msg.content}</p>
                <button
                  className="starred-item-unstar"
                  onClick={() => handleUnstar(msg.id)}
                  disabled={unstarringId === msg.id}
                >
                  {unstarringId === msg.id ? 'Removing…' : 'Unstar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
