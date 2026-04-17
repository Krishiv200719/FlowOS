// ═══════════════════════════════════════════════════════════
// FlowOS — Activity Insights via Gemini API
// Analyzes last 2 hours of ambient browser activity
// ═══════════════════════════════════════════════════════════

import type { AmbientEntry } from './bridge';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function getActivityInsights(log: AmbientEntry[]): Promise<string> {
  if (log.length === 0) throw new Error('No activity data');

  const key = import.meta.env.VITE_GEMINI_API_KEY ?? '';
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not set in .env');

  const domainMap: Record<string, { totalMin: number; isDistraction: boolean }> = {};
  for (const entry of log) {
    if (!domainMap[entry.domain]) {
      domainMap[entry.domain] = { totalMin: 0, isDistraction: entry.isDistraction };
    }
    domainMap[entry.domain].totalMin += entry.duration / 60000;
  }

  const summary = Object.entries(domainMap)
    .sort(([, a], [, b]) => b.totalMin - a.totalMin)
    .map(([domain, v]) => ({ domain, minutes: Math.round(v.totalMin), isDistraction: v.isDistraction }));

  const totalMin = summary.reduce((s, d) => s + d.minutes, 0);
  const distractionMin = summary.filter(d => d.isDistraction).reduce((s, d) => s + d.minutes, 0);
  const pct = totalMin > 0 ? Math.round((distractionMin / totalMin) * 100) : 0;

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: `You are FlowOS, a no-nonsense focus coach. Give a short, honest, direct analysis of the user's last 2 hours of browser activity. Maximum 120 words. Plain text only — no markdown, no bullets, no headers. 2-3 short paragraphs.`,
        }],
      },
      contents: [{
        role: 'user',
        parts: [{
          text: `My browser activity for the last 2 hours:

Total tracked: ${totalMin} minutes
Time on distraction sites: ${distractionMin} minutes (${pct}%)

Sites visited (by time):
${summary.map(d => `${d.domain}: ${d.minutes}min${d.isDistraction ? ' [DISTRACTION]' : ''}`).join('\n')}

Tell me honestly what this pattern shows and give me 2-3 specific things I should do right now to get back to productive work.`,
        }],
      }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Could not generate analysis.';
}
