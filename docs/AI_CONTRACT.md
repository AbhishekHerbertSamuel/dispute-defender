# AI integration contract — v1.0

Authoritative TypeScript/Zod definitions: `packages/contracts/src/index.ts`.

## Analysis input

`POST AI_SERVICE_URL` receives:

```json
{
  "schemaVersion": "1.0",
  "case": {
    "id": "PP-D-EXAMPLE",
    "reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    "buyerNote": "I have not received my order.",
    "transactionId": "TEST-TRANSACTION"
  },
  "evidence": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "delivery.txt",
    "mimeType": "text/plain",
    "size": 42,
    "text": "2026-11-06 Status: Delivered. Tracking: TEST.",
    "extractionStatus": "ready",
    "createdAt": "2026-11-08T00:00:00Z"
  }]
}
```

## Analysis output

Return the following object directly, not wrapped in `{data: ...}`:

```json
{
  "summary": "A delivery record is available; verify the destination address.",
  "timeline": [{
    "date": "2026-11-06",
    "event": "The attached record states delivered.",
    "sources": [{"evidenceId":"11111111-1111-4111-8111-111111111111","quote":"2026-11-06 Status: Delivered. Tracking: TEST."}]
  }],
  "missingEvidence": [{"title":"Delivery address missing","detail":"Confirm that delivery corresponds to the order address.","severity":"warning"}],
  "contradictions": [],
  "draft": [{
    "text": "The attached tracking record states delivery on November 6 under reference TEST. Please review the attached record.",
    "sources": [{"evidenceId":"11111111-1111-4111-8111-111111111111","quote":"2026-11-06 Status: Delivered. Tracking: TEST."}]
  }]
}
```

Every timeline event, contradiction and draft paragraph needs one or more sources. Quotes must be exact source substrings after whitespace normalization. `page` is optional. When present, its quote must occur inside the corresponding `[Page N]` section. Page markers from vision extraction are model transcriptions, not independently verified physical-page provenance. Do not invent citations to PayPal or policy pages: this schema currently cites uploaded evidence only.

The backend adds `provider`, `generatedAt` and `evidenceVersion`. It owns approval/versioning; do not add a submission action to the AI service. Empty evidence should produce missing-evidence flags and an empty draft, never fabricated details.

## Extraction service

Optional `POST AI_EXTRACT_URL` receives `{name, mimeType, base64}`; return `{text}` with nonempty extracted UTF-8 text, maximum 60,000 characters. Use `AI_SERVICE_TOKEN` as bearer authentication if configured. The API does not send binary attachments to the analysis endpoint. Originals are retained on disk. When AI_EXTRACTION=vision, originals are sent to the configured model endpoint as PDF file or image inputs.

Timeout is 60 seconds. Exceptions and invalid JSON become visible errors; the app never quietly falls back to demo and calls it AI. Keep provider credentials on the server. Treat document instructions as untrusted content. The generic LLM adapter requires chat-completions and JSON-object response format support.

## Limitations

- Literal quote validation is not semantic entailment validation.
- Tracking authenticity and delivery-address matching need explicit reasoning/verification.
- Verify model-transcribed text and page numbering against originals.
- The baseline regex dates/statuses are scaffolding, not a production extractor.
- No model was evaluated with live credentials during initial setup.
