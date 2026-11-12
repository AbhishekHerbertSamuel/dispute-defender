# Merchant journey and MVP requirements

## Product goal

Help a small merchant turn scattered order, shipping and conversation records into a reviewable response to an item-not-received PayPal dispute. The merchant retains responsibility for deciding what is accurate and what to submit. The app never decides who should win.

## Scope

One merchant, physical goods, item-not-received disputes, PayPal sandbox. TXT, PDF, PNG and JPEG evidence; maximum ten documents, 5 MB each. PDF/image transcription requires configured AI. No production payment writes, refunds, multi-merchant OAuth, automatic dispute decisions or automatic replies.

## Merchant journey and acceptance criteria

| Stage | Information and action | Acceptance criteria |
|---|---|---|
| Enter workspace | Sign in if workspace authentication is enabled; see sandbox/demo label | Secrets remain on server; failures explain the problem without exposing keys |
| Find case | Sync PayPal, import known ID, search title/ID/buyer, filter reviewed/unreviewed | Amount, evidence state and deadline shown; absent deadline says Not provided; empty search has recovery guidance |
| Understand dispute | Open case; read reason, buyer statement, transaction and PayPal status | Buyer allegations explicitly attributed; actual API data distinguished from synthetic fixtures |
| Gather evidence | Upload originals, inspect extracted text, download originals | Unreadable text never supports drafting; adding evidence invalidates earlier analysis/approval; review unavailable without readable evidence |
| Review facts | Read summary, chronological timeline, evidence gaps and conflicts | Each cited event opens its supporting source; conflicting records remain visible; shipment is not proof of delivery |
| Draft response | Inspect generated paragraphs and citations; edit and save | Maximum 2,000 characters; edited text requires human verification; saved text persists; changes invalidate approval |
| Prepare submission | Select original PDF/image attachments; enter verified carrier/tracking; approve | Current saved draft, current evidence version, explicit approval and PayPal action availability required |
| Handle unavailable action | Explain why PayPal submission is unavailable; refresh case or export | No enabled submit button when PayPal does not permit proof of fulfillment; export clearly distinguished from submission |
| Confirm result | Read accepted, failed or unknown receipt | Acceptance is not a win; uncertain writes are locked against blind retry; no fabricated success |

## Information priorities

1. Critical: conflicting evidence, unreadable or missing delivery proof, suspicious document instructions, uncertain submission.
2. Warning: incomplete corroboration, missing order/address information or extraction limitations. Optional corroboration must not be presented as a universal PayPal requirement.
3. Informational: synthetic data, sandbox environment, missing API deadline, export-only state.

Inbox counts describe review state, not dispute outcomes. Cases with contradictions need attention even when no missing-evidence flag exists. The case page keeps amount, status, deadline and buyer statement visible alongside the current task.

## Empty, loading and failure states

- No cases: explain Sync PayPal / import by ID.
- No matching search: permit clearing the query and changing filter.
- No readable evidence: keep review disabled; upload readable material or a transcript.
- AI failure: show error, preserve originals and previous persisted data; no silent rule-based fallback.
- Saving/uploading/reviewing: visible progress and disabled duplicate actions.
- PayPal not accepting evidence: prominent explanation, Refresh PayPal and Export package.
- Missing deadline: do not invent one or show an inaccurate countdown.
- Unknown submission: reconcile in PayPal before another attempt; do not auto-retry.

## Accessibility and responsive behavior

Controls have labels and visible focus. Dialogs close with Escape, constrain Tab navigation and restore focus. Layout must remain readable at 390px width and desktop. Source inspection must expose full extracted text and distinguish the selected quote; users must compare recognition-sensitive fields with the original.

## Demo narrative

A test merchant receives a sandbox dispute, imports it, uploads a clearly labelled synthetic shipping record, reviews AI output and missing delivery proof, inspects a quote, edits/saves a response and exports the review package. Show actual PayPal acceptance only when the sandbox enables the action and returns success. See DEMO.md and VALIDATION.md for verified boundaries.

## Next release

Independent annotated evaluation, stronger semantic grounding, representative scanned-document testing, multi-merchant authentication and operational reconciliation. These are outside the hackathon MVP, not hidden completed features.

## Inquiry reply flow

When PayPal exposes a send_message action in the INQUIRY stage, Response offers a separate text-only buyer reply. Save and review the response, approve the inquiry message, then send. Tracking and attachments are not required for this action. Manual replies are supported without an AI call. The app rechecks PayPal permission before writing, records acceptance separately from evidence submission and blocks duplicate text or retries after an uncertain result.
