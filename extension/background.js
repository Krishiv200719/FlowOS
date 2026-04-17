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
const ALARM_PERIOD_MINUTES = 0.5; // 30s — MV3 minimum

// ─── Layer 1: App Monitor State ─────────────────────────────
// chromeHasFocus is module-scope but only used for the CURRENT
// window focus event — it resets correctly via onFocusChanged.
let chromeHasFocus = true;

// ─── Layer 1: Idle Detector State ───────────────────────────
// isIdle/idleSince are module-scope — exposed via GET_STATUS.
// They reset on SW restart which is fine: if SW restarted,
// the idle event was already written to storage.
let isIdle = false;
let idleSince = null;

// CRITICAL (MV3): set idle threshold at top-level so it applies
// on every service worker restart, not just onInstalled.
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
console.log(`[FlowOS] SW started. Idle threshold: ${IDLE_THRESHOLD_SECONDS}s`);

// ─── Initialization ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  chrome.storage.local.set({
    sessionActive: false,
    currentSession: null,
    completedSessions: [],
    globalSiteLog: {},
    settings: { distractionDomains: DISTRACTION_DOMAINS }
  });
  console.log('[FlowOS] Extension installed.');
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

    // Feature 3c: site log
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
    plannedDuration,
    goal,
    events: [],
    stats: null
  };

  await chrome.storage.local.set({ sessionActive: true, currentSession: session });

  // Reset SW-scope global tracker for new session
  await chrome.storage.session.set({
    trackerDomain: null,
    trackerEnteredAt: null
  });

  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  await recordActivity();
  console.log(`[FlowOS] Session started: "${goal}" (${plannedDuration} min)`);
}

async function endSession() {
  const data = await chrome.storage.local.get(['currentSession', 'completedSessions', 'globalSiteLog']);
  const session = data.currentSession;
  if (!session) throw new Error('No active session to end');

  session.endTime = Date.now();

  // Close the last open event
  const lastEvent = session.events[session.events.length - 1];
  if (lastEvent && !lastEvent.duration) {
    lastEvent.duration = Date.now() - lastEvent.timestamp;
  }

  // BUG 3 FIX: compute siteLog from events (accurate, no module variable dependency)
  session.siteLog = computeSiteLogFromEvents(session.events);

  // Merge session siteLog into global log
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

  console.log(`[FlowOS] Session ended. Focus ratio: ${(session.stats.focusRatio * 100).toFixed(1)}%`);
  return session;
}

// Feature 1 + 2: GET_STATUS includes idle + app monitor state
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

  // Always update globalSiteLog even outside sessions
  const globalSiteLog = data.globalSiteLog || {};
  const domains = data.settings?.distractionDomains || DISTRACTION_DOMAINS;

  // 1. Get active tab
  let activeTab;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    activeTab = tab;
  } catch (err) {
    return;
  }
  if (!activeTab?.url) return;

  // 2. Extract domain
  let domain = '';
  try {
    domain = new URL(activeTab.url).hostname.replace(/^www\./, '');
  } catch {
    domain = 'unknown';
  }

  // ─── Feature 3b: Global site log (BUG 4 FIX) ─────────────
  // Use chrome.storage.session to persist tracker state across
  // SW restarts (session storage survives restarts unlike module vars)
  const sessionState = await chrome.storage.session.get(['trackerDomain', 'trackerEnteredAt']);
  const trackerDomain = sessionState.trackerDomain || null;
  const trackerEnteredAt = sessionState.trackerEnteredAt || null;
  const now = Date.now();

  if (trackerDomain !== domain) {
    // Domain changed — flush previous domain into global log
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
    // Start tracking new domain
    await chrome.storage.session.set({ trackerDomain: domain, trackerEnteredAt: now });
    await chrome.storage.local.set({ globalSiteLog });
  }

  // ─── Session-only logic ────────────────────────────────────
  if (!data.sessionActive || !data.currentSession) return;
  const session = data.currentSession;

  // 3. Check idle state
  let idleState = 'active';
  try {
    idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  } catch {}

  // BUG 5 FIX: If the last event is already idle/locked, don't
  // re-classify it — just update its running duration and return.
  // Only chrome.idle.onStateChanged should write idle/locked events.
  const lastEvent = session.events[session.events.length - 1];
  if (lastEvent && (lastEvent.type === 'idle' || lastEvent.type === 'locked')) {
    lastEvent.duration = now - lastEvent.timestamp;
    await chrome.storage.local.set({ currentSession: session });
    return;
  }

  // 3b. App Monitor guard
  if (!chromeHasFocus) {
    if (lastEvent && lastEvent.type !== 'off_chrome') {
      if (!lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
      session.events.push({ timestamp: now, type: 'off_chrome', domain, duration: 0 });
    } else if (lastEvent && lastEvent.type === 'off_chrome') {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    await chrome.storage.local.set({ currentSession: session });
    return;
  }

  // 4. Classify event (only reached if active + in Chrome)
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
  const domainChanged = lastEvent && lastEvent.domain !== domain;
  if (domainChanged && lastEvent) {
    if (!lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
    session.events.push({ timestamp: now, type: 'tab_switch', domain, duration: 0 });
  }

  // 6. Merge or push event
  const currentLast = session.events[session.events.length - 1];
  if (currentLast && currentLast.type === eventType && currentLast.domain === domain) {
    currentLast.duration = now - currentLast.timestamp;
  } else {
    if (currentLast && !currentLast.duration) currentLast.duration = now - currentLast.timestamp;
    session.events.push({ timestamp: now, type: eventType, domain, duration: 0 });
  }

  // 7. Distraction overlay
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

  // 8. Auto-end safety valve (2x planned)
  const elapsedMin = (now - session.startTime) / 60000;
  if (elapsedMin > session.plannedDuration * 2) {
    console.log('[FlowOS] Session auto-ended (exceeded 2x planned duration)');
    await endSession();
    return;
  }

  await chrome.storage.local.set({ currentSession: session });
}

// ─── Feature 3: Compute siteLog from events (BUG 2+3 FIX) ──
// Derives site time from the events array — no module variables,
// no incremental accumulation — always accurate.

function computeSiteLogFromEvents(events) {
  const log = {};
  for (const event of events) {
    if (!event.domain || event.domain === 'unknown') continue;
    if (event.type !== 'focus' && event.type !== 'distraction') continue;
    const dur = event.duration || 0;
    if (dur <= 0) continue;
    const category = DISTRACTION_DOMAINS.some(d => event.domain.includes(d))
      ? 'distraction' : 'work';
    if (!log[event.domain]) {
      log[event.domain] = { totalMs: 0, visits: 0, category };
    }
    log[event.domain].totalMs += dur;
    log[event.domain].visits += 1;
  }
  return log;
}

// ─── Stats Computation ──────────────────────────────────────

function computeSessionStats(session) {
  const events = session.events;
  let realFocusTime = 0;
  let distractionTime = 0;
  let idleTime = 0;
  let totalIdleMs = 0;
  let totalOffChromeMs = 0;
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
        totalIdleMs += dur;
        break;
      case 'locked':
        idleTime += dur;
        totalIdleMs += dur;
        break;
      case 'off_chrome':
        idleTime += dur;
        totalOffChromeMs += dur;
        break;
      case 'tab_switch':
        tabSwitches++;
        break;
      case 'returned':
      case 'returned_to_chrome':
      case 'return':
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
    totalIdleMs,
    totalOffChromeMs,
    offChromeTime: totalOffChromeMs,
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
      // Close the current event, push idle/locked event
      const lastEvent = session.events[session.events.length - 1];
      if (lastEvent && !lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
      session.events.push({ type: newState, timestamp: now, idleState: newState, duration: 0 });
      await chrome.storage.local.set({ currentSession: session });

      chrome.notifications.create(`flowos-${newState}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: newState === 'locked' ? 'FlowOS — Screen locked' : 'FlowOS — Still there?',
        message: newState === 'locked'
          ? `Session "${session.goal}" is paused while your screen is locked.`
          : `Your session "${session.goal}" is paused while you're away.`,
        priority: newState === 'locked' ? 2 : 1,
        silent: false,
      });
    }

  } else if (newState === 'active') {
    const awayMs = idleSince ? now - idleSince : 0;
    isIdle = false;
    idleSince = null;

    chrome.notifications.clear('flowos-idle');
    chrome.notifications.clear('flowos-locked');

    if (session && awayMs > 5000) {
      // Close the idle/locked event
      const lastEvent = session.events[session.events.length - 1];
      if (lastEvent && (lastEvent.type === 'idle' || lastEvent.type === 'locked') && !lastEvent.duration) {
        lastEvent.duration = now - lastEvent.timestamp;
      }
      session.events.push({ type: 'returned', timestamp: now, idleDurationMs: awayMs, duration: 0 });
      await chrome.storage.local.set({ currentSession: session });

      const awaySec = Math.round(awayMs / 1000);
      const label = awaySec >= 60
        ? `${Math.floor(awaySec / 60)}m ${awaySec % 60}s` : `${awaySec}s`;

      chrome.notifications.create('flowos-return', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Welcome back',
        message: `Session resuming. You were away for ${label}.`,
        priority: 1,
        silent: true,
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
    console.log('[FlowOS] App Monitor: Chrome lost focus');
    if (lastEvent && !lastEvent.duration) lastEvent.duration = now - lastEvent.timestamp;
    session.events.push({ type: 'off_chrome', timestamp: now, duration: 0, domain: null });
  } else {
    const offChromeDurationMs = lastEvent?.type === 'off_chrome'
      ? now - lastEvent.timestamp : 0;
    console.log(`[FlowOS] App Monitor: Chrome regained focus (away ${Math.round(offChromeDurationMs / 1000)}s)`);
    if (lastEvent && lastEvent.type === 'off_chrome' && !lastEvent.duration) {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    session.events.push({ type: 'returned_to_chrome', timestamp: now, durationMs: offChromeDurationMs, duration: 0, domain: null });
    recordActivity();
  }

  await chrome.storage.local.set({ currentSession: session });
});
