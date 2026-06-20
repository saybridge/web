import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { sendWSFrame } from '../services/websocket';

export interface UIActionDefinition {
	id: string;
	label: string;
	icon: string;
	slot: string;
	section: 'default' | 'danger';
	permission?: string;
	source: string;
	sort_order: number;
	action_type: 'client' | 'api' | 'ws_hook' | 'sdui';
	api_endpoint?: string;
	hook_event?: string;
	sdui_screen?: string;
	owner_only?: boolean;
	admin_only?: boolean;
}

// Global cache for room actions to prevent flooding the server
const cache: Record<string, { actions: UIActionDefinition[]; fetchedAt: number }> = {};
const inflight: Record<string, Promise<UIActionDefinition[]> | undefined> = {};
const CACHE_TTL = 30000; // 30 seconds

export const useRoomActions = (roomId: string, currentUserId?: string) => {
	const [actions, setActions] = useState<UIActionDefinition[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchActions = useCallback(async (force = false) => {
		if (!roomId) return;

		// 1. Check cache
		const cached = cache[roomId];
		const now = Date.now();
		if (!force && cached && now - cached.fetchedAt < CACHE_TTL) {
			setActions(cached.actions);
			setLoading(false);
			return;
		}

		// 2. Check in-flight promise
		if (!force && inflight[roomId]) {
			setLoading(true);
			try {
				const acts = await inflight[roomId];
				setActions(acts);
			} catch (err) {
				console.error('[useRoomActions] Failed to await in-flight actions:', err);
			} finally {
				setLoading(false);
			}
			return;
		}

		setLoading(true);
		const slots = [
			'channel_header_button',
			'channel_kebab_menu',
			'message_context_menu',
			'message_hover_toolbar'
		];

		const fetchPromise = (async () => {
			try {
				const promises = slots.map(slot =>
					api.get(`/rooms/${roomId}/actions?slot=${slot}`)
				);
				const results = await Promise.all(promises);
				const allActions: UIActionDefinition[] = [];

				results.forEach((res) => {
					if (res.data) {
						const items = Array.isArray(res.data) ? res.data : (res.data.data || []);
						allActions.push(...items);
					}
				});

				cache[roomId] = {
					actions: allActions,
					fetchedAt: Date.now()
				};
				return allActions;
			} catch (err) {
				delete cache[roomId];
				throw err;
			} finally {
				delete inflight[roomId];
			}
		})();

		inflight[roomId] = fetchPromise;

		try {
			const acts = await fetchPromise;
			setActions(acts);
		} catch (err) {
			console.error('[useRoomActions] Failed to fetch room actions:', err);
		} finally {
			setLoading(false);
		}
	}, [roomId]);

	useEffect(() => {
		fetchActions();
	}, [fetchActions]);

	// Separate actions by slot
	const headerActions = actions.filter(a => a.slot === 'channel_header_button');
	const kebabActions = actions.filter(a => a.slot === 'channel_kebab_menu');

	// Filtering for message actions (context menu and hover toolbar)
	const getMessageActions = useCallback((slot: 'message_context_menu' | 'message_hover_toolbar', messageSenderId?: string) => {
		const slotActions = actions.filter(a => a.slot === slot);
		if (!messageSenderId || !currentUserId) return slotActions;

		const isOwner = messageSenderId === currentUserId;
		return slotActions.filter(a => !a.owner_only || isOwner);
	}, [actions, currentUserId]);

	const executeAction = useCallback(async (
		action: UIActionDefinition,
		message?: { id: string; content: string; [key: string]: any },
		callbacks?: {
			onClientAction?: (actionId: string, message?: any) => void;
			onSuccess?: (result: any) => void;
			onError?: (err: any) => void;
		}
	) => {
		const { action_type, api_endpoint, hook_event, sdui_screen, source, id } = action;

		try {
			if (action_type === 'client') {
				if (callbacks?.onClientAction) {
					callbacks.onClientAction(id, message);
				}
				return;
			}

			if (action_type === 'api' && api_endpoint) {
				// Parse APIEndpoint: e.g. "POST /rooms/{room_id}/mute"
				const parts = api_endpoint.split(' ');
				const method = parts[0].toLowerCase();
				let url = parts[1] || '';

				// Replace placeholders
				url = url.replace('{room_id}', roomId);
				if (message) {
					url = url.replace('{message_id}', message.id);
				}

				// Make API call
				const methodFn = (api as any)[method];
				if (methodFn) {
					const res = await methodFn(url);
					if (callbacks?.onSuccess) callbacks.onSuccess(res.data);
				} else {
					throw new Error(`Unsupported API method: ${method}`);
				}
			}

			if (action_type === 'ws_hook') {
				// Send websocket plugin:action event
				const payload = {
					event: 'plugin:action',
					room_id: roomId,
					data: {
						plugin_slug: source,
						action_id: id,
						hook_event: hook_event,
						message_id: message?.id,
						content: message?.content,
						time_bucket: message?.time_bucket,
					}
				};
				sendWSFrame(payload);
				if (callbacks?.onSuccess) callbacks.onSuccess({ status: 'sent' });
			}

			if (action_type === 'sdui' && sdui_screen) {
				// Handle SDUI trigger
				console.log('[useRoomActions] Trigger SDUI screen:', sdui_screen);
				if (callbacks?.onSuccess) callbacks.onSuccess({ type: 'sdui', screen: sdui_screen });
			}
		} catch (err: any) {
			console.error('[useRoomActions] Failed to execute action:', err);
			if (callbacks?.onError) callbacks.onError(err);
		}
	}, [roomId]);

	return {
		loading,
		headerActions,
		kebabActions,
		getMessageActions,
		executeAction,
		refetch: fetchActions
	};
};
