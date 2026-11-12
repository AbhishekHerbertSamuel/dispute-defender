# Team handoff

The application foundation is implemented. Do not wait for a separate frontend repo.

## AI stream — implementation now included

The built-in LLM workflow, vision extraction, review pass, tests and evaluation harness are implemented. See `docs/AI_SETUP.md`. Live model validation is recorded in `docs/VALIDATION.md`; remaining work is broader independent quality review; the tasks below remain optional extension guidance.

### Extension guidance

1. Branch `feature/ai-workflow` from `main`.
2. Read `packages/contracts/src/index.ts` and `docs/AI_CONTRACT.md`.
3. Replace/enhance `packages/ai/src/index.ts` or supply an HTTP service with the same output JSON.
4. Add PDF/OCR in `packages/ai/src/extract.ts` or supply `AI_EXTRACT_URL`.
5. Keep `demoAnalysis` as a clearly labelled offline baseline for other teammates.
6. Expand `fixtures/` with independently annotated cases and update `scripts/evaluate.ts`. Report sample size, exact metric and limitations. Never call a four-case synthetic score real-world accuracy.
7. Add tests for no evidence, shipment versus delivery, inconsistent dates/tracking, fabricated references and malicious instructions inside documents.
8. Submit a PR with example request/response JSON and required environment variables. Do not commit secrets.

The backend already stores originals, versions analysis, validates output schemas and checks literal source quotes. You do not need to implement storage, PayPal or the UI.

## Product stream — completed in the shared repository

Merchant journey, scope, screen requirements, warning priorities and acceptance criteria are finalized in `docs/PRODUCT.md`. UI now explains unavailable PayPal submission, offers case refresh, counts contradictions as attention items, disables review without readable evidence and supports dialog keyboard navigation. Manual observations and remaining checks are recorded honestly in `docs/QA.md`.

## Integration / release status

- Credentials configured privately; live AI review and PDF extraction verified.
- Actual sandbox dispute `PP-R-AGU-10200241` created and imported. Live AI review ran against a clearly labelled synthetic shipping document.
- PayPal currently reports UNDER_REVIEW and does not permit proof-of-fulfillment submission. Evidence acceptance remains unverified.
- Local configured app runs at port 8788 in this session; the older demo process remains on 8787.
- Public video, judge access and final Devpost submission still require completion. See `docs/SUBMISSION_CHECKLIST.md`.

## Git workflow

```bash
git clone https://github.com/AbhishekHerbertSamuel/dispute-defender.git
cd dispute-defender
npm ci
cp .env.example .env
git switch -c feature/your-work
npm run dev
# Make changes, then:
npm run check
git add <your-files>
git commit -m "Describe your change"
git push -u origin feature/your-work
```

Open a PR into `main`. If not yet a collaborator, fork the public repository and open a PR from your fork. Direct-push access requires the owner to invite your exact GitHub username; no teammate invitations have been sent automatically.

The root `package.json`, lockfile and shared contract affect everyone. Coordinate changes there. Prefer small commits, and avoid overlapping edits to `apps/web/src/main.tsx` while the backend/AI contract is settling.

## Ready-to-integrate acceptance

- Fresh clone installs and starts using the documented commands.
- Existing tests pass.
- AI output validates without unknown sources or invented quotes.
- Adding evidence invalidates the prior draft and approval.
- Demo cases cannot reach PayPal submission.
- Any unfinished behavior is visibly labelled and documented.
