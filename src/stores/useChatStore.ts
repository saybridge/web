import { create } from 'zustand';

export interface RoomMember {
  room_id: string;
  user_id: string;
  room_role: string;
  user?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    presence_status?: string;
  };
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  type: 'public' | 'private' | 'dm';
  unread_count: number;
  last_message_at?: string;
  is_encrypted?: boolean;
  created_at: string;
  is_read_only?: boolean;
  created_by?: string;
  members?: RoomMember[];
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  msg_type: string;
  parent_id?: string;
  thread_count?: number;
  is_edited: boolean;
  is_deleted: boolean;
  reactions?: string; // JSON string of emoji reactions
  created_at: string;
  isPending?: boolean;
}

interface ChatState {
  rooms: Room[];
  activeRoomId: string | null;
  activeThreadParentId: string | null;
  messagesByRoom: Record<string, Message[]>;
  onlineUsers: Record<string, string>; // userId -> status ('online' | 'away' | 'busy' | 'offline')
  typingUsers: Record<string, Record<string, boolean>>; // roomId -> { userId -> boolean }
  
  setRooms: (rooms: Room[]) => void;
  updateRoomLastMessage: (roomId: string, timestamp: string) => void;
  setActiveRoomId: (roomId: string | null) => void;
  setActiveThreadParentId: (parentId: string | null) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  addIncomingMessage: (roomId: string, message: Message) => void;
  addOutgoingMessage: (roomId: string, message: Message) => void;
  confirmOutgoingMessage: (roomId: string, localId: string, serverId: string) => void;
  removeMessage: (roomId: string, localId: string) => void;
  updateMessageContent: (roomId: string, messageId: string, content: string, isEdited: boolean, isDeleted: boolean, reactions?: string) => void;
  updateUserPresence: (userId: string, status: string) => void;
  setUserTyping: (roomId: string, userId: string, isTyping: boolean) => void;
  incrementUnreadCount: (roomId: string) => void;
  clearUnreadCount: (roomId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  rooms: [],
  activeRoomId: null,
  activeThreadParentId: null,
  messagesByRoom: {},
  onlineUsers: {},
  typingUsers: {},

  setRooms: (rooms) => set({ rooms }),
  
  updateRoomLastMessage: (roomId, timestamp) => set((state) => ({
    rooms: state.rooms.map((r) => 
      r.id === roomId ? { ...r, last_message_at: timestamp } : r
    )
  })),

  setActiveRoomId: (roomId) => set((state) => {
    // Clear unread count when opening a room
    const rooms = state.rooms.map((r) =>
      r.id === roomId ? { ...r, unread_count: 0 } : r
    );
    return { activeRoomId: roomId, activeThreadParentId: null, rooms };
  }),

  setActiveThreadParentId: (parentId) => set({ activeThreadParentId: parentId }),

  setMessages: (roomId, messages) => set((state) => ({
    messagesByRoom: {
      ...state.messagesByRoom,
      [roomId]: messages,
    }
  })),

  addIncomingMessage: (roomId, message) => set((state) => {
    const roomMessages = state.messagesByRoom[roomId] || [];
    
    // De-duplicate if message exists (e.g. by server message_id)
    const exists = roomMessages.some((m) => m.id === message.id);
    let newMessages = roomMessages;
    if (exists) {
      newMessages = roomMessages.map((m) => m.id === message.id ? message : m);
    } else {
      // Find if there is a pending outgoing message with same sender and content
      const pendingIndex = roomMessages.findIndex(
        (m) => m.isPending && m.sender_id === message.sender_id && m.content === message.content
      );
      if (pendingIndex !== -1) {
        // Replace the pending message with the actual server message (updates ID and removes isPending)
        newMessages = [...roomMessages];
        newMessages[pendingIndex] = { ...message, isPending: false };
      } else {
        // Otherwise append as a new message
        newMessages = [...roomMessages, message];
      }

      // If the incoming message is a thread reply, increment the parent's thread count
      if (message.parent_id) {
        newMessages = newMessages.map((m) => {
          if (m.id === message.parent_id) {
            const currentCount = m.thread_count || 0;
            return { ...m, thread_count: currentCount + 1 };
          }
          return m;
        });
      }
    }

    // Update unread count if it's not the active room
    let rooms = state.rooms;
    if (state.activeRoomId !== roomId) {
      rooms = state.rooms.map((r) =>
        r.id === roomId ? { ...r, unread_count: r.unread_count + 1, last_message_at: message.created_at } : r
      );
    } else {
      rooms = state.rooms.map((r) =>
        r.id === roomId ? { ...r, last_message_at: message.created_at } : r
      );
    }

    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: newMessages,
      },
      rooms,
    };
  }),

  addOutgoingMessage: (roomId, message) => set((state) => {
    const roomMessages = state.messagesByRoom[roomId] || [];
    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: [...roomMessages, message],
      }
    };
  }),

  confirmOutgoingMessage: (roomId, localId, serverId) => set((state) => {
    const roomMessages = state.messagesByRoom[roomId] || [];
    
    // Check if the serverId is already in the store (e.g. added via msg:receive first)
    const serverIdExists = roomMessages.some((m) => m.id === serverId);
    if (serverIdExists) {
      // Just filter out the temporary localId message to avoid duplication
      return {
        messagesByRoom: {
          ...state.messagesByRoom,
          [roomId]: roomMessages.filter((m) => m.id !== localId),
        }
      };
    }

    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: roomMessages.map((m) => 
          m.id === localId ? { ...m, id: serverId, isPending: false } : m
        ),
      }
    };
  }),

  removeMessage: (roomId, localId) => set((state) => {
    const roomMessages = state.messagesByRoom[roomId] || [];
    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: roomMessages.filter((m) => m.id !== localId),
      }
    };
  }),

  updateMessageContent: (roomId, messageId, content, isEdited, isDeleted, reactions) => set((state) => {
    const roomMessages = state.messagesByRoom[roomId] || [];
    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: roomMessages.map((m) => 
          m.id === messageId ? { ...m, content, is_edited: isEdited, is_deleted: isDeleted, reactions } : m
        ),
      }
    };
  }),

  updateUserPresence: (userId, status) => set((state) => ({
    onlineUsers: {
      ...state.onlineUsers,
      [userId]: status,
    }
  })),

  setUserTyping: (roomId, userId, isTyping) => set((state) => {
    const roomTyping = state.typingUsers[roomId] || {};
    return {
      typingUsers: {
        ...state.typingUsers,
        [roomId]: {
          ...roomTyping,
          [userId]: isTyping,
        }
      }
    };
  }),

  incrementUnreadCount: (roomId) => set((state) => ({
    rooms: state.rooms.map((r) =>
      r.id === roomId ? { ...r, unread_count: r.unread_count + 1 } : r
    )
  })),

  clearUnreadCount: (roomId) => set((state) => ({
    rooms: state.rooms.map((r) =>
      r.id === roomId ? { ...r, unread_count: 0 } : r
    )
  })),
}));
