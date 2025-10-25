# Voice Calling Feature

This application now includes voice calling functionality using WebRTC technology. Users can make voice calls to each other directly through the chat interface.

## Features

- **Peer-to-Peer Voice Calls**: Direct audio communication between users using WebRTC
- **Real-time Signaling**: WebSocket-based signaling for call setup and management
- **Call Controls**: Mute/unmute microphone, speaker on/off, call end
- **Call States**: Incoming, outgoing, and active call states with appropriate UI
- **User-friendly Interface**: Modal-based call interface with user avatars and call duration

## How to Use

1. **Start a Call**: Click the phone icon next to a user's name in the chat header
2. **Answer a Call**: When receiving an incoming call, click the green phone button to answer
3. **Reject a Call**: Click the red phone button to reject an incoming call
4. **During a Call**:
   - Click the microphone icon to mute/unmute your microphone
   - Click the speaker icon to turn speaker on/off
   - Click the red phone button to end the call

## Technical Implementation

### WebRTC Signaling
- Uses WebSocket for signaling between peers
- Handles offer/answer exchange for peer connection setup
- Manages ICE candidate exchange for NAT traversal
- Supports STUN servers for connection establishment

### Audio Handling
- Requests microphone access when starting/answering calls
- Streams audio directly between peers (no server relay)
- Provides local audio controls (mute/unmute)
- Plays remote audio through HTML5 audio element

### Call States
- **Outgoing**: User initiates a call
- **Incoming**: User receives a call offer
- **Active**: Call is connected and audio is flowing
- **Ended**: Call is terminated

## Browser Requirements

- Modern browser with WebRTC support
- Microphone access permissions
- HTTPS connection (required for WebRTC in production)

## Security Considerations

- All audio data is encrypted end-to-end
- No audio data is stored on the server
- Signaling messages are authenticated via JWT tokens
- Microphone access is only requested when needed
