import { useState, useRef, useCallback, useEffect } from 'react';
import { ref, set, onValue, push, onDisconnect, remove } from 'firebase/database';
import { rtdb } from '../config/firebase';

interface WebRTCConfig {
  streamId: string;
  userId: string;
  isBroadcaster: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useWebRTC = ({ streamId, userId, isBroadcaster }: WebRTCConfig) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const startBroadcast = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true,
      });
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = ref(rtdb, `streams/${streamId}/broadcaster/iceCandidates`);
          push(candidatesRef, event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerRef = ref(rtdb, `streams/${streamId}/broadcaster/offer`);
      await set(offerRef, {
        type: offer.type,
        sdp: offer.sdp,
      });

      const answerRef = ref(rtdb, `streams/${streamId}/viewers`);
      onValue(answerRef, async (snapshot) => {
        const viewers = snapshot.val();
        if (viewers) {
          Object.keys(viewers).forEach(async (viewerId) => {
            const viewer = viewers[viewerId];
            if (viewer.answer && !pc.currentRemoteDescription) {
              const answerDesc = new RTCSessionDescription(viewer.answer);
              await pc.setRemoteDescription(answerDesc);
            }
          });
        }
      });

      setIsConnected(true);
      
      const presenceRef = ref(rtdb, `streams/${streamId}/broadcaster/presence`);
      await set(presenceRef, true);
      onDisconnect(presenceRef).remove();

    } catch (err) {
      console.error('Error starting broadcast:', err);
      setError('فشل في بدء البث. تأكد من السماح بالوصول للكاميرا والمايكروفون.');
    }
  }, [streamId]);

  const watchStream = useCallback(async () => {
    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = ref(rtdb, `streams/${streamId}/viewers/${userId}/iceCandidates`);
          push(candidatesRef, event.candidate.toJSON());
        }
      };

      const offerRef = ref(rtdb, `streams/${streamId}/broadcaster/offer`);
      onValue(offerRef, async (snapshot) => {
        const offer = snapshot.val();
        if (offer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          const answerRef = ref(rtdb, `streams/${streamId}/viewers/${userId}/answer`);
          await set(answerRef, {
            type: answer.type,
            sdp: answer.sdp,
          });
        }
      });

      const candidatesRef = ref(rtdb, `streams/${streamId}/broadcaster/iceCandidates`);
      onValue(candidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          Object.values(candidates).forEach(async (candidate) => {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit));
            } catch (e) {
              console.error('Error adding ICE candidate:', e);
            }
          });
        }
      });

      setIsConnected(true);

      const presenceRef = ref(rtdb, `streams/${streamId}/viewersList/${userId}`);
      await set(presenceRef, {
        odUserId: userId,
        joinedAt: Date.now(),
      });
      onDisconnect(presenceRef).remove();

    } catch (err) {
      console.error('Error watching stream:', err);
      setError('فشل في الاتصال بالبث.');
    }
  }, [streamId, userId]);

  const stopStream = useCallback(async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (isBroadcaster) {
      const streamRef = ref(rtdb, `streams/${streamId}`);
      await remove(streamRef);
    } else {
      const viewerRef = ref(rtdb, `streams/${streamId}/viewers/${userId}`);
      await remove(viewerRef);
      const presenceRef = ref(rtdb, `streams/${streamId}/viewersList/${userId}`);
      await remove(presenceRef);
    }

    setIsConnected(false);
  }, [localStream, streamId, userId, isBroadcaster]);

  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [localStream]);

  return {
    localStream,
    remoteStream,
    isConnected,
    error,
    startBroadcast,
    watchStream,
    stopStream,
    localVideoRef,
    remoteVideoRef,
  };
};
