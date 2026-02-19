export interface User {
  id: string;
  name: string;
  roomId: string;
  avatar: string;
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

export interface RoomState {
  roomId: string;
  users: User[];
  hostId: string;
  videoState: VideoState;
  messages: ChatMessage[];
}
