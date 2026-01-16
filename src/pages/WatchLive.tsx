import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, push, set, onValue, onDisconnect } from 'firebase/database';
import { 
  Radio, Heart, UserPlus, Share2, MoreVertical, 
  ChevronLeft, MessageCircle, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, rtdb } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import type { Stream } from '../types';

interface ChatMessage {
  id: string;
  odUserId: string;
  userName: string;
  userPhoto: string;
  message: string;
  timestamp: number;
}

interface FloatingHeart {
  id: number;
  x: number;
}

const WatchLive: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const viewerId = useRef(user?.uid || `guest_${Date.now()}`);
  const webrtcInitialized = useRef(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(false);
  
  const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Load stream data
  useEffect(() => {
    if (!streamId) return;

    const streamDocRef = doc(db, 'streams', streamId);
    const unsubscribe = onSnapshot(streamDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setStream({ id: snapshot.id, ...snapshot.data() } as Stream);
      } else {
        setStream(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [streamId]);

  // Register as viewer and setup WebRTC
  useEffect(() => {
    if (!streamId) return;

    const myViewerId = viewerId.current;
    const viewerRefPath = ref(rtdb, `streams/${streamId}/viewers/${myViewerId}`);
    
    set(viewerRefPath, {
      odUserId: myViewerId,
      userName: user?.displayName || 'زائر',
      userPhoto: user?.photoURL || '',
      joinedAt: Date.now(),
    }).catch(console.error);
    
    onDisconnect(viewerRefPath).remove();

    // Setup WebRTC connection - run only once
    const setupWebRTC = async () => {
      console.log("setupWebRTC called");
      if (peerConnectionRef.current || webrtcInitialized.current) {
        console.log("WebRTC already initialized, skipping");
        return;
      }
      webrtcInitialized.current = true;
      console.log("WebRTC initialized");
      
      try {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;
        
        // Queue for ICE candidates that arrive before remote description
        const pendingCandidates: RTCIceCandidateInit[] = [];
        let remoteDescriptionSet = false;

        // Handle incoming video stream
        pc.ontrack = (event) => {
          console.log('Track received:', event.track.kind);
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            try {
              videoRef.current.play();
              setHasVideo(true);
              setShowPlayButton(false);
            } catch(e) {
              console.log("Autoplay blocked, waiting for user tap");
              setHasVideo(true);
              setShowPlayButton(true);
            }
          }
        };

        // Handle ICE candidates - send to broadcaster
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Sending ICE candidate to broadcaster');
            push(ref(rtdb, `webrtc/${streamId}/viewerCandidates/${myViewerId}`), 
              event.candidate.toJSON()
            ).catch(console.error);
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
          console.log('Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setHasVideo(true);
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            setHasVideo(false);
          }
        };

        // Create offer with receive-only tracks
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('Offer created and set as local description');

        // Send offer to broadcaster
        await set(ref(rtdb, `webrtc/${streamId}/offers/${myViewerId}`), {
          offer: { type: offer.type, sdp: offer.sdp }
        });
        console.log('Offer sent to broadcaster');

        // Listen for answer from broadcaster
        const answerUnsubscribe = onValue(ref(rtdb, `webrtc/${streamId}/answers/${myViewerId}`), async (snap) => {
          const data = snap.val();
          if (data?.answer && pc.signalingState === 'have-local-offer') {
            console.log('Answer received from broadcaster');
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            remoteDescriptionSet = true;
            
            // Add any pending ICE candidates
            for (const cand of pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingCandidates.length = 0;
          }
        });

        // Listen for broadcaster's ICE candidates
        const candidatesUnsubscribe = onValue(ref(rtdb, `webrtc/${streamId}/broadcasterCandidates/${myViewerId}`), async (snap) => {
          const candidates = snap.val();
          if (candidates) {
            for (const cand of Object.values(candidates) as any[]) {
              if (remoteDescriptionSet) {
                console.log('Adding broadcaster ICE candidate');
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              } else {
                console.log('Queuing broadcaster ICE candidate');
                pendingCandidates.push(cand);
              }
            }
          }
        });

      } catch (err) {
        console.error('WebRTC setup error:', err);
      }
    };

    setupWebRTC();

    return () => {
      set(viewerRefPath, null).catch(console.error);
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      webrtcInitialized.current = false;
      setHasVideo(false);
    };
  }, [streamId]);

  // Listen to viewer count
  useEffect(() => {
    if (!streamId) return;

    const viewersRef = ref(rtdb, `streams/${streamId}/viewers`);
    const unsubscribe = onValue(viewersRef, (snapshot) => {
      const data = snapshot.val();
      setViewerCount(data ? Object.keys(data).length : 0);
    });

    return () => unsubscribe();
  }, [streamId]);

  // Listen to chat messages
  useEffect(() => {
    if (!streamId) return;

    const messagesRef = ref(rtdb, `chats/${streamId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          ...msg,
        }));
        setMessages(messageList.sort((a, b) => a.timestamp - b.timestamp).slice(-50));
      }
    });

    return () => unsubscribe();
  }, [streamId]);

  // Auto scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!streamId) return;

    const likesRef = ref(rtdb, `streams/${streamId}/likes`);
    const unsubscribe = onValue(likesRef, (snapshot) => {
      const data = snapshot.val();
      setLikeCount(data ? Object.keys(data).length : 0);
    });

    return () => unsubscribe();
  }, [streamId]);

  const handleLike = async () => {
    if (!streamId || !user) return;

    const likesRef = ref(rtdb, `streams/${streamId}/likes`);
    await push(likesRef, {
      odUserId: user.uid,
      timestamp: Date.now(),
    });
  };

  const handleFollow = async () => {
    if (!stream || !user) return;

    try {
      setIsFollowing(!isFollowing);
    } catch (err) {
      console.error('Error following:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: stream?.title || 'Hasndel Live',
          text: `شاهد البث المباشر: ${stream?.title}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('تم نسخ الرابط!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-dark-100 flex items-center justify-center mb-4">
            <Radio className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">البث غير موجود</h2>
          <p className="text-gray-400 mb-6">قد يكون البث قد انتهى أو تم حذفه</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-medium transition-all"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  const addHeart = () => {
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: Math.random() * 60 - 30,
    };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 2000);
    handleLike();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !streamId) return;

    const msg = {
      odUserId: user?.uid || 'guest',
      userName: user?.displayName || 'زائر',
      userPhoto: user?.photoURL || '',
      message: newMessage.trim(),
      timestamp: Date.now(),
    };

    const messagesRef = ref(rtdb, `chats/${streamId}/messages`);
    push(messagesRef, msg).catch(console.error);
    setNewMessage('');
  };

  const enableVideo = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(console.error);
      setIsMuted(false);
      setShowPlayButton(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-300 z-50">
      {/* Single video element - never re-created */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      
      {/* Background image when no video */}
      {!hasVideo && (
        <div className="absolute inset-0 z-0">
          <img
            src={stream.hostPhoto || stream.coverImage}
            alt={stream.title}
            className="w-full h-full object-cover"
          />
          {/* Connecting indicator */}
          {stream.isLive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-lg">جاري الاتصال بالبث...</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
        </div>
      )}
      
      {/* Play button overlay */}
      {showPlayButton && (
        <div className="absolute inset-0 z-40 flex items-center justify-center cursor-pointer bg-black/70">
          <button
            onClick={enableVideo}
            className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-500 backdrop-blur-sm rounded-full text-white font-bold text-xl shadow-2xl"
          >
            🔊 اضغط لتشغيل الصوت والفيديو
          </button>
        </div>
      )}
      
      {/* Mute indicator when video is playing but muted */}
      {hasVideo && isMuted && !showPlayButton && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={enableVideo}
            className="px-4 py-2 bg-black/70 backdrop-blur-sm rounded-full text-white font-medium animate-pulse"
          >
            🔇 اضغط لتشغيل الصوت
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        <div className="flex items-center gap-2">
          {stream.isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-bold text-white">LIVE</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <Radio className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">{viewerCount}</span>
          </div>
        </div>

        <button className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Host Info */}
      <div className="absolute top-16 left-4 right-4 z-20">
        <div className="flex items-center gap-3">
          <img
            src={stream.hostPhoto}
            alt={stream.hostName}
            className="w-12 h-12 rounded-full border-2 border-primary-500"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{stream.hostName}</h3>
            <p className="text-sm text-gray-300 truncate">{stream.title}</p>
          </div>
          <button
            onClick={handleFollow}
            className={`px-4 py-2 rounded-full font-medium text-sm ${
              isFollowing ? 'bg-dark-100 text-white' : 'bg-primary-500 text-white'
            }`}
          >
            {isFollowing ? 'متابَع' : 'متابعة'}
          </button>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4 z-20">
        {/* Hearts Container */}
        <div className="relative">
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-20 h-40 pointer-events-none overflow-visible">
            <AnimatePresence>
              {hearts.map((heart) => (
                <motion.div
                  key={heart.id}
                  initial={{ y: 0, x: heart.x, opacity: 1, scale: 0.5 }}
                  animate={{ y: -150, x: heart.x, opacity: 0, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                  className="absolute bottom-0 left-1/2"
                >
                  <Heart className="w-8 h-8 text-red-500 fill-red-500" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={addHeart}
            className="w-14 h-14 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <Heart className="w-7 h-7 text-white fill-white" />
          </motion.button>
          <span className="text-xs text-white text-center block mt-1">{likeCount}</span>
        </div>

        <button
          onClick={() => setShowChat(!showChat)}
          className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>

        <button
          onClick={handleShare}
          className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <Share2 className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Chat Section - Bottom */}
      {showChat && (
        <div className="absolute bottom-4 left-0 right-20 z-20 px-4">
          {/* Messages */}
          <div 
            ref={chatContainerRef}
            className="h-48 overflow-y-auto mb-3 space-y-2 scrollbar-hide"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2 bg-black/40 backdrop-blur-sm rounded-2xl p-2 max-w-[85%]"
                >
                  <img
                    src={msg.userPhoto || `https://ui-avatars.com/api/?name=${msg.userName}&background=d946ef&color=fff`}
                    alt={msg.userName}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-primary-400">{msg.userName}</span>
                    <p className="text-sm text-white">{msg.message}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-4">
                لا توجد رسائل بعد
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="اكتب تعليقاً..."
              className="flex-1 bg-black/40 backdrop-blur-sm text-white placeholder-gray-400 px-4 py-3 rounded-full text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="w-11 h-11 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 rounded-full flex items-center justify-center"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </form>
        </div>
      )}

      {/* Stream ended overlay */}
      {!stream.isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
          <div className="text-center">
            <Radio className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">انتهى البث</h2>
            <p className="text-gray-400 mb-6">هذا البث قد انتهى</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-medium"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchLive;
