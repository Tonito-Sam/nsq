# Deploying backend to Render and wiring frontend to it

This project separates frontend (Vite) and backend (Node/Express) under the `backend/` folder. To deploy the backend to Render and have the frontend call it, follow these steps.

1) Push your changes to GitHub

Stage only the files for this deployment; avoid `git add -A` if the worktree contains local environment files or unrelated changes:

```powershell
git add backend/server.cjs backend/utils/podcastConferenceSignaling.cjs backend/package.json DEPLOY_RENDER.md
git commit -m "Deploy podcast conference signaling"
git push origin main
```

2) Create a new Web Service on Render

- In Render dashboard, create a new "Web Service".
- Connect the GitHub repo and select the `main` branch.
- Set the root directory to `backend` (relative to the repository root).
- Build Command: `npm ci --omit=dev` (or `npm install --production`).
- Start Command: `npm start`.
- Render sets `PORT`; `backend/server.cjs` uses it (with `3001` as the local default).

The podcast conference signaling server is part of this backend service. `backend/server.cjs`
attaches it to the HTTP server at `/api/podcast-conference`, and `npm start` starts both
the API and its WebSocket endpoint. The frontend connects to this path using `wss://` when
the API base URL is HTTPS; no separate Render service or process is needed for signaling.
Ensure the Render service deploys the branch containing `backend/utils/podcastConferenceSignaling.cjs`
and that its auto-deploy is enabled (or manually deploy the latest commit).

3) Add environment variables on Render (Service > Environment)

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your service_role key (KEEP SECRET)
- `SUPABASE_ANON_KEY` or other keys your backend expects
- Any other backend-specific envs (API keys for third-party services)
- `CORS_ALLOWED_ORIGINS` = comma-separated frontend origins, if the frontend is not hosted at
  `https://nexsq.com` or `https://www.nexsq.com`.

The signaling server does not relay audio/video; WebRTC connects the participants directly.
If direct connections fail on restrictive networks, configure the separate TURN service using
`TURN_URL` and either `TURN_USER`/`TURN_PASS` or `TURN_SECRET`/`STATIC_TURN_SECRET`.

4) Frontend: set `VITE_API_BASE_URL` to Render service URL

- Your frontend should call the backend using a full origin when deployed. Set `VITE_API_BASE_URL` to your Render service URL, e.g. `https://nsq-98et.onrender.com` (no trailing slash preferred).
- On Render, under the frontend service (if you deploy frontend separately) set an environment variable `VITE_API_BASE_URL=https://<your-backend>.onrender.com`.
- Do not set the frontend's production `VITE_API_BASE_URL` to `http://localhost:3001`; localhost refers to each visitor's own device. The frontend now ignores a localhost API URL on a remote site and falls back to the Render backend, but the deploy setting should still be corrected.

5) Build & Deploy frontend

- If your frontend is hosted separately (Netlify / Vercel / static host), set `VITE_API_BASE_URL` in that host's env settings before building so that Vite injects the correct base.
- If you serve frontend from the same domain as backend, you can still set `VITE_API_BASE_URL` to `''` and use relative `/api` paths; otherwise set full URL.

6) Verify after deploy

- Visit `https://<your-backend>.onrender.com/api/currency/rates?base=USD` — you should see JSON rates.
- Check that frontend in production points to Render by opening browser network tab and inspecting requests.
- Confirm that joining a conference reaches the WebSocket endpoint
  `wss://<your-backend>.onrender.com/api/podcast-conference`. A normal HTTP GET to `/` or to the
  WebSocket path is not a health check and may return 404.

7) Notes and security

- Keep `SUPABASE_SERVICE_ROLE_KEY` secret — only set it on Render server envs (backend service), never in frontend envs.
- For development locally, keep using the Vite proxy (relative `/api` paths) and set `VITE_API_BASE_URL` only for production builds.
