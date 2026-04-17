// ═══════════════════════════════════════════════════════════
// FlowOS — Focus Score & Streak Calculation
// ═══════════════════════════════════════════════════════════

import type { FocusSession } from '../types';

/**
 * Compute today's focus score (0-100):
 * - 40% = total deep work minutes (capped at 120 min)
 * - 40% = best session's focus ratio (0.8 = full 40pts)
 * - 20% = completion rate (sessions with ratio > 0.5)
 */
export function computeDailyScore(sessions: FocusSession[]): number {
  const todaySessions = sessions.filter((s) => isToday(s.startTime));

  if (todaySessions.length === 0) return 0;

  // Component 1: Total deep work minutes (max 120 min = 40 pts)
  const totalFocusMin = todaySessions.reduce(
    (sum, s) => sum + s.stats.realFocusTime / 60000,
    0
  );
  const focusTimeScore = Math.min(totalFocusMin / 120, 1) * 40;

  // Component 2: Best session's focus ratio (40pts)
  const bestRatio = Math.max(...todaySessions.map((s) => s.stats.focusRatio));
  const ratioScore = Math.min(bestRatio / 0.8, 1) * 40;

  // Component 3: Completion (sessions with ratio > 0.5) (20pts)
  const completed = todaySessions.filter(
    (s) => s.stats.focusRatio > 0.5
  ).length;
  const completionScore = (completed / todaySessions.length) * 20;

  return Math.round(focusTimeScore + ratioScore + completionScore);
}

/**
 * Compute the overall focus score for a given set of sessions.
 * Used for showing "yesterday's score" or "weekly average".
 */
export function computeScoreForSessions(sessions: FocusSession[]): number {
  if (sessions.length === 0) return 0;

  const totalFocusMin = sessions.reduce(
    (sum, s) => sum + s.stats.realFocusTime / 60000,
    0
  );
  const focusTimeScore = Math.min(totalFocusMin / 120, 1) * 40;
  const bestRatio = Math.max(...sessions.map((s) => s.stats.focusRatio));
  const ratioScore = Math.min(bestRatio / 0.8, 1) * 40;
  const completed = sessions.filter((s) => s.stats.focusRatio > 0.5).length;
  const completionScore = (completed / sessions.length) * 20;

  return Math.round(focusTimeScore + ratioScore + completionScore);
}

/**
 * Count consecutive days (going back from today) where at least
 * one session had focusRatio > 0.5.
 */
export function computeStreak(sessions: FocusSession[]): number {
  if (sessions.length === 0) return 0;

  // Group sessions by date string
  const sessionDays = new Set<string>();
  for (const s of sessions) {
    if (s.stats.focusRatio > 0.5) {
      sessionDays.add(dateKey(s.startTime));
    }
  }

  let streak = 0;
  const now = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dateKey(d.getTime());

    if (sessionDays.has(key)) {
      streak++;
    } else if (i > 0) {
      // Allow today to be missing (day hasn't ended yet)
      break;
    }
  }

  return streak;
}

/**
 * Get daily scores for the last N days (for sparkline chart).
 */
export function getDailyScores(
  sessions: FocusSession[],
  days: number = 7
): { date: string; score: number }[] {
  const result: { date: string; score: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dateKey(d.getTime());

    const daySessions = sessions.filter(
      (s) => dateKey(s.startTime) === key
    );

    result.push({
      date: d.toLocaleDateString('en-US', { weekday: 'short' }),
      score: daySessions.length > 0 ? computeScoreForSessions(daySessions) : 0,
    });
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────

function isToday(timestamp: number): boolean {
  return dateKey(timestamp) === dateKey(Date.now());
}

function dateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
