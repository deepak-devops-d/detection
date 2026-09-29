# Career AI — AI Interview Only Fix

This package makes the interview module a single sidebar item named **AI Interview** and removes use of the legacy `interview` frontend/API routes.

## Frontend

Replace:
- `src/App.js` with `App.js`
- `src/pages/AIVideoInterview.js` with `AIVideoInterview.js`
- `src/services/api.js` with `api.js` if this service is used by the application

The sidebar contains exactly one interview entry:
- `AI Interview` -> `/dashboard/ai-interview`

The old dashboard quick-action interview card is removed so there is one visible entry point.

Legacy frontend routes are removed:
- `/dashboard/interview`
- `/dashboard/interview/session`
- `/dashboard/interview/result`

## AI Interview API

All AI interview calls now use only:
- `POST /api/v1/ai-interview/start`
- `GET /api/v1/ai-interview/session/<session_id>`
- `POST /api/v1/ai-interview/media`
- `GET /api/v1/ai-interview/transcription/<job_name>`
- `POST /api/v1/ai-interview/answer`
- `POST /api/v1/ai-interview/complete`

The backend file changes the corresponding Flask routes to the same `/api/v1/ai-interview/...` prefix.

Resume endpoints such as `/predict`, `/health`, and `/ready` remain unchanged because they are not interview endpoints.

## Verification

From the project root:

```bash
grep -RInE '/api/v1/interview|/dashboard/interview|label: "Interview"' src app.py --exclude-dir=node_modules
```

That command should return no legacy interview route/API matches.

Then:

```bash
npm run build
```

## Docker

```bash
docker build -f Dockerfile.frontend -t career-ai/frontend:ai-interview-only .
```

Push to your existing ECR repository and update the frontend deployment after the build succeeds.

For the backend, build and deploy the updated `app.py` using your existing `Dockerfile.backend` and deployment.
