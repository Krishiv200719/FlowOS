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
   *  return = returned to Chrome from another app or distraction
   */
  type: 'focus' | 'idle' | 'locked' | 'distraction' | 'tab_switch' | 'off_chrome' | 'return';
  domain?: string | null;
  duration?: number; // milliseconds
}

/** Stats computed at end of session */
export interface SessionStats {
  realFocusTime: number;        // milliseconds
  distractionTime: number;      // milliseconds
  idleTime: number;             // milliseconds (idle + locked)
  offChromeTime?: number;       // milliseconds — Layer 1: App Monitor (optional: absent in legacy sessions)
  tabSwitches: number;
  avgRecoveryTime: number;      // milliseconds
  focusRatio: number;           // 0.0 to 1.0
  topDistractors: { domain: string; seconds: number }[];
}

/** A full focus session */
export interface FocusSession {
  id: string;
  startTime: number;
  endTime: number;
  plannedDuration: number;      // minutes
  goal: string;
  events: SessionEvent[];
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
