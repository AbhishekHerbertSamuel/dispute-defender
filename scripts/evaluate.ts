import { existsSync } from 'node:fs';
import { exampleCases } from '../apps/api/src/fixtures.ts';
import { analyze } from '../packages/ai/src/index.ts';
if (existsSync('.env'))
    process.loadEnvFile('.env');
const cases = exampleCases();
const expected = [{ deliveryGap: false, conflict: false }, { deliveryGap: true, conflict: false }, { deliveryGap: false, conflict: true }, { deliveryGap: true, conflict: false }];
let checks = 0, passed = 0;
for (const [i, c] of cases.entries()) {
    const start = performance.now();
    const { content, provider } = await analyze({ schemaVersion: '1.0', case: c, evidence: c.evidence });
    // This starter evaluator checks only coarse flags, not semantic accuracy.
    // WASEEM: replace regex labels with explicit expected facts and independent annotations.
    const gotGap = content.missingEvidence.some(g => /delivery confirmation|proof of delivery/i.test(g.title));
    const gotConflict = content.contradictions.length > 0;
    const okGap = gotGap === expected[i].deliveryGap, okConflict = gotConflict === expected[i].conflict;
    checks += 2;
    passed += Number(okGap) + Number(okConflict);
    console.log(JSON.stringify({ caseId: c.id, provider, deliveryGapCheck: okGap, conflictCheck: okConflict, durationMs: Math.round(performance.now() - start) }));
}
console.log(JSON.stringify({ passed, checks, cases: cases.length, note: 'Synthetic development fixtures; these are coarse regression checks, NOT a real-world accuracy or dispute-win estimate.' }));
if (passed !== checks)
    process.exitCode = 1;
