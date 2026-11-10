# Deployment notes

This repository is a conventional Node + React application using SQLite and local file storage. Choose a Docker/Node host with a persistent volume. No cloud resources or paid subscriptions have been provisioned.

## One-instance deployment

1. Build the Dockerfile, or run `npm ci && npm run build` on Node 22.13+.
2. Mount persistent disk at `/app/data` (or set `DATA_DIR` to your volume path).
3. Set `HOST=0.0.0.0`, `PORT` according to the host, a random `APP_ACCESS_KEY` of at least 16 characters, and `APP_ORIGIN=https://your-exact-hostname`.
4. Set `COOKIE_SECURE=true` behind HTTPS. Never use false for an internet-facing HTTPS deployment.
5. Configure sandbox and AI secrets on the server only. Set `APP_MODE=sandbox` for the actual integration demo.
6. Run `npm start`; health check is `/api/health`.
7. Verify login, upload persistence after restart, AI calls, PayPal import, and an actual approved evidence submission.

Use a single instance. Session and operation locks are in-process; SQLite and files persist on disk. Login sessions expire after eight hours and reset on restart. A pending write becomes unknown after restart and stays locked for reconciliation.

Keep the demo reachable and credits active through December 21. Do not rely on laptop localhost access as the judges' hosted URL. If hosting cannot be arranged, supply complete runnable instructions as permitted by the rules.

## Local Docker

`docker compose up --build` uses the included named volume. Set `APP_ACCESS_KEY` in `.env` before starting. The compose file binds host access to localhost only. Stop/start preserves files; deleting the volume destroys case data, so do not delete it casually.

## GitHub

Push feature branches to the repository and use PRs. The CI workflow checks types, in-process API behavior, real HTTP behavior, synthetic regression cases and the production frontend build. The initial setup environment prohibited binding local ports; inspect CI before treating HTTP tests as verified.
