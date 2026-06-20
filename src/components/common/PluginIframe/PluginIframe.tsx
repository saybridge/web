import React, { useEffect, useRef } from 'react';
import { api } from '../../../services/api';
import { registerPluginHook, unregisterPluginHooks, handleHookResponse } from '../../../services/pluginHooks';

interface PluginIframeProps {
	src: string;
	pluginSlug: string;
	context?: any;
}

export const PluginIframe: React.FC<PluginIframeProps> = ({ src, pluginSlug, context }) => {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		const handleMessage = async (e: MessageEvent) => {
			if (!e.data) return;

			if (e.data.type === 'sb:api') {
				const { id, method, path, body } = e.data;
				try {
					const methodLower = method.toLowerCase();
					const apiFn = (api as any)[methodLower];
					if (typeof apiFn === 'function') {
						const res = await apiFn(path, body);
						iframeRef.current?.contentWindow?.postMessage(
							{ type: 'sb:api:response', id, result: res.data }, '*'
						);
					} else {
						throw new Error(`Method ${method} not supported in API client`);
					}
				} catch (err: any) {
					iframeRef.current?.contentWindow?.postMessage(
						{ type: 'sb:api:error', id, error: err.message || 'API request failed' }, '*'
					);
				}
			} else if (e.data.type === 'sb:registerHook') {
				const { hooks } = e.data;
				if (Array.isArray(hooks)) {
					hooks.forEach((hookName: string) => {
						registerPluginHook(hookName, pluginSlug, iframeRef);
					});
				}
			} else if (e.data.type === 'sb:hook:response') {
				const { id, payload, error } = e.data;
				handleHookResponse(id, payload, error);
			}
		};

		window.addEventListener('message', handleMessage);

		// Forward incoming websocket events to the iframe
		const handleWSEvent = (event: string, data: any) => {
			iframeRef.current?.contentWindow?.postMessage(
				{ type: 'sb:event', event, payload: data }, '*'
			);
		};

		// Since websocket doesn't expose onAny directly in the local ws client, 
		// we can listen to standard window custom events or custom WS event subscriptions if implemented.
		// However, a simple custom event broker is fine:
		const wsHandler = (e: Event) => {
			const customEvent = e as CustomEvent;
			if (customEvent.detail) {
				handleWSEvent(customEvent.detail.event, customEvent.detail.data);
			}
		};
		window.addEventListener('ws:message', wsHandler);

		// Send initial context once loaded
		const handleLoad = () => {
			iframeRef.current?.contentWindow?.postMessage(
				{ type: 'sb:context', pluginSlug, ...context }, '*'
			);
		};

		const iframe = iframeRef.current;
		if (iframe) {
			iframe.addEventListener('load', handleLoad);
		}

		return () => {
			window.removeEventListener('message', handleMessage);
			window.removeEventListener('ws:message', wsHandler);
			if (iframe) {
				iframe.removeEventListener('load', handleLoad);
			}
			// Clean up all hooks registered by this plugin
			unregisterPluginHooks(pluginSlug);
		};
	}, [pluginSlug, context]);

	return (
		<iframe
			ref={iframeRef}
			src={src}
			sandbox="allow-scripts allow-forms allow-same-origin"
			allow="camera; microphone; display-capture;"
			style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
			title={`Plugin ${pluginSlug}`}
		/>
	);
};
