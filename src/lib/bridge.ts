// ═══════════════════════════════════════════════════════════
// FlowOS — Extension Bridge (Dashboard Side)
// Communicates with bridge.js content script via postMessage
// ═══════════════════════════════════════════════════════════

import type { FocusSession } from '../types';

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

  // Bridge announced itself
  if (action === 'BRIDGE_READY') {
    bridgeDetected = true;
    console.log('[FlowOS] Extension bridge detected.');
    return;
  }

  // Resolve pending request
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
      {
        source: 'flowos-dashboard',
        action,
        requestId,
      },
      '*'
    );
  });
}

// ─── Public API ───────────────────────────────────────────

/**
 * Check if the FlowOS extension bridge is available.
 * Returns true if the extension content script is injected.
 */
export async function isExtensionConnected(): Promise<boolean> {
  // If bridge already announced itself, quick check
  if (bridgeDetected) return true;

  try {
    await sendBridgeMessage('PING', 1000);
    bridgeDetected = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch all completed sessions from chrome.storage.local
 * via the extension bridge.
 */
export async function getExtensionSessions(): Promise<FocusSession[]> {
  return sendBridgeMessage<FocusSession[]>('GET_SESSIONS');
}

/**
 * Get current session status from the extension.
 */
export async function getExtensionStatus(): Promise<{
  sessionActive: boolean;
  currentSession: FocusSession | null;
}> {
  return sendBridgeMessage('GET_STATUS');
}
