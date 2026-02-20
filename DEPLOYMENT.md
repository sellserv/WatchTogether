# WatchTogether Deployment Guide

## Why Voice Chat Fails Over the Internet

WebRTC peer-to-peer connections need two things to work over the internet:

1. **HTTPS** — Browsers block `getUserMedia()` (microphone access) on non-HTTPS origins. Localhost is the only exception.
2. **TURN server** — STUN servers only help discover your public IP. If both users are behind symmetric NATs (most home routers, all mobile networks), STUN fails and you need a TURN relay server to forward audio traffic.

---

## Option A: Quick Setup with Cloudflare Tunnel (Easiest)

No server, no domain, no port forwarding needed.

### 1. Install cloudflared
```bash
# Windows (winget)
winget install cloudflare.cloudflared

# macOS
brew install cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### 2. Start your servers locally
```bash
# Terminal 1
cd server && npm run dev    # runs on port 3001

# Terminal 2
cd frontend && npm run dev  # runs on port 5173
```

### 3. Create tunnels
```bash
# Terminal 3 - tunnel for backend (gives you an https URL)
cloudflared tunnel --url http://localhost:3001

# Terminal 4 - tunnel for frontend
cloudflared tunnel --url http://localhost:5173
```

### 4. Configure frontend to point to backend tunnel
Set the backend tunnel URL in your frontend `.env`:
```
VITE_SERVER_URL=https://your-backend-id.trycloudflare.com
```

Then restart the frontend dev server.

Share the frontend tunnel URL with friends — voice chat will work because it's HTTPS.

---

## Option B: VPS with Nginx Reverse Proxy (Production)

### 1. Server Setup

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx

# Clone and build
git clone https://github.com/karanpatel-stack/WatchTogether.git
cd WatchTogether

cd server && npm install && npm run build
cd ../frontend && npm install && npm run build
```

### 2. Environment Variables

Create `server/.env`:
```env
PORT=3001
CORS_ORIGIN=https://yourdomain.com

# TURN server credentials (REQUIRED for voice chat over internet)
TURN_URL=turn:yourdomain.com:3478
TURN_USERNAME=watchtogether
TURN_CREDENTIAL=your-secure-password
```

### 3. Nginx Config

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend static files
    root /path/to/WatchTogether/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO proxy (CRITICAL: must support WebSocket upgrade)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com
```

### 5. TURN Server (coturn)

This is **required** for voice chat to work for most internet users.

```bash
sudo apt install coturn
```

Edit `/etc/turnserver.conf`:
```conf
listening-port=3478
tls-listening-port=5349
realm=yourdomain.com
server-name=yourdomain.com

# Use static credentials (simplest)
lt-cred-mech
user=watchtogether:your-secure-password

# Use your SSL certs for TURNS
cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Limit relay ports (open these in your firewall)
min-port=49152
max-port=65535

# Security
no-multicast-peers
no-cli
fingerprint
```

Enable and start:
```bash
# Edit /etc/default/coturn, set TURNSERVER_ENABLED=1
sudo systemctl enable coturn
sudo systemctl start coturn
```

**Firewall rules** (open these ports):
```bash
sudo ufw allow 3478/tcp    # TURN
sudo ufw allow 3478/udp    # TURN
sudo ufw allow 5349/tcp    # TURNS (TLS)
sudo ufw allow 49152:65535/udp  # Relay ports
```

Set these in your `server/.env`:
```env
TURN_URL=turn:yourdomain.com:3478
TURN_USERNAME=watchtogether
TURN_CREDENTIAL=your-secure-password
```

### 6. Run with PM2

```bash
sudo npm install -g pm2
cd /path/to/WatchTogether/server
pm2 start dist/index.js --name watchtogether
pm2 save
pm2 startup
```

---

## Option C: Free TURN Server (No Self-Hosting)

If you don't want to run coturn yourself, use a free TURN provider:

### Metered.ca (free tier: 500GB/month)
1. Sign up at https://www.metered.ca/
2. Create a TURN app
3. Get your credentials and set in `server/.env`:
```env
TURN_URL=turn:a]global.turn.twilio.com:3478
TURN_USERNAME=your-api-key
TURN_CREDENTIAL=your-api-secret
```

### Open Relay (free, no signup)
```env
TURN_URL=turn:openrelay.metered.ca:443
TURN_USERNAME=openrelayproject
TURN_CREDENTIAL=openrelayproject
```

> Note: Free TURN servers may have reliability/bandwidth limits. For production use, self-host coturn or use a paid service.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| White screen | Missing Node polyfills for simple-peer | Already fixed with `vite-plugin-node-polyfills` |
| "NotAllowedError: Permission denied" | HTTP (not HTTPS) | Use HTTPS (Cloudflare tunnel, certbot, etc.) |
| Can hear yourself but not others | STUN-only, symmetric NAT | Add TURN server |
| Socket.IO falls back to polling | Nginx not proxying WebSocket | Add `Upgrade` and `Connection` headers in nginx |
| Voice works locally but not remotely | No TURN server configured | Set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` env vars |
| getUserMedia fails silently | Browser blocks mic on HTTP | Must use HTTPS or localhost |

## Testing TURN

To verify your TURN server works:
1. Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. Add your TURN server URL + credentials
3. Click "Gather candidates"
4. You should see `relay` type candidates — that means TURN is working
