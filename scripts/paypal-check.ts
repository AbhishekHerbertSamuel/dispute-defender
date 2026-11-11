import { existsSync } from 'node:fs';
import { PayPal, PayPalError, normalizeDispute } from '../apps/api/src/paypal.ts';
if (existsSync('.env')) process.loadEnvFile('.env');
const paypal = new PayPal(process.env.PAYPAL_CLIENT_ID || '', process.env.PAYPAL_CLIENT_SECRET || '');
try {
  if (!paypal.configured) throw new Error('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your local .env first.');
  const id = process.argv[2];
  if (id) {
    const c = normalizeDispute(await paypal.detail(id));
    console.log(JSON.stringify({ source: 'sandbox', status: c.status, reason: c.reason, canProvideEvidence: c.canProvideEvidence, requestedEvidenceTypes: c.requestedEvidenceTypes, hasTransactionId: !!c.transactionId, hasResponseDeadline: !!c.dueAt }, null, 2));
  } else {
    const result = await paypal.list();
    console.log(JSON.stringify({ source: 'sandbox', returnedDisputes: result.items.length, hasMore: result.hasMore }, null, 2));
  }
  console.log('Read-only sandbox check passed. No evidence submitted; no case data changed.');
} catch (error) {
  console.error(error instanceof PayPalError ? error.message : 'Sandbox check failed. Check credentials, Node version and network access.');
  process.exitCode = 1;
}
