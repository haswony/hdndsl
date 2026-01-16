import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, push, onValue, set, remove, onDisconnect } from 'firebase/database';
import { 
  Radio, Mic, MicOff, Video, VideoOff, 
  X, Users, Send, Heart, Gift, Share2,
  RotateCcw, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, rtdb } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

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

const StartLive: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<'preview' | 'live'>('preview');
  const [streamTitle, setStreamTitle] = useState('');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [streamId, setStreamId] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  
  const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Listen for chat messages when live
  useEffect(() => {
    if (!streamId || step !== 'live') return;
    
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
  }, [streamId, step]);

  // Auto scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for real viewer count when live
  useEffect(() => {
    if (!streamId || step !== 'live') return;
    
    const viewersRef = ref(rtdb, `streams/${streamId}/viewers`);
    const unsubscribe = onValue(viewersRef, (snapshot) => {
      const data = snapshot.val();
      setViewerCount(data ? Object.keys(data).length : 0);
    });
    return () => unsubscribe();
  }, [streamId, step]);

  // Set video stream when camera is on
  useEffect(() => {
    if (isCameraOn && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [isCameraOn, step]);

  // WebRTC: Listen for viewer offers and respond with answers
  useEffect(() => {
    if (!streamId || step !== 'live' || !streamRef.current) return;

    const offersRef = ref(rtdb, `webrtc/${streamId}/offers`);
    const processedViewers = new Set<string>();
    
    const unsubscribe = onValue(offersRef, async (snapshot) => {
      const offers = snapshot.val();
      if (!offers) return;

      for (const [viewerId, data] of Object.entries(offers) as [string, any][]) {
        if (!data?.offer || processedViewers.has(viewerId) || peerConnections.current.has(viewerId)) continue;
        
        processedViewers.add(viewerId);
        console.log('Processing offer from viewer:', viewerId);

        try {
          const pc = new RTCPeerConnection(ICE_SERVERS);
          peerConnections.current.set(viewerId, pc);

          // Add local tracks to connection
          streamRef.current?.getTracks().forEach(track => {
            console.log('Adding track to peer:', track.kind);
            pc.addTrack(track, streamRef.current!);
          });

          // Handle ICE candidates - send to viewer
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              console.log('Sending ICE candidate to viewer:', viewerId);
              push(ref(rtdb, `webrtc/${streamId}/broadcasterCandidates/${viewerId}`), 
                event.candidate.toJSON()
              ).catch(console.error);
            }
          };

          pc.oniceconnectionstatechange = () => {
            console.log(`ICE state for ${viewerId}:`, pc.iceConnectionState);
          };

          pc.onconnectionstatechange = () => {
            console.log(`Connection state for ${viewerId}:`, pc.connectionState);
          };

          // Set remote description and create answer
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          console.log('Remote description set for viewer:', viewerId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('Answer created for viewer:', viewerId);

          // Send answer to viewer
          await set(ref(rtdb, `webrtc/${streamId}/answers/${viewerId}`), {
            answer: { type: answer.type, sdp: answer.sdp }
          });
          console.log('Answer sent to viewer:', viewerId);

          // Listen for viewer's ICE candidates
          onValue(ref(rtdb, `webrtc/${streamId}/viewerCandidates/${viewerId}`), async (snap) => {
            const candidates = snap.val();
            if (candidates && pc.remoteDescription) {
              for (const cand of Object.values(candidates) as any[]) {
                console.log('Adding viewer ICE candidate:', viewerId);
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              }
            }
          });

        } catch (err) {
          console.error('WebRTC error for viewer:', viewerId, err);
          processedViewers.delete(viewerId);
        }
      }
    });

    return () => {
      unsubscribe();
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
    };
  }, [streamId, step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (streamId && step === 'live') {
        endStream();
      }
    };
  }, []);


  const startCamera = async () => {
    // First stop any existing streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true,
      });
      
      streamRef.current = stream;
      setIsCameraOn(true);
      setIsVideoOff(false);
      setIsMuted(false);
      
      // Wait for state update, then set video
      setTimeout(() => {
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.log('Play error:', e));
          };
        }
      }, 100);
      
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      
      if (err.name === 'NotReadableError' || err.name === 'AbortError') {
        alert('الكاميرا مشغولة من تطبيق آخر. أغلق التطبيقات الأخرى وحاول مرة أخرى.');
      } else if (err.name === 'NotAllowedError') {
        alert('يرجى السماح بالوصول للكاميرا من إعدادات المتصفح');
      } else if (err.name === 'NotFoundError') {
        alert('لم يتم العثور على كاميرا');
      } else {
        alert('فشل في تشغيل الكاميرا: ' + err.message);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOn(false);
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const switchCamera = async () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const currentFacing = videoTrack.getSettings().facingMode;
      stopCamera();
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: currentFacing === 'user' ? 'environment' : 'user'
          },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
      } catch (err) {
        startCamera();
      }
    }
  };

  // Start broadcasting - save to Firestore
  const startBroadcast = async () => {
    if (!user || !streamTitle.trim()) {
      alert('يرجى إدخال عنوان للبث');
      return;
    }

    setIsStarting(true);
    const newStreamId = `stream_${user.uid}_${Date.now()}`;
    
    try {
      // Save stream to Firestore
      await setDoc(doc(db, 'streams', newStreamId), {
        id: newStreamId,
        title: streamTitle,
        hostId: user.uid,
        hostName: user.displayName,
        hostPhoto: user.photoURL,
        coverImage: user.photoURL || 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800',
        viewerCount: 0,
        isLive: true,
        startedAt: Date.now(),
      });

      // Set presence in Realtime DB
      const presenceRef = ref(rtdb, `streams/${newStreamId}/broadcaster`);
      await set(presenceRef, {
        odUserId: user.uid,
        online: true,
        startedAt: Date.now(),
      });
      onDisconnect(presenceRef).remove();

      // Clean up old WebRTC data before starting
      await remove(ref(rtdb, `webrtc/${newStreamId}`));

      setStreamId(newStreamId);
      setStep('live');
    } catch (err) {
      console.error('Error starting broadcast:', err);
      alert('فشل في بدء البث. تأكد من تسجيل الدخول والسماح بالأذونات.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !streamId) return;

    const msg: ChatMessage = {
      id: `msg_${Date.now()}`,
      odUserId: user?.uid || 'guest',
      userName: user?.displayName || 'أنت',
      userPhoto: user?.photoURL || 'https://i.pravatar.cc/100?img=0',
      message: newMessage.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev.slice(-49), msg]);
    setNewMessage('');

    // Save to Firebase
    if (user && streamId) {
      const messagesRef = ref(rtdb, `chats/${streamId}/messages`);
      push(messagesRef, msg).catch(console.error);
    }
  };

  const addHeart = () => {
    const newHeart: FloatingHeart = {
      id: Date.now() + Math.random(),
      x: Math.random() * 60 - 30,
    };
    setHearts(prev => [...prev, newHeart]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 2000);

    // Save heart to Firebase
    if (streamId) {
      const heartsRef = ref(rtdb, `streams/${streamId}/hearts`);
      push(heartsRef, { odUserId: user?.uid, timestamp: Date.now() }).catch(console.error);
    }
  };

  const endStream = async () => {
    if (streamId && step === 'live') {
      try {
        // Update Firestore - mark as not live
        await updateDoc(doc(db, 'streams', streamId), {
          isLive: false,
          endedAt: Date.now(),
        });
        // Remove from Realtime DB
        await remove(ref(rtdb, `streams/${streamId}`));
        await remove(ref(rtdb, `chats/${streamId}`));
      } catch (err) {
        console.error('Error ending stream:', err);
      }
    }
    stopCamera();
    navigate('/');
  };

  // If not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-300 px-4">
        <div className="text-center">
          <Radio className="w-20 h-20 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">سجل الدخول للبث</h2>
          <p className="text-gray-400 mb-6">يجب تسجيل الدخول لبدء بث مباشر</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-medium"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Preview
  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-dark-300 py-6 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 bg-dark-100 rounded-full flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-xl font-bold text-white">بدء بث مباشر</h1>
          </div>

          {/* Camera Preview */}
          <div className="bg-dark-200 rounded-3xl overflow-hidden mb-6">
            <div className="aspect-[9/16] md:aspect-video relative bg-dark-400">
              {isCameraOn && streamRef.current ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ transform: 'scaleX(-1)' }}
                  className="w-full h-full object-cover bg-black"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <Camera className="w-16 h-16 text-gray-600 mb-4" />
                  <p className="text-gray-400 mb-4">اضغط لتشغيل الكاميرا</p>
                  <button
                    onClick={startCamera}
                    className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-full font-medium"
                  >
                    تشغيل الكاميرا
                  </button>
                </div>
              )}

              {isCameraOn && (
                <div className="absolute top-4 right-4 px-3 py-1.5 bg-yellow-500 rounded-full">
                  <span className="text-xs font-bold text-black">معاينة</span>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            {isCameraOn && (
              <div className="p-4 flex items-center justify-center gap-4">
                <button
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isMuted ? 'bg-red-500' : 'bg-dark-100'
                  }`}
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isVideoOff ? 'bg-red-500' : 'bg-dark-100'
                  }`}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
                </button>
                <button
                  onClick={switchCamera}
                  className="w-12 h-12 rounded-full bg-dark-100 flex items-center justify-center"
                >
                  <RotateCcw className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Stream Title */}
          <div className="bg-dark-200 rounded-2xl p-4 mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              عنوان البث
            </label>
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="أدخل عنوان البث..."
              className="w-full bg-dark-100 text-white placeholder-gray-500 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              maxLength={100}
            />
          </div>

          {/* Start Button */}
          <button
            onClick={startBroadcast}
            disabled={!isCameraOn || !streamTitle.trim() || isStarting}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2"
          >
            <Radio className="w-6 h-6" />
            {isStarting ? 'جاري البدء...' : 'بدء البث المباشر'}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Live
  return (
    <div className="fixed inset-0 bg-dark-300 z-50">
      {/* Full Screen Video */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20">
        <button
          onClick={endStream}
          className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <Users className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">{viewerCount}</span>
          </div>
        </div>

        <button
          onClick={switchCamera}
          className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* User Info */}
      <div className="absolute top-16 left-4 right-4 z-20">
        <div className="flex items-center gap-3">
          <img
            src={user.photoURL || ''}
            alt="Profile"
            className="w-12 h-12 rounded-full border-2 border-primary-500"
          />
          <div>
            <h3 className="font-bold text-white text-shadow">{user.displayName}</h3>
            <p className="text-sm text-gray-300">{streamTitle}</p>
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4 z-20">
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
        </div>

        <button className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
          <Gift className="w-6 h-6 text-yellow-400" />
        </button>

        <button className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
          <Share2 className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isMuted ? 'bg-red-500' : 'bg-black/50 backdrop-blur-sm'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isVideoOff ? 'bg-red-500' : 'bg-black/50 backdrop-blur-sm'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
        </button>

        <button
          onClick={endStream}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium"
        >
          إنهاء البث
        </button>
      </div>

      {/* Chat Section */}
      <div className="absolute bottom-20 left-0 right-20 z-20 px-4">
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
                className="flex items-start gap-2 bg-black/30 backdrop-blur-sm rounded-2xl p-2 max-w-[85%]"
              >
                <img src={msg.userPhoto} alt={msg.userName} className="w-8 h-8 rounded-full" />
                <div>
                  <span className="text-xs font-semibold text-primary-400">{msg.userName}</span>
                  <p className="text-sm text-white">{msg.message}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

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
            className="w-11 h-11 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default StartLive;
