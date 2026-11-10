import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../apps/api/src/server.ts';
import { exampleCases } from '../apps/api/src/fixtures.ts';
import { demoAnalysis } from '../packages/ai/src/index.ts';
import { PayPal, PayPalError } from '../apps/api/src/paypal.ts';
import type { DisputeCase } from '../packages/contracts/src/index.ts';
async function setup(env: NodeJS.ProcessEnv = {}, dependencies: Parameters<typeof createApp>[1] = {}) {
    const directory = await mkdtemp(join(tmpdir(), 'dd-test-'));
    const app = createApp({ DATA_DIR: directory, APP_MODE: 'demo', ...env }, dependencies);
    // In-process dispatch also runs inside environments that prohibit opening ports.
    // CI can set TEST_HTTP=true to exercise the exact same tests over real HTTP.
    const overHttp = process.env.TEST_HTTP === 'true';
    if (overHttp) {
        app.server.listen(0, '127.0.0.1');
        await once(app.server, 'listening');
    }
    const call = async (path: string, method = 'GET', value?: unknown, cookie?: string): Promise<Response> => {
        if (overHttp) {
            const address = app.server.address() as {
                port: number;
            };
            return fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: value === undefined ? undefined : JSON.stringify(value) });
        }
        const req = Object.assign(Readable.from(value === undefined ? [] : [Buffer.from(JSON.stringify(value))]), { url: `/api${path}`, method, headers: { 'content-type': 'application/json', cookie }, socket: { remoteAddress: '127.0.0.1' } }) as unknown as IncomingMessage;
        const headers = new Headers();
        let status = 200;
        let output = '';
        const res = { headersSent: false, setHeader(key: string, value: string) { headers.set(key, value); }, writeHead(code: number, extra: Record<string, string>) { status = code; Object.entries(extra).forEach(([k, v]) => headers.set(k, v)); }, end(value?: string | Buffer) { output = value?.toString() || ''; } } as unknown as ServerResponse;
        await app.handler(req, res);
        return new Response(output, { status, headers });
    };
    const close = async () => { if (overHttp) {
        app.server.closeAllConnections();
        await new Promise<void>(r => app.server.close(() => r()));
    }
    else
        app.store.close(); await rm(directory, { recursive: true, force: true }); };
    return { ...app, call, close };
}
test('demo flow persists review, rejects stale saves, invalidates analysis after upload, and blocks PayPal writes', async () => {
    const app = await setup();
    try {
        const cases = await (await app.call('/cases')).json() as DisputeCase[];
        assert.equal(cases.length, 4);
        const id = cases[0].id;
        let response = await app.call(`/cases/${id}/analyze`, 'POST', {});
        assert.equal(response.status, 200);
        let c = await response.json() as DisputeCase;
        assert.equal(c.analysis?.provider, 'demo');
        assert.ok(c.editedDraft);
        response = await app.call(`/cases/${id}/draft`, 'PUT', { text: 'Edited', draftRevision: c.draftRevision - 1 });
        assert.equal(response.status, 409);
        response = await app.call(`/cases/${id}/draft`, 'PUT', { text: 'Edited', draftRevision: c.draftRevision });
        assert.equal(response.status, 200);
        response = await app.call(`/cases/${id}/evidence`, 'POST', { name: '../proof.txt', mimeType: 'text/plain', base64: Buffer.from('2026-11-09 Status: Delivered.').toString('base64') });
        assert.equal(response.status, 201);
        c = await response.json() as DisputeCase;
        assert.equal(c.analysis, null);
        assert.equal(c.editedDraft, '');
        assert.equal(c.evidence.at(-1)?.name, 'proof.txt');
        response = await app.call(`/cases/${id}/submit`, 'POST', {});
        assert.equal(response.status, 409);
        const exported = await (await app.call(`/cases/${id}/export`)).json();
        assert.match(exported.notice, /not submission/);
    }
    finally {
        await app.close();
    }
});
test('authentication protects cases and rejects bad credentials', async () => {
    const app = await setup({ APP_ACCESS_KEY: 'a-long-test-password', APP_ORIGIN: 'http://localhost:5173' });
    try {
        assert.equal((await app.call('/cases')).status, 401);
        assert.equal((await app.call('/login', 'POST', { password: 'wrong' })).status, 401);
        const r = await app.call('/login', 'POST', { password: 'a-long-test-password' });
        assert.equal(r.status, 200);
        const cookie = r.headers.get('set-cookie')!.split(';')[0];
        assert.equal((await app.call('/cases', 'GET', undefined, cookie)).status, 200);
        await app.call('/logout', 'POST', {}, cookie);
        assert.equal((await app.call('/cases', 'GET', undefined, cookie)).status, 401);
    }
    finally {
        await app.close();
    }
});
test('invalid file signature and empty-evidence analysis are rejected', async () => {
    const app = await setup();
    try {
        const r = await app.call('/cases/DEMO-1042/evidence', 'POST', { name: 'bad.pdf', mimeType: 'application/pdf', base64: Buffer.from('not a pdf').toString('base64') });
        assert.equal(r.status, 400);
        assert.equal((await app.call('/cases/DEMO-1045/analyze', 'POST', {})).status, 400);
    }
    finally {
        await app.close();
    }
});
test('sandbox submit requires current approval and prevents duplicate submission', async () => {
    const fake = new PayPal('a', 'b');
    let submissions = 0;
    fake.provideEvidence = async () => { submissions++; return { data: {}, debugId: 'test' }; };
    const app = await setup({ APP_MODE: 'sandbox' }, { paypal: fake, analyze: async (input) => ({ content: demoAnalysis(input), provider: 'service' }) });
    try {
        const c = exampleCases()[0];
        c.id = 'PP-D-100';
        c.source = 'sandbox';
        c.canProvideEvidence = true;
        app.store.put(c);
        let r = await app.call(`/cases/${c.id}/evidence`, 'POST', { name: 'proof.pdf', mimeType: 'application/pdf', base64: Buffer.from('%PDF-test').toString('base64') });
        assert.equal(r.status, 201);
        r = await app.call(`/cases/${c.id}/analyze`, 'POST', {});
        const analyzed = await r.json() as DisputeCase;
        const approval = { approved: true, draftRevision: analyzed.draftRevision, evidenceVersion: analyzed.evidenceVersion, evidenceType: 'PROOF_OF_FULFILLMENT', carrier: 'Carrier', trackingNumber: 'TEST100', evidenceIds: [analyzed.evidence.at(-1)!.id] };
        r = await app.call(`/cases/${c.id}/submit`, 'POST', { ...approval, draftRevision: 0 });
        assert.equal(r.status, 409);
        r = await app.call(`/cases/${c.id}/submit`, 'POST', approval);
        assert.equal(r.status, 200);
        assert.equal((await r.json()).submission.state, 'succeeded');
        r = await app.call(`/cases/${c.id}/submit`, 'POST', approval);
        assert.equal(r.status, 409);
        assert.equal(submissions, 1);
    }
    finally {
        await app.close();
    }
});
test('uncertain submission stays locked rather than automatically retrying', async () => {
    const fake = new PayPal('a', 'b');
    fake.provideEvidence = async () => { throw new PayPalError('Timed out', 502, undefined, true); };
    const app = await setup({ APP_MODE: 'sandbox' }, { paypal: fake, analyze: async (input) => ({ content: demoAnalysis(input), provider: 'service' }) });
    try {
        const c = exampleCases()[0];
        c.id = 'PP-D-101';
        c.source = 'sandbox';
        c.canProvideEvidence = true;
        app.store.put(c);
        await app.call(`/cases/${c.id}/evidence`, 'POST', { name: 'proof.pdf', mimeType: 'application/pdf', base64: Buffer.from('%PDF-test').toString('base64') });
        const analyzed = await (await app.call(`/cases/${c.id}/analyze`, 'POST', {})).json() as DisputeCase;
        const approval = { approved: true, draftRevision: analyzed.draftRevision, evidenceVersion: analyzed.evidenceVersion, evidenceType: 'PROOF_OF_FULFILLMENT', carrier: 'Carrier', trackingNumber: 'TEST101', evidenceIds: [analyzed.evidence.at(-1)!.id] };
        assert.equal((await app.call(`/cases/${c.id}/submit`, 'POST', approval)).status, 502);
        assert.equal(app.store.get(c.id)?.submission?.state, 'unknown');
        assert.equal((await app.call(`/cases/${c.id}/submit`, 'POST', approval)).status, 409);
    }
    finally {
        await app.close();
    }
});
