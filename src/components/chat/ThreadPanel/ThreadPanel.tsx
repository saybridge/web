import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, MessageCircle, Maximize2 } from 'lucide-react';
import { useChatStore, Message } from '../../../stores/useChatStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { usePreferencesStore } from '../../../stores/usePreferencesStore';
import { api } from '../../../services/api';
import { sendMessageViaWS } from '../../../services/websocket';
import { MessageComposer, MarkdownRenderer, parse } from '@saybridge/composer';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import './ThreadPanel.css';

interface ThreadPanelProps {
  onClose: () => void;
}

const SENDER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];
const getSenderColor = (senderId: string) => {
  let hash = 0;
  for (let i = 0; i < senderId.length; i++) {
    hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

export const ThreadPanel: React.FC<ThreadPanelProps> = ({ onClose }) => {
  const { activeRoomId, activeThreadParentId, messagesByRoom, setMessages } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOverflowed, setIsOverflowed] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const parentTextRef = useRef<HTMLDivElement>(null);

  const roomMessages = activeRoomId ? messagesByRoom[activeRoomId] || [] : [];
  const parentMessage = roomMessages.find((m) => m.id === activeThreadParentId);
  const threadReplies = roomMessages.filter((m) => m.parent_id === activeThreadParentId);

  // Fetch thread replies history
  useEffect(() => {
    if (!activeRoomId || !activeThreadParentId) return;

    const fetchReplies = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/messages/thread/${activeThreadParentId}/replies`, {
          params: { room_id: activeRoomId },
        });
        if (res.data) {
          const rawReplies = res.data || [];
          const mapped: Message[] = rawReplies.map((m: any) => ({
            id: m.message_id || m.id,
            room_id: m.room_id,
            sender_id: m.sender_id,
            sender_name: m.sender_name,
            content: m.content,
            msg_type: m.msg_type || 'text',
            parent_id: m.parent_id,
            reply_to_id: m.reply_to_id,
            is_edited: m.is_edited || false,
            is_deleted: m.is_deleted || false,
            reactions: m.reactions ? (typeof m.reactions === 'string' ? m.reactions : JSON.stringify(m.reactions)) : undefined,
            created_at: m.created_at,
          }));

          const otherMessages = roomMessages.filter(
            (rm) => !mapped.some((mapMsg) => mapMsg.id === rm.id)
          );
          const merged = [...otherMessages, ...mapped].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          setMessages(activeRoomId, merged);
        }
      } catch (err) {
        console.error('Failed to load thread replies history', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReplies();
  }, [activeRoomId, activeThreadParentId]);

  // Scroll to bottom on new replies
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadReplies.length]);

  // Check if parent message content overflows
  useEffect(() => {
    const checkOverflow = () => {
      if (parentTextRef.current) {
        const el = parentTextRef.current;
        setIsOverflowed(el.scrollHeight > el.clientHeight);
      }
    };
    checkOverflow();
    const timer = setTimeout(checkOverflow, 100);
    return () => clearTimeout(timer);
  }, [parentMessage?.content]);

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || !activeRoomId || !activeThreadParentId || !currentUser) return;

    const localId = `local_${Math.random().toString(36).substring(2, 15)}`;
    const newReply: Message = {
      id: localId,
      room_id: activeRoomId,
      sender_id: currentUser.id,
      sender_name: currentUser.username,
      content: text,
      msg_type: 'text',
      parent_id: activeThreadParentId,
      is_edited: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      isPending: true,
    };

    const currentMessages = useChatStore.getState().messagesByRoom[activeRoomId] || [];
    setMessages(activeRoomId, [...currentMessages, newReply]);

    sendMessageViaWS({
      localId,
      roomId: activeRoomId,
      content: text,
      msgType: 'text',
      parentId: activeThreadParentId,
    });
  }, [activeRoomId, activeThreadParentId, currentUser, setMessages]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = useCallback((content: string) => {
    try {
      const ast = parse(content);
      if (ast) return <MarkdownRenderer ast={ast} />;
    } catch {
      // fallback
    }
    return content;
  }, []);

  if (!parentMessage) {
    return (
      <div className="tp-container">
        <div className="tp-header">
          <div className="tp-header-pill">
            <div className="tp-header-left">
              <MessageCircle size={16} />
              <span className="tp-header-title">Thread</span>
            </div>
            <button className="tp-header-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div className="tp-empty-full">
          <MessageCircle size={28} />
          <p>Không tìm thấy tin nhắn gốc</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tp-container">
      <div className="tp-header" data-tauri-drag-region>
        <div className="tp-header-pill" data-tauri-drag-region>
          <div className="tp-header-left" data-tauri-drag-region>
            <MessageCircle size={16} />
            <span className="tp-header-title" data-tauri-drag-region>Thread</span>
          </div>
          <button className="tp-header-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Parent message ── */}
      <div className="tp-parent">
        <div className="tp-parent-avatar">
          {(parentMessage.sender_name || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="tp-parent-body">
          <div className="tp-parent-meta">
            <span className="tp-parent-name" style={{ color: getSenderColor(parentMessage.sender_id) }}>
              {parentMessage.sender_name}
            </span>
            <span className="tp-parent-time">{formatTime(parentMessage.created_at)}</span>
            {isOverflowed && (
              <button className="tp-parent-expand-btn" onClick={() => setIsModalOpen(true)}>
                <Maximize2 size={12} /> Xem đầy đủ
              </button>
            )}
          </div>
          <div className="tp-parent-text" ref={parentTextRef}>{renderContent(parentMessage.content)}</div>
        </div>
      </div>

      {/* ── Reply count divider ── */}
      <div className="tp-divider">
        <span className="tp-divider-line" />
        <span className="tp-divider-text">
          {threadReplies.length} trả lời
        </span>
        <span className="tp-divider-line" />
      </div>

      {/* ── Replies ── */}
      <div className="tp-replies" ref={scrollerRef}>
        {isLoading && (
          <div className="tp-loading">
            <div className="tp-loading-dot" />
            <div className="tp-loading-dot" />
            <div className="tp-loading-dot" />
          </div>
        )}
        {!isLoading && threadReplies.length === 0 && (
          <div className="tp-empty">
            <MessageCircle size={22} />
            <p>Chưa có phản hồi nào.<br />Hãy là người đầu tiên trả lời!</p>
          </div>
        )}
        {threadReplies.map((reply, index) => {
          const prevReply = index > 0 ? threadReplies[index - 1] : null;
          const isConsecutive = !!(
            prevReply &&
            prevReply.sender_id === reply.sender_id &&
            new Date(reply.created_at).getTime() - new Date(prevReply.created_at).getTime() < 60000
          );
          const nextReply = index < threadReplies.length - 1 ? threadReplies[index + 1] : null;
          const hasNextConsecutive = !!(
            nextReply &&
            nextReply.sender_id === reply.sender_id &&
            new Date(nextReply.created_at).getTime() - new Date(reply.created_at).getTime() < 60000
          );

          return (
            <MessageBubble
              key={reply.id}
              message={reply}
              isConsecutive={isConsecutive}
              hasNextConsecutive={hasNextConsecutive}
              inThread={true}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Composer ── */}
      <div className="tp-composer">
        <MessageComposer
          onSend={handleSend}
          placeholder="Trả lời thread..."
          enterBehavior={usePreferencesStore.getState().enterBehavior}
        />
      </div>

      {/* ── Expand Modal Popup ── */}
      {isModalOpen && (
        <div className="tp-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="tp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="tp-modal-header">
              <div className="tp-modal-header-left">
                <MessageCircle size={16} />
                <span className="tp-modal-title">Chi tiết tin nhắn gốc</span>
              </div>
              <button className="tp-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="tp-modal-body">
              <div className="tp-parent-avatar">
                {(parentMessage.sender_name || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="tp-modal-content">
                <div className="tp-parent-meta">
                  <span className="tp-parent-name" style={{ color: getSenderColor(parentMessage.sender_id) }}>
                    {parentMessage.sender_name}
                  </span>
                  <span className="tp-parent-time">{formatTime(parentMessage.created_at)}</span>
                </div>
                <div className="tp-modal-text">
                  {renderContent(parentMessage.content)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
