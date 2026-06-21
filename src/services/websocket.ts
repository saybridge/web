import { DEFAULT_WS_URL } from './api';
import { getAccessToken } from './auth';
import { useChatStore, Message } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';
import { triggerNotification } from './notifications';
import { usePluginStore } from '../stores/usePluginStore';

let socket: WebSocket | null = null;
let reconnectTimeout: any = null;
let reconnectInterval = 1000;
const MAX_RECONNECT_INTERVAL = 30000;
let isDisconnectingIntentional = false;

interface SendQueueItem {
  localId: string;
  roomId: string;
  content: string;
  msgType?: string;
  parentId?: string;
  replyToId?: string;
}

let sendQueue: SendQueueItem[] = [];

export const initWebSocket = async () => {
  if (socket) {
    console.log('WebSocket: Already initialized or connecting');
    return;
  }

  const token = getAccessToken();
  if (!token) {
    console.log('WebSocket: No access token available, skipping connection');
    return;
  }

  isDisconnectingIntentional = false;
  const wsUrl = `${DEFAULT_WS_URL}?token=${token}`;
  console.log(`WebSocket: Connecting to ${wsUrl}`);

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket: Connection established');
      reconnectInterval = 1000;
      joinAllActiveRooms();
      flushQueue();
    };

    socket.onmessage = async (event) => {
      try {
        const rawData = event.data;
        if (typeof rawData !== 'string') return;

        // Split by newline to support batched frames from Go backend WritePump
        const lines = rawData.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          try {
            const payload = JSON.parse(line);
            console.log('WebSocket: Received frame', payload);

            // Dispatch global event for plugin iframe listeners
            window.dispatchEvent(new CustomEvent('ws:message', {
              detail: { event: payload.event, data: payload.data || payload }
            }));

            const chatStore = useChatStore.getState();
            const authStore = useAuthStore.getState();

            switch (payload.event) {
              case 'msg:receive': {
                const serverMsg = payload.data;
                const incomingMsg: Message = {
                  id: serverMsg.message_id,
                  room_id: serverMsg.room_id,
                  sender_id: serverMsg.sender_id,
                  sender_name: serverMsg.sender_name,
                  content: serverMsg.content,
                  msg_type: serverMsg.msg_type || 'text',
                  parent_id: serverMsg.parent_id || undefined,
                  reply_to_id: serverMsg.reply_to_id || undefined,
                  is_edited: serverMsg.is_edited || false,
                  is_deleted: serverMsg.is_deleted || false,
                  reactions: serverMsg.reactions ? JSON.stringify(serverMsg.reactions) : undefined,
                  created_at: serverMsg.created_at,
                };
                chatStore.addIncomingMessage(serverMsg.room_id, incomingMsg);

                // Trigger OS or Web notification if:
                // 1. The sender is not the current user
                // 2. The user is not actively viewing the room of this message
                // 3. The smart-notifications plugin is disabled (otherwise it handles it via smart_notification event)
                const isSmartNotifEnabled = usePluginStore.getState().isEnabled('smart-notifications');
                const isCurrentRoom = chatStore.activeRoomId === serverMsg.room_id;
                if (authStore.user && serverMsg.sender_id !== authStore.user.id && !isCurrentRoom && !isSmartNotifEnabled) {
                  triggerNotification(
                    `#${serverMsg.room_id.slice(0, 8)} - ${serverMsg.sender_name}`,
                    serverMsg.content
                  );
                }
                break;
              }
              case 'smart_notification': {
                const notifData = payload.data || payload;
                const currentUserId = authStore.user?.id;
                const isCurrentRoom = chatStore.activeRoomId === notifData.room_id;
                if (currentUserId && notifData.recipient_id === currentUserId && !isCurrentRoom) {
                  triggerNotification(
                    `🔔 Smart Notification (${notifData.priority})`,
                    notifData.message
                  );
                }
                break;
              }
              case 'msg:stream': {
                // AI streaming: update existing message content with new chunk
                const streamData = payload.data;
                if (streamData.message_id && streamData.room_id) {
                  chatStore.updateMessageContent(
                    streamData.room_id,
                    streamData.message_id,
                    streamData.content,
                    false,
                    false
                  );
                }
                break;
              }
              case 'msg:ack': {
                const ackData = payload.data;
                chatStore.confirmOutgoingMessage(payload.room_id || chatStore.activeRoomId || '', ackData.local_id, ackData.message_id);
                break;
              }
              case 'msg:error': {
                const errData = payload.data;
                console.error(`WebSocket msg:error: localId ${errData.local_id} failed`, errData.message);
                chatStore.removeMessage(payload.room_id || chatStore.activeRoomId || '', errData.local_id);
                break;
              }
              case 'user:presence:changed': {
                const presenceData = payload.data || payload;
                if (presenceData.user_id) {
                  chatStore.updateUserPresence(presenceData.user_id, presenceData.status);
                }
                break;
              }
              case 'user:typing': {
                const typingData = payload.data || {};
                chatStore.setUserTyping(payload.room_id, typingData.username || typingData.user_id, typingData.typing);
                break;
              }
              case 'auth:expired': {
                console.warn('WebSocket: Auth token expired on gateway');
                disconnectWebSocket();
                scheduleReconnect();
                break;
              }
              case 'system:plugin_toggled': {
                const pluginData = payload.data;
                console.log('[WebSocket] Plugin toggled:', pluginData);
                // Dispatch DOM event so usePluginManifests can refetch
                window.dispatchEvent(new CustomEvent('plugin:manifests:changed', { detail: pluginData }));
                break;
              }
            }
          } catch (lineErr) {
            console.error('WebSocket: Failed to parse individual frame line', lineErr, line);
          }
        }
      } catch (err) {
        console.error('WebSocket: Failed to process frame payload', err);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket: Error', error);
    };

    socket.onclose = (event) => {
      console.log('WebSocket: Connection closed', event.reason, event.code);
      socket = null;
      if (!isDisconnectingIntentional) {
        scheduleReconnect();
      }
    };
  } catch (err) {
    console.error('WebSocket: Failed to open connection', err);
    scheduleReconnect();
  }
};

export const disconnectWebSocket = () => {
  isDisconnectingIntentional = true;
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
};

const scheduleReconnect = () => {
  if (reconnectTimeout) return;

  console.log(`WebSocket: Scheduling reconnect in ${reconnectInterval}ms`);
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    reconnectInterval = Math.min(reconnectInterval * 2, MAX_RECONNECT_INTERVAL);
    initWebSocket();
  }, reconnectInterval);
};

const joinAllActiveRooms = () => {
  const { rooms } = useChatStore.getState();
  rooms.forEach((room) => {
    joinRoomViaWS(room.id);
  });
};

export const joinRoomViaWS = (roomId: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      event: 'room:join',
      room_id: roomId,
    }));
  }
};

export const leaveRoomViaWS = (roomId: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      event: 'room:leave',
      room_id: roomId,
    }));
  }
};

export const sendMessageViaWS = (item: SendQueueItem) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = {
      event: 'msg:send',
      room_id: item.roomId,
      data: {
        local_id: item.localId,
        content: item.content,
        msg_type: item.msgType || 'text',
        parent_id: item.parentId || '',
        reply_to_id: item.replyToId || '',
      },
    };
    socket.send(JSON.stringify(payload));
    console.log('WebSocket: Frame sent', payload);
  } else {
    console.log('WebSocket: Queueing message, socket not open', item);
    sendQueue.push(item);
  }
};

const flushQueue = () => {
  const queue = [...sendQueue];
  sendQueue = [];
  queue.forEach((item) => sendMessageViaWS(item));
};

export const sendTypingIndicator = (roomId: string, typing: boolean) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        event: 'user:typing',
        room_id: roomId,
        data: { typing },
      })
    );
  }
};

export const editMessageViaWS = (roomId: string, messageId: string, timeBucket: number, content: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        event: 'msg:edit',
        room_id: roomId,
        data: {
          message_id: messageId,
          time_bucket: timeBucket,
          content,
        },
      })
    );
  }
};

export const deleteMessageViaWS = (roomId: string, messageId: string, timeBucket: number) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        event: 'msg:delete',
        room_id: roomId,
        data: {
          message_id: messageId,
          time_bucket: timeBucket,
        },
      })
    );
  }
};

export const toggleReactionViaWS = (roomId: string, messageId: string, timeBucket: number, emoji: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        event: 'msg:reaction',
        room_id: roomId,
        data: {
          message_id: messageId,
          time_bucket: timeBucket,
          emoji,
        },
      })
    );
  }
};

export const sendWSFrame = (payload: any) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  } else {
    console.warn('WebSocket: Cannot send frame, socket is not open');
  }
};
