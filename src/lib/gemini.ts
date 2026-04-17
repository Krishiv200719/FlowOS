import type { FocusSession, AIInsights } from '../types';
import { preprocessSessionsByHour, getPeakHours } from './patterns';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

function getEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ================= RAW STATS =================

function computeRawStats(sessions: FocusSession[]) {
  const avgFocusRatio =
    sessions.reduce((sum, s) => sum + s.stats.focusRatio, 0) / sessions.length;

  const peakHourNums = getPeakHours(sessions);

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

  const morningSessions = sessions.filter(s => {
    const h = new Date(s.startTime).getHours();
    return h >= 6 && h < 12;
  });

  const eveningSessions = sessions.filter(s => {
    const h = new Date(s.startTime).getHours();
    return h >= 18;
  });

  const sorted = [...sessions].sort((a, b) => a.startTime - b.startTime);
  const midpoint = Math.floor(sorted.length / 2);

  const firstHalfAvg =
    sorted.slice(0, midpoint).reduce((s, x) => s + x.stats.focusRatio, 0) /
    Math.max(midpoint, 1);

  const secondHalfAvg =
    sorted.slice(midpoint).reduce((s, x) => s + x.stats.focusRatio, 0) /
    Math.max(sorted.length - midpoint, 1);

  const trendDiff = secondHalfAvg - firstHalfAvg;

  const avgTabSwitches =
    sessions.reduce((s, x) => s + x.stats.tabSwitches, 0) / sessions.length;

  const avgRecoveryMs =
    sessions.reduce((s, x) => s + x.stats.avgRecoveryTime, 0) / sessions.length;

  const totalPlannedMin =
    sessions.reduce((s, x) => s + x.plannedDuration, 0);

  const totalFocusMin =
    sessions.reduce((s, x) => s + x.stats.realFocusTime / 60000, 0);

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

// ================= MAIN FUNCTION =================

export async function getAIInsights(
  sessions: FocusSession[]
): Promise<AIInsights> {
  if (sessions.length === 0) {
    throw new Error('No sessions available for analysis');
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key');
  }

  const rawStats = computeRawStats(sessions);
  const hourlyData = preprocessSessionsByHour(sessions);

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
    hourOfDay: new Date(s.startTime).getHours(),
  }));

  const systemPrompt = `You are FlowOS, a brutally honest AI focus coach. Respond ONLY with JSON.`;

  const userPrompt = `
DATA:
${JSON.stringify(sessionSummaries)}

Return:
{
  "peakHours": "",
  "realFocusRatio": 0,
  "topDistractor": "",
  "keyInsight": "",
  "tomorrowWindow": "",
  "weeklyTrend": "",
  "coachMessage": ""
}
`;

  // FIXED REQUEST BODY (no system_instruction)
  const requestBody = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  let lastError: any = null;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];

    if (i > 0) await delay(2000);

    try {
      console.log(`Trying model: ${model}`);

      const res = await fetch(
        `${getEndpoint(model)}?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        }
      );

      const text = await res.text();

      // HANDLE ERRORS PROPERLY
      if (!res.ok) {
        console.error(`Model ${model} failed:`, res.status, text);

        if (res.status === 404) continue;
        if (res.status === 429 || res.status === 503) continue;

        throw new Error(`Fatal error: ${text}`);
      }

      const data = JSON.parse(text);
      const output = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!output) throw new Error('Empty response');

      return safeParseJSON(output) as AIInsights;

    } catch (err) {
      console.error(`Error with ${model}:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('All models failed');
}

// ================= SAFE PARSER =================

function safeParseJSON(text: string): Record<string, any> {
  try {
    return JSON.parse(text);
  } catch {
    return {
      peakHours: '',
      realFocusRatio: 0,
      topDistractor: '',
      keyInsight: 'Parsing failed',
      tomorrowWindow: '',
      weeklyTrend: '',
      coachMessage: '',
    };
  }
}