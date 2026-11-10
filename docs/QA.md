# Manual QA — fill results, do not assume passing

Automated checks do not substitute for browser and actual PayPal testing.

| Scenario | Expected | Result / tester |
|---|---|---|
| Fresh clone + demo startup | Four synthetic cases; clear demo/AI-baseline labels | Pending |
| Search and filters | Correct cases shown; helpful empty state | Pending |
| Complete case review | Timeline and source-backed response | Pending |
| In-transit case | Missing delivery confirmation flag | Pending |
| Conflicting case | Both sources visible; no unquestioned delivery assertion | Pending |
| Empty case | Review disabled, no fabricated response | Pending |
| Upload UTF-8 TXT | Saved text; prior review/draft invalidated | Pending |
| Upload PDF/image without extractor | Original retained; extraction-needed label | Pending |
| Oversized or invalid upload | Clear rejection, existing case unchanged | Pending |
| Inspect a source | Exact quoted text present in full source | Pending |
| Edit/save/reload draft | Saved text persists | Pending |
| Export | Case JSON downloads and clearly says export is not submission | Pending |
| Demo submission | No PayPal submission available | Pending |
| Mobile 390px / desktop | Readable controls; no horizontal overflow | Pending |
| Keyboard | Visible focus, reachable controls, Escape closes dialogs | Pending |
| Hosted login | Wrong password rejected, correct password works, logout revokes session | Pending |
| Real AI service | Real output, invalid references rejected, no silent fallback | Pending |
| Sandbox sync/import | Actual PayPal case details displayed | Pending |
| Valid sandbox submission | Accepted receipt and corresponding PayPal state | Pending |
| Stale approval / duplicate click | Rejected or disabled | Pending |
| PayPal timeout after write | Unknown state, no blind retry | Pending |

Initial environment restriction: localhost socket creation was denied, so browser/runtime verification could not be completed in that session. API handler tests run in-process; CI also runs the real-HTTP variant.
