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

        // Feature 3: site time tracker (computed from events for accuracy)
        case 'GET_SITE_LOG': {
          const data = await chrome.storage.local.get(['currentSession', 'globalSiteLog']);
          const sess = data.currentSession;
          let siteLog = {};
          if (sess?.events) {
            const DIST = ['youtube.com','instagram.com','twitter.com','x.com','facebook.com',
              'tiktok.com','reddit.com','netflix.com','snapchat.com','web.whatsapp.com',
              'linkedin.com','news.ycombinator.com','buzzfeed.com','9gag.com','twitch.tv',
              'pinterest.com','tumblr.com'];
            for (const ev of sess.events) {
              if (!ev.domain || ev.domain === 'unknown') continue;
              if (ev.type !== 'focus' && ev.type !== 'distraction') continue;
              const dur = ev.duration || 0;
              if (dur <= 0) continue;
              const cat = DIST.some(d => ev.domain.includes(d)) ? 'distraction' : 'work';
              if (!siteLog[ev.domain]) siteLog[ev.domain] = { totalMs: 0, visits: 0, category: cat };
              siteLog[ev.domain].totalMs += dur;
              siteLog[ev.domain].visits += 1;
            }
          }
          respond(requestId, action, { siteLog, globalSiteLog: data.globalSiteLog || {} }, true);
          break;
        }

        case 'CLEAR_GLOBAL_SITE_LOG': {
          await chrome.storage.local.set({ globalSiteLog: {} });
          respond(requestId, action, { success: true }, true);
          break;
        }

        // Feature B: Ambient log (last 2 hours)
        case 'GET_AMBIENT_LOG': {
          const data = await chrome.storage.local.get(['ambientLog']);
          const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
          const log = (data.ambientLog || []).filter(e => e.timestamp > twoHoursAgo);
          respond(requestId, action, log, true);
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
