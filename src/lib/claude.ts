// ═══════════════════════════════════════════════════════════
// FlowOS — Claude AI-Powered Focus DNA Analysis
// BUG #3: Switched from Gemini to Claude API
// ═══════════════════════════════════════════════════════════

import type { FocusSession, AIInsights } from '../types';
import { preprocessSessionsByHour } from './patterns';

export async function getAIInsights(sessions: FocusSession[]): Promise<AIInsights> {
  if (sessions.length === 0) throw new Error('No sessions available for analysis');

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are FlowOS, a brutally honest AI attention coach. You analyze 
focus session data and surface deeply personalized, specific insights. You are 
direct and tell people truths about their patterns they have never noticed.
CRITICAL: Respond ONLY with a valid JSON object. No markdown. No backticks. 
No explanation. No preamble. Pure JSON only.`,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${sessions.length} focus sessions and return personalized insights.

Session data: ${JSON.stringify(sessionSummaries)}
Hourly patterns: ${JSON.stringify(hourlyData)}

Return ONLY this exact JSON structure (no other text):
{
  "peakHours": "9am–11am",
  "realFocusRatio": 0.38,
  "topDistractor": "YouTube (avg 14 min/session)",
  "keyInsight": "one specific surprising personal insight — something specific about THEIR pattern they haven't noticed, e.g. '73% of your distractions happen in the last 20 minutes of your planned sessions'",
  "tomorrowWindow": "9:15 AM – 11:00 AM",
  "weeklyTrend": "improving",
  "coachMessage": "1-2 sentence direct coaching message, specific and actionable"
}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content
    .filter((item: any) => item.type === 'text')
    .map((item: any) => item.text)
    .join('');

  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean) as AIInsights;
  } catch {
    // Try to extract JSON object
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AIInsights;
    throw new Error('Failed to parse Claude response as JSON');
  }
}
