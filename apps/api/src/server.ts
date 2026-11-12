import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { z, ZodError } from 'zod';
import { Store } from './store.ts';
import { exampleCases } from './fixtures.ts';
import { PayPal, PayPalError, normalizeDispute } from './paypal.ts';
import { analyze } from '../../../packages/ai/src/index.ts';
import { extractEvidence } from '../../../packages/ai/src/extract.ts';
import { EvidenceUploadSchema, SubmitSchema, type DisputeCase, type Evidence } from '../../../packages/contracts/src/index.ts';
class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
type Env = NodeJS.ProcessEnv;
const equal = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
async function body(req: IncomingMessage): Promise<unknown> {
    if (!req.headers['content-type']?.startsWith('application/json'))
        throw new HttpError(415, 'Expected application/json.');
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 7100000)
            throw new HttpError(413, 'Request exceeds upload limit.');
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    catch {
        throw new HttpError(400, 'Invalid JSON body.');
    }
}
export function createApp(env: Env = process.env, dependencies: {
    paypal?: PayPal;
    analyze?: typeof analyze;
} = {}) {
    const mode = env.APP_MODE || 'demo';
    if (mode !== 'demo' && mode !== 'sandbox')
        throw new Error('APP_MODE must be demo or sandbox.');
    const aiProvider = env.AI_PROVIDER || 'demo';
    if (!['demo', 'service', 'llm'].includes(aiProvider))
        throw new Error('AI_PROVIDER must be demo, service or llm.');
    if (env.HOST && !['127.0.0.1', 'localhost', '::1'].includes(env.HOST) && (!env.APP_ACCESS_KEY || env.APP_ACCESS_KEY.length < 16))
        throw new Error('A shared APP_ACCESS_KEY of at least 16 characters is required for non-local hosting.');
    if (env.APP_ACCESS_KEY && !env.APP_ORIGIN)
        throw new Error('Set APP_ORIGIN to the exact browser origin when using authentication.');
    const directory = resolve(env.DATA_DIR || './data');
    const store = new Store(directory, mode);
    for (const c of store.list()) {
        if (c.messageReceipt?.state === 'pending') { c.messageReceipt.state = 'unknown'; c.messageReceipt.message = 'Server restarted during message send. Check PayPal before retrying.'; store.put(c); }
        if (c.submission?.state === 'pending') {
            c.submission.state = 'unknown';
            c.submission.message = 'Server restarted during submission. Check the PayPal case before retrying; acceptance is unknown.';
            store.put(c);
        }
    }
    if (mode === 'demo' && !store.list().length)
        exampleCases().forEach(c => store.put(c));
    const paypal = dependencies.paypal || new PayPal(env.PAYPAL_CLIENT_ID || '', env.PAYPAL_CLIENT_SECRET || '');
    const analyzeCase = dependencies.analyze || analyze;
    const sessions = new Map<string, number>();
    const attempts = new Map<string, {
        count: number;
        expires: number;
    }>();
    const locks = new Set<string>();
    const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    const auth = (req: IncomingMessage) => {
        if (!env.APP_ACCESS_KEY)
            return true;
        const id = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('dd_session='))?.slice(11);
        return !!id && (sessions.get(id) || 0) > Date.now();
    };
    const getCase = (id: string) => { const c = store.get(id); if (!c)
        throw new HttpError(404, 'Case not found.'); return c; };
    const notSubmitting = (c: DisputeCase) => { if (locks.has(c.id) || ['pending', 'unknown'].includes(c.messageReceipt?.state || '') || ['pending', 'unknown', 'succeeded'].includes(c.submission?.state || ''))
        throw new HttpError(409, 'This case is locked after submission or while an operation is running. Review its receipt before proceeding.'); };
    const bytes = async (c: DisputeCase, e: Evidence) => c.source === 'demo' && e.mimeType === 'text/plain' ? Buffer.from(e.text) : readFile(resolve(directory, 'uploads', e.id));
    const handler = async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
        try {
            const url = new URL(req.url || '/', 'http://localhost');
            const path = url.pathname;
            const method = req.method || 'GET';
            const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]', ...(env.APP_ORIGIN ? [new URL(env.APP_ORIGIN).hostname] : [])]);
            if (req.headers.host && !allowedHosts.has(new URL(`http://${req.headers.host}`).hostname))
                throw new HttpError(403, 'Unexpected host header.');
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                const origin = req.headers.origin;
                if (origin && origin !== (env.APP_ORIGIN || 'http://localhost:5173'))
                    throw new HttpError(403, 'Cross-origin mutation rejected.');
            }
            if (path === '/api/health')
                return json(res, 200, { ok: true });
            if (path === '/api/config')
                return json(res, 200, { mode, aiProvider, paypalConfigured: paypal.configured, authenticated: auth(req), requiresLogin: !!env.APP_ACCESS_KEY });
            if (path === '/api/login' && method === 'POST') {
                const key = req.socket.remoteAddress || 'unknown';
                const current = attempts.get(key);
                const entry = current && current.expires > Date.now() ? current : { count: 0, expires: Date.now() + 15 * 60000 };
                if (++entry.count > 10)
                    throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
                attempts.set(key, entry);
                const input = z.object({ password: z.string().max(500) }).parse(await body(req));
                if (!env.APP_ACCESS_KEY || !equal(input.password, env.APP_ACCESS_KEY))
                    throw new HttpError(401, 'Incorrect workspace password.');
                for (const [token, expiry] of sessions)
                    if (expiry < Date.now())
                        sessions.delete(token);
                const token = randomBytes(32).toString('hex');
                sessions.set(token, Date.now() + 8 * 3600000);
                res.setHeader('Set-Cookie', `dd_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
                return json(res, 200, { ok: true });
            }
            if (path.startsWith('/api/') && !auth(req))
                throw new HttpError(401, 'Sign in to this workspace.');
            if (path === '/api/logout' && method === 'POST') {
                const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('dd_session='))?.slice(11);
                if (token)
                    sessions.delete(token);
                res.setHeader('Set-Cookie', 'dd_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
                return json(res, 200, { ok: true });
            }
            if (path === '/api/cases' && method === 'GET')
                return json(res, 200, store.list());
            if (path === '/api/paypal/sync' && method === 'POST') {
                if (mode !== 'sandbox')
                    throw new HttpError(409, 'Switch APP_MODE to sandbox and restart to connect PayPal.');
                const result = await paypal.list();
                let imported = 0;
                for (const item of result.items) {
                    if (locks.has(item.dispute_id))
                        continue;
                    const raw = await paypal.detail(item.dispute_id);
                    if (locks.has(raw.dispute_id))
                        continue;
                    store.put(normalizeDispute(raw, store.get(raw.dispute_id)));
                    imported++;
                }
                return json(res, 200, { imported, hasMore: result.hasMore, message: result.hasMore ? 'Imported the first 50 disputes. Import additional cases by dispute ID.' : `Synced ${imported} disputes.` });
            }
            if (path === '/api/paypal/import' && method === 'POST') {
                if (mode !== 'sandbox')
                    throw new HttpError(409, 'Only available in sandbox mode.');
                const { id } = z.object({ id: z.string().regex(/^[A-Za-z0-9-]{1,255}$/) }).parse(await body(req));
                if (locks.has(id))
                    throw new HttpError(409, 'Case operation in progress.');
                const raw = await paypal.detail(id);
                if (locks.has(id))
                    throw new HttpError(409, 'Case operation in progress.');
                const c = normalizeDispute(raw, store.get(id));
                store.put(c);
                return json(res, 200, c);
            }
            const match = path.match(/^\/api\/cases\/([A-Za-z0-9-]+)(?:\/(.*))?$/);
            if (match) {
                const c = getCase(match[1]);
                const action = match[2] || '';
                if (!action && method === 'GET')
                    return json(res, 200, c);
                if (action === 'audit' && method === 'GET')
                    return json(res, 200, store.events(c.id));
                if (action === 'export' && method === 'GET') {
                    res.setHeader('Content-Disposition', `attachment; filename="${c.id}-evidence-package.json"`);
                    return json(res, 200, { schemaVersion: '1.0', exportedAt: new Date().toISOString(), notice: 'Review package only. Export is not submission to PayPal. Quotes are checked for source presence, not semantic correctness.', case: c, audit: store.events(c.id) });
                }
                const download = action.match(/^evidence\/([a-f0-9-]+)$/);
                if (download && method === 'GET') {
                    const e = c.evidence.find(x => x.id === download[1]);
                    if (!e)
                        throw new HttpError(404, 'Evidence not found.');
                    res.setHeader('Content-Disposition', `attachment; filename="${e.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
                    res.setHeader('Content-Type', e.mimeType);
                    res.setHeader('Cache-Control', 'no-store');
                    return res.end(await bytes(c, e));
                }
                if (action === 'evidence' && method === 'POST') {
                    notSubmitting(c);
                    const input = EvidenceUploadSchema.parse(await body(req));
                    if (c.evidence.length >= 10)
                        throw new HttpError(400, 'Maximum 10 documents per case.');
                    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))
                        throw new HttpError(400, 'Invalid base64 file.');
                    const buffer = Buffer.from(input.base64, 'base64');
                    if (!buffer.length || buffer.length > 5 * 1024 * 1024)
                        throw new HttpError(413, 'Each file must be between 1 byte and 5 MB.');
                    if (input.mimeType === 'application/pdf' && buffer.subarray(0, 5).toString() !== '%PDF-')
                        throw new HttpError(400, 'Invalid PDF signature.');
                    if (input.mimeType === 'image/png' && buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
                        throw new HttpError(400, 'Invalid PNG signature.');
                    if (input.mimeType === 'image/jpeg' && buffer.subarray(0, 3).toString('hex') !== 'ffd8ff')
                        throw new HttpError(400, 'Invalid JPEG signature.');
                    if (input.mimeType === 'text/plain' && (buffer.includes(0) || buffer.toString('utf8').includes('\uFFFD')))
                        throw new HttpError(400, 'Text evidence must be UTF-8 text.');
                    if (input.mimeType === 'text/plain' && buffer.length > 60000)
                        throw new HttpError(413, 'Text evidence is limited to 60 KB; split large documents.');
                    const extraction = await extractEvidence(input.name, input.mimeType, buffer, env);
                    const e: Evidence = { id: randomUUID(), name: basename(input.name).replace(/[\r\n]/g, ''), mimeType: input.mimeType, size: buffer.length, ...extraction, createdAt: new Date().toISOString() };
                    await mkdir(resolve(directory, 'uploads'), { recursive: true });
                    await writeFile(resolve(directory, 'uploads', e.id), buffer, { mode: 0o600 });
                    const latest = getCase(c.id);
                    notSubmitting(latest);
                    if (latest.evidence.length >= 10)
                        throw new HttpError(409, 'Document limit reached. Refresh the case.');
                    latest.evidence.push(e);
                    latest.evidenceVersion++;
                    latest.analysis = null;
                    latest.editedDraft = '';
                    latest.draftRevision++;
                    store.put(latest);
                    store.audit(c.id, 'Evidence uploaded; previous analysis and draft invalidated.');
                    return json(res, 201, latest);
                }
                if (action === 'analyze' && method === 'POST') {
                    notSubmitting(c);
                    if (!c.evidence.length)
                        throw new HttpError(400, 'Add evidence before running a review.');
                    locks.add(c.id);
                    try {
                        const result = await analyzeCase({ schemaVersion: '1.0', case: { id: c.id, reason: c.reason, buyerNote: c.buyerNote, transactionId: c.transactionId }, evidence: c.evidence }, env);
                        c.analysis = { ...result.content, provider: result.provider, generatedAt: new Date().toISOString(), evidenceVersion: c.evidenceVersion };
                        c.editedDraft = c.analysis.draft.map(p => p.text).join('\n\n');
                        c.draftRevision++;
                        store.put(c);
                        store.audit(c.id, `Review generated with ${result.provider} provider.`);
                        return json(res, 200, c);
                    }
                    finally {
                        locks.delete(c.id);
                    }
                }
                if (action === 'draft' && method === 'PUT') {
                    notSubmitting(c);
                    const input = z.object({ text: z.string().max(2000), draftRevision: z.number().int() }).parse(await body(req));
                    const latest = getCase(c.id);
                    notSubmitting(latest);
                    if (latest.draftRevision !== input.draftRevision)
                        throw new HttpError(409, 'Draft changed. Refresh before saving.');
                    latest.editedDraft = input.text;
                    latest.draftRevision++;
                    store.put(latest);
                    store.audit(c.id, 'Merchant saved response draft.');
                    return json(res, 200, latest);
                }
                if (action === 'message' && method === 'POST') {
                    notSubmitting(c);
                    if (mode !== 'sandbox' || c.source !== 'sandbox') throw new HttpError(409, 'Only sandbox inquiries can receive messages.');
                    const approval = z.object({ approved: z.literal(true), draftRevision: z.number().int().nonnegative() }).parse(await body(req));
                    const latest = getCase(c.id);
                    notSubmitting(latest);
                    if (approval.draftRevision !== latest.draftRevision) throw new HttpError(409, 'Draft changed. Save and review the current draft.');
                    if (!latest.canSendMessage) throw new HttpError(409, 'Refresh PayPal; inquiry messaging is unavailable.');
                    if (!latest.editedDraft.trim() || latest.editedDraft.length > 2000) throw new HttpError(400, 'Message must contain 1–2000 characters.');
                    const hash = createHash('sha256').update(latest.editedDraft).digest('hex');
                    if (latest.messageReceipt?.state === 'succeeded' && latest.messageReceipt.packageHash === hash) throw new HttpError(409, 'This message was already sent.');
                    locks.add(c.id);
                    latest.messageReceipt = { state: 'pending', at: new Date().toISOString(), message: 'Sending approved inquiry message.', packageHash: hash };
                    store.put(latest);
                    store.audit(c.id, 'Merchant approved inquiry message; sandbox send started.');
                    try {
                        const result = await paypal.sendMessage(c.id, latest.editedDraft);
                        latest.messageReceipt = { state: 'succeeded', at: new Date().toISOString(), message: 'PayPal sandbox accepted the inquiry message. No evidence attachments were sent.', debugId: result.debugId, packageHash: hash };
                        store.put(latest); store.audit(c.id, 'PayPal sandbox accepted inquiry message.');
                        return json(res, 200, latest);
                    } catch (error) {
                        latest.messageReceipt = { state: error instanceof PayPalError && error.uncertain ? 'unknown' : 'failed', at: new Date().toISOString(), message: error instanceof PayPalError ? error.message : 'Message failed before acceptance could be confirmed.', packageHash: hash };
                        store.put(latest); store.audit(c.id, `Inquiry message ${latest.messageReceipt.state}.`); throw error;
                    } finally { locks.delete(c.id); }
                }
                if (action === 'submit' && method === 'POST') {
                    notSubmitting(c);
                    if (mode !== 'sandbox' || c.source !== 'sandbox')
                        throw new HttpError(409, 'Demo cases cannot be submitted to PayPal.');
                    const approval = SubmitSchema.parse(await body(req));
                    const latest = getCase(c.id);
                    notSubmitting(latest);
                    if (approval.evidenceVersion !== latest.evidenceVersion || approval.draftRevision !== latest.draftRevision || latest.analysis?.evidenceVersion !== latest.evidenceVersion)
                        throw new HttpError(409, 'Evidence or draft changed. Regenerate and review before approval.');
                    if (!latest.editedDraft.trim() || latest.editedDraft.length > 2000)
                        throw new HttpError(400, 'Response must contain 1–2000 characters.');
                    if (latest.analysis.provider === 'demo')
                        throw new HttpError(409, 'Connect an AI provider and regenerate before sandbox submission. Demo baseline submissions are disabled.');
                    const selected = approval.evidenceIds.map(id => latest.evidence.find(e => e.id === id));
                    if (new Set(approval.evidenceIds).size !== approval.evidenceIds.length || selected.some(e => !e))
                        throw new HttpError(400, 'Invalid or duplicate evidence selection.');
                    if (selected.some(e => !['application/pdf', 'image/png', 'image/jpeg'].includes(e!.mimeType)))
                        throw new HttpError(400, 'Submit original PDF, PNG or JPEG documents. Text transcripts remain review-only.');
                    if (selected.reduce((sum, e) => sum + e!.size, 0) > 5 * 1024 * 1024)
                        throw new HttpError(400, 'Keep the total submitted attachments under 5 MB.');
                    locks.add(c.id);
                    const hash = createHash('sha256').update(JSON.stringify({ approval, draft: latest.editedDraft })).digest('hex');
                    latest.submission = { state: 'pending', at: new Date().toISOString(), message: 'Submitting approved evidence to PayPal sandbox.', packageHash: hash };
                    store.put(latest);
                    store.audit(c.id, 'Merchant approved evidence package; sandbox submission started.');
                    try {
                        const files = await Promise.all(selected.map(async (e) => ({ name: e!.name, mimeType: e!.mimeType, bytes: await bytes(latest, e!) })));
                        const result = await paypal.provideEvidence(c.id, latest.editedDraft, approval, files);
                        latest.submission = { state: 'succeeded', at: new Date().toISOString(), message: 'PayPal sandbox accepted the evidence. This is not a dispute outcome.', debugId: result.debugId, packageHash: hash };
                        latest.canProvideEvidence = false;
                        store.put(latest);
                        store.audit(c.id, 'PayPal sandbox accepted evidence.');
                        return json(res, 200, latest);
                    }
                    catch (error) {
                        const uncertain = error instanceof PayPalError && error.uncertain;
                        latest.submission = { state: uncertain ? 'unknown' : 'failed', at: new Date().toISOString(), message: error instanceof PayPalError ? error.message : 'Submission failed before acceptance could be confirmed.', debugId: error instanceof PayPalError ? error.debugId : undefined, packageHash: hash };
                        store.put(latest);
                        store.audit(c.id, `Sandbox submission ${latest.submission.state}.`);
                        throw error;
                    }
                    finally {
                        locks.delete(c.id);
                    }
                }
            }
            if (path.startsWith('/api/'))
                throw new HttpError(404, 'API route not found.');
            if (method !== 'GET' && method !== 'HEAD')
                throw new HttpError(405, 'Method not allowed.');
            const root = resolve('apps/web/dist');
            const requested = resolve(root, '.' + path);
            if (requested !== root && !requested.startsWith(root + '/'))
                throw new HttpError(404, 'Not found.');
            let file: Buffer;
            let extension = extname(requested);
            try {
                file = await readFile(requested);
            }
            catch {
                file = await readFile(resolve(root, 'index.html'));
                extension = '.html';
            }
            const contentType: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
            res.setHeader('Content-Type', contentType[extension] || 'application/octet-stream');
            res.end(method === 'HEAD' ? undefined : file);
        }
        catch (error) {
            if (res.headersSent)
                return res.end();
            const status = error instanceof HttpError || error instanceof PayPalError ? error.status : error instanceof ZodError ? 400 : 500;
            const message = error instanceof ZodError ? `Invalid input: ${error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}` : error instanceof Error ? error.message : 'Unexpected error.';
            // No raw PayPal payloads, document contents, credentials or model output in logs.
            json(res, status, { error: message, ...(error instanceof PayPalError ? { debugId: error.debugId } : {}) });
        }
    };
    const server = createServer(handler);
    server.on('close', () => store.close());
    return { server, store, handler };
}
