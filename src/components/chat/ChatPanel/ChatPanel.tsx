import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PluginIframe } from '../../common/PluginIframe/PluginIframe';
import {
  MoreVertical, MessageSquare, Info, Shield, ShieldOff,
  Hash, Lock, Search, Users, Star, Bell, Pin, LogOut,
  ArrowDown, X, User, AtSign, Paperclip, Scissors, Download, Ban, FileText, Headphones,
  Minimize2, Maximize2,
} from 'lucide-react';
import { useChatStore, Message } from '../../../stores/useChatStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { usePluginStore } from '../../../stores/usePluginStore';
import { usePreferencesStore } from '../../../stores/usePreferencesStore';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import { useTranslation } from 'react-i18next';
import { DropZone } from '../DropZone/DropZone';
import { api } from '../../../services/api';
import { sendMessageViaWS, sendTypingIndicator, joinRoomViaWS } from '../../../services/websocket';
import { MessageComposer, createChannelPlugin, createMentionPlugin, ReplyTarget } from '@saybridge/composer';
import { usePluginManifests } from '../../../plugins/usePluginManifests';
import { useRoomActions, UIActionDefinition } from '../../../hooks/useRoomActions';
import { DynamicIcon } from '../../common/DynamicIcon/DynamicIcon';
import { SlotRenderer } from '../../common/SlotRenderer/SlotRenderer';
import { triggerPluginHook } from '../../../services/pluginHooks';
import { PinnedMessagesPanel } from '../PinnedMessagesPanel/PinnedMessagesPanel';
import { StarredMessagesPanel } from '../StarredMessagesPanel/StarredMessagesPanel';
import { FilesPanel } from '../FilesPanel/FilesPanel';
import { BannedUsersPanel } from '../BannedUsersPanel/BannedUsersPanel';
import { SearchResults } from '../SearchResults/SearchResults';
import { PruneModal } from '../PruneModal/PruneModal';
import { InviteMemberModal } from '../InviteMemberModal/InviteMemberModal';
import { CopilotPanel } from '../CopilotPanel/CopilotPanel';
import './ChatPanel.css';

interface ChatPanelProps {
  onToggleDetail: () => void;
  onOpenThread: (message: Message) => void;
  openPanelRef?: React.MutableRefObject<((panel: 'pinned' | 'starred' | 'files' | 'banned') => void) | null>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatDateSeparator(dateStr: string, t: any): string {
  const date = new Date(dateStr);
  const now = new Date();

  const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = stripTime(now);
  const target = stripTime(date);
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('chat.today');
  if (diffDays === 1) return t('chat.yesterday');

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatCreatedDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Component ─────────────────────────────────────────────────────────────
export const ChatPanel: React.FC<ChatPanelProps> = ({ onToggleDetail, onOpenThread, openPanelRef }) => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const { activeRoomId, rooms, messagesByRoom, setMessages, addOutgoingMessage, typingUsers, onlineUsers } = useChatStore();
  const isPluginEnabled = usePluginStore((s) => s.isEnabled);
  const _plugins = usePluginStore((s) => s.plugins); // subscribe to trigger re-render on toggle
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // New UI states
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Panel states
  type PanelType = 'pinned' | 'starred' | 'files' | 'banned' | 'search' | 'plugin' | 'copilot' | null;
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [activePluginPanel, setActivePluginPanel] = useState<{ id: string; label: string; iframeSrc: string; pluginSlug: string } | null>(null);

  // Expose setActivePanel to parent via ref
  useEffect(() => {
    if (openPanelRef) {
      openPanelRef.current = (panel) => setActivePanel(panel);
    }
    return () => { if (openPanelRef) openPanelRef.current = null; };
  }, [openPanelRef]);

  // Generic: read plugin extensions from ALL enabled plugins
  const { manifests: pluginManifests, composerPlugins: backendPlugins } = usePluginManifests();
  const pluginSidePanels = useMemo(() => {
    const panels: { id: string; label: string; icon: string; sort_order: number; render: string; iframe_src: string; pluginSlug: string }[] = [];
    for (const m of pluginManifests) {
      if (!m.enabled || !m.ui_extensions?.chat_side_panels) continue;
      for (const p of m.ui_extensions.chat_side_panels) {
        panels.push({
          ...p,
          iframe_src: (p.iframe_src || '').replace('{slug}', m.id),
          pluginSlug: m.id,
        });
      }
    }
    return panels.sort((a, b) => a.sort_order - b.sort_order);
  }, [pluginManifests]);

  const openPluginPanel = useCallback((panel: typeof pluginSidePanels[0]) => {
    setActivePluginPanel({ id: panel.id, label: panel.label, iframeSrc: panel.iframe_src, pluginSlug: panel.pluginSlug });
    setActivePanel('plugin');
  }, []);
  const [showPruneModal, setShowPruneModal] = useState(false);

  // Invite member modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [isInviting, setIsInviting] = useState(false);
  const inviteInputRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const kebabRef = useRef<HTMLDivElement>(null);
  const kebabButtonRef = useRef<HTMLButtonElement>(null);
  const [kebabMenuPosition, setKebabMenuPosition] = useState({ top: 0, right: 0 });
  const prevMessagesLenRef = useRef(0);

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const currentMember = activeRoom?.members?.find((m) => m.user_id === currentUser?.id);
  const isReadOnly = activeRoom?.is_read_only;
  const canPost = !isReadOnly ||
    currentUser?.system_role === 'admin' ||
    currentMember?.room_role === 'owner' ||
    currentMember?.room_role === 'moderator';
  const [togglingE2EE, setTogglingE2EE] = useState(false);



  // Load backend-driven UI actions
  const { headerActions, kebabActions, executeAction } = useRoomActions(activeRoomId || '', currentUser?.id);

  const handleHeaderAction = (action: UIActionDefinition) => {
    if (action.action_type === 'client') {
      if (action.id === 'info') {
        onToggleDetail();
      } else if (action.id === 'members') {
        setShowInviteModal(true);
        setInviteQuery('');
        setInviteResults([]);
        setInvitedIds(new Set());
        setTimeout(() => inviteInputRef.current?.focus(), 100);
      } else if (action.id === 'search') {
        setShowSearch((v) => !v);
        setSearchQuery('');
      } else if (action.id === 'copilot') {
        setActivePanel((p) => p === 'copilot' ? null : 'copilot');
      }
    } else {
      executeAction(action);
    }
  };

  const handleKebabAction = async (action: UIActionDefinition) => {
    setShowKebabMenu(false);
    if (action.action_type === 'client') {
      if (action.id === 'files') {
        setActivePanel('files');
      } else if (action.id === 'pinned-panel' || action.id === 'pinned') {
        setActivePanel('pinned');
      } else if (action.id === 'starred-panel' || action.id === 'starred') {
        setActivePanel('starred');
      } else if (action.id === 'banned' || action.id === 'banned-panel') {
        setActivePanel('banned');
      } else if (action.id === 'copilot') {
        setActivePanel((p) => p === 'copilot' ? null : 'copilot');
      } else if (action.id === 'prune' || action.id === 'prune-messages') {
        setShowPruneModal(true);
      } else if (action.id === 'notif_prefs') {
        try {
          await api.post(`/rooms/${activeRoomId}/mute`);
        } catch (e) { console.error('Mute toggle failed', e); }
      }
    } else if (action.id === 'export' && activeRoomId) {
      try {
        const res = await api.get(`/rooms/${activeRoomId}/export`);
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `messages-${activeRoomId}.json`;
        a.click(); URL.revokeObjectURL(url);
      } catch (e) { console.error('Export failed', e); }
    } else {
      executeAction(action);
    }
  };

  // Combine backend plugins with local plugins
  const composerPlugins = useMemo(() => [
    ...backendPlugins,
    createMentionPlugin(async (query) => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}&limit=10`);
        const users = res.data?.data || [];
        return users.map((u: any) => ({
          id: u.id,
          username: u.username,
          displayName: u.display_name || u.username,
          avatar: u.avatar_url,
        }));
      } catch {
        return [];
      }
    }),
    createChannelPlugin(async (query) => {
      const q = query.toLowerCase();
      return rooms
        .filter(r => r.name.toLowerCase().includes(q))
        .slice(0, 10)
        .map(r => ({ id: r.id, name: r.name, type: r.type }));
    }),
  ], [backendPlugins, rooms]);
  const messages = activeRoomId ? messagesByRoom[activeRoomId] || [] : [];

  // Fetch message history on room load
  useEffect(() => {
    if (!activeRoomId) return;

    // Join room WS channel
    joinRoomViaWS(activeRoomId);

    const fetchHistory = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await api.get(`/messages/room/${activeRoomId}`);
        if (res.data && res.data.success) {
          const rawMessages = res.data.data || [];
          const mapped: Message[] = rawMessages.map((m: any) => ({
            id: m.message_id,
            room_id: m.room_id,
            sender_id: m.sender_id,
            sender_name: m.sender_name,
            content: m.content,
            msg_type: m.msg_type || 'text',
            parent_id: m.parent_id || undefined,
            is_edited: m.is_edited || false,
            is_deleted: m.is_deleted || false,
            reactions: m.reactions ? JSON.stringify(m.reactions) : undefined,
            created_at: m.created_at,
          }));

          const sorted = [...mapped].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setMessages(activeRoomId, sorted);

          // Auto-scroll to bottom after loading history
          requestAnimationFrame(() => {
            scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'auto' });
          });
        }
      } catch (err) {
        console.error('Failed to load message history', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchHistory();
  }, [activeRoomId]);



  // Reset UI state on room switch
  useEffect(() => {
    setShowSearch(false);
    setSearchQuery('');
    setShowKebabMenu(false);
    setShowJumpToBottom(false);
    setNewMsgCount(0);
  }, [activeRoomId]);

  // ─── Scroll tracking ──────────────────────────────────────────────────
  const isNearBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 300;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setNewMsgCount(0);
  }, []);

  // Scroll to bottom on new messages (only if already near bottom)
  const lastMsgContent = messages.length > 0 ? messages[messages.length - 1]?.content : '';
  useEffect(() => {
    if (messages.length > prevMessagesLenRef.current) {
      if (isNearBottom()) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setNewMsgCount(0);
      } else {
        setNewMsgCount((c) => c + (messages.length - prevMessagesLenRef.current));
      }
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages, isNearBottom]);

  // Auto-scroll during streaming (content updates on existing message)
  useEffect(() => {
    if (isNearBottom()) {
      scrollerRef.current?.scrollTo({
        top: scrollerRef.current.scrollHeight,
        behavior: 'auto',
      });
    }
  }, [lastMsgContent, isNearBottom]);

  const handleScroll = useCallback(() => {
    setShowJumpToBottom(!isNearBottom());
    if (isNearBottom()) {
      setNewMsgCount(0);
    }
  }, [isNearBottom]);

  // Update kebab position based on button coordinates
  useEffect(() => {
    if (showKebabMenu && kebabButtonRef.current) {
      const rect = kebabButtonRef.current.getBoundingClientRect();
      setKebabMenuPosition({
        top: rect.bottom + window.scrollY + 6,
        right: window.innerWidth - rect.right - window.scrollX,
      });
    }
  }, [showKebabMenu]);

  // Close kebab on outside click
  useEffect(() => {
    if (!showKebabMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        kebabRef.current &&
        !kebabRef.current.contains(e.target as Node) &&
        kebabButtonRef.current &&
        !kebabButtonRef.current.contains(e.target as Node)
      ) {
        setShowKebabMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showKebabMenu]);

  // Handle typing indicator debouncing
  const handleTextChange = (_val: string) => {

    if (!isTyping && activeRoomId) {
      setIsTyping(true);
      sendTypingIndicator(activeRoomId, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (activeRoomId) {
        sendTypingIndicator(activeRoomId, false);
      }
    }, 2000);
  };

  const handleSend = async (text: string, replyToId?: string) => {
    if (!text.trim() || !activeRoomId || !currentUser) return;

    let hookResult = { content: text, msg_type: 'text' };
    try {
      hookResult = await triggerPluginHook('message:before_send', {
        roomId: activeRoomId,
        content: text,
        msg_type: 'text'
      });
    } catch (err) {
      console.warn('[Hooks] message:before_send hook execution failed:', err);
    }

    const localId = `local_${Math.random().toString(36).substring(2, 15)}`;
    const newMsg: Message = {
      id: localId,
      room_id: activeRoomId,
      sender_id: currentUser.id,
      sender_name: currentUser.username,
      content: hookResult.content,
      msg_type: hookResult.msg_type,
      parent_id: replyToId,
      is_edited: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      isPending: true,
    };

    // Optimistic UI update
    addOutgoingMessage(activeRoomId, newMsg);

    // Send through WebSocket
    sendMessageViaWS({
      localId,
      roomId: activeRoomId,
      content: hookResult.content,
      msgType: hookResult.msg_type,
      parentId: replyToId,
    });

    setInputText('');
    setIsTyping(false);
    setReplyTo(null);
    sendTypingIndicator(activeRoomId, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  // Handle reply to message
  const handleReply = useCallback((msg: Message) => {
    setReplyTo({
      messageId: msg.id,
      senderName: msg.sender_name,
      content: msg.content,
    });
  }, []);


  // Upload file handling — now supports preview before send
  const handleFileSelect = (files: File[]) => {
    if (files.length === 0) return;
    setPendingFile(files[0]);
  };

  const handleCancelFile = () => {
    setPendingFile(null);
    setUploadProgress(null);
  };

  const handleSendFile = async () => {
    if (!pendingFile || !activeRoomId || !currentUser) return;
    const file = pendingFile;

    try {
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('room_id', activeRoomId);

      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 95));
          }
        },
      });

      if (res.data?.success) {
        const { id: fileId, url: download_url } = res.data.data;

        // Send file details via WS
        const localId = `local_${Math.random().toString(36).substring(2, 15)}`;
        const newMsg: Message = {
          id: localId,
          room_id: activeRoomId,
          sender_id: currentUser.id,
          sender_name: currentUser.username,
          content: download_url,
          msg_type: 'file',
          is_edited: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          isPending: true,
        };

        addOutgoingMessage(activeRoomId, newMsg);

        sendMessageViaWS({
          localId,
          roomId: activeRoomId,
          content: download_url,
          msgType: 'file',
        });

        setUploadProgress(100);
        setPendingFile(null);
        setTimeout(() => setUploadProgress(null), 500);
      }
    } catch (e) {
      console.error('File upload failed', e);
      setUploadProgress(null);
    }
  };

  // Get active typing users string — now shows actual usernames
  const getTypingString = () => {
    if (!activeRoomId) return '';
    const roomTypers = typingUsers[activeRoomId] || {};
    const typerIds = Object.keys(roomTypers).filter(
      (uid) => roomTypers[uid] && uid !== currentUser?.id && uid !== currentUser?.username
    );

    if (typerIds.length === 0) return '';
    if (typerIds.length === 1) {
      return `${typerIds[0]} ${t('chat.typing')}`;
    }
    if (typerIds.length === 2) {
      return `${typerIds[0]} ${t('chat.and')} ${typerIds[1]} ${t('chat.typing_plural')}`;
    }
    return `${typerIds[0]} ${t('chat.and')} ${typerIds.length - 1} ${t('chat.others_typing')}`;
  };

  // ─── Room type helpers ──────────────────────────────────────────────
  const getDMInfo = useCallback(() => {
    if (!activeRoom || !currentUser || !activeRoom.members) return { name: activeRoom?.name || '', avatar: undefined, presence: 'offline' };
    const otherMember = activeRoom.members.find((m) => m.user_id !== currentUser.id);
    if (!otherMember || !otherMember.user) {
      return { name: activeRoom?.name || t('chat.chat_with', { name: '' }), avatar: undefined, presence: 'offline' };
    }
    const otherUser = otherMember.user;
    const displayName = otherUser.display_name || otherUser.username;
    const presence = onlineUsers[otherUser.id] || otherUser.presence_status || 'offline';
    return {
      name: displayName,
      avatar: otherUser.avatar_url,
      presence,
    };
  }, [activeRoom, currentUser, onlineUsers]);

  const getRoomIcon = () => {
    if (!activeRoom) return <Hash size={16} />;
    if (activeRoom.type === 'public') return <Hash size={16} />;
    if (activeRoom.type === 'private') return <Lock size={16} />;

    const dmInfo = getDMInfo();
    if (dmInfo.avatar) {
      return <img src={dmInfo.avatar} alt="avatar" className="header-dm-avatar" />;
    }
    return <User size={16} />;
  };

  const getRoomIconClass = () => {
    if (!activeRoom) return 'icon-public';
    if (activeRoom.type === 'public') return 'icon-public';
    if (activeRoom.type === 'private') return 'icon-private';

    const dmInfo = getDMInfo();
    if (dmInfo.avatar) return 'icon-dm-has-avatar';
    return 'icon-dm';
  };

  const getRoomTopicText = () => {
    if (!activeRoom) return '';
    if (activeRoom.type === 'public') return 'Public Channel';
    if (activeRoom.type === 'private') return 'Private Channel';

    const dmInfo = getDMInfo();
    return `Direct Message with ${dmInfo.name} (${dmInfo.presence})`;
  };

  const typingString = getTypingString();

  if (!activeRoomId) {
    return (
      <div className="chatpanel-empty-state">
        <MessageSquare size={64} className="empty-icon" />
        <h3>{t('chat.empty_state_title')}</h3>
        <p>{t('chat.empty_state_desc')}</p>
      </div>
    );
  }

  const hasPanel = activeRoomId && activePanel;

  return (
    <div className="chatpanel-wrapper">
      <div className={`chatpanel-main ${hasPanel ? 'with-panel' : ''}`}>
        <SlotRenderer slot="global_app_overlay" context={{ roomId: activeRoomId }} />
        <DropZone onFilesDropped={handleFileSelect}>
          <div className="chatpanel-container">
            {/* ─── Header ──────────────────────────────────────────────── */}
            <div className="chatpanel-header" data-tauri-drag-region>
              <div className="header-left">
                <div className={`header-room-icon ${getRoomIconClass()}`}>
                  {getRoomIcon()}
                </div>
                <div className="header-info">
                  <div className="header-name-row">
                    <span className="header-room-name">
                      {activeRoom?.type === 'dm' ? getDMInfo().name : activeRoom?.name}
                    </span>
                    <SlotRenderer slot="room_header_badge" context={{ roomId: activeRoomId }} />
                  </div>
                  <span className="header-room-topic">{getRoomTopicText()}</span>
                </div>
              </div>

              <div className="header-actions">

                {/* Dynamic Header Actions */}
                {headerActions.map(action => (
                  <button
                    key={action.id}
                    className={`header-btn ${action.id === 'search' && showSearch ? 'active' : ''}`}
                    onClick={() => handleHeaderAction(action)}
                    title={action.label}
                  >
                    <DynamicIcon name={action.icon} size={18} />
                  </button>
                ))}

                {/* Generic: Plugin side panel buttons (from manifests) */}
                {/* Moved into kebab menu below */}

                {/* Kebab menu */}
                <div className="header-kebab-wrapper">
                  <button
                    ref={kebabButtonRef}
                    className={`header-btn ${showKebabMenu ? 'active' : ''}`}
                    onClick={() => setShowKebabMenu((v) => !v)}
                    title={t('chat.kebab_tooltip', 'More actions')}
                  >
                    <MoreVertical size={18} />
                  </button>
                  {showKebabMenu && createPortal(
                    <div
                      className="header-kebab-dropdown"
                      ref={kebabRef}
                      style={{
                        position: 'absolute',
                        top: `${kebabMenuPosition.top}px`,
                        right: `${kebabMenuPosition.right}px`,
                      }}
                    >
                      {/* Plugin side panels in menu */}
                      {pluginSidePanels.map(panel => (
                        <button
                          key={panel.id}
                          className={`kebab-item ${activePanel === 'plugin' && activePluginPanel?.id === panel.id ? 'kebab-active' : ''}`}
                          onClick={() => {
                            setShowKebabMenu(false);
                            if (activePanel === 'plugin' && activePluginPanel?.id === panel.id) {
                              setActivePanel(null);
                              setActivePluginPanel(null);
                            } else {
                              openPluginPanel(panel);
                            }
                          }}
                        >
                          <DynamicIcon name={panel.icon} size={15} />
                          <span>{panel.label}</span>
                        </button>
                      ))}
                      {pluginSidePanels.length > 0 && kebabActions.length > 0 && <div className="kebab-divider" />}
                      {kebabActions.map((action, i) => {
                        const showDivider = i > 0 && (
                          (action.section === 'danger' && kebabActions[i - 1].section !== 'danger') ||
                          (action.id === 'notif_prefs') ||
                          (action.id === 'export') ||
                          (action.id === 'leave')
                        );
                        return (
                          <React.Fragment key={action.id}>
                            {showDivider && <div className="kebab-divider" />}
                            <button
                              className={`kebab-item ${action.section === 'danger' ? 'kebab-danger' : ''}`}
                              onClick={() => handleKebabAction(action)}
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
              </div>
            </div>

            <SlotRenderer slot="chat_header" context={{ roomId: activeRoomId }} />

            {/* ─── Search bar (conditional) ──────────────────────────── */}
            {showSearch && (
              <div className="header-search-bar">
                <Search size={16} className="search-bar-icon" />
                <input
                  className="search-bar-input"
                  type="text"
                  placeholder={t('chat.search_placeholder', 'Search messages...')}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value.length > 1) setActivePanel('search'); else setActivePanel(null); }}
                  autoFocus
                />
                <button className="search-bar-close" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                  <X size={16} />
                </button>
              </div>
            )}


            {/* ─── Message area ──────────────────────────────────────── */}
            <div className="chatpanel-messages-container">
              <div className="messages-scroller" ref={scrollerRef} onScroll={handleScroll}>
                {isLoadingMessages ? (
                  <div className="messages-loading-skeleton">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={`skeleton-msg ${i % 3 === 0 ? '' : 'skeleton-consecutive'}`}>
                        {i % 3 === 0 && <div className="skeleton-avatar" />}
                        <div className={`skeleton-body ${i % 3 !== 0 ? 'skeleton-body--consecutive' : ''}`}>
                          {i % 3 === 0 && <div className="skeleton-name" />}
                          <div className="skeleton-line" style={{ width: `${45 + Math.random() * 40}%` }} />
                          {Math.random() > 0.5 && <div className="skeleton-line" style={{ width: `${25 + Math.random() * 30}%` }} />}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {(() => {
                      const rootMessages = messages.filter(
                        (msg) => !msg.parent_id && !(msg.is_deleted && msg.content.startsWith('/'))
                      );
                      return rootMessages.length > 0 ? (
                        rootMessages.map((msg, index, filteredMessages) => {
                          const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                          const nextMsg = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;

                          const isConsecutive = !!(
                            prevMsg &&
                            prevMsg.sender_id === msg.sender_id &&
                            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 1 * 60 * 1000
                          );

                          const hasNextConsecutive = !!(
                            nextMsg &&
                            nextMsg.sender_id === msg.sender_id &&
                            new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() < 1 * 60 * 1000
                          );

                          // Date separator check
                          const showDateSep = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);

                          return (
                            <React.Fragment key={msg.id}>
                              {showDateSep && (
                                <div className="date-separator">
                                  <span className="date-separator-text">{formatDateSeparator(msg.created_at, t)}</span>
                                </div>
                              )}
                              <MessageBubble
                                message={msg}
                                onOpenThread={onOpenThread}
                                onReply={canPost ? handleReply : undefined}
                                isConsecutive={isConsecutive && !showDateSep}
                                hasNextConsecutive={hasNextConsecutive}
                              />
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <div className="room-welcome">
                          <div className={`room-welcome-icon ${getRoomIconClass()}`}>
                            {activeRoom?.type === 'public' && <Hash size={28} />}
                            {activeRoom?.type === 'private' && <Lock size={28} />}
                            {activeRoom?.type === 'dm' && (
                              getDMInfo().avatar ? (
                                <img src={getDMInfo().avatar} alt="avatar" className="header-dm-avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <User size={28} />
                              )
                            )}
                          </div>
                          <h3>
                            {activeRoom?.type === 'dm'
                              ? t('chat.chat_with', { name: getDMInfo().name })
                              : t('chat.channel_welcome', { name: activeRoom?.name })}
                          </h3>
                          <p className="room-welcome-desc">
                            {activeRoom?.type === 'dm'
                              ? t('chat.dm_start_desc', { name: getDMInfo().name })
                              : t('chat.channel_start_desc')}
                          </p>
                          <span className="room-welcome-date">Created {formatCreatedDate(activeRoom?.created_at)}</span>
                        </div>
                      );
                    })()}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Jump to bottom */}
              {showJumpToBottom && (
                <button className="jump-to-bottom" onClick={() => scrollToBottom()} title="Jump to latest">
                  <ArrowDown size={20} />
                  {newMsgCount > 0 && <span className="jump-badge">{newMsgCount}</span>}
                </button>
              )}
            </div>

            <SlotRenderer slot="chat_before_composer" context={{ roomId: activeRoomId }} />

            {/* ─── Input panel ───────────────────────────────────────── */}
            <div className="chatpanel-input-container">
              {/* Typing indicator inside input container to align layout constraints */}
              <div className="typing-indicator-banner">
                {typingString && (
                  <div className="typing-content">
                    <span className="typing-user">{typingString}</span>
                    <span className="typing-dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </span>
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && handleFileSelect(Array.from(e.target.files))}
              />

              {/* File Preview Banner */}
              {pendingFile && (
                <div className="file-preview-banner">
                  <div className="file-preview-content">
                    {pendingFile.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(pendingFile)}
                        alt="preview"
                        className="file-preview-thumb"
                      />
                    ) : (
                      <div className="file-preview-icon">
                        <FileText size={20} />
                      </div>
                    )}
                    <div className="file-preview-info">
                      <span className="file-preview-name">{pendingFile.name}</span>
                      <span className="file-preview-size">
                        {(pendingFile.size / 1024).toFixed(1)} KB — {pendingFile.type || 'unknown'}
                      </span>
                    </div>
                    <button className="file-preview-cancel" onClick={handleCancelFile} title={t('chat.cancel', 'Cancel')}>
                      ✕
                    </button>
                  </div>
                  {uploadProgress !== null && (
                    <div className="file-upload-progress">
                      <div className="file-upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
              )}

              {canPost ? (
                <MessageComposer
                  onSend={(text) => {
                    if (pendingFile) {
                      handleSendFile();
                      return;
                    }
                    handleSend(text, replyTo?.messageId);
                  }}
                  allowEmptySend={!!pendingFile}
                  onAttach={() => fileInputRef.current?.click()}
                  onChangeText={handleTextChange}
                  placeholder={
                    pendingFile
                      ? t('chat.send_file', { name: pendingFile.name })
                      : activeRoom?.type === 'dm'
                      ? t('chat.send_message_to_dm', { name: getDMInfo().name })
                      : t('chat.send_message_to_channel', { name: activeRoom?.name || t('chat.channel_fallback', 'channel') })
                  }
                  replyTo={replyTo}
                  onClearReply={() => setReplyTo(null)}
                  plugins={composerPlugins}
                  enterBehavior={usePreferencesStore.getState().enterBehavior}
                  formatToggleShowTitle={t('chat.format_show', 'Text formatting (Ctrl+Shift+F)')}
                  formatToggleHideTitle={t('chat.format_hide', 'Hide formatting')}
                />
              ) : (
                <div className="chat-readonly-banner" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '16px',
                  background: 'var(--glass-thin)',
                  backdropFilter: 'var(--blur-heavy)',
                  border: 'var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  pointerEvents: 'auto',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box'
                }}>
                  <Lock size={16} style={{ color: 'var(--text-muted)', opacity: 0.8 }} />
                  <span>{t('chat.readonly_banner', 'This is a read-only channel. Only administrators and moderators can send messages.')}</span>
                </div>
              )}
              <SlotRenderer slot="chat_after_composer" context={{ roomId: activeRoomId }} />
            </div>
          </div>
        </DropZone>
      </div>

      {/* ─── Contextual Panels (right side) ─────────────────── */}
      {activeRoomId && activePanel === 'pinned' && (
        <PinnedMessagesPanel roomId={activeRoomId} onClose={() => setActivePanel(null)} />
      )}
      {activeRoomId && activePanel === 'starred' && (
        <StarredMessagesPanel roomId={activeRoomId} onClose={() => setActivePanel(null)} />
      )}
      {activeRoomId && activePanel === 'files' && (
        <FilesPanel roomId={activeRoomId} onClose={() => setActivePanel(null)} />
      )}
      {activeRoomId && activePanel === 'banned' && (
        <BannedUsersPanel roomId={activeRoomId} onClose={() => setActivePanel(null)} />
      )}
      {activeRoomId && activePanel === 'search' && searchQuery.length > 0 && (
        <SearchResults
          query={searchQuery}
          roomId={activeRoomId}
          onClose={() => { setActivePanel(null); setShowSearch(false); setSearchQuery(''); }}
          onSelectMessage={(_msgId) => { setActivePanel(null); /* TODO: scroll to message */ }}
        />
      )}
      {activeRoomId && activePanel === 'copilot' && (
        <CopilotPanel roomId={activeRoomId} onClose={() => setActivePanel(null)} />
      )}

      {/* ─── Plugin Side Panels (generic, from manifests) ──── */}
      {activeRoomId && activePanel === 'plugin' && activePluginPanel && (
        <div className="chat-side-panel">
          <div className="chat-side-panel-header" data-tauri-drag-region>
            <h3 data-tauri-drag-region>{activePluginPanel.label}</h3>
            <button className="chat-side-panel-close" onClick={() => { setActivePanel(null); setActivePluginPanel(null); }}>
              <X size={16} />
            </button>
          </div>
          <div className="chat-side-panel-body">
            <PluginIframe
              src={activePluginPanel.iframeSrc}
              pluginSlug={activePluginPanel.pluginSlug}
              context={{ room_id: activeRoomId, roomId: activeRoomId }}
            />
          </div>
        </div>
      )}

      {/* ─── Modals ────────────────────────────────────────────── */}
      {activeRoomId && showPruneModal && (
        <PruneModal roomId={activeRoomId} onClose={() => setShowPruneModal(false)} />
      )}

      {/* ─── Invite Member Modal ──────────────────────────────── */}
      {activeRoomId && showInviteModal && createPortal(
        <InviteMemberModal
          roomId={activeRoomId}
          inviteQuery={inviteQuery}
          setInviteQuery={setInviteQuery}
          inviteResults={inviteResults}
          setInviteResults={setInviteResults}
          invitedIds={invitedIds}
          setInvitedIds={setInvitedIds}
          isInviting={isInviting}
          setIsInviting={setIsInviting}
          inputRef={inviteInputRef}
          onClose={() => setShowInviteModal(false)}
        />,
        document.body
      )}
    </div>
  );
};
