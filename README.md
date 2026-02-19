# WatchParty - Self-hosted YouTube Watch Party

Watch YouTube videos in sync with friends. Create a room, share the code, and enjoy together.

## Features

- Real-time YouTube video synchronization (play/pause/seek/speed)
- Room-based system with shareable 6-character codes
- Live chat
- User presence with avatars
- Host controls (host auto-transfers if they leave)

## Quick Start (Docker - Recommended)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed

### Steps

1. **Copy the environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` if needed** (defaults work fine for local use):

   ```
   APP_PORT=8080          # Port the app will be accessible on
   CORS_ORIGIN=*          # Set to your domain in production (e.g. https://watch.example.com)
   ```

3. **Start everything:**

   ```bash
   docker compose up -d --build
   ```

4. **Open in browser:**

   ```
   http://localhost:8080
   ```

5. **Stop:**

   ```bash
   docker compose down
   ```

## Hosting on a Server (with a domain)

If you want to expose this on the internet:

1. Point your domain (e.g. `watch.example.com`) to your server's IP
2. Set up a reverse proxy (Nginx Proxy Manager, Caddy, etc.) pointing to port `8080`
3. Enable SSL (Let's Encrypt)
4. Update `.env`:
   ```
   CORS_ORIGIN=https://watch.example.com
   ```
5. Rebuild: `docker compose up -d --build`

**Important:** The reverse proxy must support WebSocket upgrades for real-time sync to work. In Nginx Proxy Manager, enable "WebSockets Support" for the proxy host.

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
- **Backend:** Express + Socket.io + TypeScript
- **Production:** Multi-stage Docker builds, Nginx serves frontend and proxies WebSocket/API to backend
