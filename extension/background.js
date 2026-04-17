// ═══════════════════════════════════════════════════════════
// FlowOS — Background Service Worker (MV3)
// Session state manager + activity tracker
// Layer 1 Sensors: Tab Tracker, Idle Detector, App Monitor
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
const ALARM_PERIOD_MINUTES = 0.5;

// ─── Layer 1: App Monitor State ─────────────────────────────
let chromeHasFocus = true;
let offChromeStartTime = null;

// ─── Layer 1: Idle Detector State ───────────────────────────
let idleStartTime = null;
let isIdle = false;       // exposed via GET_STATUS
let idleSince = null;     // timestamp when idle started

// ─── Layer 1: Site Tracker State ────────────────────────────
// currentDomain + domainEnteredAt for precise per-domain duration
let currentDomain = null;
let domainEnteredAt = null;

// CRITICAL (MV3): set idle threshold at top level — survives SW restarts
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
console.log(`[FlowOS] Service worker started. Idle threshold: ${IDLE_THRESHOLD_SECONDS}s`);

// ─── Initialization ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  chrome.storage.local.set({
    sessionActive: false,
    currentSession: null,
    completedSessions: [],
    globalSiteLog: {},      // Feature 3: persists across all browser usage
    settings: {
      distractionDomains: DISTRACTION_DOMAINS
    }
  });
  console.log('[FlowOS] Extension installed — Layer 1 sensors active.');
});

// ─── Message Router ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_SESSION':
      startSession(message.goal, message.plannedDuration)
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

    // Feature 3c: return per-session siteLog + globalSiteLog
    case 'GET_SITE_LOG':
      chrome.storage.local.get(['currentSession', 'globalSiteLog'], (data) => {
        sendResponse({
          siteLog: data.currentSession?.siteLog || {},
          globalSiteLog: data.globalSiteLog || {}
        });
      });
      return true;

    // Feature 3c: reset the global tracker
    case 'CLEAR_GLOBAL_SITE_LOG':
      chrome.storage.local.set({ globalSiteLog: {} }, () => {
        sendResponse({ success: true });
      });
      return true;

    // TEST: fire an instant notification to verify permissions work
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

async function startSession(goal, plannedDuration) {
  const session = {
    id: crypto.randomUUID(),
    startTime: Date.now(),
    endTime: null,
    plannedDuration: plannedDuration,
    goal: goal,
    events: [],
    siteLog: {},    // Feature 3a: per-session site time log
    stats: null
  };

  await chrome.storage.local.set({
    sessionActive: true,
    currentSession: session
  });

  // Reset domain tracker for fresh session
  currentDomain = null;
  domainEnteredAt = null;

  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  await recordActivity();
  console.log(`[FlowOS] Session started: "${goal}" (${plannedDuration} min)`);
}

async function endSession() {
  const data = await chrome.storage.local.get(['currentSession', 'completedSessions']);
  const session = data.currentSession;

  if (!session) throw new Error('No active session to end');

  session.endTime = Date.now();

  // Flush the current domain's time into siteLog before ending
  if (currentDomain && domainEnteredAt) {
    const spent = Date.now() - domainEnteredAt;
    accumulateSiteLog(session.siteLog, currentDomain, spent);
    currentDomain = null;
    domainEnteredAt = null;
  }

  // Close the last open event
  const lastEvent = session.events[session.events.length - 1];
  if (lastEvent && !lastEvent.duration) {
    lastEvent.duration = Date.now() - lastEvent.timestamp;
  }

  session.stats = computeSessionStats(session);

  const completed = data.completedSessions || [];
  completed.push(session);

  await chrome.storage.local.set({
    sessionActive: false,
    currentSession: null,
    completedSessions: completed
  });

  await chrome.alarms.clear(ALARM_NAME);

  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SESSION_ENDED' });
      } catch (_) {}
    }
  } catch (_) {}

  console.log(`[FlowOS] Session ended. Focus ratio: ${(session.stats.focusRatio * 100).toFixed(1)}%`);
  return session;
}

// Feature 1: GET_STATUS now surfaces idle + app monitor state
async function getStatus() {
  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  return {
    sessionActive: data.sessionActive || false,
    currentSession: data.currentSession || null,
    // Feature 1 — Idle Detector status
    isIdle,
    idleSince,
    // Feature 2 — App Monitor status
    isInChrome: chromeHasFocus,
    offChromeSince: offChromeStartTime,
  };
}

// ─── Activity Recording ─────────────────────────────────────

async function recordActivity() {
  const data = await chrome.storage.local.get([
    'sessionActive', 'currentSession', 'settings', 'globalSiteLog'
  ]);

  const session = data.sessionActive ? data.currentSession : null;
  const domains = data.settings?.distractionDomains || DISTRACTION_DOMAINS;
  const globalSiteLog = data.globalSiteLog || {};

  // 1. Get active tab
  let activeTab;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    activeTab = tab;
  } catch (err) {
    console.warn('[FlowOS] Could not query active tab:', err.message);
    return;
  }

  if (!activeTab?.url) return;

  // 2. Extract domain
  let domain = '';
  try {
    const url = new URL(activeTab.url);
    domain = url.hostname.replace(/^www\./, '');
  } catch {
    domain = 'unknown';
  }

  // ─── Feature 3b: Global site log (always, regardless of session) ──
  const now = Date.now();
  if (currentDomain !== domain) {
    // Domain changed — flush previous domain time
    if (currentDomain && domainEnteredAt) {
      const spent = now - domainEnteredAt;
      accumulateSiteLog(globalSiteLog, currentDomain, spent);
      // Also flush into session log if session active
      if (session) accumulateSiteLog(session.siteLog, currentDomain, spent);
    }
    currentDomain = domain;
    domainEnteredAt = now;
  } else {
    // Same domain — just update duration in global log (running total)
    if (domainEnteredAt) {
      const spent = now - domainEnteredAt;
      // Update without incrementing visits (same visit continuing)
      const category = DISTRACTION_DOMAINS.some(d => domain.includes(d))
        ? 'distraction' : 'work';
      if (!globalSiteLog[domain]) {
        globalSiteLog[domain] = { totalMs: 0, visits: 0, category, lastVisited: now };
      }
      // Update lastVisited
      globalSiteLog[domain].lastVisited = now;
    }
  }

  // Persist globalSiteLog
  await chrome.storage.local.set({ globalSiteLog });

  // ─── Session-only logic below ──────────────────────────────
  if (!data.sessionActive || !session) return;

  // 3. Check idle state
  let idleState = 'active';
  try {
    idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  } catch {}

  // 3b. App Monitor guard: if Chrome doesn't have OS focus → off_chrome
  if (!chromeHasFocus) {
    const lastEvent = session.events[session.events.length - 1];
    if (lastEvent && lastEvent.type !== 'off_chrome') {
      if (!lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
      session.events.push({ timestamp: now, type: 'off_chrome', domain, duration: 0 });
    } else if (lastEvent && lastEvent.type === 'off_chrome') {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    await chrome.storage.local.set({ currentSession: session });
    return;
  }

  // 4. Classify event
  const isDistraction = domains.some(d => domain.includes(d));
  let eventType;
  if (idleState === 'locked') {
    eventType = 'locked';
  } else if (idleState === 'idle') {
    eventType = 'idle';
  } else if (isDistraction) {
    eventType = 'distraction';
  } else {
    eventType = 'focus';
  }

  // 5. Tab switch detection
  const lastEvent = session.events[session.events.length - 1];
  const domainChanged = lastEvent && lastEvent.domain !== domain;
  if (domainChanged && lastEvent) {
    if (!lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
    session.events.push({ timestamp: now, type: 'tab_switch', domain, duration: 0 });
  }

  // 6. Merge or push new event
  if (lastEvent && lastEvent.type === eventType && lastEvent.domain === domain) {
    lastEvent.duration = now - lastEvent.timestamp;
  } else {
    if (lastEvent && !lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
    session.events.push({ timestamp: now, type: eventType, domain, duration: 0 });
  }

  // 7. Feature 3a: Update per-session siteLog with running duration
  if (domain && idleState === 'active' && chromeHasFocus) {
    const elapsed = domainEnteredAt ? now - domainEnteredAt : 0;
    const category = isDistraction ? 'distraction' : 'work';
    if (!session.siteLog[domain]) {
      session.siteLog[domain] = { totalMs: 0, visits: 1, category };
    }
    session.siteLog[domain].totalMs = elapsed;
  }

  // 8. Distraction overlay notification
  if (isDistraction && idleState === 'active') {
    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: 'DISTRACTION_DETECTED',
        domain,
        sessionGoal: session.goal,
        distractionCount: session.events.filter(e => e.type === 'distraction').length
      });
    } catch (_) {}
  }

  // 9. Auto-end safety valve
  const elapsedMin = (now - session.startTime) / 60000;
  if (elapsedMin > session.plannedDuration * 2) {
    console.log('[FlowOS] Session auto-ended (exceeded 2x planned duration)');
    await endSession();
    return;
  }

  await chrome.storage.local.set({ currentSession: session });
}

// ─── Feature 3: Site Log Accumulator ────────────────────────
// Shared helper to update a siteLog object in place

function accumulateSiteLog(log, domain, durationMs) {
  if (!domain || domain === 'unknown' || durationMs <= 0) return;
  const category = DISTRACTION_DOMAINS.some(d => domain.includes(d))
    ? 'distraction' : 'work';
  if (!log[domain]) {
    log[domain] = { totalMs: 0, visits: 0, category, lastVisited: Date.now() };
  }
  log[domain].totalMs += durationMs;
  log[domain].visits += 1;
  log[domain].lastVisited = Date.now();
}

// ─── Stats Computation ──────────────────────────────────────

function computeSessionStats(session) {
  const events = session.events;
  let realFocusTime = 0;
  let distractionTime = 0;
  let idleTime = 0;           // idle + locked + off_chrome
  let totalIdleMs = 0;        // Feature 1: idle + locked only
  let totalOffChromeMs = 0;   // Feature 2: off_chrome only
  let tabSwitches = 0;
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
        if (event.domain) {
          distractorMap[event.domain] = (distractorMap[event.domain] || 0) + dur;
        }
        break;
      case 'idle':
        idleTime += dur;
        totalIdleMs += dur;   // Feature 1
        break;
      case 'locked':
        idleTime += dur;
        totalIdleMs += dur;   // Feature 1
        break;
      case 'off_chrome':
        idleTime += dur;
        totalOffChromeMs += dur;   // Feature 2
        break;
      case 'tab_switch':
        tabSwitches++;
        break;
      case 'return':
      case 'returned_to_chrome':
        if (lastDistractionEnd !== null) {
          recoveryTimes.push(event.timestamp - lastDistractionEnd);
          lastDistractionEnd = null;
        }
        break;
    }
  }

  const totalPlannedMs = session.plannedDuration * 60 * 1000;
  const focusRatio = totalPlannedMs > 0
    ? Math.min(realFocusTime / totalPlannedMs, 1.0) : 0;

  const topDistractors = Object.entries(distractorMap)
    .map(([domain, ms]) => ({ domain, seconds: Math.round(ms / 1000) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  const avgRecoveryTime = recoveryTimes.length > 0
    ? recoveryTimes.reduce((s, t) => s + t, 0) / recoveryTimes.length : 0;

  return {
    realFocusTime,
    distractionTime,
    idleTime,
    totalIdleMs,        // Feature 1
    totalOffChromeMs,   // Feature 2
    offChromeTime: totalOffChromeMs, // backwards compat
    tabSwitches,
    avgRecoveryTime,
    focusRatio,
    topDistractors
  };
}

// ─── Event Listeners ────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) recordActivity();
});

chrome.tabs.onActivated.addListener(async () => {
  const data = await chrome.storage.local.get(['sessionActive']);
  if (data.sessionActive) recordActivity();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.url) {
    const data = await chrome.storage.local.get(['sessionActive']);
    if (data.sessionActive) recordActivity();
  }
});

// ─── Feature 1: Idle Detector — Full Implementation ──────────
// Handles all 3 idle states + notifications + GET_STATUS exposure

chrome.idle.onStateChanged.addListener(async (newState) => {
  console.log(`[FlowOS] Idle state changed: ${newState}`);
  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  const session = data.currentSession;

  if (newState === 'idle') {
    // Feature 1: update module-scope state (exposed via GET_STATUS)
    isIdle = true;
    idleSince = Date.now();
    idleStartTime = Date.now();

    if (session) {
      // Push idle event with idleState field (as per spec)
      session.events.push({
        type: 'idle',
        timestamp: Date.now(),
        idleState: 'idle',
        duration: 0,
      });
      await chrome.storage.local.set({ currentSession: session });

      chrome.notifications.create('flowos-idle', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Still there?',
        message: `Your session "${session.goal}" is paused while you're away.`,
        priority: 1,
        silent: false,
      });
    }

  } else if (newState === 'locked') {
    isIdle = true;
    idleSince = Date.now();
    idleStartTime = Date.now();

    if (session) {
      session.events.push({
        type: 'locked',
        timestamp: Date.now(),
        idleState: 'locked',
        duration: 0,
      });
      await chrome.storage.local.set({ currentSession: session });

      chrome.notifications.create('flowos-locked', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Screen locked',
        message: `Session "${session.goal}" is paused while your screen is locked.`,
        priority: 2,
        silent: false,
      });
    }

  } else if (newState === 'active') {
    const idleDurationMs = idleStartTime ? Date.now() - idleStartTime : 0;
    // Feature 1: reset status
    isIdle = false;
    idleSince = null;
    idleStartTime = null;

    chrome.notifications.clear('flowos-idle');
    chrome.notifications.clear('flowos-locked');

    if (session && idleDurationMs > 5000) {
      // Push returned event with idleDurationMs (as per spec)
      session.events.push({
        type: 'returned',
        timestamp: Date.now(),
        idleDurationMs,
        duration: 0,
      });
      await chrome.storage.local.set({ currentSession: session });

      const awaySec = Math.round(idleDurationMs / 1000);
      const awayLabel = awaySec >= 60
        ? `${Math.floor(awaySec / 60)}m ${awaySec % 60}s`
        : `${awaySec}s`;

      chrome.notifications.create('flowos-return', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Welcome back',
        message: `Session resuming. You were away for ${awayLabel}.`,
        priority: 1,
        silent: true,
      });
    }
  }

  if (data.sessionActive) recordActivity();
});

// ─── Feature 2: App Monitor — Full Implementation ─────────────
// Detects when Chrome loses/gains OS focus

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
    // Chrome lost OS focus — user in another app
    offChromeStartTime = now;
    console.log('[FlowOS] App Monitor: Chrome lost focus');

    if (lastEvent && !lastEvent.duration) {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    // Feature 2: push off_chrome event (as per spec)
    session.events.push({
      type: 'off_chrome',
      timestamp: now,
      duration: 0,
      domain: null,
    });
  } else {
    // Chrome regained OS focus
    const offChromeDurationMs = offChromeStartTime ? now - offChromeStartTime : 0;
    offChromeStartTime = null;
    console.log(`[FlowOS] App Monitor: Chrome regained focus (away ${Math.round(offChromeDurationMs / 1000)}s)`);

    if (lastEvent && lastEvent.type === 'off_chrome' && !lastEvent.duration) {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    // Feature 2: push returned_to_chrome event with durationMs (as per spec)
    session.events.push({
      type: 'returned_to_chrome',
      timestamp: now,
      durationMs: offChromeDurationMs,
      duration: 0,
      domain: null,
    });
  }

  await chrome.storage.local.set({ currentSession: session });
  recordActivity();
});
