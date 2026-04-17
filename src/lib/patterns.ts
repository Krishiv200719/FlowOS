// ═══════════════════════════════════════════════════════════
// FlowOS — Pattern Analysis
// ═══════════════════════════════════════════════════════════

import type { FocusSession } from '../types';

/**
 * Find the optimal focus window based on historical session data.
 * Filters sessions with focusRatio > 0.6, finds the most common hour range.
 */
export function getOptimalWindow(sessions: FocusSession[]): string {
  const qualitySessions = sessions.filter((s) => s.stats.focusRatio > 0.6);

  if (qualitySessions.length < 2) {
    return 'Complete more sessions to unlock';
  }

  // Count sessions per hour
  const hourCounts: Record<number, number> = {};
  for (const s of qualitySessions) {
    const hour = new Date(s.startTime).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  // Find the peak hour
  const peakHour = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0];

  if (!peakHour) return 'Complete more sessions to unlock';

  const startHour = parseInt(peakHour[0]);
  const endHour = startHour + 2; // 2-hour window

  return `${formatHour(startHour)} – ${formatHour(endHour)}`;
}

/**
 * Generate a 7×24 heatmap of focus quality.
 * [dayOfWeek][hourOfDay] = average focusRatio (0-1)
 */
export function getHourlyHeatmap(sessions: FocusSession[]): number[][] {
  // Initialize 7x24 grid with -1 (no data)
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(-1)
  );

  const countGrid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );

  const sumGrid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );

  for (const session of sessions) {
    const d = new Date(session.startTime);
    const day = d.getDay(); // 0=Sun, 1=Mon, ...
    const hour = d.getHours();

    sumGrid[day][hour] += session.stats.focusRatio;
    countGrid[day][hour]++;
  }

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (countGrid[day][hour] > 0) {
        grid[day][hour] = sumGrid[day][hour] / countGrid[day][hour];
      }
    }
  }

  return grid;
}

/**
 * Preprocess sessions by hour of day for AI context.
 */
export function preprocessSessionsByHour(
  sessions: FocusSession[]
): Record<number, { avgFocusRatio: number; sessionCount: number }> {
  const hourMap: Record<number, { totalRatio: number; count: number }> = {};

  for (const s of sessions) {
    const hour = new Date(s.startTime).getHours();
    if (!hourMap[hour]) {
      hourMap[hour] = { totalRatio: 0, count: 0 };
    }
    hourMap[hour].totalRatio += s.stats.focusRatio;
    hourMap[hour].count++;
  }

  const result: Record<number, { avgFocusRatio: number; sessionCount: number }> = {};
  for (const [hour, data] of Object.entries(hourMap)) {
    result[parseInt(hour)] = {
      avgFocusRatio: data.totalRatio / data.count,
      sessionCount: data.count,
    };
  }

  return result;
}

/**
 * Get peak focus hours sorted by quality.
 */
export function getPeakHours(sessions: FocusSession[]): number[] {
  const hourly = preprocessSessionsByHour(sessions);
  return Object.entries(hourly)
    .sort(([, a], [, b]) => b.avgFocusRatio - a.avgFocusRatio)
    .map(([hour]) => parseInt(hour));
}

/**
 * DATA #2: Compute a compelling local insight from session data — no API call.
 * Returns the single most dramatic/surprising truth from the sessions.
 */
export function getLocalInsight(sessions: FocusSession[]): string {
  if (sessions.length < 2) return '';

  const morningSessions = sessions.filter((s) => {
    const h = new Date(s.startTime).getHours();
    return h >= 6 && h < 12;
  });
  const eveningSessions = sessions.filter((s) => {
    const h = new Date(s.startTime).getHours();
    return h >= 18;
  });

  const morningAvg =
    morningSessions.length > 0
      ? Math.round(
          (morningSessions.reduce((sum, s) => sum + s.stats.focusRatio, 0) /
            morningSessions.length) *
            100
        )
      : null;

  const eveningAvg =
    eveningSessions.length > 0
      ? Math.round(
          (eveningSessions.reduce((sum, s) => sum + s.stats.focusRatio, 0) /
            eveningSessions.length) *
            100
        )
      : null;

  // Distractor totals
  const distractorMap: Record<string, { totalSec: number; sessionCount: number }> = {};
  for (const s of sessions) {
    for (const d of s.stats.topDistractors) {
      if (!distractorMap[d.domain]) {
        distractorMap[d.domain] = { totalSec: 0, sessionCount: 0 };
      }
      distractorMap[d.domain].totalSec += d.seconds;
      distractorMap[d.domain].sessionCount++;
    }
  }
  const sortedDistractors = Object.entries(distractorMap).sort(
    ([, a], [, b]) => b.totalSec - a.totalSec
  );
  const topDistractor = sortedDistractors[0];

  // Avg tab switches
  const avgTabSwitches = Math.round(
    sessions.reduce((sum, s) => sum + s.stats.tabSwitches, 0) / sessions.length
  );

  // Choose most dramatic insight
  const insights: string[] = [];

  if (morningAvg !== null && eveningAvg !== null && Math.abs(morningAvg - eveningAvg) >= 15) {
    const delta = morningAvg - eveningAvg;
    insights.push(
      delta > 0
        ? `Your morning sessions average ${morningAvg}% focus. Your evening sessions average ${eveningAvg}%. You are ${delta}% more effective before noon. Same brain. Different hour.`
        : `Your evening sessions average ${eveningAvg}% focus. Your mornings average ${morningAvg}%. Night mode is your focus mode — ${Math.abs(delta)}% better after 6pm.`
    );
  }

  if (topDistractor) {
    const totalMin = Math.round(topDistractor[1].totalSec / 60);
    const count = topDistractor[1].sessionCount;
    insights.push(
      `${topDistractor[0]} has stolen ${totalMin} minutes from you across ${count} sessions. That's ${(totalMin / 60).toFixed(1)} hours you can't get back.`
    );
  }

  insights.push(
    `You switch tabs an average of ${avgTabSwitches} times per session. Each switch costs you minutes of focus you never see leaving.`
  );

  // Return the first (most dramatic based on ordering)
  if (morningAvg !== null && eveningAvg !== null && Math.abs(morningAvg - eveningAvg) >= 15) {
    return insights[0];
  }
  if (topDistractor && topDistractor[1].totalSec > 600) {
    return insights.find((i) => i.includes(topDistractor[0])) ?? insights[0];
  }
  return insights[insights.length - 1];
}

// ─── Helpers ──────────────────────────────────────────────

function formatHour(h: number): string {
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:00 ${ampm}`;
}
