# AI Photo Studio Proxy

This Express proxy forwards an uploaded image + prompt to an image-to-image backend and returns generated images as data URLs. It supports two modes:

1. Automatic1111 (self-hosted web UI) — set `AUTOMATIC1111_URL` to the webui URL (e.g. `http://127.0.0.1:7860`).
2. Replicate (hosted inference) — set `REPLICATE_API_TOKEN` and `REPLICATE_MODEL_VERSION` to call Replicate's inference API.

Usage

- Install deps:

```powershell
cd backend
npm install
```

- Run locally:

```powershell
# Run proxy on port 3001
node ai-photo-studio-proxy.js
```

Environment variables

- `PORT` — optional (default 3001)
- `AUTOMATIC1111_URL` — optional; if set the proxy forwards to Automatic1111's `/sdapi/v1/img2img` endpoint
- `REPLICATE_API_TOKEN` — optional; if set (and `AUTOMATIC1111_URL` is not set) the proxy will call Replicate
- `REPLICATE_MODEL_VERSION` — required when using Replicate. This is the model *version* id from Replicate (not the model name). You can find it under the model's page on replicate.com -> Versions -> click a version -> the long id.

Example: use Replicate (server-side)

1. Sign up at https://replicate.com and add a payment method.
2. Pick a model and version for img2img (or any model that accepts an `image` + `prompt`). Copy the version id.
3. Start the proxy with env vars:

```powershell
$Env:REPLICATE_API_TOKEN = 'your-token-here'
$Env:REPLICATE_MODEL_VERSION = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
node ai-photo-studio-proxy.js
```

4. From the frontend, POST a multipart/form-data to `/api/ai-photo-studio` with fields:
   - `image` (file)
   - `prompt` (string)
   - `preset` (optional)
   - `n` (optional number of outputs)

The proxy will return JSON: `{ images: [dataUrl, ...] }`.

Deploying to Render

- Create a new Web Service on Render.
- Connect your repository and set the Build Command to `npm install` and the Start Command to `node ai-photo-studio-proxy.js`.
- Add environment variables in Render: `REPLICATE_API_TOKEN` and `REPLICATE_MODEL_VERSION` (or `AUTOMATIC1111_URL`).
- Ensure the frontend points to the deployed proxy's `/api/ai-photo-studio` endpoint (via CORS or a domain). If your frontend is on a different host, enable CORS or use server-side proxying on the frontend host.

Notes

- Replicate costs per inference. Use small sample sizes when testing.
- Automatic1111 requires GPU for decent speed. Render does not provide GPU instances — if you want to self-host Automatic1111 you must use a GPU VM (Lambda, Paperspace, GCP/AWS GPU instance, or your local machine with CUDA).

If you want, I can also prepare a small Render-specific `render.yaml` or a GitHub Actions workflow to deploy the proxy automatically.
