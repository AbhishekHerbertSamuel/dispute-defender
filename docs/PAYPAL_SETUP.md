# PayPal sandbox validation

Use test accounts and synthetic records. Production PayPal calls are deliberately unavailable.

1. Create/select a PayPal developer REST app and a business sandbox account. Use a separate personal sandbox account as the buyer.
2. Put the app's sandbox client ID/secret in local `.env` or hosting secrets. Set `APP_MODE=sandbox` and restart.
3. Create a sandbox transaction and buyer dispute using the currently supported PayPal sandbox workflow. Access and creation permissions vary; follow the official testing guide below.
4. Use Connections → Import a known dispute ID. Or Sync PayPal (first 50 list results).
5. Verify the app displays actual amount, reason, seller transaction ID, status, buyer message and seller response due date when PayPal supplies them. Missing optional fields must remain visibly unavailable.
6. Share a sanitised actual response with the AI teammate; remove buyer/seller private information and never share tokens. The committed example file is synthetic.
7. For submission, the app requires `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`, `WAITING_FOR_SELLER_RESPONSE`, a `provide-evidence` POST action, and `PROOF_OF_FULFILLMENT` requested from the seller.
8. Upload original PDF/JPEG/PNG files. Add transcripts or configure extraction. Run the real AI provider. Edit/save the response (max 2,000 characters), select original files (combined <=5 MB), enter actual sandbox tracking details and approve.
9. Verify the response in the app **and in PayPal**. Acceptance is not a dispute win. Capture the debug ID without exposing credentials.

## Implemented endpoints

| Operation | PayPal endpoint |
|---|---|
| OAuth | `POST /v1/oauth2/token` |
| List | `GET /v1/customer/disputes?page_size=50` |
| Detail | `GET /v1/customer/disputes/{id}` |
| Evidence | `POST /v1/customer/disputes/{id}/provide-evidence` |

All requests target `https://api-m.sandbox.paypal.com`. Fresh detail/action checks run immediately before evidence submission. The client does not follow arbitrary URLs returned by documents or users. Documents are multipart attachments referenced by field name from the JSON input part. Carrier uses `OTHER` with `carrier_name_other`.

## Failure handling

- 401/403: check sandbox app/account permissions and credentials; the application cannot grant PayPal scopes.
- Missing action: use the appropriate test dispute stage. Never force-send despite a missing action.
- Different evidence request: use PayPal's UI; the MVP supports proof of fulfillment only.
- Unknown write result / interrupted process: case stays locked. Check PayPal manually and preserve the audit trail. There is no automatic retry/reset button because it could duplicate a write.
- 50+ cases: import additional IDs individually; pagination is not implemented.

## Official references checked during implementation

- https://developer.paypal.com/api/customer-disputes/v1/
- https://developer.paypal.com/api/customer-disputes/v1/disputes-provide-evidence
- https://developer.paypal.com/platforms/disputes/handle-disputes/use-disputes-api/
- https://developer.paypal.com/disputes/test-go-live
- https://developer.paypal.com/disputes/set-up/

**Validation status:** adapter and state/multipart behavior covered with stubbed transport tests. Live sandbox credentials and an actual end-to-end evidence acceptance are still required.
