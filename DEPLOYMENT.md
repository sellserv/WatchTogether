# WatchTogether Deployment Guide

Deploy on an Ubuntu VM (Proxmox) with Docker Compose and a Cloudflare Tunnel. No port forwarding, no UDP, no reverse proxy.

## Architecture

```
Internet → Cloudflare Edge (HTTPS) → Tunnel (outbound from VM)
    → cloudflared container → frontend (nginx:80)
        ├─ Static files → serves React app
        ├─ /api/*       → proxy to server:3001
        └─ /socket.io/* → proxy to server:3001 (WebSocket)
```

- **No port forwarding** — Cloudflare Tunnel creates an outbound-only connection from your VM
- **No UDP** — everything runs over HTTPS/WebSocket through Cloudflare
- **HTTPS automatic** — Cloudflare handles SSL termination
- **Docker Compose** on an Ubuntu VM in Proxmox

---

## Prerequisites

- Ubuntu VM running in Proxmox (with internet access)
- Docker and Docker Compose installed
- A domain managed by Cloudflare
- A Cloudflare account with Zero Trust access

### Install Docker (if not already installed)

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker compose version
```

---

## Step 1: Create a Cloudflare Tunnel

1. Log in to [Cloudflare Zero Trust](https://one.dash.cloudflare.com)
2. Go to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Select **Cloudflared** as the connector
5. Name it (e.g. `watchparty`)
6. Copy the **tunnel token** — you'll need this in Step 2

### Configure the Public Hostname

In the tunnel config, add a **Public Hostname**:

| Field | Value |
|-------|-------|
| Subdomain | `watch` (or whatever you want) |
| Domain | `yourdomain.com` |
| Type | `HTTP` |
| URL | `frontend:80` |

This routes `watch.yourdomain.com` → the frontend container on port 80 (internal Docker network).

**Additional settings** (expand the hostname entry):

Under **HTTP Settings**:
- **WebSocket**: ON (required for Socket.IO real-time sync)
- **No TLS Verify**: ON (internal traffic between containers is plain HTTP)

---

## Step 2: Configure Environment

Create a `.env` file in the project root:

```env
# Cloudflare Tunnel token from Step 1
TUNNEL_TOKEN=eyJhIjoiYWJjZGVmZy4uLi...

# CORS origin — must match your public URL exactly
CORS_ORIGIN=https://watch.yourdomain.com
```

That's it — only two variables needed.

---

## Step 3: Deploy

Clone the repo and start the stack:

```bash
git clone <your-repo-url> watchtogether
cd watchtogether

# Create .env with your values (see Step 2)
cp .env.example .env
nano .env

# Build and start
docker compose up -d --build
```

Verify everything is running:

```bash
docker compose ps
docker logs watchparty-tunnel
docker logs watchparty-server
docker logs watchparty-frontend
```

Your app is live at `https://watch.yourdomain.com`.

---

## Updating

```bash
git pull
docker compose up -d --build
```

---

## How Traffic Flows

```
Browser
  ↓ HTTPS
Cloudflare Edge
  ↓ Tunnel (outbound connection from VM)
cloudflared container
  ↓ HTTP (internal Docker network)
frontend container (nginx:80)
  ├─ / → React app (static files)
  ├─ /api/* → proxy to server:3001
  └─ /socket.io/* → proxy to server:3001 (WebSocket upgrade)
        ↓
server container (node:3001)
  └─ Manages rooms, chat, video sync via Socket.IO
```

All traffic flows through the Cloudflare Tunnel — no ports exposed, no inbound connections needed.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| 502 Bad Gateway | Tunnel can't reach frontend | Check `frontend` container is running: `docker compose ps` |
| WebSocket disconnects | WebSocket not enabled in tunnel | Enable WebSocket in tunnel hostname HTTP settings |
| Tunnel shows "unhealthy" | Bad token or no internet | Check `TUNNEL_TOKEN` in `.env`, check logs: `docker logs watchparty-tunnel` |
| CORS errors in browser | `CORS_ORIGIN` mismatch | Ensure it matches your public URL exactly (including `https://`) |
| Video sync not working | Server not healthy | Check server logs: `docker logs watchparty-server` |
| Containers won't start | Docker not running | `sudo systemctl start docker` |
