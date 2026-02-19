import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getUserRoom,
  getRoomUsers,
  getVideoState,
  addMessage,
  extractVideoId,
  getRoomCount,
  getTotalUsers,
} from './rooms.js';
import type { ClientToServerEvents, ServerToClientEvents } from './types.js';

const app = express();
const server = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    rooms: getRoomCount(),
    users: getTotalUsers(),
    uptime: process.uptime(),
  });
});

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('room:create', (data, callback) => {
    const { room, user } = createRoom(socket.id, data.userName);
    socket.join(room.id);
    console.log(`[room:create] ${user.name} created room ${room.id}`);

    callback({ roomId: room.id, userId: user.id });

    socket.emit('room:state', {
      roomId: room.id,
      users: getRoomUsers(room),
      hostId: room.hostId,
      videoState: getVideoState(room),
      messages: room.messages,
    });
  });

  socket.on('room:join', (data, callback) => {
    const result = joinRoom(data.roomId, socket.id, data.userName);
    if (!result) {
      callback({ success: false, error: 'Room not found. Check the code and try again.' });
      return;
    }

    const { room, user } = result;
    socket.join(room.id);
    console.log(`[room:join] ${user.name} joined room ${room.id}`);

    callback({ success: true, userId: user.id });

    socket.emit('room:state', {
      roomId: room.id,
      users: getRoomUsers(room),
      hostId: room.hostId,
      videoState: getVideoState(room),
      messages: room.messages,
    });

    socket.to(room.id).emit('room:user-joined', { user });
    const systemMsg = room.messages[room.messages.length - 1];
    if (systemMsg) {
      io.to(room.id).emit('chat:message', systemMsg);
    }
  });

  socket.on('room:leave', () => {
    handleDisconnect();
  });

  socket.on('video:load', (data) => {
    const room = getUserRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can change the video' });
      return;
    }

    const videoId = extractVideoId(data.url);
    if (!videoId) {
      socket.emit('error', { message: 'Invalid YouTube URL' });
      return;
    }

    room.videoId = videoId;
    room.videoUrl = data.url;
    room.isPlaying = false;
    room.currentTime = 0;
    room.lastSyncTime = Date.now();

    io.to(room.id).emit('video:load', { videoId, videoUrl: data.url });
    io.to(room.id).emit('video:state-update', getVideoState(room));

    const systemMsg = addMessage(room, 'system', '');
    if (systemMsg) {
      systemMsg.text = `Host loaded a new video`;
      systemMsg.userId = 'system';
      systemMsg.userName = 'System';
      systemMsg.avatar = '🤖';
      systemMsg.type = 'system';
      io.to(room.id).emit('chat:message', systemMsg);
    }
  });

  socket.on('video:play', (data) => {
    const room = getUserRoom(socket.id);
    if (!room) return;

    room.isPlaying = true;
    room.currentTime = data.currentTime;
    room.lastSyncTime = Date.now();

    socket.to(room.id).emit('video:state-update', getVideoState(room));
  });

  socket.on('video:pause', (data) => {
    const room = getUserRoom(socket.id);
    if (!room) return;

    room.isPlaying = false;
    room.currentTime = data.currentTime;
    room.lastSyncTime = Date.now();

    socket.to(room.id).emit('video:state-update', getVideoState(room));
  });

  socket.on('video:seek', (data) => {
    const room = getUserRoom(socket.id);
    if (!room) return;

    room.currentTime = data.currentTime;
    room.lastSyncTime = Date.now();

    socket.to(room.id).emit('video:state-update', getVideoState(room));
  });

  socket.on('video:rate', (data) => {
    const room = getUserRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) return;

    room.playbackRate = data.rate;
    socket.to(room.id).emit('video:state-update', getVideoState(room));
  });

  socket.on('chat:message', (data) => {
    const room = getUserRoom(socket.id);
    if (!room) return;

    const message = addMessage(room, socket.id, data.text);
    if (message) {
      io.to(room.id).emit('chat:message', message);
    }
  });

  function handleDisconnect() {
    const result = leaveRoom(socket.id);
    if (!result) return;

    const { room, user, newHostId } = result;
    console.log(`[disconnect] ${user.name} left room ${room.id}`);

    socket.to(room.id).emit('room:user-left', {
      userId: user.id,
      userName: user.name,
    });

    const systemMsg = room.messages[room.messages.length - 1];
    if (systemMsg) {
      io.to(room.id).emit('chat:message', systemMsg);
    }

    if (newHostId) {
      io.to(room.id).emit('room:host-changed', { hostId: newHostId });
    }

    socket.leave(room.id);
  }

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    handleDisconnect();
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`WatchParty server running on port ${PORT}`);
});
