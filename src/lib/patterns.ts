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

// ─── Helpers ──────────────────────────────────────────────

function formatHour(h: number): string {
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:00 ${ampm}`;
}
