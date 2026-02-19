export interface User {
  id: string;
  name: string;
  roomId: string;
  avatar: string;
}

export interface Room {
  id: string;
  hostId: string;
  users: Map<string, User>;
  videoUrl: string;
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  lastSyncTime: number;
  playbackRate: number;
  messages: ChatMessage[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  text: string;
  timestamp: number;
  type: 'message' | 'system';
}

export interface VideoState {
  videoId: string;
  videoUrl: string;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  timestamp: number;
}

export interface ClientToServerEvents {
  'room:create': (data: { userName: string }, callback: (response: { roomId: string; userId: string }) => void) => void;
  'room:join': (data: { roomId: string; userName: string }, callback: (response: { success: boolean; error?: string; userId?: string }) => void) => void;
  'room:leave': () => void;
  'video:load': (data: { url: string }) => void;
  'video:play': (data: { currentTime: number }) => void;
  'video:pause': (data: { currentTime: number }) => void;
  'video:seek': (data: { currentTime: number }) => void;
  'video:rate': (data: { rate: number }) => void;
  'chat:message': (data: { text: string }) => void;
}

export interface ServerToClientEvents {
  'room:state': (data: {
    roomId: string;
    users: User[];
    hostId: string;
    videoState: VideoState;
    messages: ChatMessage[];
  }) => void;
  'room:user-joined': (data: { user: User }) => void;
  'room:user-left': (data: { userId: string; userName: string }) => void;
  'room:host-changed': (data: { hostId: string }) => void;
  'video:state-update': (data: VideoState) => void;
  'video:load': (data: { videoId: string; videoUrl: string }) => void;
  'chat:message': (data: ChatMessage) => void;
  'error': (data: { message: string }) => void;
}
