# FlowOS — Project Documentation

---

## What We Built

FlowOS is a **personal focus operating system** — a Chrome extension paired with a web dashboard that tracks, analyzes, and improves how you actually work.

Most productivity tools tell you to be more disciplined. FlowOS tells you the truth. It runs silently in the background while you work and produces an honest, data-driven picture of every session: how long you actually focused, what pulled you away, when you are sharpest, and what your patterns look like over time.

The system has two parts:

**1. Chrome Extension (Data Collection)**  
A background process that monitors your tab activity, detects when you go idle, tracks when you leave Chrome for another app, and records your declared session goal. It does all of this without sending any data to a server — everything stays on your device in `chrome.storage.local`.

**2. React Dashboard (Visualization + AI)**  
A web app (`localhost:5173`) that pulls session data from the extension via a secure message bridge, renders it into visual screens (score ring, session timeline, heatmap, history log), and optionally passes anonymized statistics to Google Gemini to generate behavioral coaching insights.

---

## Feature List

| # | Feature | Where It Lives |
|---|---------|----------------|
| 1 | **Session Intent** | Extension popup |
| 2 | **Tab Tracker** | Extension background |
| 3 | **Idle Detector** | Extension background |
| 4 | **App Monitor** | Extension background |
| 5 | **Idle + Lock Notifications** | Extension background |
| 6 | **Live Focus Meter** | Extension popup |
| 7 | **Home Screen — Focus Score + Streak** | Dashboard |
| 8 | **Last Session (Mirror)** | Dashboard |
| 9 | **Focus DNA — AI Pattern Analysis** | Dashboard |
| 10 | **Session History** | Dashboard |
| 11 | **Extension Bridge** | Extension + Dashboard |

---

## Feature Purpose

**Session Intent**  
Forces the user to declare what they are about to work on before the session begins. When you name your goal, distractions become visible — the extension can show you _"your goal is X — is this helping?"_

**Tab Tracker**  
Knows what website you are actually looking at at every moment. Distinguishes productive work from distraction sites. This is the primary data source for the session timeline.

**Idle Detector**  
Catches the scenario where the browser is open but the person has walked away or stopped working. Without this, idle time would be counted as focus time, inflating the score.

**App Monitor**  
Catches the scenario where the user switches to another application entirely — VS Code, Slack, Finder. This time is neither "focus" nor "idle" in the browser sense; it is categorically different and tracked separately.

**Idle + Lock Notifications**  
Real-time feedback loop. When FlowOS detects you went idle or locked your screen during a session, it pushes a Chrome notification so you are aware the clock has paused. When you return, it tells you how long you were away.

**Live Focus Meter**  
Shows the user their real-time focus percentage while the session is running so they can course-correct before the session ends, not after.

**Focus Score + Streak**  
A single daily number (0–100) that summarizes how well you are working. The streak shows consistency over time. Together they give a "vital signs" view of your focus health without requiring the user to read raw data.

**Last Session (Mirror)**  
An honest breakdown of the most recent session. Shows the exact timeline of what happened minute by minute — when you were focused, when you were distracted, when you went idle. Called Mirror because it shows you what actually happened, not what you think happened.

**Focus DNA**  
A macro-level view across all sessions. Identifies when in the day you are most focused, what your biggest distraction is, what your focus trend is week-over-week, and gives you a specific action to take tomorrow. Powered by Gemini AI with a local fallback.

**Session History**  
A chronological log of every session ever recorded. Lets you spot patterns: which days were good, which goals led to better focus, how session quality is trending.

**Extension Bridge**  
The technical plumbing that connects the Chrome extension (which holds all data) to the web dashboard (which cannot access Chrome APIs). Without this, the two parts could not communicate at all.

---

## How Each Feature Works

---

### 1. Session Intent

The user opens the extension popup, types their goal (e.g. "Write chapter 3"), and selects a duration (5–120 minutes). When they click **Start**, the popup sends a message to the background service worker:

```
popup.js → chrome.runtime.sendMessage({ type: 'START_SESSION', goal, plannedDuration })
```

The background creates a session object:

```json
{
  "id": "uuid",
  "startTime": 1713456789000,
  "goal": "Write chapter 3",
  "plannedDuration": 45,
  "events": [],
  "stats": null
}
```

This is saved to `chrome.storage.local`. A 30-second alarm is started and the first activity check runs immediately. The goal is stored with the session permanently and later surfaced in distraction overlay messages and AI analysis.

---

### 2. Tab Tracker

Three event listeners in `background.js` trigger an activity check whenever something changes:

- `chrome.tabs.onActivated` — user switched to a different tab
- `chrome.tabs.onUpdated` (url changed) — page navigated
- `chrome.alarms.onAlarm` — 30-second heartbeat (in case nothing changed)

Every time any of these fires, `recordActivity()` runs:

1. Query the currently active tab, extract the domain (strip `www.`)
2. Check if the domain is in the distraction list (`youtube.com`, `instagram.com`, `reddit.com`, etc.)
3. Check idle state (see Idle Detector)
4. Classify the moment as `focus`, `distraction`, `idle`, or `locked`
5. If the domain changed from the previous event, insert a `tab_switch` marker
6. Either extend the current event's duration or push a new event
7. Save the updated session to storage

At session end, all events are summed to produce the stats object.

---

### 3. Idle Detector

Uses the Chrome `idle` API which reads OS-level keyboard and mouse input:

```
chrome.idle.setDetectionInterval(30)  ← threshold: 30 seconds of no input
```

This is called at the **top level** of the service worker (not just in `onInstalled`) because MV3 service workers restart frequently and would otherwise revert to the 60-second default.

`chrome.idle.onStateChanged` fires the instant the OS detects a state change:

| State | Meaning | Recorded as |
|-------|---------|-------------|
| `active` | Input detected in last 30s | `focus` or `distraction` |
| `idle` | No keyboard/mouse for 30s | `idle` |
| `locked` | Screen lock activated | `locked` |

Both `idle` and `locked` events accumulate into `idleTime` in the session stats. This means the focus ratio is calculated against only time you were actually present and active.

---

### 4. App Monitor

Uses `chrome.windows.onFocusChanged` which fires the instant the operating system changes which window has focus:

```
windowId === chrome.windows.WINDOW_ID_NONE
→ All Chrome windows lost OS focus
→ User is in another app (VS Code, Slack, Finder, etc.)
```

When Chrome loses focus:
1. Set `chromeHasFocus = false`
2. Close the current session event with its duration
3. Push a new `off_chrome` event to the session
4. Store the timestamp

When Chrome regains focus:
1. Set `chromeHasFocus = true`
2. Close the `off_chrome` event, calculate duration
3. Push a `return` event
4. Immediately call `recordActivity()` to resume normal tracking

Inside `recordActivity()`, there is a guard at the top:

```javascript
if (!chromeHasFocus) {
  // Update the running off_chrome event duration
  // Return early — do not classify as focus/idle/distraction
  return;
}
```

This means time in other apps is tracked accurately in `offChromeTime` and never misclassified as idle or focus.

---

### 5. Idle + Lock Notifications

`chrome.idle.onStateChanged` also drives notifications. The handler reads the active session from storage, then:

**On `idle`:**
```
chrome.notifications.create('flowos-idle', {
  title: 'FlowOS — You went idle',
  message: 'No activity detected. Your session "..." is paused.',
})
```

**On `locked`:**
```
chrome.notifications.create('flowos-locked', {
  title: 'FlowOS — Screen locked',
  message: 'Session "..." is paused while your screen is locked.',
})
```

**On `active` return (away > 5 seconds):**
1. Calculate away duration from stored `idleStartTime`
2. Clear the idle/lock notifications  
3. Show a return notification: _"You were away for 2m 14s. Lock back in: 'Write chapter 3'"_

Notifications only fire during an active session so they are always meaningful, never random alerts.

**Test button:** The popup has a small "test notifications" button that sends `TEST_NOTIFICATION` to the background, which fires an instant test notification and reports success/failure back inline.

---

### 6. Live Focus Meter

While a session is running, the popup polls every 5 seconds:

```javascript
const stats = session.stats_live; // accumulated from events so far
const focusSec = stats.realFocusTime / 1000;
const elapsedSec = (Date.now() - session.startTime) / 1000;
const focusPct = Math.round((focusSec / elapsedSec) * 100);
focusMeterFill.style.width = focusPct + '%';
```

The bar is color-coded: green if above 70%, orange if 40–70%, red below 40%. This gives the user a live signal to course-correct mid-session.

---

### 7. Focus Score + Streak

**Focus Score (0–100):**

Not a simple average. Computed as:

```
base = focusRatio × 100

completionBonus = (actualFocusMin / plannedMin >= 0.8) ? +10 : 0
// Did you use your planned time productively?

switchPenalty = min(tabSwitches × 2, 20)
// Frequent tab-switching reduces score

sessionScore = clamp(base + completionBonus - switchPenalty, 0, 100)
```

Multiple sessions are averaged with recent sessions weighted more heavily. The ring on the Home screen animates to this value.

**Streak:**

Counts consecutive calendar days that have at least one completed session. Iterates backward from today, stops as soon as it finds a day with no sessions. The 7-day grid shows each day as a colored square: cyan (>50% focus), orange (<50%), empty (no session).

---

### 8. Last Session (Mirror)

**Session selection:** Defaults to the session with the lowest focus ratio (the worst session) to make the gap between planned and actual work immediately visible. Can be switched by clicking session tabs at the top, or via the URL (`/mirror/:sessionId`).

**Session Timeline:**

The horizontal bar is built by iterating `session.events` and calculating each segment's width as a proportion of total session duration. Colors: green (focus), red (distraction), orange (idle), gray (off Chrome). Tab switch markers have zero width and are skipped visually.

**Stats Grid:**

| Card | Formula |
|------|---------|
| Real Focus Time | `realFocusTime / 60000` min |
| Time Lost | `(distractionTime + idleTime) / 60000` min |
| Tab Switches | `tabSwitches` count |
| True Cost per Distraction | `(distractionTime + avgRecoveryTime × tabSwitches) / tabSwitches / 60000` min |

The "True Cost" card is the most insightful — it shows that each distraction costs more than just the distraction itself, it also costs the recovery time needed to get back into focus.

---

### 9. Focus DNA

**Heatmap:**

Loops through all sessions and all focus events within each session. For each event, extracts the hour and day-of-week from the timestamp and accumulates the focus ratio into a `[24 hours × 7 days]` grid. Normalizes to 0–1. Cells are colored from near-black (no data / low focus) to bright cyan (high focus).

**AI Insights — Loading Sequence:**

```
1. Check IndexedDB cache → show immediately if fresh
2. Check for VITE_GEMINI_API_KEY
3. Try gemini-2.5-flash → gemini-2.0-flash → gemini-2.0-flash-lite
4. On any failure → buildLocalInsights(sessions)
```

The screen never shows an error. If AI is unavailable, local pattern math produces the same fields from aggregated statistics.

**Data sent to AI:** Only anonymized stats per session — minutes planned, minutes focused, distraction minutes, tab switches, hour of day. No URLs, no goal text, no identifiable information.

---

### 10. Session History

All sessions sorted by recency. Each row shows:
- Timestamp
- Focus % badge (green ≥70%, orange 40–70%, red <40%)
- Goal text  
- Stat line: planned → actual focus · distraction · idle
- Mini proportional bar (green/red/orange)

Clicking any row navigates to `/mirror/:sessionId` for the full timeline. The header shows total sessions and cumulative focus hours.

---

### 11. Extension Bridge

The dashboard is a web page. Web pages cannot call `chrome.storage` or `chrome.runtime`. The bridge solves this.

**bridge.js** is injected as a content script into `localhost:*`. It sits in the page context and listens for `postMessage` from the dashboard:

```
Dashboard                         bridge.js                      background.js
   |                                 |                                 |
   |-- postMessage(GET_SESSIONS) --> |                                 |
   |                                 |-- sendMessage(GET_SESSIONS) --> |
   |                                 | <------ sessions array -------- |
   | <-- postMessage(sessions) ----- |                                 |
```

Each request has a unique `requestId` so responses are matched correctly even if multiple requests are in flight. All requests have a 2-second timeout — if no response, the dashboard marks extension as disconnected and shows the appropriate empty state.

On page load, bridge.js immediately sends `BRIDGE_READY` to announce itself, which sets `extensionConnected = true` in the Sidebar without needing to wait for a data request.

---

*FlowOS — ITM SFT SummerHacks '26 | PS3: The Focus OS*
