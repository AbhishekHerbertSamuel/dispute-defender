# Validation — 12 November 2026

## Verified

- `npm run check`: TypeScript, all 27 deterministic tests and production Vite build passed.
- PayPal sandbox OAuth and dispute-list API succeeded with configured merchant credentials. The list contained zero disputes at that check.
- A USD 20 sandbox goods-and-services payment to the configured merchant succeeded. Buyer transaction: `8HB40087P22627148`. This used generated sandbox accounts and funding; no real money or goods.
- Live `gpt-4.1-mini` review completed six synthetic development cases without provider/schema errors in the final run. Five cases used model calls; the empty case correctly abstained before any call.
- Live PDF transcription passed a one-page synthetic smoke test, preserving tracking ID, in-transit status and amount. This is not an OCR benchmark.

- Actual sandbox dispute `PP-R-AGU-10200241` was created, retrieved through merchant credentials and imported into the app. Browser displayed the API case and completed a live AI review of a clearly labelled synthetic in-transit record. The model identified that the record was synthetic and did not establish actual delivery.

## Live review results

The final run passed 26 of 29 keyword/structural checks. The evaluator deliberately exits nonzero when any check fails. These are development fixtures used during iteration, not an independent test set or an accuracy estimate.

- Delivered and normal-progression cases raised optional recipient-confirmation gaps. The broad delivery-gap heuristic marked both as failures. The model can over-request evidence even when a delivery record exists.
- The in-transit case failed the forbidden-phrase check because its draft said it had **no evidence confirming** that the package “was delivered.” Manual inspection shows a negated statement, not an assertion of delivery. The substring evaluator does not understand negation.
- Conflicting simultaneous tracking statuses were flagged; ordinary chronological progression was not called a contradiction.
- The embedded-instruction fixture was excluded from input and flagged. This regex-based filter is incomplete and is not a prompt-injection guarantee.
- Empty evidence returns no draft. Literal quotation checks do not prove that every clause is supported or that a document is authentic. Some draft paragraphs cite only part of their factual content; merchant review remains necessary.

## Still unverified / pending

- PayPal acceptance of evidence remains unverified: case PP-R-AGU-10200241 is UNDER_REVIEW and does not expose permission to provide proof of fulfillment.
- Live image extraction and broader scanned/multipage PDF evaluation.
- Remaining browser checks are tracked in QA.md.
- Hosted judge access or a verified judge setup, public demo video, team/form completion and final Devpost submission.

Keep synthetic examples clearly labelled. Do not claim production readiness, dispute win rate, perfect grounding or complete end-to-end PayPal acceptance from these checks.

## Inquiry messaging implementation

Added text-only inquiry replies through `/send-message`, with explicit approval, saved-draft version checks, a current PayPal action check, duplicate protection, persisted receipts and unknown-result locking. Action normalization accepts PayPal's observed underscore names as well as hyphenated names.

Read-only live API check returned INQUIRY / WAITING_FOR_BUYER_RESPONSE and a POST send_message action after the merchant's website reply. All 29 tests passed in both in-process and real HTTP modes; typecheck and build passed. Tests use mocked PayPal responses and make no paid AI calls.

Live sending from the app remains unverified: a subsequent tool operation reported PayPal network access blocked by environment policy. No new message was sent by this implementation. The earlier merchant reply was sent through PayPal's website by the user.

API reference: https://developer.paypal.com/api/disputes/
