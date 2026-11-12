import { existsSync, readFileSync } from 'node:fs';
import { analyze } from '../packages/ai/src/index.ts';
import type { AnalysisInput } from '../packages/contracts/src/index.ts';
if (existsSync('.env')) process.loadEnvFile('.env');
if (!['llm', 'service'].includes(process.env.AI_PROVIDER || '')) {
  console.error('Set AI_PROVIDER=llm or service and configure credentials. This evaluator will not report demo results as AI accuracy.');
  process.exit(1);
}
const fixtures = JSON.parse(readFileSync('fixtures/eval/cases.json', 'utf8')) as {
  id: string; text: string; expectedDeliveryGap: boolean | null; expectedConflict: boolean; forbiddenClaims: string[]; review: string;
}[];
let passed = 0, checks = 0, errors = 0;
for (const f of fixtures) {
  const input: AnalysisInput = { schemaVersion: '1.0', case: { id: f.id, reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', buyerNote: 'Item not received', transactionId: 'SYNTHETIC' }, evidence: f.text ? [{ id: 'record-1', name: 'Synthetic record', mimeType: 'text/plain', size: Buffer.byteLength(f.text), text: f.text, extractionStatus: 'ready', createdAt: '2026-11-01' }] : [] };
  const started = performance.now();
  try {
    const { content, provider } = await analyze(input);
    const draft = content.draft.map(p => p.text).join('\n\n');
    const results: Record<string, boolean> = {
      conflictFlag: (content.contradictions.length > 0) === f.expectedConflict,
      prohibitedPhrasesAbsent: !f.forbiddenClaims.some(s => draft.toLowerCase().includes(s.toLowerCase())),
      draftLength: draft.length <= 2000,
      emptyEvidenceAbstention: !!f.text || content.draft.length === 0,
    };
    if (f.expectedDeliveryGap !== null) results.deliveryGapHeuristic = content.missingEvidence.some(g => /deliver|fulfill/i.test(g.title + ' ' + g.detail)) === f.expectedDeliveryGap;
    for (const ok of Object.values(results)) { checks++; passed += Number(ok); }
    console.log(JSON.stringify({ caseId: f.id, provider, results, latencyMs: Math.round(performance.now() - started), manualReviewRubric: f.review, output: content }));
  } catch (error) { errors++; console.log(JSON.stringify({ caseId: f.id, error: error instanceof Error ? error.message : 'Failed' })); }
}
console.log(JSON.stringify({ cases: fixtures.length, passed, checks, errors, note: 'Synthetic development set. Keyword and structural checks are heuristics, not semantic accuracy. Review every output against its rubric. No win-rate claim. Extraction accuracy must be evaluated separately against original documents.' }));
if (errors || passed !== checks) process.exitCode = 1;
