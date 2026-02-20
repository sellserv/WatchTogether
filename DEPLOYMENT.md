# WatchTogether Deployment Guide

## Architecture

- **Docker Compose** via Dockge on TrueNAS
- **Nginx Proxy Manager (NPM Plus)** as reverse proxy with Let's Encrypt SSL
- **Cloudflare** for DNS
- Frontend container (nginx) on port 8080 → proxied by NPM

## Why Voice Chat Needs Extra Setup

WebRTC peer-to-peer voice requires:

1. **HTTPS** — Browsers block `getUserMedia()` (microphone access) on non-HTTPS origins. Localhost is the only exception.
2. **TURN server** — STUN servers only discover your public IP. If users are behind symmetric NATs (most home routers, mobile networks), STUN fails and you need a TURN relay to forward audio.

---

## Step 1: Add TURN Server Environment Variables

Add TURN credentials to your `docker-compose.yml` server service:

```yaml
services:
  server:
    build: ./server
    container_name: watchparty-server
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
      - CORS_ORIGIN=${CORS_ORIGIN:-*}
      - TURN_URL=${TURN_URL:-}
      - TURN_USERNAME=${TURN_USERNAME:-}
      - TURN_CREDENTIAL=${TURN_CREDENTIAL:-}
    networks:
      - watchparty
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Then set the values in your Dockge stack `.env` or environment config:

```env
CORS_ORIGIN=https://watch.yourdomain.com
TURN_URL=turn:yourdomain.com:3478
TURN_USERNAME=watchtogether
TURN_CREDENTIAL=your-secure-password
```

---

## Step 2: TURN Server Options

### Option A: coturn Docker Container (Recommended — Self-Hosted)

Add coturn to your `docker-compose.yml`:

```yaml
  coturn:
    image: coturn/coturn:latest
    container_name: watchparty-coturn
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./coturn/turnserver.conf:/etc/coturn/turnserver.conf:ro
    tmpfs:
      - /var/tmp
```

Create `coturn/turnserver.conf`:

```conf
listening-port=3478
tls-listening-port=5349
realm=yourdomain.com
server-name=yourdomain.com

# Static credentials
lt-cred-mech
user=watchtogether:your-secure-password

# Relay port range (open these in your firewall/router)
min-port=49152
max-port=65535

# Security
no-multicast-peers
no-cli
fingerprint
```

**Port forwarding required** on your router/firewall:
| Port | Protocol | Purpose |
|------|----------|---------|
| 3478 | TCP + UDP | TURN signaling |
| 5349 | TCP | TURNS (TLS) |
| 49152-65535 | UDP | Media relay |

Then set in your environment:
```env
TURN_URL=turn:yourdomain.com:3478
TURN_USERNAME=watchtogether
TURN_CREDENTIAL=your-secure-password
```

### Option B: Free TURN Provider (No Self-Hosting)

If you don't want to run coturn, use a free provider:

**Open Relay (free, no signup):**
```env
TURN_URL=turn:openrelay.metered.ca:443
TURN_USERNAME=openrelayproject
TURN_CREDENTIAL=openrelayproject
```

**Metered.ca (free tier: 500GB/month):**
1. Sign up at https://www.metered.ca/
2. Create a TURN app, get credentials
3. Set them in your env

> Free TURN servers may have reliability/bandwidth limits. For production, self-host coturn.

---

## Step 3: Nginx Proxy Manager Configuration

In NPM Plus, your proxy host for WatchTogether should already be set up. Verify these settings:

**Details tab:**
- Scheme: `http`
- Forward Hostname: your TrueNAS IP (e.g. `192.168.1.x`)
- Forward Port: `8080` (the `APP_PORT` from docker-compose)
- Websockets Support: **ON** (critical for Socket.IO)

**SSL tab:**
- Force SSL: ON
- SSL Certificate: Let's Encrypt (request or select existing)

**Advanced tab** (add this if WebSocket connections drop):
```nginx
location /socket.io/ {
    proxy_pass http://YOUR_TRUENAS_IP:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

> The frontend container's nginx.conf already proxies `/socket.io/` and `/api/` to the backend container internally. NPM just needs to forward everything to port 8080 with WebSocket support enabled.

---

## Step 4: Cloudflare DNS

In Cloudflare dashboard for your domain:

1. **A record**: `watch` → your public IP (or CNAME to DDNS)
2. **Proxy status**: Proxied (orange cloud) for HTTPS

**Important:** If using coturn with Cloudflare proxy, the TURN server domain should **NOT** be proxied (grey cloud / DNS only), since Cloudflare doesn't proxy UDP. Use a separate subdomain:
- `watch.yourdomain.com` → Proxied (orange) — for the web app
- `turn.yourdomain.com` → DNS only (grey) — for coturn

Then set: `TURN_URL=turn:turn.yourdomain.com:3478`

---

## Step 5: Deploy

In Dockge, rebuild and restart the stack:

```bash
docker compose up -d --build
```

Or click **Restart** / **Update & Restart** in the Dockge UI.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Microphone access denied" | HTTP (not HTTPS) | Ensure NPM has SSL + Force SSL enabled |
| Can't hear others / voice fails | No TURN server | Add TURN env vars (Option A or B above) |
| Socket.IO falls back to polling | WebSocket not proxied | Enable "Websockets Support" in NPM |
| Voice works on LAN but not internet | No TURN + symmetric NAT | Set up coturn or use free TURN provider |
| White screen | Missing Node polyfills | Already fixed with `vite-plugin-node-polyfills` |
| Join Voice does nothing | Mic permission denied/no mic | Check browser permissions, error shows in UI |

## Testing TURN

Verify your TURN server works:
1. Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. Add your TURN server: `turn:turn.yourdomain.com:3478` with username/credential
3. Click "Gather candidates"
4. You should see `relay` type candidates — TURN is working
