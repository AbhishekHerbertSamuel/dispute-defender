/** Shared bounded JSON client. No provider error bodies or secrets enter UI errors. */
export async function chatJson(messages: { role: string; content: unknown }[], env = process.env, request: typeof fetch = fetch): Promise<unknown> {
  if (!env.AI_CHAT_COMPLETIONS_URL || !env.AI_API_KEY || !env.AI_MODEL)
    throw new Error('Configure AI_CHAT_COMPLETIONS_URL, AI_API_KEY and AI_MODEL in .env.');
  const endpoint = new URL(env.AI_CHAT_COMPLETIONS_URL);
  if (endpoint.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(endpoint.hostname) && endpoint.protocol === 'http:'))
    throw new Error('AI endpoint must use HTTPS (HTTP is allowed only on localhost).');
  let response: Response;
  try {
    response = await request(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({ model: env.AI_MODEL, response_format: { type: 'json_object' }, max_completion_tokens: 8000, messages }),
    });
  } catch { throw new Error('AI request timed out or could not connect. No draft was saved.'); }
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}. Check model access, billing and configuration.`);
  const data = await response.json() as any;
  const choice = data.choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice?.message?.refusal || typeof choice?.message?.content !== 'string')
    throw new Error('AI response was incomplete or refused. No draft was saved.');
  try { return JSON.parse(choice.message.content); }
  catch { throw new Error('AI returned invalid JSON. No draft was saved.'); }
}
