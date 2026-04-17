<div align="center">

```
███████╗██╗      ██████╗ ██╗    ██╗ ██████╗ ███████╗
██╔════╝██║     ██╔═══██╗██║    ██║██╔═══██╗██╔════╝
█████╗  ██║     ██║   ██║██║ █╗ ██║██║   ██║███████╗
██╔══╝  ██║     ██║   ██║██║███╗██║██║   ██║╚════██║
██║     ███████╗╚██████╔╝╚███╔███╔╝╚██████╔╝███████║
╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝  ╚═════╝ ╚══════╝
```

### **Your Personal Focus Operating System**

*Because most productivity tools lie to you — FlowOS tells you the truth.*

<br/>

![Built for](https://img.shields.io/badge/Built%20For-ITM%20SFT%20SummerHacks%20'26-ff2d78?style=for-the-badge)
![Problem Statement](https://img.shields.io/badge/Track-PS3%3A%20The%20Focus%20OS-00e5ff?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20Chrome%20MV3%20%2B%20LLaMA%203.3-blueviolet?style=for-the-badge)

</div>

---

## 🧠 The Problem We're Solving

Deep work is disappearing. Most people *think* they focused for 2 hours. The data says 34 minutes.

Existing tools don't fix this — they just add more timers, more blockers, more guilt. FlowOS takes a different approach: **it runs silently, records everything honestly, and shows you a mirror of how you actually work** — then uses AI to help you do it better.

---

## 🏗️ What We Built

FlowOS has two tightly integrated parts:

```
┌─────────────────────────────────────────────────────────┐
│  🔌 CHROME EXTENSION             📊 REACT DASHBOARD      │
│                                                          │
│  • Records tab activity          • Focus Score + Streak  │
│  • Detects idle / screen lock    • Session Mirror        │
│  • Tracks app switching          • Focus DNA Heatmap     │
│  • Live Focus Meter              • AI Behavioral Coach   │
│  • Session intent capture        • Session History       │
│                                                          │
│         ←──── Extension Bridge (postMessage) ────→       │
└─────────────────────────────────────────────────────────┘
```

Everything is **100% local**. No accounts. No servers. Your data never leaves your device.

---

## ✨ Feature Breakdown

### 🔌 Chrome Extension

| Feature | What It Does |
|---|---|
| **Session Intent** | Before you start, you declare your goal. FlowOS holds you to it. |
| **Tab Tracker** | Knows every domain you visited, second by second, and classifies it as focus or distraction |
| **Idle Detector** | Catches when you walk away — so idle time is never counted as focus time |
| **App Monitor** | Detects when you switch to VS Code, Slack, or any other app outside Chrome |
| **Live Focus Meter** | A real-time % bar in the popup — course-correct *during* a session, not after |
| **Smart Notifications** | Notifies you when you go idle, when your screen locks, and when you return |

### 📊 React Dashboard

| Screen | What It Shows |
|---|---|
| **Home** | Your daily Focus Score (0–100), streak calendar, and tomorrow's recommended window |
| **Mirror** | An honest, minute-by-minute timeline of your last session — what actually happened |
| **Focus DNA** | A 24×7 heatmap of *when* you focus best, AI-identified patterns, and one specific action to take |
| **History** | Every session ever recorded, each with a focus %, goal, and mini timeline bar |

---

## ⚙️ How It Works — Under the Hood

### The Scoring Engine

Focus Score isn't a simple average. It's a weighted formula:

```
base            = focusRatio × 100
completionBonus = +10 if (actualFocusMins / plannedMins ≥ 0.8)
switchPenalty   = min(tabSwitches × 2, 20)

sessionScore = clamp(base + completionBonus − switchPenalty, 0, 100)
```

Recent sessions are weighted more heavily than older ones. The ring animates to the result.

---

### The Tab Tracking Loop

Three events continuously fire the `recordActivity()` function:

```
chrome.tabs.onActivated      → user switched tabs
chrome.tabs.onUpdated        → page navigated
chrome.alarms.onAlarm        → 30-second heartbeat
```

Every call classifies the current moment as `focus | distraction | idle | locked | off_chrome`, extends or creates an event object, and saves to `chrome.storage.local`. This produces a precise, unbroken event log for every second of every session.

---

### The Idle + App Detection

```
OS keyboard/mouse idle for 30s  →  state = "idle"
Screen lock activated           →  state = "locked"
Chrome window loses OS focus    →  state = "off_chrome"
```

These three states are tracked separately and excluded from focus calculations. This is why FlowOS scores are honest — it cannot be gamed by leaving a tab open while you're doing something else.

---

### The Extension Bridge

The dashboard is a web page — it cannot call Chrome APIs. The bridge solves this via a 3-way message relay:

```
Dashboard ──postMessage(GET_SESSIONS)──► bridge.js (content script)
                                              │
                              chrome.runtime.sendMessage()
                                              │
                                       background.js
                                              │
                              chrome.runtime.sendMessage(response)
                                              │
Dashboard ◄──postMessage(sessions)─────── bridge.js
```

Every request gets a unique `requestId`. Unresolved requests time out after 2 seconds so the dashboard handles disconnected extension states gracefully.

---

### The Focus DNA AI Pipeline

```
1. Pull all sessions from extension via Bridge
2. Aggregate into hourly focus ratios → [24 hours × 7 days] grid
3. Check IndexedDB cache → serve immediately if fresh
4. Build anonymized stats payload (no URLs, no goal text)
5. Call Groq API → llama-3.3-70b-versatile
6. On any failure → local pattern math produces identical output
```

The screen **never shows an error or blank state**. Local fallback always fires.

**What gets sent to Groq:** anonymized stats only — focus %, minutes, tab switches, hour of day, day of week. No browsing data. No personal information.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 + TypeScript |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **Charts** | Recharts |
| **Routing** | React Router v6 |
| **Extension** | Chrome Manifest V3 (Service Worker) |
| **Local Storage** | `chrome.storage.local` + IndexedDB (idb) |
| **AI Model** | LLaMA 3.3 70B via Groq API |
| **AI Fallback** | Local pattern analysis (zero API dependency) |

---

## 📁 Project Structure

```
FlowOS/
│
├── extension/                  # Chrome Extension (MV3)
│   ├── background.js           # Core engine — tracking, scoring, storage
│   ├── popup.html / popup.js   # Live focus meter + session start UI
│   ├── content.js              # Distraction overlay injection
│   ├── bridge.js               # Dashboard ↔ Extension message relay
│   ├── blocked.html            # Soft block page for distraction sites
│   └── manifest.json           # Extension permissions + entry points
│
└── src/                        # React Dashboard
    ├── screens/
    │   ├── Home.tsx             # Focus Score ring + streak calendar
    │   ├── Mirror.tsx           # Session timeline + stats breakdown
    │   ├── DNA.tsx              # AI insights + focus heatmap
    │   ├── Activity.tsx         # Live activity + distraction chart
    │   └── History.tsx          # All sessions log
    │
    ├── lib/
    │   ├── scoring.ts           # Focus Score formula
    │   ├── patterns.ts          # Hourly aggregation for heatmap
    │   ├── activityInsights.ts  # Real-time activity analysis
    │   ├── goalParser.ts        # NLP goal → task classification
    │   ├── groq.ts              # Groq API client (LLaMA 3.3 70B)
    │   ├── bridge.ts            # Dashboard side of Extension Bridge
    │   └── db.ts                # IndexedDB cache layer
    │
    └── components/
        ├── dna/                 # Heatmap + sparkline + DNA card
        ├── home/                # Score ring + streak + session modal
        ├── mirror/              # Timeline + distraction chart + stats
        └── layout/              # Sidebar + shell
```

---

## 🔑 The One Insight That Drives Everything

> **Each distraction costs more than just the distraction itself.**
>
> FlowOS computes *True Cost per Distraction*:
> ```
> trueCost = (distractionTime + avgRecoveryTime × tabSwitches) / tabSwitches
> ```
> That recovery time — the time to get back into deep work after an interruption — is invisible in every other tool. FlowOS surfaces it.

---



## Built By

**Team FlowOS** — ITM SFT SummerHacks '26
*Problem Statement 3(red colur ): The Focus OS*

---

<div align="center">

*Deep work is a skill. FlowOS helps you rebuild it.*

</div>
