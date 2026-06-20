import { useState } from 'react';
import { X, Search, Hash, Lock, User, ArrowRight } from 'lucide-react';
import type { Room } from '../../../stores/useChatStore';
import './ForwardModal.css';

interface ForwardMessage {
  id: string;
  content: string;
  sender_name: string;
}

interface ForwardModalProps {
  message: ForwardMessage;
  rooms: Room[];
  onClose: () => void;
  onForward: (roomId: string) => void;
}

function getRoomIcon(type: string) {
  if (type === 'public') return <Hash size={14} />;
  if (type === 'private') return <Lock size={14} />;
  return <User size={14} />;
}

export function ForwardModal({ message, rooms, onClose, onForward }: ForwardModalProps) {
  const [search, setSearch] = useState('');

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleForward = (roomId: string) => {
    onForward(roomId);
    onClose();
  };

  return (
    <div className="forward-overlay" onClick={onClose}>
      <div className="forward-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="forward-modal-header">
          <span className="forward-modal-title">Forward Message</span>
          <button className="forward-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Message preview */}
        <div className="forward-preview">
          <span className="forward-preview-sender">{message.sender_name}</span>
          <p className="forward-preview-content">{message.content}</p>
        </div>

        {/* Search */}
        <div className="forward-search-wrapper">
          <Search size={15} className="forward-search-icon" />
          <input
            className="forward-search-input"
            type="text"
            placeholder="Search rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Room list */}
        <div className="forward-room-list">
          {filtered.length === 0 ? (
            <div className="forward-room-empty">No rooms found</div>
          ) : (
            filtered.map((room) => (
              <button
                className="forward-room-item"
                key={room.id}
                onClick={() => handleForward(room.id)}
              >
                <span className="forward-room-icon">{getRoomIcon(room.type)}</span>
                <span className="forward-room-name">{room.name}</span>
                <ArrowRight size={14} className="forward-room-arrow" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
