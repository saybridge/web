import React, { useState } from 'react';
import { X, Hash, Lock, HelpCircle } from 'lucide-react';
import { api } from '../../../services/api';
import { useChatStore } from '../../../stores/useChatStore';
import './CreateRoomDialog.css';

interface CreateRoomDialogProps {
  onClose: () => void;
}

export const CreateRoomDialog: React.FC<CreateRoomDialogProps> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { rooms, setRooms, setActiveRoomId } = useChatStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);

    // Mappings: public -> 'channel', private -> 'group' in backend
    const backendType = type === 'public' ? 'channel' : 'group';

    try {
      const res = await api.post('/rooms', {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type: backendType,
        description: description.trim(),
        topic: topic.trim(),
      });

      if (res.data && res.data.success) {
        const newRoom = res.data.data;
        // Append to local store rooms list
        setRooms([...rooms, {
          id: newRoom.id,
          name: newRoom.name,
          slug: newRoom.slug || '',
          type: type,
          unread_count: 0,
          created_at: newRoom.created_at,
          is_read_only: newRoom.is_read_only || false,
          created_by: newRoom.created_by,
          members: newRoom.members || [],
        }]);
        setActiveRoomId(newRoom.id);
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to create room', err);
      setError(err.response?.data?.error?.message || err.message || 'Tạo phòng thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-card">
        {/* Header */}
        <div className="dialog-header">
          <h3 className="dialog-title">Tạo kênh mới</h3>
          <button className="dialog-close-btn" onClick={onClose} disabled={isLoading}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="dialog-form">
          {error && <div className="error-alert">{error}</div>}

          {/* Name input */}
          <div className="form-group">
            <label className="form-label">Tên kênh</label>
            <div className="input-with-prefix">
              <span className="prefix-symbol">#</span>
              <input
                type="text"
                className="form-input prefix-padding"
                placeholder="e.g. ke-hoach-q3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                pattern="^[a-zA-Z0-9-_]+$"
                title="Tên kênh chỉ chứa chữ cái, chữ số, dấu gạch ngang và dấu gạch dưới"
              />
            </div>
            <span className="form-help-text">
              Tên kênh được viết thường liền nhau, không dấu, phân tách bằng dấu gạch ngang.
            </span>
          </div>

          {/* Type toggles */}
          <div className="form-group">
            <label className="form-label">Loại kênh</label>
            <div className="type-toggle-group">
              <button
                type="button"
                className={`type-toggle-btn ${type === 'public' ? 'selected' : ''}`}
                onClick={() => setType('public')}
                disabled={isLoading}
              >
                <Hash size={18} />
                <div className="type-btn-label">
                  <span className="type-title-text">Công khai (Public)</span>
                  <span className="type-desc-text">Mọi thành viên đều có thể tìm thấy và tham gia</span>
                </div>
              </button>

              <button
                type="button"
                className={`type-toggle-btn ${type === 'private' ? 'selected' : ''}`}
                onClick={() => setType('private')}
                disabled={isLoading}
              >
                <Lock size={18} />
                <div className="type-btn-label">
                  <span className="type-title-text">Riêng tư (Private)</span>
                  <span className="type-desc-text">Chỉ những thành viên được mời mới có thể tham gia</span>
                </div>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Mô tả (Tùy chọn)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Mục đích của kênh này là gì?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Topic */}
          <div className="form-group">
            <label className="form-label">Chủ đề (Tùy chọn)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Phát triển tính năng Chat"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Actions */}
          <div className="dialog-actions">
            <button type="button" className="dialog-btn-cancel" onClick={onClose} disabled={isLoading}>
              Hủy
            </button>
            <button type="submit" className="dialog-btn-submit" disabled={isLoading || !name.trim()}>
              Tạo kênh
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
