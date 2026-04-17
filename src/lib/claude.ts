// ═══════════════════════════════════════════════════════════
// FlowOS — Focus DNA AI Analysis (via Groq / LLaMA 3.3 70B)
// File kept as claude.ts so all existing imports stay intact.
// ═══════════════════════════════════════════════════════════

import type { FocusSession, AIInsights } from '../types';
import { preprocessSessionsByHour } from './patterns';
import { callGroq } from './groq';

export async function getAIInsights(sessions: FocusSession[]): Promise<AIInsights> {
  if (sessions.length === 0) throw new Error('No sessions to analyze');

  // ─── Build rich data payload ────────────────────────────
  const hourlyData = preprocessSessionsByHour(sessions);

  const sessionSummaries = sessions.slice(-15).map((s) => ({
    goal: s.goal,
    plannedMin: s.plannedDuration,
    actualFocusMin: Math.round(s.stats.realFocusTime / 60000),
    distractionMin: Math.round(s.stats.distractionTime / 60000),
    idleMin: Math.round(s.stats.idleTime / 60000),
    focusRatio: Math.round(s.stats.focusRatio * 100),
    tabSwitches: s.stats.tabSwitches,
    avgRecoveryTimeSec: Math.round((s.stats.avgRecoveryTime ?? 0) / 1000),
    topDistractors: (s.stats.topDistractors ?? []).slice(0, 5).map(d => ({
      domain: d.domain,
      minutes: Math.round(d.seconds / 60),
    })),
    hourOfDay: new Date(s.startTime).getHours(),
    dayOfWeek: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(s.startTime).getDay()],
    daysAgo: Math.floor((Date.now() - s.startTime) / 86400000),
  }));

  // Aggregate stats
  const avgFocusRatio = sessions.reduce((s, x) => s + x.stats.focusRatio, 0) / sessions.length;
  const bestSession = sessions.reduce((b, x) => x.stats.focusRatio > b.stats.focusRatio ? x : b);
  const worstSession = sessions.reduce((w, x) => x.stats.focusRatio < w.stats.focusRatio ? x : w);
  const totalFocusHours = Math.round(sessions.reduce((s, x) => s + x.stats.realFocusTime, 0) / 3600000 * 10) / 10;

  // Peak hour detection
  const hourCounts: Record<number, number> = {};
  for (const s of sessions) {
    const h = new Date(s.startTime).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + (s.stats.focusRatio * s.stats.realFocusTime);
  }
  const peakHour = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '9';

  const fmt = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:00 ${ampm}`;
  };

  const system = `You are FlowOS — an elite AI focus coach with deep expertise in cognitive science, behavioral psychology, and peak performance. You analyze focus session data to deliver brutally honest, highly specific, and deeply personalized insights.

Your analysis must:
- Reference EXACT numbers from the data (times, percentages, session counts)
- Identify the SPECIFIC pattern that is holding this user back
- Name EXACT distraction sites and their cost
- Give insights that feel like they were written by someone who watched the user's screen all week
- Use the language of high-performance athletes / elite knowledge workers
- NEVER give generic advice — everything must be tied to their specific data

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation outside the JSON.`;

  const prompt = `Analyze this user's ${sessions.length} focus sessions and generate deeply personalized insights.

=== RAW SESSION DATA ===
${JSON.stringify(sessionSummaries, null, 2)}

=== HOURLY PATTERNS ===
${JSON.stringify(hourlyData, null, 2)}

=== AGGREGATE STATS ===
- Total sessions: ${sessions.length}
- Average focus ratio: ${Math.round(avgFocusRatio * 100)}%
- Total focus time logged: ${totalFocusHours} hours
- Best session: "${bestSession.goal}" at ${Math.round(bestSession.stats.focusRatio * 100)}% focus
- Worst session: "${worstSession.goal}" at ${Math.round(worstSession.stats.focusRatio * 100)}% focus
- Peak productivity hour (weighted): ${fmt(parseInt(peakHour))}

Return ONLY this exact JSON structure — every field must be specific to THIS user's data:
{
  "peakHours": "exact time range like '9:00 AM – 11:00 AM'",
  "realFocusRatio": 0.42,
  "topDistractor": "specific site name with exact cost like 'YouTube — stealing avg 18 min per session'",
  "keyInsight": "1 razor-sharp insight referencing exact numbers and patterns from their data — min 25 words",
  "tomorrowWindow": "specific optimal window for tomorrow like '9:15 AM – 11:30 AM'",
  "weeklyTrend": "improving | declining | stable",
  "coachMessage": "a powerful, personalized 2-3 sentence coaching message that references their specific numbers, sounds like a world-class coach speaking directly to them, and gives them 1 concrete action to take today"
}`;

  const text = await callGroq(
    [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    true,   // JSON mode
    800,
    0.3
  );

  const clean = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean) as AIInsights;
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AIInsights;
    throw new Error('Failed to parse Groq response as JSON');
  }
}
