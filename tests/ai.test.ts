import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleCases } from '../apps/api/src/fixtures.ts';
import { demoAnalysis } from '../packages/ai/src/index.ts';
import { validateGrounding } from '../packages/contracts/src/index.ts';
test('baseline does not mistake in-transit shipment for delivery', () => {
    const c = exampleCases()[1];
    const a = demoAnalysis({ schemaVersion: '1.0', case: c, evidence: c.evidence });
    assert.ok(a.missingEvidence.some(g => g.title === 'Delivery confirmation missing'));
    assert.ok(!a.draft.some(p => /was delivered/i.test(p.text)));
});
test('inconsistent delivery records are flagged with references to both files', () => {
    const c = exampleCases()[2];
    const a = demoAnalysis({ schemaVersion: '1.0', case: c, evidence: c.evidence });
    assert.equal(a.contradictions.length, 1);
    assert.equal(a.contradictions[0].sources.length, 2);
});
test('unknown and invented quotes are rejected', () => {
    const c = exampleCases()[0];
    const a = demoAnalysis({ schemaVersion: '1.0', case: c, evidence: c.evidence });
    a.draft[0].sources[0].quote = 'Made-up signed delivery confirmation';
    assert.throws(() => validateGrounding(a, c.evidence), /absent/);
    a.draft[0].sources[0].evidenceId = 'unknown';
    assert.throws(() => validateGrounding(a, c.evidence));
});
test('empty case produces no fabricated response', () => {
    const c = exampleCases()[3];
    const a = demoAnalysis({ schemaVersion: '1.0', case: c, evidence: [] });
    assert.deepEqual(a.draft, []);
    assert.ok(a.missingEvidence.length);
});
