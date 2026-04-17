// ═══════════════════════════════════════════════════════════
// FlowOS — Gemini-Powered Focus DNA Analysis
// All analysis is done by Gemini API using real session data.
// Data-computed stats are provided as context for Gemini.
// ═══════════════════════════════════════════════════════════

import type { FocusSession, AIInsights } from '../types';
import { preprocessSessionsByHour, getPeakHours } from './patterns';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Model fallback chain — ordered by rate limit availability
// gemini-2.0-flash-lite has the highest free-tier RPM
const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

function getEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════
// Compute raw stats from data (used as context for Gemini)
// ═══════════════════════════════════════════════════════════

function computeRawStats(sessions: FocusSession[]) {
  // Average focus ratio
  const avgFocusRatio =
    sessions.reduce((sum, s) => sum + s.stats.focusRatio, 0) / sessions.length;

  // Peak hours
  const peakHourNums = getPeakHours(sessions);

  // Aggregate distractors
  const distractorTotals: Record<string, { totalSec: number; count: number }> = {};
  for (const s of sessions) {
    for (const d of s.stats.topDistractors) {
      if (!distractorTotals[d.domain]) {
        distractorTotals[d.domain] = { totalSec: 0, count: 0 };
      }
      distractorTotals[d.domain].totalSec += d.seconds;
      distractorTotals[d.domain].count++;
    }
  }
  const sortedDistractors = Object.entries(distractorTotals)
    .sort(([, a], [, b]) => b.totalSec - a.totalSec);

  // Morning vs evening
  const morningSessions = sessions.filter(s => {
    const h = new Date(s.startTime).getHours();
    return h >= 6 && h < 12;
  });
  const eveningSessions = sessions.filter(s => {
    const h = new Date(s.startTime).getHours();
    return h >= 18;
  });

  // Trend
  const sorted = [...sessions].sort((a, b) => a.startTime - b.startTime);
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalfAvg = sorted.slice(0, midpoint).reduce((s, x) => s + x.stats.focusRatio, 0) / Math.max(midpoint, 1);
  const secondHalfAvg = sorted.slice(midpoint).reduce((s, x) => s + x.stats.focusRatio, 0) / Math.max(sorted.length - midpoint, 1);
  const trendDiff = secondHalfAvg - firstHalfAvg;

  // Avg tab switches + recovery
  const avgTabSwitches = sessions.reduce((s, x) => s + x.stats.tabSwitches, 0) / sessions.length;
  const avgRecoveryMs = sessions.reduce((s, x) => s + x.stats.avgRecoveryTime, 0) / sessions.length;

  // Total planned vs actual
  const totalPlannedMin = sessions.reduce((s, x) => s + x.plannedDuration, 0);
  const totalFocusMin = sessions.reduce((s, x) => s + x.stats.realFocusTime / 60000, 0);

  return {
    avgFocusRatio,
    peakHourNums,
    sortedDistractors,
    morningSessions,
    eveningSessions,
    trendDiff,
    avgTabSwitches,
    avgRecoveryMs,
    totalPlannedMin,
    totalFocusMin,
    sessionCount: sessions.length,
  };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API — Gemini-powered analysis
// ═══════════════════════════════════════════════════════════

export async function getAIInsights(
  sessions: FocusSession[]
): Promise<AIInsights> {
  if (sessions.length === 0) {
    throw new Error('No sessions available for analysis');
  }

  const rawStats = computeRawStats(sessions);
  const hourlyData = preprocessSessionsByHour(sessions);

  // Build comprehensive data summary for Gemini
  const sessionSummaries = sessions.map((s) => ({
    goal: s.goal,
    plannedMin: s.plannedDuration,
    actualFocusMin: Math.round(s.stats.realFocusTime / 60000),
    distractionMin: Math.round(s.stats.distractionTime / 60000),
    idleMin: Math.round(s.stats.idleTime / 60000),
    focusRatio: Math.round(s.stats.focusRatio * 100),
    tabSwitches: s.stats.tabSwitches,
    avgRecoveryTimeSec: Math.round(s.stats.avgRecoveryTime / 1000),
    topDistractors: s.stats.topDistractors.slice(0, 5),
    startTime: new Date(s.startTime).toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }),
    hourOfDay: new Date(s.startTime).getHours(),
    dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(s.startTime).getDay()],
  }));

  // Pre-computed stats for Gemini context
  const computedContext = {
    totalSessions: rawStats.sessionCount,
    overallFocusRatio: Math.round(rawStats.avgFocusRatio * 100),
    totalPlannedMinutes: Math.round(rawStats.totalPlannedMin),
    totalActualFocusMinutes: Math.round(rawStats.totalFocusMin),
    totalMinutesLost: Math.round(rawStats.totalPlannedMin - rawStats.totalFocusMin),
    avgTabSwitchesPerSession: Math.round(rawStats.avgTabSwitches),
    avgRecoveryTimeSeconds: Math.round(rawStats.avgRecoveryMs / 1000),
    trendDirection: rawStats.trendDiff > 0.05 ? 'improving' : rawStats.trendDiff < -0.05 ? 'declining' : 'stable',
    morningSessionCount: rawStats.morningSessions.length,
    eveningSessionCount: rawStats.eveningSessions.length,
    morningAvgFocusPct: rawStats.morningSessions.length > 0
      ? Math.round(rawStats.morningSessions.reduce((s, x) => s + x.stats.focusRatio, 0) / rawStats.morningSessions.length * 100)
      : null,
    eveningAvgFocusPct: rawStats.eveningSessions.length > 0
      ? Math.round(rawStats.eveningSessions.reduce((s, x) => s + x.stats.focusRatio, 0) / rawStats.eveningSessions.length * 100)
      : null,
    hourlyPatterns: hourlyData,
    bestSession: sessions.reduce((a, b) => a.stats.focusRatio > b.stats.focusRatio ? a : b),
    worstSession: sessions.reduce((a, b) => a.stats.focusRatio < b.stats.focusRatio ? a : b),
  };

  const bestSessionInfo = {
    goal: computedContext.bestSession.goal,
    focusPct: Math.round(computedContext.bestSession.stats.focusRatio * 100),
    time: new Date(computedContext.bestSession.startTime).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
  };

  const worstSessionInfo = {
    goal: computedContext.worstSession.goal,
    focusPct: Math.round(computedContext.worstSession.stats.focusRatio * 100),
    time: new Date(computedContext.worstSession.startTime).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
  };

  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY not set. Add it to your .env file.');
  }

  const systemPrompt = `You are FlowOS, a brutally honest AI focus coach. You analyze REAL focus session data from a user's Chrome extension. Every insight must reference specific numbers from the data provided. Never make up statistics — only use what's in the data.

You are direct, specific, and tell people uncomfortable truths about their focus habits. Your insights should feel personal and surprising — not generic advice.

CRITICAL RULES:
1. Every claim must be backed by the actual numbers in the data
2. Reference specific sessions, times, and domains from the data
3. The "keyInsight" should be something surprising the user hasn't noticed — a pattern, a correlation, or a hidden cost
4. The "coachMessage" should be actionable and reference their best session's conditions
5. All numbers in your response must come directly from the data — do not round differently or fabricate

Respond ONLY with valid JSON. No markdown, no backticks, no commentary.`;

  const userPrompt = `Analyze this user's REAL focus session data and provide deeply personalized insights.

=== SESSION DATA (${computedContext.totalSessions} sessions) ===
${JSON.stringify(sessionSummaries, null, 2)}

=== PRE-COMPUTED STATISTICS ===
- Overall focus ratio: ${computedContext.overallFocusRatio}%
- Total planned: ${computedContext.totalPlannedMinutes} min, Actual focus: ${computedContext.totalActualFocusMinutes} min
- Total time lost: ${computedContext.totalMinutesLost} min
- Avg tab switches per session: ${computedContext.avgTabSwitchesPerSession}
- Avg recovery time after distraction: ${computedContext.avgRecoveryTimeSeconds} seconds
- Trend: ${computedContext.trendDirection}
${computedContext.morningAvgFocusPct !== null ? `- Morning sessions (${computedContext.morningSessionCount}): avg ${computedContext.morningAvgFocusPct}% focus` : ''}
${computedContext.eveningAvgFocusPct !== null ? `- Evening sessions (${computedContext.eveningSessionCount}): avg ${computedContext.eveningAvgFocusPct}% focus` : ''}
- Best session: "${bestSessionInfo.goal}" at ${bestSessionInfo.time} (${bestSessionInfo.focusPct}%)
- Worst session: "${worstSessionInfo.goal}" at ${worstSessionInfo.time} (${worstSessionInfo.focusPct}%)

=== HOURLY PATTERNS ===
${JSON.stringify(computedContext.hourlyPatterns, null, 2)}

Return this EXACT JSON structure with values derived ONLY from the data above:
{
  "peakHours": "the specific time range when this user focuses best based on the data",
  "realFocusRatio": <the actual decimal focus ratio from the data e.g. 0.05>,
  "topDistractor": "the #1 distractor domain with specific time data e.g. 'YouTube (26 min total across 4 sessions)'",
  "keyInsight": "a specific, data-backed surprising insight about their focus patterns — reference actual numbers",
  "tomorrowWindow": "specific recommended time window for tomorrow based on their peak hours",
  "weeklyTrend": "${computedContext.trendDirection}",
  "coachMessage": "a direct, personal 1-2 sentence coaching message referencing their best session conditions"
}`;

  const requestBody = JSON.stringify({
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 2048,
      temperature: 0.3,
    },
  });

  // Try each model in the fallback chain with delays
  let lastError: Error | null = null;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];

    // Wait before retry (not on first attempt)
    if (i > 0) {
      console.log(`[FlowOS] Waiting 3s before trying next model...`);
      await delay(3000);
    }

    try {
      console.log(`[FlowOS] Trying Gemini model: ${model}`);

      const response = await fetch(`${getEndpoint(model)}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      if (response.status === 503 || response.status === 429) {
        console.warn(`[FlowOS] ${model} unavailable (${response.status}), trying next...`);
        lastError = new Error(`${model} returned ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Empty Gemini response');
      }

      const insights = safeParseJSON(text);

      if (!insights.peakHours || !insights.keyInsight || !insights.coachMessage) {
        throw new Error('Incomplete Gemini response');
      }

      console.log(`[FlowOS] ✓ Insights loaded from ${model}`);
      return insights as AIInsights;
    } catch (err) {
      console.error(`[FlowOS] ${model} failed:`, err);
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error('All Gemini models unavailable. Wait a minute and retry.');
}

/**
 * Safely parse JSON from Gemini, repairing common issues like
 * truncated strings, markdown wrappers, or trailing commas.
 */
function safeParseJSON(text: string): Record<string, any> {
  // 1. Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }

  // 2. Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Continue to repair
  }

  // 3. Try to fix truncated JSON (missing closing quotes/braces)
  let repaired = cleaned;

  // Count unmatched quotes — if odd, add a closing quote
  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  // Remove trailing comma before closing brace
  repaired = repaired.replace(/,\s*$/, '');

  // Ensure closing brace
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  try {
    return JSON.parse(repaired);
  } catch (_) {
    // Continue to more aggressive repair
  }

  // 4. Extract individual fields with regex as last resort
  const extract = (key: string): string | number | null => {
    // Try string value
    const strMatch = repaired.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (strMatch) return strMatch[1];
    // Try numeric value
    const numMatch = repaired.match(new RegExp(`"${key}"\\s*:\\s*([\\d.]+)`));
    if (numMatch) return parseFloat(numMatch[1]);
    return null;
  };

  return {
    peakHours: extract('peakHours') || 'Unable to determine',
    realFocusRatio: extract('realFocusRatio') || 0,
    topDistractor: extract('topDistractor') || 'Unable to determine',
    keyInsight: extract('keyInsight') || 'Unable to parse AI insight — try refreshing.',
    tomorrowWindow: extract('tomorrowWindow') || 'Unable to determine',
    weeklyTrend: extract('weeklyTrend') || 'stable',
    coachMessage: extract('coachMessage') || 'Try refreshing for a new analysis.',
  };
}

