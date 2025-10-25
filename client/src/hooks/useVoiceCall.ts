import { useState, useRef, useCallback, useEffect } from 'react';
import type { User } from '@shared/schema';

export interface CallState {
  isInCall: boolean;
  callType: 'incoming' | 'outgoing' | 'active' | null;
  otherUser: User | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  callDuration: number;
}

export interface WebRTCSignalingMessage {
  type: 'call_offer' | 'call_answer' | 'ice_candidate' | 'call_end' | 'call_error';
  targetUserId?: string;
  fromUserId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  error?: string;
}

export function useVoiceCall(wsRef: React.RefObject<WebSocket | null>) {
  const [callState, setCallState] = useState<CallState>({
    isInCall: false,
    callType: null,
    otherUser: null,
    isMuted: false,
    isSpeakerOn: true,
    callDuration: 0
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize WebRTC peer connection
  const initializePeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice_candidate',
          targetUserId: callState.otherUser?.id,
          candidate: event.candidate
        }));
      }
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteStreamRef.current = remoteStream;
      
      // Play remote audio
      if (audioRef.current) {
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play().catch(console.error);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setCallState(prev => ({ ...prev, callType: 'active' }));
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        endCall();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [wsRef, callState.otherUser?.id]);

  // Start outgoing call
  const startCall = useCallback(async (user: User) => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      localStreamRef.current = stream;
      
      // Initialize peer connection
      const peerConnection = initializePeerConnection();
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer through WebSocket
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'call_offer',
          targetUserId: user.id,
          offer: offer
        }));
      }

      setCallState({
        isInCall: true,
        callType: 'outgoing',
        otherUser: user,
        isMuted: false,
        isSpeakerOn: true,
        callDuration: 0
      });

    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  }, [initializePeerConnection, wsRef]);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (!callState.otherUser || !peerConnectionRef.current) return;

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      localStreamRef.current = stream;
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, stream);
      });

      // Create answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send answer through WebSocket
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'call_answer',
          targetUserId: callState.otherUser.id,
          answer: answer
        }));
      }

      setCallState(prev => ({ ...prev, callType: 'active' }));

    } catch (error) {
      console.error('Failed to answer call:', error);
      endCall();
    }
  }, [callState.otherUser, wsRef]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (callState.otherUser && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'call_end',
        targetUserId: callState.otherUser.id
      }));
    }
    endCall();
  }, [callState.otherUser, wsRef]);

  // End call
  const endCall = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop remote audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }

    // Send end call signal
    if (callState.otherUser && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'call_end',
        targetUserId: callState.otherUser.id
      }));
    }

    setCallState({
      isInCall: false,
      callType: null,
      otherUser: null,
      isMuted: false,
      isSpeakerOn: true,
      callDuration: 0
    });
  }, [callState.otherUser, wsRef]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setCallState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setCallState(prev => ({ ...prev, isSpeakerOn: !audioRef.current?.muted }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  // Handle incoming WebRTC signaling messages
  const handleSignalingMessage = useCallback(async (message: WebRTCSignalingMessage, users?: User[]) => {
    switch (message.type) {
      case 'call_offer':
        if (message.fromUserId && message.offer) {
          // Initialize peer connection for incoming call
          const peerConnection = initializePeerConnection();
          await peerConnection.setRemoteDescription(message.offer);
          
          // Find the calling user from the users list
          const callingUser = users?.find(u => u.id === message.fromUserId);
          
          setCallState(prev => ({
            ...prev,
            isInCall: true,
            callType: 'incoming',
            otherUser: callingUser || { id: message.fromUserId } as User
          }));
        }
        break;

      case 'call_answer':
        if (message.answer && peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(message.answer);
        }
        break;

      case 'ice_candidate':
        if (message.candidate && peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(message.candidate);
        }
        break;

      case 'call_end':
        endCall();
        break;

      case 'call_error':
        console.error('Call error:', message.error);
        endCall();
        break;
    }
  }, [initializePeerConnection, endCall]);

  return {
    callState,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    handleSignalingMessage,
    audioRef
  };
}
