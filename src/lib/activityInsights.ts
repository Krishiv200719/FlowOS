// ═══════════════════════════════════════════════════════════
// FlowOS — Activity Insights (via Groq / LLaMA 3.3 70B)
// Analyzes last 2 hours of ambient browser activity.
// Returns a detailed, multi-section coaching report.
// ═══════════════════════════════════════════════════════════

import type { AmbientEntry } from './bridge';
import { callGroq } from './groq';

// ─── Data preparation helpers ────────────────────────────

function buildDomainMap(log: AmbientEntry[]) {
  const map: Record<string, { totalMs: number; visits: number; isDistraction: boolean; firstSeen: number; lastSeen: number }> = {};
  for (const entry of log) {
    if (!map[entry.domain]) {
      map[entry.domain] = { totalMs: 0, visits: 0, isDistraction: entry.isDistraction, firstSeen: entry.timestamp, lastSeen: entry.timestamp };
    }
    map[entry.domain].totalMs += entry.duration;
    map[entry.domain].visits += 1;
    map[entry.domain].lastSeen = Math.max(map[entry.domain].lastSeen, entry.timestamp);
  }
  return map;
}

function detectSwitchPattern(log: AmbientEntry[]): string {
  if (log.length < 3) return 'insufficient data';
  let rapidSwitches = 0;
  for (let i = 1; i < log.length; i++) {
    if (log[i].timestamp - log[i - 1].timestamp < 90000) rapidSwitches++;
  }
  const pct = Math.round((rapidSwitches / (log.length - 1)) * 100);
  if (pct > 60) return `severe context-switching (${pct}% of transitions under 90s)`;
  if (pct > 30) return `moderate context-switching (${pct}% of transitions under 90s)`;
  return `healthy browsing rhythm (only ${pct}% rapid switches)`;
}

function getLongestFocusStreak(log: AmbientEntry[]): { domain: string; minutes: number } {
  let best = { domain: 'none', minutes: 0 };
  let current = { domain: '', ms: 0 };
  for (const entry of log) {
    if (!entry.isDistraction) {
      if (entry.domain === current.domain) {
        current.ms += entry.duration;
      } else {
        if (current.ms > best.minutes * 60000) best = { domain: current.domain, minutes: Math.round(current.ms / 60000) };
        current = { domain: entry.domain, ms: entry.duration };
      }
    } else {
      if (current.ms > best.minutes * 60000) best = { domain: current.domain, minutes: Math.round(current.ms / 60000) };
      current = { domain: '', ms: 0 };
    }
  }
  return best;
}

function getTimelineSegments(log: AmbientEntry[]): string {
  if (log.length === 0) return 'No data';
  const start = log[0].timestamp;
  const end = log[log.length - 1].timestamp;
  const totalMs = end - start;
  if (totalMs <= 0) return 'Single snapshot';

  // Split into 6 segments of ~20 min each
  const segCount = 6;
  const segMs = totalMs / segCount;
  const segments: string[] = [];

  for (let i = 0; i < segCount; i++) {
    const segStart = start + i * segMs;
    const segEnd = segStart + segMs;
    const segEntries = log.filter(e => e.timestamp >= segStart && e.timestamp < segEnd);
    const focusMs = segEntries.filter(e => !e.isDistraction).reduce((s, e) => s + e.duration, 0);
    const distractMs = segEntries.filter(e => e.isDistraction).reduce((s, e) => s + e.duration, 0);
    const total = focusMs + distractMs;
    if (total === 0) {
      segments.push(`Segment ${i + 1}: No activity`);
    } else {
      const focusPct = Math.round((focusMs / total) * 100);
      const label = focusPct >= 70 ? '🟢 Focused' : focusPct >= 40 ? '🟡 Mixed' : '🔴 Distracted';
      segments.push(`Segment ${i + 1} (${new Date(segStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}): ${label} — ${focusPct}% productive`);
    }
  }
  return segments.join('\n');
}

// ─── Main export ─────────────────────────────────────────

export async function getActivityInsights(log: AmbientEntry[]): Promise<string> {
  if (log.length === 0) throw new Error('No activity data');

  const domainMap = buildDomainMap(log);
  const sorted = Object.entries(domainMap)
    .sort(([, a], [, b]) => b.totalMs - a.totalMs)
    .map(([domain, v]) => ({
      domain,
      minutes: Math.round(v.totalMs / 60000),
      visits: v.visits,
      isDistraction: v.isDistraction,
    }));

  const totalMs = log.reduce((s, e) => s + e.duration, 0);
  const distractionMs = log.filter(e => e.isDistraction).reduce((s, e) => s + e.duration, 0);
  const focusMs = totalMs - distractionMs;
  const totalMin = Math.round(totalMs / 60000);
  const distractionMin = Math.round(distractionMs / 60000);
  const focusMin = Math.round(focusMs / 60000);
  const distractionPct = totalMin > 0 ? Math.round((distractionMin / totalMin) * 100) : 0;
  const focusPct = 100 - distractionPct;

  const switchPattern = detectSwitchPattern(log);
  const longestStreak = getLongestFocusStreak(log);
  const timeline = getTimelineSegments(log);

  const topDistractors = sorted
    .filter(d => d.isDistraction)
    .slice(0, 5);

  const topWorkSites = sorted
    .filter(d => !d.isDistraction)
    .slice(0, 5);

  const uniqueTabCount = sorted.length;
  const avgVisitMin = uniqueTabCount > 0 ? Math.round(totalMin / sorted.reduce((s, d) => s + d.visits, 0)) : 0;

  const system = `You are FlowOS — an elite AI focus coach. Your job is to give the most honest, specific, data-driven, and actionable focus analysis a person has ever received.

You MUST:
- Reference EXACT numbers, sites, and time splits from the data — not generic statements
- Diagnose the ROOT CAUSE of their focus problem, not just symptoms
- Give actionable advice tied directly to what you see in their data
- Sound like a world-class performance coach who has studied this person's specific session
- Make the user feel like you truly understand their exact situation
- Be direct and confident — no hedging

Your response MUST be in this exact format (plain text, no markdown, no asterisks, no headers with #):

VERDICT: [1 brutal, honest sentence about their last 2 hours]

WHAT THE DATA SHOWS:
[2-3 sentences analyzing SPECIFIC numbers — exact minutes, exact percentages, exact sites]

YOUR FOCUS PATTERN:
[1-2 sentences on switching behavior and longest streak — name exact domains]

WHERE THE TIME REALLY WENT:
[Specific breakdown of top 2-3 sites with their exact cost in minutes and what that means]

ROOT CAUSE:
[1 sentence diagnosing the core problem — be specific and psychological]

YOUR NEXT 60 MINUTES — DO THIS NOW:
1. [Specific, immediate action tied to their data]
2. [Second specific action]  
3. [Third specific action]

FOCUS FORECAST:
[1-2 sentences: what will happen if they keep this pattern vs. if they fix it — use their specific numbers]`;

  const userMsg = `Here is my browser activity for the last ${totalMin} minutes:

=== TIME SPLIT ===
Total tracked: ${totalMin} min
Focused (non-distraction): ${focusMin} min (${focusPct}%)
Distracted: ${distractionMin} min (${distractionPct}%)

=== TOP DISTRACTION SITES ===
${topDistractors.length > 0
    ? topDistractors.map(d => `${d.domain}: ${d.minutes} min across ${d.visits} visit(s)`).join('\n')
    : 'None detected'}

=== TOP WORK SITES ===
${topWorkSites.length > 0
    ? topWorkSites.map(d => `${d.domain}: ${d.minutes} min across ${d.visits} visit(s)`).join('\n')
    : 'None detected'}

=== SWITCHING BEHAVIOR ===
${switchPattern}
Total unique sites visited: ${uniqueTabCount}
Average time per visit: ${avgVisitMin} min

=== LONGEST FOCUS STREAK ===
${longestStreak.domain !== 'none'
    ? `${longestStreak.domain} for ${longestStreak.minutes} consecutive minutes`
    : 'No sustained focus detected'}

=== 20-MINUTE TIMELINE SEGMENTS ===
${timeline}

Give me a full, specific analysis using the format defined. Do not add any extra sections or markdown formatting.`;

  return callGroq(
    [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ],
    false,  // plain text
    900,
    0.4
  );
}
