// ═══════════════════════════════════════════════════════════
// FlowOS — Groq API Utility
// Central call function used by both DNA and Activity analysis.
// Model: llama-3.3-70b-versatile (fastest, highest quality free tier)
// Endpoint: https://api.groq.com/openai/v1/chat/completions
// ═══════════════════════════════════════════════════════════

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';

function getGroqKey(): string {
  return (import.meta.env.VITE_GROQ_API_KEY as string) ?? '';
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Call Groq API.
 * @param messages  Chat messages array
 * @param jsonMode  If true, forces response_format: {type:'json_object'}
 * @param maxTokens Max tokens for the response
 */
export async function callGroq(
  messages: GroqMessage[],
  jsonMode = false,
  maxTokens = 1200,
  temperature = 0.35
): Promise<string> {
  const key = getGroqKey();
  if (!key) throw new Error('VITE_GROQ_API_KEY is not set in .env');

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Groq API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty response from Groq');
  return text;
}
