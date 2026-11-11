import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const mode = process.env.APP_MODE || 'demo';
const provider = process.env.AI_PROVIDER || 'demo';
const checks = [
  ['Frontend build', existsSync('apps/web/dist/index.html')],
  ['Valid app mode', ['demo', 'sandbox'].includes(mode)],
  ['Valid AI provider', ['demo', 'service', 'llm'].includes(provider)],
  ['PayPal credentials (required in sandbox)', mode !== 'sandbox' || !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)],
  ['AI service URL (required for service)', provider !== 'service' || !!process.env.AI_SERVICE_URL],
  ['LLM configuration (required for llm)', provider !== 'llm' || !!(process.env.AI_CHAT_COMPLETIONS_URL && process.env.AI_API_KEY && process.env.AI_MODEL)],
] as const;
console.log(`Node ${process.version}; mode=${mode}; AI=${provider}`);
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'MISSING'}: ${name}`);
console.log('Configuration presence only: no credentials printed and no network requests made. Run npm run build if the frontend build is missing.');
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
