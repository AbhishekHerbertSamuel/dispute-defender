# Validation — 12 November 2026

## Verified

- `npm run check`: TypeScript, all 27 deterministic tests and production Vite build passed.
- PayPal sandbox OAuth and dispute-list API succeeded with configured merchant credentials. The list contained zero disputes at that check.
- A USD 20 sandbox goods-and-services payment to the configured merchant succeeded. Buyer transaction: `8HB40087P22627148`. This used generated sandbox accounts and funding; no real money or goods.
- Live `gpt-4.1-mini` review completed six synthetic development cases without provider/schema errors in the final run. Five cases used model calls; the empty case correctly abstained before any call.
- Live PDF transcription passed a one-page synthetic smoke test, preserving tracking ID, in-transit status and amount. This is not an OCR benchmark.

## Live review results

The final run passed 26 of 29 keyword/structural checks. The evaluator deliberately exits nonzero when any check fails. These are development fixtures used during iteration, not an independent test set or an accuracy estimate.

- Delivered and normal-progression cases raised optional recipient-confirmation gaps. The broad delivery-gap heuristic marked both as failures. The model can over-request evidence even when a delivery record exists.
- The in-transit case failed the forbidden-phrase check because its draft said it had **no evidence confirming** that the package “was delivered.” Manual inspection shows a negated statement, not an assertion of delivery. The substring evaluator does not understand negation.
- Conflicting simultaneous tracking statuses were flagged; ordinary chronological progression was not called a contradiction.
- The embedded-instruction fixture was excluded from input and flagged. This regex-based filter is incomplete and is not a prompt-injection guarantee.
- Empty evidence returns no draft. Literal quotation checks do not prove that every clause is supported or that a document is authentic. Some draft paragraphs cite only part of their factual content; merchant review remains necessary.

## Still unverified / pending

- Creation and import of an actual sandbox dispute, followed by PayPal acceptance of evidence. The payment exists, but opening the dispute form was interrupted; subsequent browser retry reached an expired login session.
- Live image extraction and broader scanned/multipage PDF evaluation.
- Final browser walkthrough against the restarted app and configured real provider.
- Hosted judge access or a verified judge setup, public demo video, team/form completion and final Devpost submission.

Keep synthetic examples clearly labelled. Do not claim production readiness, dispute win rate, perfect grounding or complete end-to-end PayPal acceptance from these checks.
