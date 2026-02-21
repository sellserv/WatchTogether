# WatchParty - Self-hosted YouTube Watch Party

Watch YouTube videos in sync with friends. Create a room, share the code, and enjoy together.

## Features

- Real-time YouTube video synchronization (play/pause/seek/speed)
- Room-based system with shareable 6-character codes
- Live chat
- User presence with avatars
- Host controls (host auto-transfers if they leave)

## Deployment (Docker + Cloudflare Tunnel)

Designed to run on an Ubuntu VM (Proxmox) with a Cloudflare Tunnel — no port forwarding, no UDP, no reverse proxy needed.

### Quick Start

1. **Clone and configure:**

   ```bash
   git clone https://github.com/sellserv/WatchTogether.git
   cd WatchTogether
   cp .env.example .env
   ```

2. **Edit `.env`:**

   ```env
   TUNNEL_TOKEN=<your-cloudflare-tunnel-token>
   CORS_ORIGIN=https://watch.yourdomain.com
   ```

3. **Start everything:**

   ```bash
   docker compose up -d --build
   ```

4. Visit `https://watch.yourdomain.com`

See [DEPLOYMENT.md](DEPLOYMENT.md) for full setup instructions including Cloudflare Tunnel configuration and Docker installation.

## Development (without Docker)

### Prerequisites

- Node.js 20+
- npm

### Steps

1. **Install dependencies:**

   ```bash
   cd server && npm install
   cd ../frontend && npm install
   ```

2. **Start the backend:**

   ```bash
   cd server
   npm run dev
   ```

3. **Start the frontend** (in a second terminal):

   ```bash
   cd frontend
   npm run dev
   ```

4. **Open** `http://localhost:5173`

## How to Use

1. Open the app and enter a display name
2. Click **Create Room** to start a new room
3. Share the **room code** with friends
4. Friends join by entering the code on the home page
5. The host pastes a YouTube URL to load a video
6. Playback is synced for everyone in the room

## Architecture

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + Socket.IO + TypeScript
- **Production:** Multi-stage Docker builds, Nginx serves frontend and proxies WebSocket/API to backend
- **Networking:** Cloudflare Tunnel (outbound-only, no exposed ports)