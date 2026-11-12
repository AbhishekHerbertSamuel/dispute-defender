# Enable the built-in AI workflow

No separate AI server is required. Keep keys only in your local `.env` or hosting secrets. A ChatGPT browser session does not configure API access.

1. Copy `.env.example` to `.env` only if it does not already exist.
2. Set these values using a model available in your own API account:

```dotenv
AI_PROVIDER=llm
AI_CHAT_COMPLETIONS_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=your-private-api-key
AI_MODEL=your-enabled-model
AI_EXTRACTION=vision
AI_VISION_MODEL=your-enabled-vision-model
```

The endpoint is configurable. It must support Chat Completions JSON-object output, `max_completion_tokens` and system messages. Vision extraction additionally requires `image_url` data URLs for PNG/JPEG and `file.file_data` PDF inputs. Not every compatible provider supports PDFs. Leave AI_VISION_MODEL blank to use AI_MODEL. `AI_EXTRACT_URL`, if set, takes precedence over vision extraction.

3. Run `npm run doctor`, then restart the app. You can use `APP_MODE=demo` with real AI for synthetic cases; demo PayPal writes remain blocked.
4. Upload readable evidence. Vision transcribes each page, preserving page markers. Unreadable/partial extraction is flagged rather than treated as evidence. Files uploaded before extraction was configured need a new upload.
5. Run review. The model generates the structured timeline, gaps, conflicts and draft. Schema, literal quotes, readable-source references, page references and the 2,000-character draft budget are checked. One repair attempt is allowed. A second model call independently reviews the candidate; its output is validated again.
6. Inspect every quote and compare extracted text with the original before approving. The critic uses the same configured model and can repeat its mistakes; it does not establish authenticity or guarantee semantic correctness.

## Evaluation

- `npm test`: deterministic integration tests with mocked provider responses, including malformed JSON, truncation, fabricated citations, page mismatch and incomplete extraction.
- `npm run eval`: existing four-case rule baseline regression suite.
- `npm run eval:ai`: six synthetic cases using actual provider calls; prints outputs, timings and heuristic checks for manual review. This can incur API charges. It refuses demo mode. Cases cover delivery, in-transit shipment, conflicting same-time status, normal status progression, prompt injection and absent evidence.

Live validation has now been run with gpt-4.1-mini; see docs/VALIDATION.md for results and limitations. Do not present mock-test counts as model accuracy. The evaluation does not measure OCR accuracy; compare representative scanned documents against hand-checked transcripts separately.

## Bounds and behavior

- Maximum 5 MB per original enforced by upload API; vision output max 30 pages / 60,000 characters.
- Analysis max 120,000 evidence characters; oversized cases fail rather than silently truncate.
- 60 seconds per model call; two review calls normally, at most four with repair. Upload extraction is one call per document.
- No automatic demo fallback, PayPal actions or fabricated success. Provider refusals/errors remain visible.
- API credentials are never returned to the browser. Uploaded document content is sent to your configured provider when extraction/review is enabled.

Provider request formats checked against:
https://developers.openai.com/api/docs/guides/file-inputs
https://developers.openai.com/api/docs/guides/images-vision
