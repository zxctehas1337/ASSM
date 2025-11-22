/// <reference types="vite/client" />

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { User } from '@shared/schema';
import { toast } from '@/hooks/use-toast';

// Environment variables with fallback values
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME || 'cf1c508f38e5750fc60c572d';
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL || '6xcE3PB8Zg3RW1AA';

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
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:a.relay.metered.ca:80',
          username: process.env.TURN_USERNAME || 'cf1c508f38e5750fc60c572d',
          credential: process.env.TURN_CREDENTIAL || '6xcE3PB8Zg3RW1AA',
        },
        {
          urls: 'turn:a.relay.metered.ca:443',
          username: process.env.TURN_USERNAME || 'cf1c508f38e5750fc60c572d',
          credential: process.env.TURN_CREDENTIAL || '6xcE3PB8Zg3RW1AA',
        },
        {
          urls: 'turn:a.relay.metered.ca:443?transport=tcp',
          username: process.env.TURN_USERNAME || 'cf1c508f38e5750fc60c572d',
          credential: process.env.TURN_CREDENTIAL || '6xcE3PB8Zg3RW1AA',
        }
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
      // Check user availability via WebSocket
      if (wsRef.current) {
        const isAvailable = await new Promise<boolean>((resolve) => {
          const timeoutId = setTimeout(() => resolve(false), 5000);
          
          wsRef.current?.send(JSON.stringify({
            type: 'check_user_availability',
            targetUserId: user.id
          }));

          const availabilityHandler = (event: MessageEvent) => {
            const message = JSON.parse(event.data);
            if (message.type === 'user_availability' && message.userId === user.id) {
              clearTimeout(timeoutId);
              wsRef.current?.removeEventListener('message', availabilityHandler);
              resolve(message.available);
            }
          };

          wsRef.current?.addEventListener('message', availabilityHandler);
        });

        if (!isAvailable) {
          alert('User is not currently available for calls.');
          return;
        }
      }

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

      // Create offer with timeout
      const offerCreationTimeout = setTimeout(() => {
        endCall();
        alert('Call setup timed out. Please try again.');
      }, 15000);

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      clearTimeout(offerCreationTimeout);

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
      alert('Failed to start call. Please check microphone permissions and network connection.');
      endCall();
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
          // Only set to incoming if not already in an outgoing call
          if (callState.callType !== 'outgoing') {
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
  }, [initializePeerConnection, endCall, callState.callType]);

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
