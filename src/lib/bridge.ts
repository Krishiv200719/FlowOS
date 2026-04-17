// ═══════════════════════════════════════════════════════════
// FlowOS — Extension Bridge (Dashboard Side)
// Communicates with bridge.js content script via postMessage
// ═══════════════════════════════════════════════════════════

import type { FocusSession, AmbientEntry } from '../types';

export type { AmbientEntry };

const pendingRequests = new Map<
  string,
  { resolve: (data: any) => void; reject: (err: Error) => void }
>();

let bridgeDetected = false;

// ─── Message Listener ─────────────────────────────────────

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'flowos-extension') return;

  const { action, requestId, data, success, error } = event.data;

  if (action === 'BRIDGE_READY') {
    bridgeDetected = true;
    console.log('[FlowOS] Extension bridge detected.');
    return;
  }

  const pending = pendingRequests.get(requestId);
  if (pending) {
    pendingRequests.delete(requestId);
    if (success) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(error || 'Bridge error'));
    }
  }
});

// ─── Helpers ──────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

function sendBridgeMessage<T = any>(
  action: string,
  timeoutMs = 2000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Bridge timeout'));
    }, timeoutMs);

    pendingRequests.set(requestId, {
      resolve: (data: T) => {
        clearTimeout(timeout);
        resolve(data);
      },
      reject: (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    window.postMessage(
      { source: 'flowos-dashboard', action, requestId },
      '*'
    );
  });
}

// ─── Public API ───────────────────────────────────────────

export async function isExtensionConnected(): Promise<boolean> {
  if (bridgeDetected) return true;
  try {
    await sendBridgeMessage('PING', 1000);
    bridgeDetected = true;
    return true;
  } catch {
    return false;
  }
}

export async function getExtensionSessions(): Promise<FocusSession[]> {
  return sendBridgeMessage<FocusSession[]>('GET_SESSIONS');
}

export async function getExtensionStatus(): Promise<{
  sessionActive: boolean;
  currentSession: FocusSession | null;
  isIdle: boolean;
  idleSince: number | null;
  isInChrome: boolean;
  offChromeSince: number | null;
}> {
  return sendBridgeMessage('GET_STATUS');
}

export async function getSiteLog(): Promise<{
  siteLog: Record<string, { totalMs: number; visits: number; category: string; lastVisited?: number }>;
  globalSiteLog: Record<string, { totalMs: number; visits: number; category: string; lastVisited?: number }>;
}> {
  return sendBridgeMessage('GET_SITE_LOG', 3000);
}

export async function clearGlobalSiteLog(): Promise<void> {
  await sendBridgeMessage('CLEAR_GLOBAL_SITE_LOG', 3000);
}

/** Feature B: Get last 2 hours of ambient browser activity */
export async function getAmbientLog(): Promise<AmbientEntry[]> {
  return sendBridgeMessage<AmbientEntry[]>('GET_AMBIENT_LOG', 3000);
}
