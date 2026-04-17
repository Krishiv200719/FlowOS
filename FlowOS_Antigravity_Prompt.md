# FlowOS — Antigravity Fix Prompt
### Gemini Integration Errors + Missing Features

You are working on **FlowOS**, a React + TypeScript + Vite productivity dashboard
paired with a Chrome Extension. The project is mostly built but has critical bugs
that prevent the Gemini AI integration from working and leave the dashboard blank
without the extension. Fix every issue below **exactly as described** and add the
missing features listed at the end.

---

## REPO OVERVIEW (what already exists)

```
flowos/
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js          ← distraction guardian
│   ├── bridge.js           ← chrome.storage ↔ postMessage bridge
│   ├── popup.html / popup.js
│   └── icons/
├── src/
│   ├── context/SessionContext.tsx   ← loads sessions from extension only
│   ├── data/mockSessions.ts         ← exists but is NEVER used
│   ├── lib/
│   │   ├── gemini.ts        ← Gemini API integration
│   │   ├── db.ts            ← IndexedDB (idb) — saveInsights/getInsights exist
│   │   ├── bridge.ts        ← postMessage bridge client
│   │   ├── patterns.ts      ← getHourlyHeatmap, getOptimalWindow, getPeakHours
│   │   └── scoring.ts       ← computeDailyScore, computeStreak, getDailyScores
│   ├── screens/
│   │   ├── Home.tsx         ← shows "Connect Extension" when no extension
│   │   ├── DNA.tsx          ← shows "Extension Not Connected" — blocks Gemini call
│   │   ├── Mirror.tsx
│   │   └── History.tsx
│   ├── components/ ...
│   └── types/index.ts
├── package.json             ← React 18, TypeScript, Vite, Framer Motion, Recharts, idb
└── .gitignore
```

**There is NO `.env` file.** The Gemini API key is missing entirely.

---

## BUG 1 — Missing `.env` file (CRITICAL — Gemini throws immediately)

**Problem:** `src/lib/gemini.ts` reads `import.meta.env.VITE_GEMINI_API_KEY`. No
`.env` file exists, so this is always `undefined`. The code throws
`'VITE_GEMINI_API_KEY not set. Add it to your .env file.'` before any API call.

**Fix:**
1. Create `.env` in the project root (next to `package.json`):
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. Create `.env.example` for reference:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Confirm `.env` is already in `.gitignore` (it is — verify and leave it).
4. In `src/vite-env.d.ts`, ensure the env var is typed:
   ```typescript
   interface ImportMetaEnv {
     readonly VITE_GEMINI_API_KEY: string;
   }
   interface ImportMeta {
     readonly env: ImportMetaEnv;
   }
   ```

---

## BUG 2 — SessionContext never loads mock data (CRITICAL — dashboard is blank)

**Problem:** `src/context/SessionContext.tsx` only loads sessions from the
extension bridge (`getExtensionSessions`). When the extension is not installed,
`sessions` is always `[]`. The file `src/data/mockSessions.ts` exists with 7
rich fake sessions but is **never imported or used anywhere**. Every screen that
depends on sessions shows a dead "Connect Extension" state. The build guide
explicitly says: *"Build with mock data first. Never let the demo depend on the
extension being perfectly wired."*

**Fix — rewrite `src/context/SessionContext.tsx`:**

```typescript
// Replace the entire loadSessions function logic with this:

import { MOCK_SESSIONS } from '../data/mockSessions';  // ADD THIS IMPORT

const loadSessions = useCallback(async () => {
  setLoading(true);
  try {
    const connected = await isExtensionConnected();
    setExtensionConnected(connected);

    if (connected) {
      const extSessions = await getExtensionSessions();
      if (extSessions && extSessions.length > 0) {
        extSessions.sort((a, b) => b.startTime - a.startTime);
        setSessions(extSessions);
        console.log(`[FlowOS] Loaded ${extSessions.length} real sessions from extension.`);
      } else {
        // Extension connected but no sessions yet — use mock data as seed
        setSessions(MOCK_SESSIONS);
        console.log('[FlowOS] Extension connected, no sessions yet — showing mock data.');
      }
    } else {
      // No extension — always fall back to mock data for demo
      setSessions(MOCK_SESSIONS);
      console.log('[FlowOS] No extension detected — using mock demo data.');
    }
  } catch (err) {
    console.warn('[FlowOS] Bridge error:', err);
    // On any error, fall back to mock data so the app never goes blank
    setSessions(MOCK_SESSIONS);
  } finally {
    setLoading(false);
  }
}, []);
```

---

## BUG 3 — DNA.tsx blocks Gemini call behind extension gate (CRITICAL)

**Problem:** `src/screens/DNA.tsx` checks `extensionConnected` first and shows a
full-page "Extension Not Connected" error screen **before** checking sessions.
Because sessions now fall back to mock data (Bug 2 fix), this gate is wrong — the
AI analysis should run on whatever sessions are available, real or mock.

**Fix — in `src/screens/DNA.tsx`:**

Remove the extension-not-connected early return block entirely:

```typescript
// DELETE this entire block from DNA.tsx:
if (!extensionConnected) {
  return (
    <motion.div ...>
      <span className="text-5xl">🔌</span>
      <p ...>Extension Not Connected</p>
      ...
    </motion.div>
  );
}
```

Instead, add a subtle non-blocking banner at the **bottom** of the main view
that only shows when `!extensionConnected` and sessions are mock data:

```tsx
{/* Add at the bottom of the main view JSX, inside the motion.div */}
{!extensionConnected && (
  <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#2A2A2A] rounded-lg">
    <span className="text-[10px] font-mono text-flow-very-muted">
      ○ DEMO MODE — Install the Chrome extension to track real sessions
    </span>
  </div>
)}
```

---

## BUG 4 — Home.tsx shows setup screen instead of dashboard

**Problem:** `src/screens/Home.tsx` shows a full "Connect the FlowOS Extension"
setup screen when `!extensionConnected`. With the mock data fix, this should
never be a full-page block — it should show the actual dashboard with data.

**Fix — in `src/screens/Home.tsx`:**

Remove the full-page `if (!extensionConnected) { return (...) }` block.

Replace it with a small dismissible inline notice in the existing dashboard
layout (same pattern as DNA fix above — a dashed border banner at the bottom of
the page, not a full-page gate):

```tsx
{!extensionConnected && (
  <div className="card-dashed px-4 py-3 flex items-center justify-between">
    <span className="text-[10px] font-mono text-flow-very-muted">
      ○ DEMO MODE — data shown is simulated. Install the extension to track real sessions.
    </span>
    <a
      href="https://developer.chrome.com/docs/extensions/mv3/getstarted/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] font-mono text-flow-cyan hover:underline ml-4 whitespace-nowrap"
    >
      Setup →
    </a>
  </div>
)}
```

---

## BUG 5 — Gemini model list missing `gemini-2.5-flash`

**Problem:** `src/lib/gemini.ts` defines this fallback chain:
```typescript
const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];
```
The build spec requires `gemini-2.5-flash` as the primary model. It is missing.

**Fix — update `GEMINI_MODELS` in `src/lib/gemini.ts`:**

```typescript
const GEMINI_MODELS = [
  'gemini-2.5-flash',          // Primary — as per build spec
  'gemini-2.0-flash',          // Fallback 1
  'gemini-2.0-flash-lite',     // Fallback 2 — highest free-tier RPM
  'gemini-1.5-flash',          // Fallback 3 — legacy safety net
];
```

Also update `GEMINI_ENDPOINT` and `getEndpoint` to use `v1beta` (already correct)
and confirm the endpoint pattern:
```
https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent
```

---

## BUG 6 — Gemini insights are never cached (wastes quota + slow UX)

**Problem:** `src/lib/db.ts` already exports `saveInsights` and `getInsights` but
`src/screens/DNA.tsx` never calls them. Every mount triggers a fresh Gemini API
call. This burns free-tier quota and causes a loading spinner every visit.

**Fix — update the `useEffect` in `src/screens/DNA.tsx`:**

```typescript
import { saveInsights, getInsights } from '../lib/db';  // ADD THIS

useEffect(() => {
  if (sessionsLoading || sessions.length < 3) return;

  setInsightsLoading(true);
  setInsightsError(null);

  // 1. Try cache first
  getInsights()
    .then((cached) => {
      if (cached) {
        console.log('[FlowOS] Loaded insights from cache.');
        setInsights(cached);
        setInsightsLoading(false);
        return;
      }
      // 2. Cache miss — call Gemini
      return getAIInsights(sessions)
        .then((data) => {
          setInsights(data);
          // 3. Persist to IndexedDB cache
          return saveInsights(data);
        });
    })
    .catch((err) => {
      console.error('[FlowOS] AI insights error:', err);
      setInsights(null);
      setInsightsError(err.message || 'Failed to load AI insights');
    })
    .finally(() => setInsightsLoading(false));
}, [sessions, sessionsLoading]);
```

Also add a **"Refresh Analysis"** button in the DNA screen that:
1. Calls `getAIInsights(sessions)` directly (bypassing cache)
2. Saves new result to IndexedDB with `saveInsights`
3. Updates `insights` state

Place it next to the header:
```tsx
<button
  onClick={async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const fresh = await getAIInsights(sessions);
      setInsights(fresh);
      await saveInsights(fresh);
    } catch (err: any) {
      setInsightsError(err.message);
    } finally {
      setInsightsLoading(false);
    }
  }}
  disabled={insightsLoading}
  className="text-[10px] font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-3 py-1.5 hover:bg-flow-cyan/5 transition-colors disabled:opacity-40"
>
  ↻ Refresh Analysis
</button>
```

---

## BUG 7 — `bridge.js` not injected into the dashboard page

**Problem:** `extension/bridge.js` is the content script that bridges
`chrome.storage.local` to the dashboard via `postMessage`. It is NOT referenced
in `extension/manifest.json`. The manifest only injects `content.js` (the
distraction guardian). Without `bridge.js` being injected on the dashboard URL,
`isExtensionConnected()` always times out and returns `false` even when the
extension is installed.

**Fix — update `extension/manifest.json`:**

```json
{
  "manifest_version": 3,
  "name": "FlowOS",
  "version": "1.0",
  "description": "Your personal focus operating system",
  "permissions": ["tabs", "idle", "storage", "scripting", "alarms"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "http://localhost/*",
        "http://127.0.0.1/*",
        "https://*.vercel.app/*",
        "https://*.netlify.app/*",
        "https://*.github.io/*"
      ],
      "js": ["bridge.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

---

## MISSING FEATURE 1 — Session Start Modal on Home screen

**Problem:** The Home screen has a "START FOCUS SESSION →" CTA button but there
is no modal to actually set a goal and duration. The button exists with no
`onClick` handler.

**Build `src/components/home/StartSessionModal.tsx`:**

A modal overlay with:
- Dark backdrop (`bg-black/60 backdrop-blur-sm`)
- Card with dashed border, matching design system
- Title: `INITIATE FOCUS SESSION` in monospace
- Input: "WHAT WILL YOU WORK ON?" — text input, full width
- Slider: "PLANNED DURATION" — 15 to 180 minutes, step 15
  - Show current value: `{duration} MIN` next to label
- Two buttons:
  - `"START SESSION →"` (cyan, primary) — on click:
    1. If extension connected: `window.postMessage({ source: 'flowos-dashboard', action: 'START_SESSION', goal, plannedDuration }, '*')`
    2. Also store `{ goal, plannedDuration, startedAt: Date.now() }` in `localStorage` as `'flowos_active_session'`
    3. Close modal
  - `"Cancel"` (muted, secondary) — closes modal
- Press `Escape` to close
- Auto-focus the goal input on open

Wire the CTA button on `Home.tsx` to open this modal via local `useState`.

---

## MISSING FEATURE 2 — Live Session Timer on Home screen

**Problem:** When a session is active, the Home screen should show a live timer
and the current goal. Currently it has no session-active state.

**Fix — in `src/screens/Home.tsx`:**

1. On mount, check `localStorage.getItem('flowos_active_session')`. If it exists,
   parse it as `{ goal, plannedDuration, startedAt }`.
2. If active session found, show a live timer card instead of the CTA:

```tsx
// Session Active Card
<motion.div className="card-dashed px-6 py-5 space-y-3" ...>
  <div className="flex items-center gap-2">
    <span className="w-2 h-2 rounded-full bg-flow-green animate-pulse" />
    <span className="text-xs font-mono text-flow-green">SESSION ACTIVE</span>
  </div>
  <p className="text-sm text-flow-muted">{activeSession.goal}</p>
  <p className="text-4xl font-mono text-white">{elapsedFormatted}</p>
  <p className="text-xs text-flow-very-muted font-mono">
    of {activeSession.plannedDuration} min planned
  </p>
  <button
    onClick={endSession}
    className="text-xs font-mono text-flow-red border border-dashed border-flow-red/40 rounded px-4 py-2 hover:bg-flow-red/5 transition-colors"
  >
    End Session
  </button>
</motion.div>
```

3. Use `useEffect` + `setInterval(1000)` to count elapsed seconds.
4. `endSession` clears `localStorage.removeItem('flowos_active_session')` and
   refreshes the page (or triggers a context refresh).
5. Format elapsed time as `MM:SS` up to 59:59, then `HH:MM:SS`.

---

## MISSING FEATURE 3 — "Copy to Calendar" on Tomorrow's Window card

**Problem:** The `TomorrowWindow` component likely has an "Add to calendar"
button that does nothing.

**Fix — in `src/components/home/TomorrowWindow.tsx`:**

Wire the button to copy a pre-formatted Google Calendar URL to clipboard:

```typescript
const handleCopyCalendar = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Parse the window string to get hours (e.g., "9:00 AM – 11:00 AM")
  const text = `FlowOS Focus Session\n\nScheduled peak focus window.\n\nStart: ${optimalWindow.split('–')[0].trim()}\nEnd: ${optimalWindow.split('–')[1]?.trim() || ''}\n\n"All your data stays on your device."`;
  
  navigator.clipboard.writeText(text).then(() => {
    // Show a brief "Copied!" confirmation by toggling local state
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
};
```

Button text: `"📋 Copy to clipboard"` → changes to `"✓ Copied!"` for 2 seconds.

---

## MISSING FEATURE 4 — Session Debrief auto-navigation after session ends

**Problem:** When a session ends (popup clicks "End Session"), the dashboard
should automatically navigate to the Mirror screen showing that session's debrief.

**Fix:** 
1. In `src/context/SessionContext.tsx`, add a polling mechanism that checks
   `chrome.storage.local` (via bridge) for newly completed sessions every 5
   seconds when the extension is connected.
2. When a new session appears (not in current `sessions` array), call `refresh()`.
3. In `src/App.tsx` or the router, watch for `sessions` length increase and
   navigate to `/mirror/${sessions[0].id}` automatically.

Use this pattern in `App.tsx`:

```typescript
const prevLengthRef = useRef(sessions.length);
useEffect(() => {
  if (sessions.length > prevLengthRef.current && sessions[0]) {
    navigate(`/mirror/${sessions[0].id}`);
  }
  prevLengthRef.current = sessions.length;
}, [sessions.length]);
```

---

## VERIFICATION CHECKLIST

After all fixes, verify:
- [ ] `npm run dev` starts without TypeScript errors
- [ ] Home screen shows Focus Score + Streak + Tomorrow Window using mock data
      (no "Connect Extension" gate)
- [ ] DNA screen loads → shows heatmap + calls Gemini → displays AI insights
      (no "Extension Not Connected" gate)
- [ ] Second visit to DNA screen loads from cache (no Gemini API call)
- [ ] "Refresh Analysis" button forces a fresh Gemini call and updates cache
- [ ] Mirror screen shows timeline with colored segments using mock session data
- [ ] History screen shows list of 7 mock sessions
- [ ] `.env` file exists with `VITE_GEMINI_API_KEY=...` filled in
- [ ] `extension/manifest.json` includes both `content.js` and `bridge.js`
      in `content_scripts`, with `bridge.js` matching localhost + deploy URLs
- [ ] No full-page extension-gate screens exist anywhere

---

## DESIGN RULES — DO NOT CHANGE THESE

- Background: `#0A0A0A` primary, `#111111` secondary, `#161616` cards
- Accent cyan: `#00F5FF` | Focus green: `#00D46A` | Idle orange: `#FF6B35` | Distraction red: `#FF3B3B`
- Fonts: `Space Grotesk` (prose) + `JetBrains Mono` (numbers/data)
- All cards: `border-dashed border-[#2A2A2A]`, max 8px border-radius
- No light mode. No bouncing animations. Everything dark, precise, intentional.

---

*Fix these bugs and the Gemini analysis will work correctly.
The dashboard will be fully functional with mock data for demo,
and will automatically upgrade to real data once the extension is connected.*
