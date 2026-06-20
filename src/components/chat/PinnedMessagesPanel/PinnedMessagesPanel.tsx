import { useState, useEffect, useCallback } from 'react';
import { X, Pin, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import './PinnedMessagesPanel.css';

interface PinnedMessage {
  id: string;
  content: string;
  sender_name: string;
  pinned_at: string;
  created_at: string;
}

interface PinnedMessagesPanelProps {
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

export function PinnedMessagesPanel({ roomId, onClose }: PinnedMessagesPanelProps) {
  const [messages, setMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);

  const fetchPinned = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/rooms/${roomId}/pinned`);
      if (res.data?.success) {
        setMessages(res.data.data || []);
      }
    } catch {
      // API may not be available yet
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchPinned();
  }, [fetchPinned]);

  const handleUnpin = async (messageId: string) => {
    setUnpinningId(messageId);
    try {
      await api.delete(`/rooms/${roomId}/pin/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      // Optimistic removal on error for demo
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } finally {
      setUnpinningId(null);
    }
  };

  return (
    <div className="pinned-panel">
      <div className="pinned-panel-header">
        <div className="pinned-panel-title">
          <Pin size={16} />
          <span>Pinned Messages</span>
        </div>
        <button className="pinned-panel-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="pinned-panel-content">
        {loading ? (
          <div className="pinned-panel-loading">
            <Loader2 size={24} className="pinned-spinner" />
            <span>Loading pinned messages…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="pinned-panel-empty">
            <div className="pinned-panel-empty-icon">
              <Pin size={28} />
            </div>
            <h4>No pinned messages</h4>
            <p>Pin important messages so they're easy to find later.</p>
          </div>
        ) : (
          <div className="pinned-panel-list">
            {messages.map((msg) => (
              <div className="pinned-item" key={msg.id}>
                <div className="pinned-item-header">
                  <span className="pinned-item-sender">{msg.sender_name}</span>
                  <span className="pinned-item-date">{formatDate(msg.pinned_at || msg.created_at)}</span>
                </div>
                <p className="pinned-item-content">{msg.content}</p>
                <button
                  className="pinned-item-unpin"
                  onClick={() => handleUnpin(msg.id)}
                  disabled={unpinningId === msg.id}
                >
                  {unpinningId === msg.id ? 'Unpinning…' : 'Unpin'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
