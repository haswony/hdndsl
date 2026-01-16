export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio?: string;
  followers: number;
  following: number;
  createdAt: number;
}

export interface Stream {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  hostPhoto: string;
  coverImage: string;
  viewerCount: number;
  isLive: boolean;
  startedAt: number;
  endedAt?: number;
  category?: string;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  message: string;
  timestamp: number;
}

export interface Viewer {
  odUserId: string;
  userName: string;
  userPhoto: string;
  joinedAt: number;
}

export interface Like {
  id: string;
  streamId: string;
  userId: string;
  timestamp: number;
}

export interface PastStream {
  id: string;
  title: string;
  hostId: string;
  coverImage: string;
  viewerCount: number;
  duration: number;
  recordedAt: number;
  videoUrl?: string;
}
