# Deploying backend to Render and wiring frontend to it

This project separates frontend (Vite) and backend (Node/Express) under the `backend/` folder. To deploy the backend to Render and have the frontend call it, follow these steps.

1) Push your changes to GitHub

Run the helper script from repository root (PowerShell):

```powershell
cd C:\xampp\htdocs\nexsq
.\scripts\git_push.ps1 -Remote origin -Branch main -Message "Deploy: point frontend to Render backend"
```

Or use standard git commands:

```powershell
git add -A
git commit -m "Deploy: point frontend to Render backend"
git push origin main
```

2) Create a new Web Service on Render

- In Render dashboard, create a new "Web Service".
- Connect the GitHub repo and select the `main` branch.
- Set the root directory to `/backend` (so Render runs the code in the `backend` folder).
- Build Command: `npm install --production` (or `npm ci`)
- Start Command: `node server.cjs` or use `npm run start` depending on `backend/package.json`.
- Port: Render sets `$PORT` automatically — ensure your backend reads `process.env.PORT` (server already uses `PORT` 3001 locally; Render uses env PORT).

3) Add environment variables on Render (Service > Environment)

- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your service_role key (KEEP SECRET)
- `SUPABASE_ANON_KEY` or other keys your backend expects
- Any other backend-specific envs (API keys for third-party services)

4) Frontend: set `VITE_API_BASE_URL` to Render service URL

- Your frontend should call the backend using a full origin when deployed. Set `VITE_API_BASE_URL` to your Render service URL, e.g. `https://nsq-98et.onrender.com` (no trailing slash preferred).
- On Render, under the frontend service (if you deploy frontend separately) set an environment variable `VITE_API_BASE_URL=https://<your-backend>.onrender.com`.

5) Build & Deploy frontend

- If your frontend is hosted separately (Netlify / Vercel / static host), set `VITE_API_BASE_URL` in that host's env settings before building so that Vite injects the correct base.
- If you serve frontend from the same domain as backend, you can still set `VITE_API_BASE_URL` to `''` and use relative `/api` paths; otherwise set full URL.

6) Verify after deploy

- Visit `https://<your-backend>.onrender.com/api/currency/rates?base=USD` — you should see JSON rates.
- Check that frontend in production points to Render by opening browser network tab and inspecting requests.

7) Notes and security

- Keep `SUPABASE_SERVICE_ROLE_KEY` secret — only set it on Render server envs (backend service), never in frontend envs.
- For development locally, keep using the Vite proxy (relative `/api` paths) and set `VITE_API_BASE_URL` only for production builds.
