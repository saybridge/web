type ActiveHook = {
  pluginSlug: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
};

// Global registry of which plugins have registered which hooks
const registeredHooks: Record<string, ActiveHook[]> = {};

// Unique request ID generator for hook executions
let nextHookRequestId = 1;
const pendingHookResolvers: Record<string, { resolve: (val: any) => void; reject: (err: any) => void }> = {};

export function registerPluginHook(hookName: string, pluginSlug: string, iframeRef: React.RefObject<HTMLIFrameElement | null>) {
  if (!registeredHooks[hookName]) {
    registeredHooks[hookName] = [];
  }
  // Avoid duplicate registrations for same iframe/plugin
  const exists = registeredHooks[hookName].some(h => h.pluginSlug === pluginSlug && h.iframeRef === iframeRef);
  if (!exists) {
    registeredHooks[hookName].push({ pluginSlug, iframeRef });
  }
}

export function unregisterPluginHooks(pluginSlug: string) {
  for (const hookName in registeredHooks) {
    registeredHooks[hookName] = registeredHooks[hookName].filter(h => h.pluginSlug !== pluginSlug);
  }
}

export function handleHookResponse(requestId: string, payload: any, error?: string) {
  const resolver = pendingHookResolvers[requestId];
  if (resolver) {
    if (error) {
      resolver.reject(new Error(error));
    } else {
      resolver.resolve(payload);
    }
    delete pendingHookResolvers[requestId];
  }
}

// Executes a hook across all registered plugin iframes sequentially (waterfall pattern)
export async function triggerPluginHook(hookName: string, initialPayload: any): Promise<any> {
  const hooks = registeredHooks[hookName] || [];
  let currentPayload = initialPayload;

  for (const hook of hooks) {
    const iframe = hook.iframeRef.current;
    if (!iframe || !iframe.contentWindow) continue;

    const id = `hook_${nextHookRequestId++}_${Date.now()}`;
    const promise = new Promise((resolve) => {
      // Timeout hook execution after 2 seconds to prevent blocking UI
      const timeout = setTimeout(() => {
        if (pendingHookResolvers[id]) {
          console.warn(`[Hooks] Hook ${hookName} on plugin ${hook.pluginSlug} timed out`);
          resolve(currentPayload); // fallback to current payload
          delete pendingHookResolvers[id];
        }
      }, 2000);

      pendingHookResolvers[id] = {
        resolve: (val) => {
          clearTimeout(timeout);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timeout);
          console.error(`[Hooks] Hook ${hookName} failed:`, err);
          resolve(currentPayload); // fallback to current payload on error
        }
      };
    });

    iframe.contentWindow.postMessage({
      type: 'sb:hook:trigger',
      id,
      hookName,
      payload: currentPayload
    }, '*');

    currentPayload = await promise;
  }

  return currentPayload;
}
