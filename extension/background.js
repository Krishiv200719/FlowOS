// ═══════════════════════════════════════════════════════════
// FlowOS — Background Service Worker (MV3)
// Session state manager + activity tracker
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
const ALARM_PERIOD_MINUTES = 0.5; // 30 seconds (MV3 minimum)

// ─── Layer 1: App Monitor State ─────────────────────────────
// Tracks whether Chrome itself is the active OS window.
// When chromeHasFocus = false, the user is in another app.
let chromeHasFocus = true;
let offChromeStartTime = null; // when Chrome last lost focus

// ─── Initialization ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  chrome.storage.local.set({
    sessionActive: false,
    currentSession: null,
    completedSessions: [],
    settings: {
      distractionDomains: DISTRACTION_DOMAINS
    }
  });
  console.log('[FlowOS] Extension installed — Layer 1 sensors: Idle Detector + App Monitor active.');
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
  }
});

// ─── Session Lifecycle ──────────────────────────────────────

async function startSession(goal, plannedDuration) {
  const session = {
    id: crypto.randomUUID(),
    startTime: Date.now(),
    endTime: null,
    plannedDuration: plannedDuration, // minutes
    goal: goal,
    events: [],
    stats: null
  };

  await chrome.storage.local.set({
    sessionActive: true,
    currentSession: session
  });

  // Start periodic alarm (MV3 enforces minimum 30s period)
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });

  // Perform first check immediately
  await recordActivity();

  console.log(`[FlowOS] Session started: "${goal}" (${plannedDuration} min)`);
}

async function endSession() {
  const data = await chrome.storage.local.get(['currentSession', 'completedSessions']);
  const session = data.currentSession;

  if (!session) {
    throw new Error('No active session to end');
  }

  session.endTime = Date.now();

  // Close the last open event
  const lastEvent = session.events[session.events.length - 1];
  if (lastEvent && !lastEvent.duration) {
    lastEvent.duration = Date.now() - lastEvent.timestamp;
  }

  // Compute all session stats
  session.stats = computeSessionStats(session);

  // Add to completed sessions
  const completed = data.completedSessions || [];
  completed.push(session);

  await chrome.storage.local.set({
    sessionActive: false,
    currentSession: null,
    completedSessions: completed
  });

  // Stop the alarm
  await chrome.alarms.clear(ALARM_NAME);

  // Notify any open tabs that session ended
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SESSION_ENDED' });
      } catch (_) { /* content script may not be loaded */ }
    }
  } catch (_) {}

  console.log(`[FlowOS] Session ended. Focus ratio: ${(session.stats.focusRatio * 100).toFixed(1)}%`);
  return session;
}

async function getStatus() {
  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  return {
    sessionActive: data.sessionActive || false,
    currentSession: data.currentSession || null
  };
}

// ─── Activity Recording ─────────────────────────────────────

async function recordActivity() {
  const data = await chrome.storage.local.get(['sessionActive', 'currentSession', 'settings']);
  if (!data.sessionActive || !data.currentSession) return;

  const session = data.currentSession;
  const domains = data.settings?.distractionDomains || DISTRACTION_DOMAINS;

  // 1. Get the currently active tab
  let activeTab;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    activeTab = tab;
  } catch (err) {
    console.warn('[FlowOS] Could not query active tab:', err.message);
    return;
  }

  if (!activeTab?.url) return;

  // 2. Extract domain from URL
  let domain = '';
  try {
    const url = new URL(activeTab.url);
    domain = url.hostname.replace(/^www\./, '');
  } catch {
    domain = 'unknown';
  }

  // 3. Check idle state — chrome.idle reports:
  //    'active'  = mouse or keyboard used within threshold
  //    'idle'    = no mouse/keyboard for threshold seconds
  //    'locked'  = screen is locked
  let idleState = 'active';
  try {
    idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  } catch {
    // idle API might not be available in all contexts
  }

  // 3b. Layer 1 — APP MONITOR: if Chrome doesn't have OS focus,
  //     treat as off_chrome regardless of idle state
  if (!chromeHasFocus) {
    // User is in another app — record off_chrome event
    const lastEvent = session.events[session.events.length - 1];
    if (lastEvent && lastEvent.type !== 'off_chrome') {
      if (!lastEvent.duration) lastEvent.duration = Date.now() - lastEvent.timestamp;
      session.events.push({
        timestamp: Date.now(),
        type: 'off_chrome',
        domain: domain,
        duration: 0,
      });
    } else if (lastEvent && lastEvent.type === 'off_chrome') {
      lastEvent.duration = Date.now() - lastEvent.timestamp;
    }
    await chrome.storage.local.set({ currentSession: session });
    return; // don't classify further — user is in another OS app
  }

  // 4. Classify the event
  const isDistraction = domains.some(d => domain.includes(d));
  let eventType;

  if (idleState === 'locked') {
    eventType = 'locked';   // screen locked — Layer 1: Idle Detector
  } else if (idleState === 'idle') {
    eventType = 'idle';     // no mouse/keyboard — Layer 1: Idle Detector
  } else if (isDistraction) {
    eventType = 'distraction';
  } else {
    eventType = 'focus';
  }

  // 5. Check for tab switch
  const lastEvent = session.events[session.events.length - 1];
  const domainChanged = lastEvent && lastEvent.domain !== domain;

  if (domainChanged && lastEvent) {
    // Close previous event duration
    if (!lastEvent.duration) {
      lastEvent.duration = Date.now() - lastEvent.timestamp;
    }
    // Record the tab switch marker
    session.events.push({
      timestamp: Date.now(),
      type: 'tab_switch',
      domain: domain,
      duration: 0
    });
  }

  // 6. Merge with previous event or create new
  if (lastEvent && lastEvent.type === eventType && lastEvent.domain === domain) {
    // Same activity continues — update duration
    lastEvent.duration = Date.now() - lastEvent.timestamp;
  } else {
    // New activity — close previous, start new
    if (lastEvent && !lastEvent.duration) {
      lastEvent.duration = Date.now() - lastEvent.timestamp;
    }
    session.events.push({
      timestamp: Date.now(),
      type: eventType,
      domain: domain,
      duration: 0
    });
  }

  // 7. Notify content script about distraction (for Guardian overlay)
  if (isDistraction && idleState === 'active') {
    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: 'DISTRACTION_DETECTED',
        domain: domain,
        sessionGoal: session.goal,
        distractionCount: session.events.filter(e => e.type === 'distraction').length
      });
    } catch (_) {
      // Content script not loaded on this page
    }
  }

  // 8. Auto-end if far past planned duration (safety valve: 2x planned)
  const elapsedMin = (Date.now() - session.startTime) / 60000;
  if (elapsedMin > session.plannedDuration * 2) {
    console.log('[FlowOS] Session auto-ended (exceeded 2x planned duration)');
    await endSession();
    return;
  }

  // 9. Persist updated session
  await chrome.storage.local.set({ currentSession: session });
}

// ─── Stats Computation ──────────────────────────────────────

function computeSessionStats(session) {
  const events = session.events;

  let realFocusTime = 0;
  let distractionTime = 0;
  let idleTime = 0;
  let offChromeTime = 0;  // Layer 1: App Monitor — time in other OS apps
  let tabSwitches = 0;
  const distractorMap = {};
  const recoveryTimes = [];

  let wasDistracted = false;
  let lastDistractionEnd = null;

  for (const event of events) {
    const dur = event.duration || 0;

    switch (event.type) {
      case 'focus':
        realFocusTime += dur;
        // Track recovery time: how long after a distraction until focus resumes
        if (lastDistractionEnd !== null) {
          recoveryTimes.push(event.timestamp - lastDistractionEnd);
          lastDistractionEnd = null;
        }
        wasDistracted = false;
        break;

      case 'distraction':
        distractionTime += dur;
        wasDistracted = true;
        lastDistractionEnd = event.timestamp + dur;
        // Accumulate per-domain distraction time
        if (event.domain) {
          distractorMap[event.domain] = (distractorMap[event.domain] || 0) + dur;
        }
        break;

      case 'idle':
        idleTime += dur;
        break;

      case 'locked':
        // Screen locked — counts as idle time
        idleTime += dur;
        break;

      case 'off_chrome':
        // User switched to another OS app (VS Code, Slack, etc.)
        offChromeTime += dur;
        break;

      case 'tab_switch':
        tabSwitches++;
        break;

      case 'return':
        if (lastDistractionEnd !== null) {
          recoveryTimes.push(event.timestamp - lastDistractionEnd);
          lastDistractionEnd = null;
        }
        break;
    }
  }

  // Focus ratio = real focus / planned duration
  const totalPlannedMs = session.plannedDuration * 60 * 1000;
  const focusRatio = totalPlannedMs > 0
    ? Math.min(realFocusTime / totalPlannedMs, 1.0)
    : 0;

  // Sort distractors by time spent
  const topDistractors = Object.entries(distractorMap)
    .map(([domain, ms]) => ({ domain, seconds: Math.round(ms / 1000) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  // Average recovery time
  const avgRecoveryTime = recoveryTimes.length > 0
    ? recoveryTimes.reduce((sum, t) => sum + t, 0) / recoveryTimes.length
    : 0;

  return {
    realFocusTime,
    distractionTime,
    idleTime,
    offChromeTime,       // Layer 1: App Monitor
    tabSwitches,
    avgRecoveryTime,
    focusRatio,
    topDistractors
  };
}

// ─── Event Listeners ────────────────────────────────────────

// Periodic alarm fires every ~30 seconds during a session
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    recordActivity();
  }
});

// Real-time tab switch detection (supplements the alarm)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const data = await chrome.storage.local.get(['sessionActive']);
  if (data.sessionActive) {
    recordActivity();
  }
});

// Real-time navigation detection
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const data = await chrome.storage.local.get(['sessionActive']);
    if (data.sessionActive) {
      recordActivity();
    }
  }
});

// ─── Layer 1: Idle Detector — Notifications ──────────────────
// Fires immediately when user goes idle/active/locked.
// Shows a Chrome notification so the user knows FlowOS noticed.

let idleStartTime = null; // track when idle/lock started

chrome.idle.onStateChanged.addListener(async (newState) => {
  console.log(`[FlowOS] Idle state changed: ${newState}`);

  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);

  if (newState === 'idle') {
    idleStartTime = Date.now();

    if (data.sessionActive && data.currentSession) {
      // Notify: user went idle during a focus session
      chrome.notifications.create('flowos-idle', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — You went idle',
        message: `No activity detected. Your session "${data.currentSession.goal}" is paused.`,
        priority: 1,
        silent: false,
      });
    }
  } else if (newState === 'locked') {
    idleStartTime = Date.now();

    if (data.sessionActive && data.currentSession) {
      // Notify: screen locked during a focus session
      chrome.notifications.create('flowos-locked', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Screen locked',
        message: `Session "${data.currentSession.goal}" is paused while your screen is locked.`,
        priority: 2,
        silent: false,
      });
    }
  } else if (newState === 'active') {
    // User returned — calculate how long they were away
    const awayMs = idleStartTime ? Date.now() - idleStartTime : 0;
    idleStartTime = null;

    // Clear any previous idle/lock notifications
    chrome.notifications.clear('flowos-idle');
    chrome.notifications.clear('flowos-locked');

    if (data.sessionActive && data.currentSession && awayMs > 5000) {
      const awaySec = Math.round(awayMs / 1000);
      const awayLabel = awaySec >= 60
        ? `${Math.floor(awaySec / 60)}m ${awaySec % 60}s`
        : `${awaySec}s`;

      chrome.notifications.create('flowos-return', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FlowOS — Welcome back',
        message: `You were away for ${awayLabel}. Lock back in: "${data.currentSession.goal}"`,
        priority: 1,
        silent: true,
      });
    }
  }

  // Always trigger activity recording on state change
  if (data.sessionActive) {
    recordActivity();
  }
});

// ─── Layer 1: App Monitor ────────────────────────────────────
// Detects when Chrome loses/gains focus to another OS application.
// windowId === WINDOW_ID_NONE means all Chrome windows lost focus.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const hadFocus = chromeHasFocus;
  chromeHasFocus = (windowId !== chrome.windows.WINDOW_ID_NONE);

  if (hadFocus === chromeHasFocus) return; // no change

  const data = await chrome.storage.local.get(['sessionActive', 'currentSession']);
  if (!data.sessionActive || !data.currentSession) return;

  const session = data.currentSession;
  const now = Date.now();
  const lastEvent = session.events[session.events.length - 1];

  if (!chromeHasFocus) {
    // Chrome lost OS focus — user switched to another app
    offChromeStartTime = now;
    console.log(`[FlowOS] App Monitor: Chrome lost focus (user in other app)`);
    // Close current event
    if (lastEvent && !lastEvent.duration) {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    // Record the off_chrome event
    session.events.push({
      timestamp: now,
      type: 'off_chrome',
      domain: null,
      duration: 0,
    });
  } else {
    // Chrome regained OS focus
    const awayMs = offChromeStartTime ? now - offChromeStartTime : 0;
    offChromeStartTime = null;
    console.log(`[FlowOS] App Monitor: Chrome regained focus (away ${Math.round(awayMs / 1000)}s)`);
    // Close the off_chrome event
    if (lastEvent && lastEvent.type === 'off_chrome' && !lastEvent.duration) {
      lastEvent.duration = now - lastEvent.timestamp;
    }
    // Record a return event
    session.events.push({
      timestamp: now,
      type: 'return',
      domain: null,
      duration: 0,
    });
  }

  await chrome.storage.local.set({ currentSession: session });
  // Immediately re-classify current activity
  recordActivity();
});
