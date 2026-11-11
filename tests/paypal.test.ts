import test from 'node:test';
import assert from 'node:assert/strict';
import { PayPal, PayPalError, PAYPAL_BASE, assertSubmittable, normalizeDispute } from '../apps/api/src/paypal.ts';
export const raw = { dispute_id: 'PP-D-100', reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', status: 'WAITING_FOR_SELLER_RESPONSE', links: [{ rel: 'provide-evidence', method: 'POST', href: `${PAYPAL_BASE}/v1/customer/disputes/PP-D-100/provide-evidence` }], evidences: [{ source: 'REQUESTED_FROM_SELLER', evidence_type: 'PROOF_OF_FULFILLMENT' }], dispute_amount: { value: '10.00', currency_code: 'USD' } };
test('status alone does not grant evidence submission', () => {
    assert.doesNotThrow(() => assertSubmittable(raw));
    assert.throws(() => assertSubmittable({ ...raw, links: [] }));
    assert.throws(() => assertSubmittable({ ...raw, status: 'UNDER_REVIEW' }));
    assert.throws(() => assertSubmittable({ ...raw, evidences: [] }));
    assert.throws(() => assertSubmittable({ ...raw, reason: 'UNAUTHORISED' }));
});
test('normalizer handles missing optional buyer and transaction details', () => {
    const c = normalizeDispute(raw);
    assert.equal(c.buyerName, 'PayPal buyer');
    assert.equal(c.dueAt, null);
    assert.equal(c.canProvideEvidence, true);
});
test('PayPal client uses sandbox and creates multipart file references', async () => {
    let calls = 0;
    const fake: typeof fetch = async (url, init) => {
        assert.ok(String(url).startsWith(PAYPAL_BASE));
        calls++;
        if (String(url).endsWith('/token'))
            return Response.json({ access_token: 'test', expires_in: 3600 });
        if (String(url).endsWith('/provide-evidence')) {
            assert.ok(init?.body instanceof FormData);
            const form = init.body;
            const input = JSON.parse(await (form.get('input') as Blob).text());
            assert.equal(input.evidences[0].documents[0].name, 'evidence-1');
            assert.ok(form.get('evidence-1') instanceof Blob);
            assert.equal(input.evidences[0].evidence_info.tracking_info[0].carrier_name, 'OTHER');
            return Response.json({ links: [] }, { headers: { 'paypal-debug-id': 'test-debug' } });
        }
        return Response.json(raw);
    };
    const p = new PayPal('test', 'test', fake);
    const result = await p.provideEvidence('PP-D-100', 'Reviewed', { approved: true, draftRevision: 1, evidenceVersion: 1, evidenceType: 'PROOF_OF_FULFILLMENT', carrier: 'Example Carrier', trackingNumber: 'TEST100', evidenceIds: ['a'] }, [{ name: 'proof.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-test') }]);
    assert.equal(result.debugId, 'test-debug');
    assert.equal(calls, 3);
});
test('network ambiguity on write is explicitly marked uncertain', async () => {
    const fake: typeof fetch = async (url) => {
        if (String(url).endsWith('/token'))
            return Response.json({ access_token: 'test', expires_in: 3600 });
        if (String(url).endsWith('/provide-evidence'))
            throw new Error('connection reset');
        return Response.json(raw);
    };
    const p = new PayPal('a', 'b', fake);
    await assert.rejects(() => p.provideEvidence('PP-D-100', 'Draft', { approved: true, draftRevision: 1, evidenceVersion: 1, evidenceType: 'PROOF_OF_FULFILLMENT', carrier: 'Test', trackingNumber: 'TEST', evidenceIds: ['a'] }, []), (error: unknown) => error instanceof PayPalError && error.uncertain);
});

test('refresh invalidates drafts when buyer context changes but retains evidence and submission locks', () => {
    const previous = normalizeDispute(raw);
    previous.editedDraft = 'Old response';
    previous.draftRevision = 2;
    previous.submission = { state: 'unknown', at: '2026-11-11', message: 'Check PayPal', packageHash: 'abc' };
    const unchanged = normalizeDispute(raw, previous);
    assert.equal(unchanged.editedDraft, 'Old response');
    const changed = normalizeDispute({ ...raw, messages: [{ posted_by: 'BUYER', content: 'New claim details' }] }, previous);
    assert.equal(changed.editedDraft, '');
    assert.equal(changed.analysis, null);
    assert.equal(changed.evidenceVersion, 1);
    assert.equal(changed.draftRevision, 3);
    assert.deepEqual(changed.evidence, previous.evidence);
    assert.equal(changed.submission?.state, 'unknown');
});
