import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Edit2, Trash2, Smile, MessageSquare, Check, X, FileText, CornerUpLeft,
  MoreHorizontal, Star, Pin, Copy, Link, Download,
  FileImage, FileAudio, FileVideo, File, Plus,
  Reply, MessageCircle, Bell, ExternalLink, User as UserIcon,
  Globe, Sparkles, Loader2
} from 'lucide-react';
import { Message, useChatStore } from '../../../stores/useChatStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useRoomActions, UIActionDefinition } from '../../../hooks/useRoomActions';
import { DynamicIcon } from '../../common/DynamicIcon/DynamicIcon';
import { SlotRenderer } from '../../common/SlotRenderer/SlotRenderer';
import { triggerPluginHook } from '../../../services/pluginHooks';
import { editMessageViaWS, deleteMessageViaWS, toggleReactionViaWS } from '../../../services/websocket';
import { api, getAuthenticatedFileUrl } from '../../../services/api';
import { SDUIRenderer } from '@saybridge/ui';
import { MarkdownRenderer, parse } from '@saybridge/composer';
import { MentionPopover } from '../MentionPopover/MentionPopover';
import { LiquidPopover } from '@saybridge/ui';
import { useTranslation } from 'react-i18next';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
  onOpenThread?: (message: Message) => void;
  onReply?: (message: Message) => void;
  isConsecutive?: boolean;
  hasNextConsecutive?: boolean;
  inThread?: boolean;
}

/** Return the appropriate lucide icon for a file extension */
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return <FileImage size={20} />;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return <FileAudio size={20} />;
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) return <FileVideo size={20} />;
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md'].includes(ext)) return <FileText size={20} />;
  return <File size={20} />;
};

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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onOpenThread,
  onReply,
  isConsecutive = false,
  hasNextConsecutive = false,
  inThread = false
}) => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const { activeRoomId, rooms, messagesByRoom } = useChatStore();
  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const currentMember = activeRoom?.members?.find((m) => m.user_id === currentUser?.id);
  const isReadOnly = activeRoom?.is_read_only;
  const canPost = !isReadOnly ||
    currentUser?.system_role === 'admin' ||
    currentMember?.room_role === 'owner' ||
    currentMember?.room_role === 'moderator';

  // Find parent message for replies
  const parentMessage = useMemo(() => {
    if (!message.reply_to_id || !activeRoomId) return null;
    const roomMessages = messagesByRoom[activeRoomId] || [];
    return roomMessages.find((m) => m.id === message.reply_to_id) || null;
  }, [message.reply_to_id, activeRoomId, messagesByRoom]);

  const scrollToParent = useCallback(() => {
    if (!message.reply_to_id) return;
    const parentEl = document.getElementById(`msg-${message.reply_to_id}`);
    if (parentEl) {
      parentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      parentEl.classList.add('highlight-flash');
      setTimeout(() => {
        parentEl.classList.remove('highlight-flash');
      }, 2000);
    }
  }, [message.reply_to_id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [displayContent, setDisplayContent] = useState(message.content);

  // Copilot States
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [explainedText, setExplainedText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleTranslate = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setExplainedText(null);
    try {
      const res = await api.post<{ translated_text: string }>('/copilot/translate', {
        text: displayContent,
        target_lang: 'vi',
      });
      setTranslatedText(res.data.translated_text);
    } catch (err) {
      setAiError(t('messageBubble.translateError'));
    } finally {
      setAiLoading(false);
    }
  }, [displayContent, t]);

  const handleExplain = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setTranslatedText(null);
    try {
      const res = await api.post<{ reply: string }>('/copilot/chat', {
        message: `Giải thích tin nhắn sau một cách ngắn gọn, súc tích: "${displayContent}"`,
        room_id: message.room_id,
      });
      setExplainedText(res.data.reply);
    } catch (err) {
      setAiError(t('messageBubble.explainError'));
    } finally {
      setAiLoading(false);
    }
  }, [displayContent, message.room_id, t]);

  useEffect(() => {
    let active = true;
    const decrypt = async () => {
      try {
        const res = await triggerPluginHook('message:before_render', {
          roomId: message.room_id,
          content: message.content,
          msg_type: message.msg_type
        });
        if (active) {
          setDisplayContent(res.content);
          setEditContent(res.content);
        }
      } catch (err) {
        console.warn('[Hooks] message:before_render hook execution failed:', err);
      }
    };
    decrypt();
    return () => { active = false; };
  }, [message.content, message.room_id, message.msg_type]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showUserCard, setShowUserCard] = useState(false);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const userCardRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const openUserCard = useCallback((e: React.MouseEvent) => {
    if (showUserCard) { setShowUserCard(false); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cardH = 260;
    let top = rect.top;
    if (top + cardH > window.innerHeight - 16) top = window.innerHeight - cardH - 16;
    if (top < 16) top = 16;
    setCardPos({ top, left: rect.right + 8 });
    setShowUserCard(true);
  }, [showUserCard]);

  const isMe = currentUser?.id === message.sender_id;
  const isDeleted = message.is_deleted;
  const isEdited = message.is_edited;

  const senderMember = useMemo(() => {
    return activeRoom?.members?.find((m) => m.user_id === message.sender_id);
  }, [activeRoom?.members, message.sender_id]);

  const avatarUrl = useMemo(() => {
    if (message.sender_id === '00000000-0000-0000-0000-000000000001' || message.sender_id === '00000000-0000-0000-0000-000000000000') {
      return '/sai-avatar.png';
    }
    const memberAvatar = senderMember?.user?.avatar_url;
    if (memberAvatar) return getAuthenticatedFileUrl(memberAvatar);
    if (isMe && currentUser?.avatar_url) return getAuthenticatedFileUrl(currentUser.avatar_url);
    return null;
  }, [message.sender_id, senderMember, isMe, currentUser?.avatar_url]);

  // Load backend-driven UI actions
  const { getMessageActions, executeAction } = useRoomActions(activeRoomId || '', currentUser?.id);

  const hoverActions = useMemo(() => {
    let acts = getMessageActions('message_hover_toolbar', message.sender_id);
    if (!canPost) {
      acts = acts.filter(a => a.id !== 'react' && a.id !== 'reply' && a.id !== 'thread');
    }
    return message.parent_id ? acts.filter(a => a.id !== 'thread') : acts;
  }, [getMessageActions, message.sender_id, message.parent_id, canPost]);

  const contextMenuActions = useMemo(() => {
    let acts = [...getMessageActions('message_context_menu', message.sender_id)];
    if (!acts.some(a => a.id === 'react')) {
      acts.push({
        id: 'react',
        label: t('messageBubble.addReaction'),
        icon: 'Smile',
        slot: 'message_context_menu',
        section: 'default',
        sort_order: 15,
        action_type: 'client',
        source: 'core'
      });
    }
    if (!canPost) {
      acts = acts.filter(a => a.id !== 'react' && a.id !== 'reply' && a.id !== 'thread');
    }
    return message.parent_id ? acts.filter(a => a.id !== 'thread') : acts;
  }, [getMessageActions, message.sender_id, message.parent_id, canPost, t]);

  const handleAction = useCallback(async (action: UIActionDefinition) => {
    setShowMoreDropdown(false);
    setContextMenu(null);

    if (action.action_type === 'client') {
      if (action.id === 'reply') {
        if (onReply) onReply(message);
      } else if (action.id === 'thread') {
        onOpenThread?.(message);
      } else if (action.id === 'edit') {
        setIsEditing(true);
      } else if (action.id === 'delete') {
        handleDelete();
      } else if (action.id === 'copy_text') {
        handleCopyText();
      } else if (action.id === 'copy_link') {
        handleCopyLink();
      } else if (action.id === 'react') {
        setShowEmojiPicker(!showEmojiPicker);
      } else if (action.id === 'copilot_translate') {
        handleTranslate();
      } else if (action.id === 'copilot_explain') {
        handleExplain();
      }
    } else {
      executeAction(action, message);
    }
  }, [message, onReply, onOpenThread, showEmojiPicker, executeAction, handleTranslate, handleExplain]);

  // Close More dropdown on click outside
  useEffect(() => {
    if (!showMoreDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target as Node)) {
        setShowMoreDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreDropdown]);

  // Close context menu on click outside or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  // Close user card on click outside
  useEffect(() => {
    if (!showUserCard) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userCardRef.current && !userCardRef.current.contains(e.target as Node)) {
        setShowUserCard(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserCard]);

  // Close emoji picker on click outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Context menu handler — clamp to viewport
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isDeleted || isEditing) return;
    e.preventDefault();
    const menuW = 260, menuH = 400;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y) });
    setShowMoreDropdown(false);
  }, [isDeleted, isEditing]);

  // Format time
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const getTimeBucket = useCallback(() => {
    const date = new Date(message.created_at);
    date.setHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }, [message.created_at]);

  const handleEditSubmit = () => {
    if (!editContent.trim() || editContent === displayContent) {
      setIsEditing(false);
      return;
    }
    editMessageViaWS(activeRoomId || '', message.id, getTimeBucket(), editContent);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(t('messageBubble.deleteConfirm'))) {
      deleteMessageViaWS(activeRoomId || '', message.id, getTimeBucket());
    }
  };

  const handleToggleReaction = (emoji: string) => {
    toggleReactionViaWS(activeRoomId || '', message.id, getTimeBucket(), emoji);
    setShowEmojiPicker(false);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(displayContent);
    setShowMoreDropdown(false);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${message.room_id}/${message.id}`;
    navigator.clipboard.writeText(link);
    setShowMoreDropdown(false);
  };

  // Parse reactions JSON string: {"👍":["user_1"], "❤️":["user_2"]}
  const parseReactions = (): Record<string, string[]> => {
    if (!message.reactions) return {};
    try {
      const parsed = JSON.parse(message.reactions);
      const normalized: Record<string, string[]> = {};

      for (const emoji of Object.keys(parsed)) {
        const val = parsed[emoji];
        if (Array.isArray(val)) {
          normalized[emoji] = val;
        } else if (typeof val === 'string') {
          try {
            const arr = JSON.parse(val);
            normalized[emoji] = Array.isArray(arr) ? arr : [val];
          } catch {
            normalized[emoji] = [val];
          }
        } else {
          normalized[emoji] = [];
        }
      }
      return normalized;
    } catch (e) {
      return {};
    }
  };

  const reactions = parseReactions();
  const reactionsKeys = Object.keys(reactions);

  // thread_count from the message (gracefully handle undefined)
  const threadCount = (message as Message & { thread_count?: number }).thread_count;

  const getFilenameFromUrl = (url: string): string => {
    try {
      const parsed = new URL(url, window.location.origin || 'http://localhost');
      const filenameParam = parsed.searchParams.get('filename');
      if (filenameParam) return filenameParam;
    } catch {
      // ignore
    }
    return url.split('/').pop()?.split('?')[0] || 'Attachment';
  };

  const renderAttachments = () => {
    if (message.msg_type !== 'file') return null;

    const filename = getFilenameFromUrl(message.content);
    const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(filename);
    const authenticatedUrl = getAuthenticatedFileUrl(message.content);

    if (isImage) {
      return (
        <div className="message-attachment-image">
          <img src={authenticatedUrl} alt="Attachment" className="attachment-img" />
          <a href={authenticatedUrl} target="_blank" rel="noopener noreferrer" className="image-download-overlay">
            <Download size={20} />
          </a>
        </div>
      );
    }

    // File card
    const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
    return (
      <div className="file-card">
        <div className="file-card-icon">
          {getFileIcon(filename)}
        </div>
        <div className="file-card-info">
          <span className="file-card-name">{filename}</span>
          <span className="file-card-meta">{ext} • Click to download</span>
        </div>
        <a href={authenticatedUrl} target="_blank" rel="noopener noreferrer" className="file-card-download">
          <Download size={16} />
        </a>
      </div>
    );
  };

  // ── Smart Message (SDUI) Detection ──────────────────────────────────────
  const sduiData = useMemo(() => {
    try {
      if (message.content.startsWith('{') && message.content.includes('"_sdui"')) {
        const parsed = JSON.parse(message.content);
        if (parsed._sdui && Array.isArray(parsed.components)) {
          return parsed;
        }
      }
    } catch {
      // Not JSON — render as plain text
    }
    return null;
  }, [message.content]);

  // Parse markdown AST for non-SDUI text messages
  const markdownAst = useMemo(() => {
    if (sduiData || message.msg_type !== 'text') return null;
    try {
      return parse(message.content);
    } catch {
      return null;
    }
  }, [message.content, message.msg_type, sduiData]);

  const renderSmartContent = (content: string) => {
    if (sduiData) {
      return (
        <div className="message-sdui-card">
          <SDUIRenderer schema={sduiData.components} />
          {sduiData.plugin && (
            <div className="message-sdui-badge">
              <span className="sdui-plugin-icon">⚡</span>
              <span>{sduiData.plugin}</span>
            </div>
          )}
        </div>
      );
    }
    if (markdownAst) {
      return <MarkdownRenderer ast={markdownAst} />;
    }
    return content;
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`message-bubble-container ${isMe ? 'is-me' : ''} ${isDeleted ? 'is-deleted' : ''} ${isEditing ? 'is-editing' : ''} ${isConsecutive ? 'consecutive' : ''} ${hasNextConsecutive ? 'has-next' : ''} ${!hasNextConsecutive ? 'is-last-in-group' : ''}`}
      onContextMenu={handleContextMenu}
      onMouseLeave={() => { setShowEmojiPicker(false); setShowMoreDropdown(false); }}
    >
      {!isConsecutive && (
        <div className="message-avatar">
          <div
            className={`avatar-circle clickable ${isMe ? 'is-me-circle' : ''}`}
            ref={avatarRef}
            onClick={openUserCard}
            title={isMe ? t('messageBubble.viewYourProfile') : t('messageBubble.viewProfileOf', { name: message.sender_name })}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={message.sender_name} className="avatar-img" />
            ) : (
              getInitials(message.sender_name)
            )}
          </div>
        </div>
      )}

      {createPortal(
        <LiquidPopover
          isOpen={showUserCard}
          style={{ position: 'fixed', top: cardPos.top, left: cardPos.left, zIndex: 1100 }}
        >
          <div
            className="user-profile-card"
            ref={userCardRef}
            style={{ margin: 0 }}
          >
            <button className="upc-close" onClick={() => setShowUserCard(false)}>✕</button>
            <div className="upc-header">
              <div className="upc-avatar">
                <div className="upc-avatar-circle">{getInitials(message.sender_name)}</div>
                <span className="upc-status-dot online" />
              </div>
              <div className="upc-header-info">
                <div className="upc-name">{message.sender_name}</div>
                <div className="upc-meta">
                  <span className="upc-role-badge">user</span>
                  <span className="upc-time">
                    {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="upc-actions">
              <button className="upc-action-btn" title={t('chat.message_bubble.send_dm_tooltip', 'Nhắn trực tiếp')}>
                <MessageCircle size={14} /> {t('chat.message_bubble.send_dm', 'Nhắn tin')}
              </button>
              <button className="upc-action-btn" title={t('chat.message_bubble.view_profile_tooltip', 'Xem hồ sơ')}>
                <UserIcon size={14} /> {t('settings.profile')}
              </button>
            </div>
          </div>
        </LiquidPopover>,
        document.body
      )}

      {/* Message content panel */}
      <div className="message-content-wrapper" ref={contentRef}>
        <MentionPopover containerRef={contentRef} />
        {/* Sender name — show for first message in group */}
        {!isConsecutive && (
          <div className="message-meta">
            <span
              className="message-sender-name clickable"
              style={{ color: isMe ? 'var(--accent)' : getSenderColor(message.sender_id) }}
              onClick={openUserCard}
            >
              {isMe ? t('messageBubble.you') : message.sender_name}
            </span>
          </div>
        )}
        <SlotRenderer slot="message_header" context={{ message }} />

        {/* Reply Quote Preview */}
        {message.reply_to_id && !inThread && (
          <div className="message-reply-quote" onClick={scrollToParent}>
            <div className="reply-quote-line" />
            <div className="reply-quote-body">
              <span className="reply-quote-sender">
                {parentMessage ? (parentMessage.sender_id === currentUser?.id ? t('chat.you', 'Bạn') : parentMessage.sender_name) : '...'}
              </span>
              <span className="reply-quote-content">
                {parentMessage ? (
                  parentMessage.is_deleted ? (
                    <span className="deleted-text">{t('chat.deleted_message', 'Tin nhắn đã bị thu hồi')}</span>
                  ) : parentMessage.msg_type === 'file' ? (
                    `📎 ${t('chat.file', 'Tệp tin')}`
                  ) : (
                    parentMessage.content
                  )
                ) : (
                  t('chat.message_not_found', 'Tin nhắn không khả dụng')
                )}
              </span>
            </div>
          </div>
        )}

        <div className="message-row">
          <div className="message-content-box">
            <div className="message-content-box-main">
              {isDeleted ? (
                <span className="deleted-text">{t('messageBubble.deletedMessage')}</span>
              ) : isEditing ? (
                <div className="message-edit-input-wrapper">
                  <input
                    type="text"
                    className="message-edit-input"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEditSubmit()}
                  />
                  <div className="message-edit-actions">
                    <button className="edit-btn-action confirm" onClick={handleEditSubmit}>
                      <Check size={14} />
                    </button>
                    <button className="edit-btn-action cancel" onClick={() => setIsEditing(false)}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`message-text ${sduiData ? 'sdui-message' : ''}`}>
                  {message.msg_type === 'text' ? renderSmartContent(displayContent) : renderAttachments()}
                  {isEdited && !sduiData && (
                    <span className="edited-badge" title={`Edited at ${formatTime(message.created_at)}`}>
                      (edited)
                    </span>
                  )}
                  <SlotRenderer slot="message_after_body" context={{ message }} />
                </div>
              )}
              
              {!isEditing && reactionsKeys.length === 0 && (
                <span className="bubble-time">{formatTime(message.created_at)}</span>
              )}
            </div>
            
            {/* Inline AI Results */}
            {aiLoading && (
              <div className="copilot-inline-result loading">
                <Loader2 size={14} className="copilot-spinner spin" />
                <span>{t('messageBubble.copilotAnalyzing')}</span>
              </div>
            )}
            {aiError && (
              <div className="copilot-inline-result error">
                <span>⚠️ {aiError}</span>
                <button className="copilot-inline-close" onClick={() => setAiError(null)}>✕</button>
              </div>
            )}
            {translatedText && (
              <div className="copilot-inline-result translation">
                <div className="copilot-inline-header">
                  <div className="copilot-inline-title">
                    <Globe size={13} />
                    <span>{t('messageBubble.translatedToVietnamese')}</span>
                  </div>
                  <button className="copilot-inline-close" onClick={() => setTranslatedText(null)}>✕</button>
                </div>
                <div className="copilot-inline-content">{translatedText}</div>
              </div>
            )}
            {explainedText && (
              <div className="copilot-inline-result explanation">
                <div className="copilot-inline-header">
                  <div className="copilot-inline-title">
                    <Sparkles size={13} />
                    <span>{t('messageBubble.explainedByCopilot')}</span>
                  </div>
                  <button className="copilot-inline-close" onClick={() => setExplainedText(null)}>✕</button>
                </div>
                <div className="copilot-inline-content">
                  <MarkdownRenderer ast={parse(explainedText)} />
                </div>
              </div>
            )}
            {/* Bubble footer containing reactions and/or time */}
            {!isEditing && reactionsKeys.length > 0 && (
              <div className="bubble-footer">
                {!isDeleted && (
                  <div className="reactions-pills-list">
                    {reactionsKeys.map((emoji) => {
                      const users = reactions[emoji] || [];
                      const hasReacted = currentUser && users.includes(currentUser.id);
                      return (
                        <button
                          key={emoji}
                          className={`reaction-pill ${hasReacted ? 'reacted' : ''}`}
                          onClick={canPost ? () => handleToggleReaction(emoji) : undefined}
                          title={users.join(', ')}
                          style={{ cursor: canPost ? 'pointer' : 'default' }}
                        >
                          <span className="reaction-emoji">{emoji}</span>
                          <span className="reaction-count">{users.length}</span>
                          <span className="reaction-tooltip">{users.join(', ')}</span>
                        </button>
                      );
                    })}
                    {canPost && (
                      <button
                        className="reaction-pill reaction-add-btn"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Add reaction"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                )}
                <span className="bubble-time">{formatTime(message.created_at)}</span>
              </div>
            )}
          </div>
        </div>

        <SlotRenderer slot="message_footer" context={{ message }} />

        {/* Thread Indicator */}
        {!isDeleted && threadCount != null && threadCount > 0 && onOpenThread && (
          <div className="thread-indicator" onClick={() => onOpenThread(message)}>
            <MessageSquare size={14} />
            <span>{t('messageBubble.replyCount', { count: threadCount })}</span>
          </div>
        )}

        {/* Floating Action Toolbar (on hover) */}
        {!isDeleted && !isEditing && (
          <div className="message-action-toolbar">
            {hoverActions.map(action => {
              if (action.id === 'more') {
                return (
                  <div key={action.id} className="toolbar-more-wrapper" ref={moreDropdownRef}>
                    <button
                      onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                      className="toolbar-btn"
                      title={action.label}
                    >
                      <DynamicIcon name={action.icon} size={16} />
                    </button>
                    {showMoreDropdown && (
                      <div className="toolbar-more-dropdown">
                        {contextMenuActions.map((cAct, i) => {
                          const showDivider = i > 0 && (
                            (cAct.section === 'danger' && contextMenuActions[i - 1].section !== 'danger') ||
                            (cAct.id === 'copy_link') ||
                            (cAct.id === 'edit')
                          );
                          if (cAct.id === 'reply' && !onReply) return null;
                          if (cAct.id === 'thread' && !onOpenThread) return null;
                          return (
                            <React.Fragment key={cAct.id}>
                              {showDivider && <div className="dropdown-divider" />}
                              <button
                                className={`dropdown-item ${cAct.section === 'danger' ? 'danger' : ''}`}
                                onClick={() => handleAction(cAct)}
                              >
                                <DynamicIcon name={cAct.icon} size={14} />
                                <span>{cAct.label}</span>
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (action.id === 'reply' && !onReply) return null;
              if (action.id === 'thread' && !onOpenThread) return null;

              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="toolbar-btn"
                  title={action.label}
                >
                  <DynamicIcon name={action.icon} size={16} />
                </button>
              );
            })}
          </div>
        )}

        {/* Emoji Picker - positioned inside wrapper */}
        <LiquidPopover
          isOpen={showEmojiPicker}
          className="mini-emoji-picker"
        >
          <div ref={emojiPickerRef} style={{ display: 'flex', gap: '2px' }}>
            {['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉'].map((emoji) => (
              <button key={emoji} onClick={() => handleToggleReaction(emoji)} className="picker-emoji-btn">
                {emoji}
              </button>
            ))}
          </div>
        </LiquidPopover>
      </div>

      {/* Right-Click Context Menu — portal to body for correct fixed positioning */}
      {contextMenu && createPortal(
        <div
          className="message-context-menu"
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Reactions Row */}
          <div className="ctx-quick-reactions">
            {['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => { handleToggleReaction(emoji); setContextMenu(null); }}
                className="ctx-quick-reaction-btn"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="ctx-divider" />

          {contextMenuActions.map((action, i) => {
            const showDivider = i > 0 && (
              (action.section === 'danger' && contextMenuActions[i - 1].section !== 'danger') ||
              (action.id === 'copy_link') ||
              (action.id === 'edit')
            );

            if (action.id === 'reply' && !onReply) return null;

            return (
              <React.Fragment key={action.id}>
                {showDivider && <div className="ctx-divider" />}
                <button
                  className={`ctx-item ${action.section === 'danger' ? 'ctx-danger' : ''}`}
                  onClick={() => handleAction(action)}
                >
                  <DynamicIcon name={action.icon} size={15} />
                  <span>{action.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};
