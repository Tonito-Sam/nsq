# coturn deployment (WSL2 or Docker) for Windows

This folder contains templates to run coturn for TURN services on Windows (WSL2 or Docker).

Files
- `turnserver.conf.template` - edit and save as `turnserver.conf` in this folder.
- `docker-compose.yml` - Docker Compose setup to run coturn with recommended ports.
- `certs/` - optional folder for TLS certs (letsencrypt fullchain.pem + privkey.pem).

Quick start (Docker)
1. Install Docker Desktop and ensure WSL2 backend is enabled.
2. Copy `turnserver.conf.template` -> `turnserver.conf` and configure:
   - set `realm=yourdomain.com`
   - set `static-auth-secret=YOUR_SECRET` or add static `user=...` for testing
   - optionally set `external-ip=YOUR_PUBLIC_IP` if behind NAT
3. (Optional) place TLS certs in `certs/` and set `cert`/`pkey` in the conf.
4. Run:
   docker-compose up -d
5. Check logs:
   docker logs -f coturn

Quick start (WSL2 / Ubuntu)
1. Install WSL and Ubuntu. Open Ubuntu shell.
2. sudo apt update && sudo apt install coturn -y
3. Copy `turnserver.conf.template` -> `/etc/turnserver.conf` and edit.
4. Start server:
   sudo turnserver -c /etc/turnserver.conf

Generate ephemeral credentials (server-side)
- The backend exposes `/api/turn/creds` which uses `STATIC_TURN_SECRET` or `TURN_PASS` env to create ephemeral creds.
- Set env in `backend/.env` or your host environment:
  - TURN_URL=turn:yourdomain.com:3478
  - STATIC_TURN_SECRET=your_shared_secret

Test
- Use the WebRTC trickle-ICE sample: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
  - Paste your TURN URL and credentials and gather candidates. You should see `relay` candidates when TURN works.

Security
- Prefer `lt-cred-mech` + `static-auth-secret` and generate ephemeral credentials for clients.
- Do not commit secrets to git; use host environment variables in production.
