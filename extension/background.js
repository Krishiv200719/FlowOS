// ═══════════════════════════════════════════════════════════
// FlowOS — Background Service Worker (MV3)
// Session manager + Layer 1 sensors + Allowlist Mode
// + Ambient Tracker (Feature B)
// ═══════════════════════════════════════════════════════════

const DISTRACTION_DOMAINS = [
  'youtube.com', 'instagram.com', 'twitter.com', 'x.com',
  'facebook.com', 'tiktok.com', 'reddit.com', 'netflix.com',
  'snapchat.com', 'web.whatsapp.com', 'linkedin.com',
  'news.ycombinator.com', 'buzzfeed.com', '9gag.com',
  'twitch.tv', 'pinterest.com', 'tumblr.com'
];

const IDLE_THRESHOLD_SECONDS = 30;
const ALARM_NAME = 'flowos-activity-tick';
const ALARM_PERIOD_MINUTES = 1; // Bug #5 Fix: MV3 minimum is 1 minute

// Feature B: Ambient Tracker
const AMBIENT_ALARM_NAME = 'flowos-ambient-tick';
const AMBIENT_PERIOD_MINUTES = 1;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// ─── Module-scope state (App Monitor + Idle Detector) ────────
let chromeHasFocus = true;
let isIdle = false;
let idleSince = null;
let blockSnoozedUntil = 0; // Timestamp until which site blocking is snoozed

// CRITICAL (MV3): set idle threshold at top-level — survives SW restarts
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
console.log(`[FlowOS] SW started. Idle threshold: ${IDLE_THRESHOLD_SECONDS}s`);

// Ensure ambient alarm is always running (survives SW restarts)
chrome.alarms.get(AMBIENT_ALARM_NAME, (alarm) => {
  if (!alarm) {
    chrome.alarms.create(AMBIENT_ALARM_NAME, { periodInMinutes: AMBIENT_PERIOD_MINUTES });
    console.log('[FlowOS] Ambient tracker alarm started.');
  }
});

// ─── Initialization ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  chrome.storage.local.set({
    sessionActive: false,
    currentSession: null,
    completedSessions: [],
    globalSiteLog: {},
    ambientLog: [],
    settings: { distractionDomains: DISTRACTION_DOMAINS }
  });
  chrome.alarms.create(AMBIENT_ALARM_NAME, { periodInMinutes: AMBIENT_PERIOD_MINUTES });
  console.log('[FlowOS] Extension installed.');
});

// ─── Message Router ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_SESSION':
      startSession(
        message.goal,
        message.plannedDuration,
        message.allowlistDomain ?? null,
        message.mode ?? 'blocklist'
      )
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'END_SESSION':
      endSession()
        .then(session => sendResponse({ success: true, session }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_STATUS':
      getStatus()
        .then(status => sendResponse(status))
        .catch(err => sendResponse({ sessionActive: false, error: err.message }));
      return true;

    case 'GET_COMPLETED_SESSIONS':
      chrome.storage.local.get(['completedSessions'], (data) => {
        sendResponse({ sessions: data.completedSessions || [] });
      });
      return true;

    case 'GET_SITE_LOG':
      chrome.storage.local.get(['currentSession', 'globalSiteLog'], (data) => {
        const siteLog = data.currentSession
          ? computeSiteLogFromEvents(data.currentSession.events)
          : {};
        sendResponse({ siteLog, globalSiteLog: data.globalSiteLog || {} });
      });
      return true;

    case 'CLEAR_GLOBAL_SITE_LOG':
      chrome.storage.local.set({ globalSiteLog: {} }, () => {
        sendResponse({ success: true });
      });
      return true;

    // Feature B: Ambient log
    case 'GET_AMBIENT_LOG':
      chrome.storage.local.get(['ambientLog'], (data) => {
        const log = (data.ambientLog || []).filter(
          e => e.timestamp > Date.now() - TWO_HOURS_MS
        );
        sendResponse({ log });
      });
      return true;

    // Bug #4 Fix: find nearest non-distraction tab and activate it
    case 'FOCUS_BACK_TO_WORK':
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const nonDistraction = tabs.find(t => {
          if (!t.url) return false;
          try {
            const d = new URL(t.url).hostname.replace(/^www\./, '');
            return !DISTRACTION_DOMAINS.some(dd => d.includes(dd)) &&
                   !t.url.startsWith('chrome://') &&
                   !t.url.startsWith('chrome-extension://');
          } catch { return false; }
        });
        if (nonDistraction?.id) chrome.tabs.update(nonDistraction.id, { active: true });
      });
      sendResponse({ success: true });
      return true;

    // Feature A5: navigate back to allowlist site
    case 'FOCUS_BACK_TO_ALLOWLIST':
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const allowed = (message.allowlistDomain || '').toLowerCase();
        const allowedTab = tabs.find(t => {
          if (!t.url) return false;
          try {
            const d = new URL(t.url).hostname.replace(/^www\./, '').toLowerCase();
            return d.includes(allowed) || allowed.includes(d);
          } catch { return false; }
        });
        if (allowedTab?.id) {
          chrome.tabs.update(allowedTab.id, { active: true });
        } else {
          // No tab open with that domain — open one
          chrome.tabs.create({ url: `https://${allowed}` });
        }
      });
      sendResponse({ success: true });
      return true;

    case 'SNOOZE_BLOCK':
      blockSnoozedUntil = Date.now() + ((message.minutes || 5) * 60 * 1000);
      console.log(`[FlowOS] Block snoozed for ${message.minutes || 5} min`);
      sendResponse({ success: true });
      return true;

    case 'TEST_NOTIFICATION':
      chrome.notifications.create('flowos-test', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Notifications working!',
        message: 'Idle detector and lock screen alerts are active.',
        priority: 2,
      }, () => {
        sendResponse({ success: !chrome.runtime.lastError });
      });
      return true;
  }
});

// ─── Session Lifecycle ──────────────────────────────────────

async function startSession(goal, plannedDuration, allowlistDomain = null, mode = 'blocklist') {
  const session = {
    id: crypto.randomUUID(),
    startTime: Date.now(),
    endTime: null,
    plannedDuration,
    goal,
    allowlistDomain,   // Feature A
    mode,              // Feature A: 'blocklist' | 'allowlist'
    events: [],
    stats: null
  };

  await chrome.storage.local.set({ sessionActive: true, currentSession: session });
  await chrome.storage.session.set({ trackerDomain: null, trackerEnteredAt: null });

  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  await recordActivity();
  console.log(`[FlowOS] Session started: "${goal}" mode=${mode} allowlist=${allowlistDomain}`);
}

async function endSession() {
  const data = await chrome.storage.local.get(['currentSession', 'completedSessions', 'globalSiteLog']);
  const session = data.currentSession;
  if (!session) throw new Error('No active session to end');

  session.endTime = Date.now();

  const lastEvent = session.events[session.events.length - 1];
  if (lastEvent && !lastEvent.duration) {
    lastEvent.duration = Date.now() - lastEvent.timestamp;
  }

  session.siteLog = computeSiteLogFromEvents(session.events);

  // Merge into global log
  const globalSiteLog = data.globalSiteLog || {};
  for (const [domain, entry] of Object.entries(session.siteLog)) {
    if (!globalSiteLog[domain]) {
      globalSiteLog[domain] = { totalMs: 0, visits: 0, category: entry.category, lastVisited: Date.now() };
    }
    globalSiteLog[domain].totalMs += entry.totalMs;
    globalSiteLog[domain].visits += entry.visits;
    globalSiteLog[domain].lastVisited = Date.now();
  }

  session.stats = computeSessionStats(session);

  const completed = data.completedSessions || [];
  completed.push(session);

  await chrome.storage.local.set({
    sessionActive: false,
    currentSession: null,
    completedSessions: completed,
    globalSiteLog
  });
  await chrome.alarms.clear(ALARM_NAME);

  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try { await chrome.tabs.sendMessage(tab.id, { type: 'SESSION_ENDED' }); } catch (_) {}
    }
  } catch (_) {}

  console.log(`[FlowOS] Session ended. Focus: ${(session.stats.focusRatio * 100).toFixed(1)}%`);
  return session;
}

async function getStatus() {
  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  return {
    sessionActive: data.sessionActive || false,
    currentSession: data.currentSession || null,
    isIdle,
    idleSince,
    isInChrome: chromeHasFocus,
    offChromeSince: chromeHasFocus ? null : Date.now(),
  };
}

// ─── Activity Recording ─────────────────────────────────────

async function recordActivity() {
  const data = await chrome.storage.local.get([
    'sessionActive', 'currentSession', 'settings', 'globalSiteLog'
  ]);

  const domains = data.settings?.distractionDomains || DISTRACTION_DOMAINS;
  const globalSiteLog = data.globalSiteLog || {};

  // 1. Active tab
  let activeTab;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    activeTab = tab;
  } catch { return; }
  if (!activeTab?.url) return;
  if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) return;

  // 2. Domain
  let domain = '';
  try {
    domain = new URL(activeTab.url).hostname.replace(/^www\./, '');
  } catch { domain = 'unknown'; }

  // 3. Global site log (Feature B — persists always)
  const now = Date.now();
  const sessionState = await chrome.storage.session.get(['trackerDomain', 'trackerEnteredAt']);
  const trackerDomain = sessionState.trackerDomain || null;
  const trackerEnteredAt = sessionState.trackerEnteredAt || null;

  if (trackerDomain !== domain) {
    if (trackerDomain && trackerEnteredAt) {
      const spent = now - trackerEnteredAt;
      if (spent > 0 && trackerDomain !== 'unknown') {
        const cat = domains.some(d => trackerDomain.includes(d)) ? 'distraction' : 'work';
        if (!globalSiteLog[trackerDomain]) {
          globalSiteLog[trackerDomain] = { totalMs: 0, visits: 0, category: cat, lastVisited: now };
        }
        globalSiteLog[trackerDomain].totalMs += spent;
        globalSiteLog[trackerDomain].visits += 1;
        globalSiteLog[trackerDomain].lastVisited = now;
      }
    }
    await chrome.storage.session.set({ trackerDomain: domain, trackerEnteredAt: now });
    await chrome.storage.local.set({ globalSiteLog });
  }

  // ─── Session-only below ───────────────────────────────
  if (!data.sessionActive || !data.currentSession) return;
  const session = data.currentSession;

  // 4. Bug #5 Fix: idle state
  let idleState = 'active';
  try {
    idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  } catch {}

  // Bug Fix: don't re-classify if already idle — onStateChanged handles it
  const lastEv = session.events[session.events.length - 1];
  if (lastEv && (lastEv.type === 'idle' || lastEv.type === 'locked')) {
    lastEv.duration = now - lastEv.timestamp;
    await chrome.storage.local.set({ currentSession: session });
    return;
  }

  // App Monitor guard
  if (!chromeHasFocus) {
    if (lastEv && lastEv.type !== 'off_chrome') {
      if (!lastEv.duration) lastEv.duration = now - lastEv.timestamp;
      session.events.push({ timestamp: now, type: 'off_chrome', domain, duration: 0 });
    } else if (lastEv && lastEv.type === 'off_chrome') {
      lastEv.duration = now - lastEv.timestamp;
    }
    await chrome.storage.local.set({ currentSession: session });
    return;
  }

  // 5. Feature A: classify based on mode
  const isAllowlistMode = !!session.allowlistDomain;
  let isDistraction = false;
  let eventType;

  if (idleState === 'locked') {
    eventType = 'locked';
  } else if (idleState === 'idle') {
    eventType = 'idle';
  } else if (isAllowlistMode) {
    // In allowlist mode: distraction = anything NOT the allowed domain
    const allowed = session.allowlistDomain.toLowerCase();
    isDistraction = !domain.toLowerCase().includes(allowed) && !allowed.includes(domain.toLowerCase());
    eventType = isDistraction ? 'distraction' : 'focus';
  } else {
    // Blocklist mode (default)
    isDistraction = domains.some(d => domain.includes(d));
    eventType = isDistraction ? 'distraction' : 'focus';
  }

  // 6. Tab switch
  const domainChanged = lastEv && lastEv.domain !== domain;
  if (domainChanged && lastEv) {
    if (!lastEv.duration) lastEv.duration = now - lastEv.timestamp;
    session.events.push({ timestamp: now, type: 'tab_switch', domain, duration: 0 });
  }

  // 7. Merge or push event
  const currentLast = session.events[session.events.length - 1];
  if (currentLast && currentLast.type === eventType && currentLast.domain === domain) {
    currentLast.duration = now - currentLast.timestamp;
  } else {
    if (currentLast && !currentLast.duration) currentLast.duration = now - currentLast.timestamp;
    session.events.push({ timestamp: now, type: eventType, domain, duration: 0 });
  }

  // 8. Distraction overlay — send to the distraction tab itself
  if (isDistraction && idleState === 'active') {
    const msg = {
      type: 'DISTRACTION_DETECTED',
      domain,
      sessionGoal: session.goal,
      allowlistDomain: session.allowlistDomain,
      isAllowlistMode,
      distractionCount: session.events.filter(e => e.type === 'distraction').length
    };
    try {
      await chrome.tabs.sendMessage(activeTab.id, msg);
    } catch (_) {
      // Content script not ready yet — inject it dynamically
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });
        // Brief wait for script to initialize, then retry
        setTimeout(async () => {
          try { await chrome.tabs.sendMessage(activeTab.id, msg); } catch (_) {}
        }, 200);
      } catch (_) {}
    }
  }

  // 9. Auto-end safety valve
  const elapsedMin = (now - session.startTime) / 60000;
  if (elapsedMin > session.plannedDuration * 2) {
    await endSession();
    return;
  }

  await chrome.storage.local.set({ currentSession: session });
}

// ─── Feature B: Ambient Tracker ─────────────────────────────
// Records site visits even outside sessions (last 2 hours)

async function recordAmbientActivity() {
  const now = Date.now();
  const twoHoursAgo = now - TWO_HOURS_MS;

  let activeTab;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    activeTab = tab;
  } catch { return; }

  if (!activeTab?.url) return;
  if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) return;

  let domain = '';
  try {
    domain = new URL(activeTab.url).hostname.replace(/^www\./, '');
  } catch { return; }
  if (!domain || domain === 'newtab') return;

  const isDistractionSite = DISTRACTION_DOMAINS.some(d => domain.includes(d));
  const data = await chrome.storage.local.get(['ambientLog']);
  let log = (data.ambientLog || []).filter(e => e.timestamp > twoHoursAgo);

  const lastEntry = log[log.length - 1];
  if (lastEntry && lastEntry.domain === domain) {
    lastEntry.duration = now - lastEntry.timestamp;
  } else {
    if (lastEntry) lastEntry.duration = now - lastEntry.timestamp;
    log.push({
      timestamp: now,
      domain,
      url: activeTab.url,
      duration: 0,
      isDistraction: isDistractionSite,
    });
  }

  await chrome.storage.local.set({ ambientLog: log });
}

// ─── Site Log from Events (accurate, no module vars) ─────────

function computeSiteLogFromEvents(events) {
  const log = {};
  for (const event of events) {
    if (!event.domain || event.domain === 'unknown') continue;
    if (event.type !== 'focus' && event.type !== 'distraction') continue;
    const dur = event.duration || 0;
    if (dur <= 0) continue;
    const category = DISTRACTION_DOMAINS.some(d => event.domain.includes(d)) ? 'distraction' : 'work';
    if (!log[event.domain]) log[event.domain] = { totalMs: 0, visits: 0, category };
    log[event.domain].totalMs += dur;
    log[event.domain].visits += 1;
  }
  return log;
}

// ─── Stats Computation ──────────────────────────────────────

function computeSessionStats(session) {
  const events = session.events;
  let realFocusTime = 0, distractionTime = 0, idleTime = 0;
  let totalIdleMs = 0, totalOffChromeMs = 0, tabSwitches = 0;
  const distractorMap = {};
  const recoveryTimes = [];
  let lastDistractionEnd = null;

  for (const event of events) {
    const dur = event.duration || 0;
    switch (event.type) {
      case 'focus':
        realFocusTime += dur;
        if (lastDistractionEnd !== null) {
          recoveryTimes.push(event.timestamp - lastDistractionEnd);
          lastDistractionEnd = null;
        }
        break;
      case 'distraction':
        distractionTime += dur;
        lastDistractionEnd = event.timestamp + dur;
        if (event.domain) distractorMap[event.domain] = (distractorMap[event.domain] || 0) + dur;
        break;
      case 'idle': idleTime += dur; totalIdleMs += dur; break;
      case 'locked': idleTime += dur; totalIdleMs += dur; break;
      case 'off_chrome': idleTime += dur; totalOffChromeMs += dur; break;
      case 'tab_switch': tabSwitches++; break;
      case 'returned': case 'returned_to_chrome': case 'return':
        if (lastDistractionEnd !== null) {
          recoveryTimes.push(event.timestamp - lastDistractionEnd);
          lastDistractionEnd = null;
        }
        break;
    }
  }

  const totalPlannedMs = session.plannedDuration * 60 * 1000;
  const focusRatio = totalPlannedMs > 0 ? Math.min(realFocusTime / totalPlannedMs, 1.0) : 0;
  const topDistractors = Object.entries(distractorMap)
    .map(([domain, ms]) => ({ domain, seconds: Math.round(ms / 1000) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);
  const avgRecoveryTime = recoveryTimes.length > 0
    ? recoveryTimes.reduce((s, t) => s + t, 0) / recoveryTimes.length : 0;

  return {
    realFocusTime, distractionTime, idleTime,
    totalIdleMs, totalOffChromeMs,
    offChromeTime: totalOffChromeMs,
    tabSwitches, avgRecoveryTime, focusRatio, topDistractors
  };
}

// ─── Event Listeners ────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) recordActivity();
  if (alarm.name === AMBIENT_ALARM_NAME) recordAmbientActivity();
});

chrome.tabs.onActivated.addListener(async () => {
  const data = await chrome.storage.local.get(['sessionActive']);
  if (data.sessionActive) recordActivity();
  recordAmbientActivity();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // ─ Site Blocker: intercept distraction navigation ─────
    await checkAndBlockTab(tabId, changeInfo.url);

    const data = await chrome.storage.local.get(['sessionActive']);
    if (data.sessionActive) recordActivity();
    recordAmbientActivity();
  }
});

// ─── Site Blocker ───────────────────────────────────────────
// Redirects distraction sites to blocked.html during blocklist sessions

async function checkAndBlockTab(tabId, url) {
  if (!url || url.startsWith('chrome-extension://') || url.startsWith('chrome://')) return;

  // Check snooze
  if (Date.now() < blockSnoozedUntil) return;

  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  if (!data.sessionActive || !data.currentSession) return;

  const session = data.currentSession;
  // Only block in blocklist mode
  if (session.mode === 'allowlist' || session.allowlistDomain) return;

  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch { return; }

  const isDistraction = DISTRACTION_DOMAINS.some(d => domain.includes(d));
  if (!isDistraction) return;

  // Build blocked page URL with context
  const blockedUrl = chrome.runtime.getURL('blocked.html') +
    `?domain=${encodeURIComponent(domain)}` +
    `&goal=${encodeURIComponent(session.goal)}` +
    `&start=${session.startTime}`;

  console.log(`[FlowOS] Blocking ${domain} → blocked.html`);
  try {
    await chrome.tabs.update(tabId, { url: blockedUrl });
  } catch (_) {}
}

// Also intercept via webNavigation for faster response
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only main frame navigations
  if (details.frameId !== 0) return;
  if (!details.url || details.url.startsWith('chrome')) return;

  await checkAndBlockTab(details.tabId, details.url);
});


// ─── Feature 1: Idle Detector ───────────────────────────────

chrome.idle.onStateChanged.addListener(async (newState) => {
  console.log(`[FlowOS] Idle: ${newState}`);
  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  const session = data.currentSession;
  const now = Date.now();

  if (newState === 'idle' || newState === 'locked') {
    isIdle = true;
    idleSince = now;

    if (session) {
      const lastEvent = session.events[session.events.length - 1];
      if (lastEvent && !lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
      session.events.push({ type: newState, timestamp: now, idleState: newState, duration: 0 });
      await chrome.storage.local.set({ currentSession: session });

      chrome.notifications.create(`flowos-${newState}`, {
        type: 'basic', iconUrl: 'icons/icon48.png',
        title: newState === 'locked' ? 'FlowOS — Screen locked' : 'FlowOS — Still there?',
        message: newState === 'locked'
          ? `Session "${session.goal}" is paused while your screen is locked.`
          : `Your session "${session.goal}" is paused while you're away.`,
        priority: newState === 'locked' ? 2 : 1, silent: false,
      });
    }
  } else if (newState === 'active') {
    const awayMs = idleSince ? now - idleSince : 0;
    isIdle = false;
    idleSince = null;

    chrome.notifications.clear('flowos-idle');
    chrome.notifications.clear('flowos-locked');

    if (session && awayMs > 5000) {
      const lastEvent = session.events[session.events.length - 1];
      if (lastEvent && (lastEvent.type === 'idle' || lastEvent.type === 'locked') && !lastEvent.duration) {
        lastEvent.duration = now - lastEvent.timestamp;
      }
      session.events.push({ type: 'returned', timestamp: now, idleDurationMs: awayMs, duration: 0 });
      await chrome.storage.local.set({ currentSession: session });

      const awaySec = Math.round(awayMs / 1000);
      const label = awaySec >= 60 ? `${Math.floor(awaySec / 60)}m ${awaySec % 60}s` : `${awaySec}s`;
      chrome.notifications.create('flowos-return', {
        type: 'basic', iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Welcome back',
        message: `Session resuming. You were away for ${label}.`,
        priority: 1, silent: true,
      });
    }

    if (data.sessionActive) recordActivity();
  }
});

// ─── Feature 2: App Monitor ─────────────────────────────────

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const hadFocus = chromeHasFocus;
  chromeHasFocus = (windowId !== chrome.windows.WINDOW_ID_NONE);
  if (hadFocus === chromeHasFocus) return;

  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  if (!data.sessionActive || !data.currentSession) return;

  const session = data.currentSession;
  const now = Date.now();
  const lastEvent = session.events[session.events.length - 1];

  if (!chromeHasFocus) {
    if (lastEvent && !lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
    session.events.push({ type: 'off_chrome', timestamp: now, duration: 0, domain: null });
  } else {
    const offMs = lastEvent?.type === 'off_chrome' ? now - lastEvent.timestamp : 0;
    if (lastEvent && lastEvent.type === 'off_chrome' && !lastEvent.duration) {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    session.events.push({ type: 'returned_to_chrome', timestamp: now, durationMs: offMs, duration: 0, domain: null });
    recordActivity();
  }

  await chrome.storage.local.set({ currentSession: session });
});
