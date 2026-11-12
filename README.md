# Dispute Defender

A single-merchant workspace that turns scattered records into a traceable, editable PayPal dispute response. Built for the PayPal AI Hackathon 2026.

**Current status:** locally runnable hackathon MVP. Live AI review and PayPal sandbox case import were tested; an app-originated inquiry reply was confirmed in PayPal’s Resolution Centre. Formal delivery-evidence submission remains unverified. Runs without credentials in clearly labelled demo mode. Real AI and sandbox calls require your server credentials. The rule-based demo is not an AI model and alone does not satisfy the hackathon's AI requirement.

## Start in five minutes

Use Node **22.13+** (Node 22 LTS recommended) and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API runs on http://127.0.0.1:8787. Four synthetic cases are seeded on first demo startup: complete delivery record, missing proof, inconsistent tracking, and no evidence.

For the production build locally:

```bash
npm run build
APP_ORIGIN=http://localhost:8787 npm start
```

Open http://localhost:8787. PowerShell users should set `$env:APP_ORIGIN="http://localhost:8787"` before `npm start`.

## What works

- Responsive dispute inbox, search and review filters.
- Persistent SQLite case records and originals on disk, with demo/sandbox separation.
- Upload TXT/PDF/PNG/JPEG (5 MB each, ten documents per case).
- UTF-8 text extraction and optional model-based PDF/image transcription; a synthetic PDF extraction was tested live. Broad OCR accuracy has not been established.
- Timeline, evidence gaps, potential contradictions, source quote inspection.
- Editable saved drafts, review-package JSON export, original-file download.
- AI adapters: explicit demo baseline, external team service, or chat-completions-compatible LLM.
- Source IDs and quoted text checked server-side. This does **not** verify semantic entailment.
- Sandbox OAuth, list/import disputes, approved inquiry messaging, and a separate case-gated multipart evidence-submission implementation.
- Explicit merchant approval and version checks; duplicate/uncertain writes blocked.
- Shared-password access for hosted demos, HttpOnly sessions, origin/host checks and upload validation.

## Team: start here

| Area | Owner / location |
|---|---|
| AI reasoning and drafting | Waseem: `packages/ai/src/index.ts` |
| Extraction / OCR | Waseem: `packages/ai/src/extract.ts` |
| Shared contract | `packages/contracts/src/index.ts`; coordinate changes |
| Product journey, manual QA, demo narrative | Princess: `docs/PRODUCT.md`, `docs/QA.md`, `docs/DEMO.md` |
| Frontend | `apps/web/src/` |
| Backend, PayPal, persistence | `apps/api/src/` |
| Evaluation starter | `scripts/evaluate.ts`, `fixtures/` |

Read [TEAM_HANDOFF](docs/TEAM_HANDOFF.md) and [AI_CONTRACT](docs/AI_CONTRACT.md) before changing interfaces. Use feature branches and PRs; do not replace the app with a separate project.

## Configuration

See `.env.example` for all variables. Never place API keys in frontend variables or commit `.env`.

### PayPal

Set `APP_MODE=sandbox`, `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET`, then restart. Use Connections → import an existing sandbox dispute or Sync PayPal. There is intentionally **no production-payment mode**. Inquiry replies require an eligible case and a current messaging action. Formal evidence submission supports only the implemented proof-of-fulfillment workflow when eligible.

Read [PAYPAL_SETUP](docs/PAYPAL_SETUP.md). Sandbox import and inquiry messaging were verified live. Formal evidence submission remains unverified; automated tests use a fake PayPal transport.

### AI

- `AI_PROVIDER=demo`: deterministic development baseline; no model/network call.
- `AI_PROVIDER=service`: POST the typed analysis input to `AI_SERVICE_URL`; optional bearer `AI_SERVICE_TOKEN`.
- `AI_PROVIDER=llm`: set `AI_CHAT_COMPLETIONS_URL`, `AI_API_KEY`, `AI_MODEL`. Endpoint must implement chat completions and JSON-object response format. GPT-4.1 mini was exercised with real credentials on synthetic evidence; generated output can still fail source validation.
- Optional `AI_EXTRACT_URL` receives `{name,mimeType,base64}` and returns `{text}` for PDF/image uploads. Alternatively set `AI_EXTRACTION=vision` with the configured model; without either extraction option, originals remain stored with `needs-extraction`, and TXT transcripts can be added for review.

Uploaded evidence is transmitted only to the configured AI/extraction services when those operations run. Use synthetic/test records for the hackathon.

## Checks

```bash
npm run check
npm run eval
TEST_HTTP=true npm test
```

Default API tests call the actual handler in-process; `TEST_HTTP=true` runs the same integration suite over localhost HTTP. CI runs both. Eval results are coarse regression checks on four synthetic development fixtures, not real-world model accuracy.

## Deploy

Use the included Dockerfile on a Node/Docker host with **persistent disk**. Set `HOST=0.0.0.0`, a long random `APP_ACCESS_KEY` (at least 16 characters), `APP_ORIGIN` to the exact HTTPS origin, and `COOKIE_SECURE=true`. Set `DATA_DIR` to the mounted disk. Use one app instance (sessions/locks are process-local). Keep API/AI secrets in the host's secret settings.

For local Docker, copy `.env.example`, set a long `APP_ACCESS_KEY`, then run `docker compose up --build`. Open http://localhost:8787. No paid service is provisioned by this repository.

Do not put this Node/SQLite application on a static-only host or an ephemeral serverless filesystem. Read [DEPLOYMENT](docs/DEPLOYMENT.md).

## Known boundaries

This is a hackathon MVP, not a production multi-tenant service. No automatic refunds, carrier verification, win probabilities, policy adjudication, user account management or background webhooks. The first sync imports up to 50 cases; import further cases individually. A successful evidence response means PayPal accepted the package, **not** that the dispute was won. Unknown/pending submissions stay locked for manual reconciliation in PayPal; do not blindly reset/retry them. Broad PDF/image extraction evaluation and independent semantic evaluation remain outstanding.

## Submission

See [SUBMISSION_CHECKLIST](docs/SUBMISSION_CHECKLIST.md). Deadline: 13 November 2026, 01:30 IST. The demo must show genuine PayPal + AI functionality before submitting. Keep the demo available and freeze linked submission materials according to organizer instructions.

MIT licensed. No affiliation with or endorsement by PayPal is implied.

## Integration checks

Use Node 22.13+ (`nvm install && nvm use` reads `.nvmrc`). `npm start` and `npm run dev` now reject older Node versions with an actionable message.

- `npm run doctor`: checks local configuration presence without printing secrets or contacting providers.
- `npm run paypal:check`: verifies sandbox OAuth and dispute-list access without submitting evidence.
- `npm run paypal:check -- PP-D-YOUR-ID`: checks a known dispute's status and submission eligibility without printing buyer details.

For the built app, run `npm run build` then `npm start` and visit http://localhost:8787. For frontend development use `npm run dev` and the Vite URL. When configuring APP_ORIGIN, use the exact URL opened in your browser.

Refreshing a PayPal claim with changed buyer context, transaction, reason or status clears the old analysis/draft and requires fresh review. Stored evidence and submission receipts remain intact.

Full integration testing requires server-side AI and PayPal sandbox credentials. No hosted deployment is provided. Automated tests alone do not establish live-provider success; the separately observed live result is inquiry-message acceptance, not evidence-attachment acceptance.

## Built-in AI workflow

The AI stream is implemented: vision PDF/image transcription, grounded drafting, a separate model review pass, one bounded repair attempt, and source/page validation. Follow [AI_SETUP.md](docs/AI_SETUP.md) to enable it. No separate Python service is required. `npm run eval:ai` exercises six synthetic cases against your configured real provider; mock tests and demo scores are not real-model accuracy.
