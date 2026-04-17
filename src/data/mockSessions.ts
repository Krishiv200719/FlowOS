// ═══════════════════════════════════════════════════════════
// FlowOS — Mock Session Data
// 7 realistic sessions over 7 days for demo
// ═══════════════════════════════════════════════════════════

import { FocusSession, SessionEvent, SessionStats } from '../types';

// ─── Helpers ──────────────────────────────────────────────

function daysAgo(days: number, hour: number, minute: number = 0): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function ms(minutes: number): number {
  return minutes * 60 * 1000;
}

function buildEvents(
  startTime: number,
  segments: Array<{ type: SessionEvent['type']; domain?: string; minutes: number }>
): SessionEvent[] {
  const events: SessionEvent[] = [];
  let cursor = startTime;

  for (const seg of segments) {
    events.push({
      timestamp: cursor,
      type: seg.type,
      domain: seg.domain,
      duration: seg.type === 'tab_switch' ? 0 : ms(seg.minutes),
    });
    if (seg.type !== 'tab_switch') {
      cursor += ms(seg.minutes);
    }
  }

  return events;
}

function computeStats(
  session: { plannedDuration: number; events: SessionEvent[] }
): SessionStats {
  let realFocusTime = 0;
  let distractionTime = 0;
  let idleTime = 0;
  let tabSwitches = 0;
  const distractorMap: Record<string, number> = {};
  const recoveryTimes: number[] = [];
  let lastDistractionEnd: number | null = null;

  for (const event of session.events) {
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
        if (event.domain) {
          distractorMap[event.domain] = (distractorMap[event.domain] || 0) + dur;
        }
        lastDistractionEnd = event.timestamp + dur;
        break;
      case 'idle':
        idleTime += dur;
        break;
      case 'tab_switch':
        tabSwitches++;
        break;
    }
  }

  const totalPlannedMs = session.plannedDuration * 60 * 1000;
  const focusRatio = totalPlannedMs > 0 ? Math.min(realFocusTime / totalPlannedMs, 1) : 0;

  const topDistractors = Object.entries(distractorMap)
    .map(([domain, msTime]) => ({ domain, seconds: Math.round(msTime / 1000) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  const avgRecoveryTime =
    recoveryTimes.length > 0
      ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
      : 0;

  return {
    realFocusTime,
    distractionTime,
    idleTime,
    tabSwitches,
    avgRecoveryTime,
    focusRatio,
    topDistractors,
  };
}

function makeSession(
  id: string,
  daysOffset: number,
  hour: number,
  minute: number,
  plannedDuration: number,
  goal: string,
  segments: Array<{ type: SessionEvent['type']; domain?: string; minutes: number }>
): FocusSession {
  const startTime = daysAgo(daysOffset, hour, minute);
  const events = buildEvents(startTime, segments);
  const totalMinutes = segments.reduce(
    (sum, s) => sum + (s.type === 'tab_switch' ? 0 : s.minutes),
    0
  );
  const endTime = startTime + ms(totalMinutes);
  const stats = computeStats({ plannedDuration, events });

  return { id, startTime, endTime, plannedDuration, goal, events, stats };
}

// ═══════════════════════════════════════════════════════════
// THE 7 SESSIONS — Each tells part of the story
// ═══════════════════════════════════════════════════════════

export const mockSessions: FocusSession[] = [

  // ─── Session 1: 7 days ago, morning, decent ───────────
  // Planned 60 min, focused ~39 min (ratio 0.65)
  makeSession('s1', 7, 9, 0, 60, 'Write project proposal', [
    { type: 'focus', domain: 'docs.google.com', minutes: 15 },
    { type: 'tab_switch', domain: 'twitter.com' },
    { type: 'distraction', domain: 'twitter.com', minutes: 5 },
    { type: 'tab_switch', domain: 'docs.google.com' },
    { type: 'focus', domain: 'docs.google.com', minutes: 12 },
    { type: 'idle', minutes: 4 },
    { type: 'focus', domain: 'docs.google.com', minutes: 8 },
    { type: 'tab_switch', domain: 'youtube.com' },
    { type: 'distraction', domain: 'youtube.com', minutes: 7 },
    { type: 'tab_switch', domain: 'docs.google.com' },
    { type: 'idle', minutes: 3 },
    { type: 'focus', domain: 'docs.google.com', minutes: 4 },
    { type: 'idle', minutes: 2 },
  ]),

  // ─── Session 2: 6 days ago, evening, WORST ────────────
  // Planned 90 min, focused ONLY 19 min (ratio 0.211)
  // This is THE demo session for the Honest Mirror
  makeSession('s2', 6, 20, 0, 90, 'Study data structures', [
    { type: 'focus', domain: 'leetcode.com', minutes: 8 },
    { type: 'tab_switch', domain: 'youtube.com' },
    { type: 'distraction', domain: 'youtube.com', minutes: 14 },
    { type: 'tab_switch', domain: 'leetcode.com' },
    { type: 'focus', domain: 'leetcode.com', minutes: 4 },
    { type: 'idle', minutes: 6 },
    { type: 'tab_switch', domain: 'twitter.com' },
    { type: 'distraction', domain: 'twitter.com', minutes: 8 },
    { type: 'tab_switch', domain: 'leetcode.com' },
    { type: 'focus', domain: 'leetcode.com', minutes: 3 },
    { type: 'tab_switch', domain: 'reddit.com' },
    { type: 'distraction', domain: 'reddit.com', minutes: 15 },
    { type: 'idle', minutes: 5 },
    { type: 'focus', domain: 'leetcode.com', minutes: 4 },
    { type: 'tab_switch', domain: 'youtube.com' },
    { type: 'distraction', domain: 'youtube.com', minutes: 12 },
    { type: 'idle', minutes: 8 },
    { type: 'distraction', domain: 'instagram.com', minutes: 3 },
  ]),

  // ─── Session 3: 5 days ago, morning, BEST ─────────────
  // Planned 60 min, focused 51 min (ratio 0.85)
  makeSession('s3', 5, 9, 30, 60, 'Build dashboard component', [
    { type: 'focus', domain: 'vscode.dev', minutes: 22 },
    { type: 'idle', minutes: 3 },
    { type: 'focus', domain: 'vscode.dev', minutes: 18 },
    { type: 'tab_switch', domain: 'twitter.com' },
    { type: 'distraction', domain: 'twitter.com', minutes: 2 },
    { type: 'tab_switch', domain: 'vscode.dev' },
    { type: 'focus', domain: 'vscode.dev', minutes: 11 },
    { type: 'idle', minutes: 4 },
  ]),

  // ─── Session 4: 4 days ago, afternoon, moderate ───────
  // Planned 45 min, focused ~25 min (ratio 0.556)
  makeSession('s4', 4, 14, 0, 45, 'Review pull requests', [
    { type: 'focus', domain: 'github.com', minutes: 10 },
    { type: 'tab_switch', domain: 'youtube.com' },
    { type: 'distraction', domain: 'youtube.com', minutes: 6 },
    { type: 'tab_switch', domain: 'github.com' },
    { type: 'focus', domain: 'github.com', minutes: 8 },
    { type: 'idle', minutes: 5 },
    { type: 'tab_switch', domain: 'reddit.com' },
    { type: 'distraction', domain: 'reddit.com', minutes: 4 },
    { type: 'tab_switch', domain: 'github.com' },
    { type: 'focus', domain: 'github.com', minutes: 7 },
    { type: 'idle', minutes: 3 },
    { type: 'focus', domain: 'github.com', minutes: 2 },
  ]),

  // ─── Session 5: 3 days ago, morning, good ─────────────
  // Planned 60 min, focused ~43 min (ratio 0.717)
  makeSession('s5', 3, 10, 0, 60, 'Write API documentation', [
    { type: 'focus', domain: 'notion.so', minutes: 18 },
    { type: 'idle', minutes: 2 },
    { type: 'focus', domain: 'notion.so', minutes: 14 },
    { type: 'tab_switch', domain: 'youtube.com' },
    { type: 'distraction', domain: 'youtube.com', minutes: 5 },
    { type: 'tab_switch', domain: 'notion.so' },
    { type: 'focus', domain: 'notion.so', minutes: 11 },
    { type: 'idle', minutes: 4 },
    { type: 'tab_switch', domain: 'twitter.com' },
    { type: 'distraction', domain: 'twitter.com', minutes: 3 },
    { type: 'tab_switch', domain: 'notion.so' },
    { type: 'focus', domain: 'notion.so', minutes: 3 },
  ]),

  // ─── Session 6: 2 days ago, evening, bad ──────────────
  // Planned 90 min, focused ~22 min (ratio 0.244)
  makeSession('s6', 2, 21, 0, 90, 'Study algorithms', [
    { type: 'focus', domain: 'leetcode.com', minutes: 6 },
    { type: 'tab_switch', domain: 'youtube.com' },
    { type: 'distraction', domain: 'youtube.com', minutes: 18 },
    { type: 'idle', minutes: 7 },
    { type: 'tab_switch', domain: 'leetcode.com' },
    { type: 'focus', domain: 'leetcode.com', minutes: 5 },
    { type: 'tab_switch', domain: 'reddit.com' },
    { type: 'distraction', domain: 'reddit.com', minutes: 12 },
    { type: 'tab_switch', domain: 'leetcode.com' },
    { type: 'focus', domain: 'leetcode.com', minutes: 3 },
    { type: 'tab_switch', domain: 'instagram.com' },
    { type: 'distraction', domain: 'instagram.com', minutes: 8 },
    { type: 'idle', minutes: 10 },
    { type: 'focus', domain: 'leetcode.com', minutes: 8 },
    { type: 'tab_switch', domain: 'twitter.com' },
    { type: 'distraction', domain: 'twitter.com', minutes: 7 },
    { type: 'idle', minutes: 6 },
  ]),

  // ─── Session 7: yesterday, morning, improving ─────────
  // Planned 60 min, focused ~34 min (ratio 0.567)
  makeSession('s7', 1, 9, 15, 60, 'Design landing page', [
    { type: 'focus', domain: 'figma.com', minutes: 14 },
    { type: 'tab_switch', domain: 'youtube.com' },
    { type: 'distraction', domain: 'youtube.com', minutes: 4 },
    { type: 'tab_switch', domain: 'figma.com' },
    { type: 'focus', domain: 'figma.com', minutes: 10 },
    { type: 'idle', minutes: 5 },
    { type: 'focus', domain: 'figma.com', minutes: 8 },
    { type: 'tab_switch', domain: 'twitter.com' },
    { type: 'distraction', domain: 'twitter.com', minutes: 6 },
    { type: 'tab_switch', domain: 'figma.com' },
    { type: 'idle', minutes: 3 },
    { type: 'focus', domain: 'figma.com', minutes: 2 },
    { type: 'tab_switch', domain: 'reddit.com' },
    { type: 'distraction', domain: 'reddit.com', minutes: 5 },
    { type: 'tab_switch', domain: 'figma.com' },
    { type: 'focus', domain: 'figma.com', minutes: 3 },
  ]),
];

export default mockSessions;
