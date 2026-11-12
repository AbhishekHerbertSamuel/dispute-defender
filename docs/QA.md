# QA results — 12 November 2026

Automated checks do not substitute for browser and actual PayPal testing.

| Scenario | Expected | Result / tester |
|---|---|---|
| Fresh clone + demo startup | Four synthetic cases; clear demo/AI-baseline labels | Pending |
| Search and filters | Correct cases shown; helpful empty state | Pending |
| Complete case review | Timeline and source-backed response | Browser verified: sandbox case and persisted live AI timeline/draft |
| In-transit case | Missing delivery confirmation flag | Live AI + browser verified on explicitly synthetic record |
| Conflicting case | Both sources visible; no unquestioned delivery assertion | Pending |
| Empty case | Review disabled, no fabricated response | Pending |
| Upload UTF-8 TXT | Saved text; prior review/draft invalidated | Pending |
| Upload PDF/image without extractor | Original retained; extraction-needed label | Pending |
| Oversized or invalid upload | Clear rejection, existing case unchanged | Pending |
| Inspect a source | Exact quoted text present in full source | Pending |
| Edit/save/reload draft | Saved text persists | Browser edit/save succeeded; separate HTTP read/export verified persisted exact text |
| Export | Case JSON downloads and clearly says export is not submission | HTTP 200, attachment filename, saved draft and not-submission notice verified |
| Demo submission | No PayPal submission available | Pending |
| Mobile 390px / desktop | Readable controls; no horizontal overflow | Pending |
| Keyboard | Visible focus, reachable controls, Escape closes dialogs | Pending |
| Hosted login | Wrong password rejected, correct password works, logout revokes session | Pending |
| Real AI service | Real output, invalid references rejected, no silent fallback | Live review succeeded; invalid-reference/fallback rejection covered by automated tests |
| Sandbox sync/import | Actual PayPal case details displayed | Passed: actual PP-R-AGU-10200241 API import and browser display |
| Valid sandbox submission | Accepted receipt and corresponding PayPal state | Blocked by PayPal state: UNDER_REVIEW, evidence action unavailable; disabled UI and explanatory notice verified |
| Stale approval / duplicate click | Rejected or disabled | Pending |
| PayPal timeout after write | Unknown state, no blind retry | Pending |

Local server now runs on port 8788. All 27 automated tests, typecheck and production build passed after the product changes. Rows still marked Pending have not been manually verified; automated coverage is not being presented as browser validation. No additional paid AI calls were made for this product/QA pass.
