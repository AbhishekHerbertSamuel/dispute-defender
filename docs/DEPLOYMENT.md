# Deployment notes

This repository is a conventional Node + React application using SQLite and local file storage. Choose a Docker/Node host with a persistent volume. No cloud resources or paid subscriptions have been provisioned.

## One-instance deployment

1. Build the Dockerfile, or run `npm ci && npm run build` on Node 22.13+.
2. Mount persistent disk at `/app/data` (or set `DATA_DIR` to your volume path).
3. Set `HOST=0.0.0.0`, `PORT` according to the host, a random `APP_ACCESS_KEY` of at least 16 characters, and `APP_ORIGIN=https://your-exact-hostname`.
4. Set `COOKIE_SECURE=true` behind HTTPS. Never use false for an internet-facing HTTPS deployment.
5. Configure sandbox and AI secrets on the server only. Set `APP_MODE=sandbox` for the actual integration demo.
6. Run `npm start`; health check is `/api/health`.
7. Verify login, upload persistence after restart, AI calls, and PayPal import. Inquiry messaging was confirmed in PayPal by the project owner on November 12 at 8:12 PM IST; verify the hosted receipt workflow without resending that message. Formal evidence submission remains unverified and case-dependent.

Use a single instance. Session and operation locks are in-process; SQLite and files persist on disk. Login sessions expire after eight hours and reset on restart. A pending write becomes unknown after restart and stays locked for reconciliation.

Keep the demo reachable and credits active through the end of judging, December 15, 2026 at 8 AM Pacific Time. Do not rely on laptop localhost access as the judges' hosted URL. If hosting cannot be arranged, supply complete runnable instructions as permitted by the rules.

## Render deployment

The root `render.yaml` configures one paid Node web service and a 1 GB persistent disk. Review Render's displayed charges before creating it. No service is created merely by committing this file.

1. Sign in at https://dashboard.render.com and create a Blueprint from this public GitHub repository.
2. Set `APP_ORIGIN` to the exact HTTPS service URL (no trailing slash). If Render assigns a different URL, correct this variable before testing login.
3. Enter `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `AI_API_KEY` in Render's secret environment fields. Never put values in this file or the public repository.
4. Deploy. Retrieve the generated `APP_ACCESS_KEY` privately from the service environment; this is the workspace login password, not an API key.
5. Open the service URL, log in, and import the sandbox dispute. The hosted disk starts empty; it does not contain your laptop's evidence or review history. Upload clearly labelled synthetic evidence as needed.
6. Check `/api/health`, login, import, upload, saved draft/export, and persistence across a restart. Use one bounded AI review only when needed; do not resend an already accepted buyer message merely to test hosting.
7. Give judges the URL and workspace password through the submission's private testing instructions. Keep provider API secrets private.

Do not scale beyond one instance. Do not delete the disk during judging.

## Local Docker

`docker compose up --build` uses the included named volume. Set `APP_ACCESS_KEY` in `.env` before starting. The compose file binds host access to localhost only. Stop/start preserves files; deleting the volume destroys case data, so do not delete it casually.

## GitHub

Push feature branches to the repository and use PRs. The CI workflow checks types, in-process API behavior, real HTTP behavior, synthetic regression cases and the production frontend build. The initial setup environment prohibited binding local ports; inspect CI before treating HTTP tests as verified.
