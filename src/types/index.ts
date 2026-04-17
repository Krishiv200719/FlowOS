// ═══════════════════════════════════════════════════════════
// FlowOS — TypeScript Interfaces
// ═══════════════════════════════════════════════════════════

/** A single event during a focus session */
export interface SessionEvent {
  timestamp: number;
  /** focus = deep work in Chrome
   *  idle = no mouse/keyboard (Idle Detector)
   *  locked = screen locked (Idle Detector)
   *  distraction = known distraction domain
   *  tab_switch = switched to a different tab
   *  off_chrome = Chrome lost OS focus (App Monitor)
   *  returned = user returned from idle/locked (Feature 1)
   *  returned_to_chrome = user returned to Chrome (Feature 2)
   *  return = legacy alias for returned_to_chrome
   */
  type: 'focus' | 'idle' | 'locked' | 'distraction' | 'tab_switch'
      | 'off_chrome' | 'returned' | 'returned_to_chrome' | 'return';
  domain?: string | null;
  duration?: number;          // milliseconds
  idleState?: string;         // Feature 1: 'idle' | 'locked'
  idleDurationMs?: number;    // Feature 1: ms away when returning
  durationMs?: number;        // Feature 2: ms away from Chrome
}

/** Stats computed at end of session */
export interface SessionStats {
  realFocusTime: number;        // milliseconds
  distractionTime: number;      // milliseconds
  idleTime: number;             // milliseconds (idle + locked + off_chrome)
  totalIdleMs?: number;         // Feature 1: idle + locked only
  totalOffChromeMs?: number;    // Feature 2: off_chrome only
  offChromeTime?: number;       // alias for totalOffChromeMs (legacy)
  tabSwitches: number;
  avgRecoveryTime: number;      // milliseconds
  focusRatio: number;           // 0.0 to 1.0
  topDistractors: { domain: string; seconds: number }[];
}

/** Site time log entry — Feature 3 */
export interface SiteLogEntry {
  totalMs: number;
  visits: number;
  category: 'work' | 'distraction' | 'neutral';
  lastVisited?: number;
}

/** A full focus session */
export interface FocusSession {
  id: string;
  startTime: number;
  endTime: number;
  plannedDuration: number;      // minutes
  goal: string;
  events: SessionEvent[];
  siteLog?: Record<string, SiteLogEntry>; // Feature 3a: per-session site time
  stats: SessionStats;
  aiDebrief?: string;
}

/** User's personal pattern profile */
export interface UserPattern {
  peakFocusHours: number[];
  avgFocusRatio: number;
  topDistractor: string;
  avgSessionLength: number;
  avgRecoveryTime: number;
  sessionsCompleted: number;
  focusScore: number;
  streak: number;
}

/** AI-generated insight object */
export interface AIInsights {
  peakHours: string;
  realFocusRatio: number;
  topDistractor: string;
  keyInsight: string;
  tomorrowWindow: string;
  weeklyTrend: 'improving' | 'declining' | 'stable';
  coachMessage: string;
}
