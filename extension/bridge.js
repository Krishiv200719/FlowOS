// ═══════════════════════════════════════════════════════════
// FlowOS — Data Bridge (Content Script)
// Injected into the dashboard page to bridge
// chrome.storage.local ↔ web page via postMessage
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Listen for requests from the dashboard web page
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'flowos-dashboard') return;

    const { action, requestId } = event.data;

    try {
      switch (action) {
        case 'GET_SESSIONS': {
          const data = await chrome.storage.local.get(['completedSessions']);
          respond(requestId, action, data.completedSessions || [], true);
          break;
        }

        case 'GET_STATUS': {
          const data = await chrome.storage.local.get([
            'sessionActive',
            'currentSession',
          ]);
          respond(requestId, action, {
            sessionActive: data.sessionActive || false,
            currentSession: data.currentSession || null,
          }, true);
          break;
        }

        // Feature 3: site time tracker
        case 'GET_SITE_LOG': {
          const data = await chrome.storage.local.get(['currentSession', 'globalSiteLog']);
          respond(requestId, action, {
            siteLog: data.currentSession?.siteLog || {},
            globalSiteLog: data.globalSiteLog || {},
          }, true);
          break;
        }

        case 'CLEAR_GLOBAL_SITE_LOG': {
          await chrome.storage.local.set({ globalSiteLog: {} });
          respond(requestId, action, { success: true }, true);
          break;
        }

        case 'PING': {
          respond(requestId, 'PONG', null, true);
          break;
        }

        default:
          respond(requestId, action, null, false, 'Unknown action: ' + action);
      }
    } catch (err) {
      respond(requestId, action, null, false, err.message);
    }
  });

  function respond(requestId, action, data, success, error) {
    window.postMessage(
      {
        source: 'flowos-extension',
        requestId,
        action,
        data,
        success,
        error: error || null,
      },
      '*'
    );
  }

  // Announce that bridge is ready
  window.postMessage(
    {
      source: 'flowos-extension',
      action: 'BRIDGE_READY',
      success: true,
    },
    '*'
  );

  console.log('[FlowOS Bridge] Data bridge injected and ready.');
})();
