# Merchant journey — Princess's working area

## Audience and scope

A small merchant handling an item-not-received PayPal dispute for a physical product. One merchant account, sandbox only. The product helps assemble and review evidence; it does not adjudicate claims or guarantee a win.

## Journey

| Stage | Merchant question | UI / acceptance criteria |
|---|---|---|
| Inbox | What needs my attention? | Searchable cases with amount, evidence state and response date when provided |
| Case | What is the buyer saying? | Clearly attributed buyer message, transaction and status |
| Evidence | What records do I have? | Upload, inspect and download originals; extraction limitations visible |
| Review | What do these records establish? | Timeline, gaps, possible contradictions and source quotes |
| Response | What am I sending? | Editable text, explicit original attachments and tracking details |
| Approval | Did I check it? | Saved current draft and deliberate approval before sandbox write |
| Receipt | Did PayPal accept it? | Actual success/error/unknown state; no fake dispute outcome |

## Product decisions to refine

- Which missing evidence deserves the strongest warning?
- Is source inspection understandable without technical vocabulary?
- Can a first-time merchant complete the flow without assistance?
- Are empty, loading, failed and unavailable actions explained well?

Keep all demo badges and limitations honest. PDF/image extraction requires the AI stream. No performance claims without measured results and denominators.
