import React, { useState, useEffect } from 'react';
import { X, Search, MessageSquare } from 'lucide-react';
import { api } from '../../../services/api';
import { useChatStore, Room } from '../../../stores/useChatStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import './StartDMDialog.css';

interface StartDMDialogProps {
  onClose: () => void;
}

interface UserResult {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  presence_status?: string;
}

export const StartDMDialog: React.FC<StartDMDialogProps> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rooms, setRooms, setActiveRoomId } = useChatStore();
  const currentUser = useAuthStore((s) => s.user);

  // Search users whenever searchQuery changes
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get('/users/search', {
          params: { q: searchQuery, limit: 10 },
        });
        if (res.data && res.data.success) {
          // Filter out current user from selection list
          const list = (res.data.data || []).filter(
            (u: UserResult) => u.id !== currentUser?.id
          );
          setUsers(list);
          if (list.length > 0 && !selectedUserId) {
            setSelectedUserId(list[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to search users', err);
        setError(err.message || 'Không thể tải danh sách người dùng');
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, currentUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.post('/rooms', {
        name: selectedUserId, // Backend roomUseCase.CreateRoom maps targetUserID from name param for direct room
        type: 'direct',
      });

      if (res.data && res.data.success) {
        const newRoom = res.data.data;
        const exists = rooms.find((r) => r.id === newRoom.id);

        if (!exists) {
          // Add newly created direct room to store list
          setRooms([
            ...rooms,
            {
              id: newRoom.id,
              name: newRoom.name || '',
              slug: newRoom.slug || '',
              type: 'dm',
              unread_count: 0,
              created_at: newRoom.created_at,
              is_read_only: newRoom.is_read_only || false,
              created_by: newRoom.created_by,
              members: newRoom.members || [],
            },
          ]);
        }
        setActiveRoomId(newRoom.id);
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to start direct message', err);
      setError(
        err.response?.data?.error?.message ||
        err.message ||
        'Không thể khởi tạo cuộc hội thoại'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (user: UserResult) => {
    const name = user.display_name || user.username || '?';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-card dm-start-card">
        {/* Header */}
        <div className="dialog-header">
          <h3 className="dialog-title">Bắt đầu trò chuyện trực tiếp</h3>
          <button className="dialog-close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="dialog-form">
          {error && <div className="error-alert">{error}</div>}

          {/* Search box */}
          <div className="form-group">
            <label className="form-label">Tìm kiếm người dùng</label>
            <div className="input-with-prefix">
              <Search size={16} className="input-prefix-icon" />
              <input
                type="text"
                className="form-input prefix-padding"
                placeholder="Nhập tên hiển thị hoặc username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>

          {/* Users List */}
          <div className="form-group">
            <label className="form-label">Người dùng</label>
            <div className="dm-user-list-container">
              {isLoading ? (
                <div className="dm-list-loading">
                  <div className="spinner" />
                  <span>Đang tải người dùng...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="dm-list-empty">Không tìm thấy người dùng nào</div>
              ) : (
                <div className="dm-user-list">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={`dm-user-item ${selectedUserId === u.id ? 'selected' : ''
                        }`}
                      onClick={() => !isSubmitting && setSelectedUserId(u.id)}
                    >
                      <div className="dm-user-avatar-wrapper">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="avatar" className="avatar-img" />
                        ) : (
                          <div className="avatar-fallback">{getInitials(u)}</div>
                        )}
                        <span
                          className={`status-dot-inner ${u.presence_status || 'offline'}`}
                        />
                      </div>
                      <div className="dm-user-meta">
                        <span className="dm-user-name">
                          {u.display_name || u.username}
                        </span>
                        <span className="dm-user-username">@{u.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="dialog-actions">
            <button
              type="button"
              className="dialog-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="dialog-btn-submit"
              disabled={isSubmitting || !selectedUserId}
            >
              <MessageSquare size={16} style={{ marginRight: '6px' }} />
              Bắt đầu chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
