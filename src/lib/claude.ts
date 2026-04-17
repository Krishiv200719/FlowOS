// ═══════════════════════════════════════════════════════════
// FlowOS — AI Insights via Gemini API
// File kept as claude.ts so existing imports do not break.
// Uses VITE_GEMINI_API_KEY from .env
// ═══════════════════════════════════════════════════════════

import type { FocusSession, AIInsights } from '../types';
import { preprocessSessionsByHour } from './patterns';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY ?? '';
}

async function callGemini(prompt: string, systemInstruction: string, jsonMode = true): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not set in .env');

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

export async function getAIInsights(sessions: FocusSession[]): Promise<AIInsights> {
  if (sessions.length === 0) throw new Error('No sessions to analyze');

  const hourlyData = preprocessSessionsByHour(sessions);
  const sessionSummaries = sessions.slice(-10).map((s) => ({
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

  const systemInstruction = `You are FlowOS, a brutally honest AI attention coach. Analyze focus session data and surface deeply personalized insights. Be specific and direct. Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation.`;

  const prompt = `Analyze these ${sessions.length} focus sessions and return personalized insights.

Sessions: ${JSON.stringify(sessionSummaries)}
Hourly patterns: ${JSON.stringify(hourlyData)}

Return ONLY this exact JSON structure:
{
  "peakHours": "9am–11am",
  "realFocusRatio": 0.38,
  "topDistractor": "YouTube (avg 14 min/session)",
  "keyInsight": "73% of your distractions happen in the last 20 minutes of your sessions",
  "tomorrowWindow": "9:15 AM – 11:00 AM",
  "weeklyTrend": "improving",
  "coachMessage": "Your mornings are gold. Protect them like meetings you cannot miss."
}`;

  const text = await callGemini(prompt, systemInstruction, true);
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean) as AIInsights;
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AIInsights;
    throw new Error('Failed to parse Gemini response as JSON');
  }
}
