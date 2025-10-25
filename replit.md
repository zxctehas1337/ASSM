# Assm - Modern Web Messenger

## Project Overview
Assm is a modern, minimalist real-time messaging application built with React, TypeScript, Express, and WebSocket technology. The application features secure authentication, customizable user profiles, and instant message delivery.

## Architecture

### Frontend (React + TypeScript)
- **Auth Page**: Split-screen design with animated benefits carousel
  - Left panel: Black background with login/registration form
  - Right panel: White background with auto-rotating benefits
  - Smooth transitions and animations

- **Profile Setup**: Interactive onboarding experience
  - Real-time nickname availability checking
  - Animated color picker with 9 preset colors
  - Live avatar preview

- **Chat Interface**: Full-featured messaging UI
  - Left sidebar: User list with avatars
  - Right panel: Active chat with message history
  - Real-time message synchronization via WebSocket
  - Timestamp display (HH:MM format)

- **Settings Page**: Profile customization
  - Nickname updates with availability checking
  - Avatar color selection
  - Theme switcher (Light/Dark)

### Backend (Express + Node.js)
- RESTful API endpoints for authentication and data management
- WebSocket server for real-time messaging
- In-memory storage for users and messages
- bcrypt password hashing
- JWT-based session management

### Data Models
- **User**: id, username, password, nickname, avatarColor, theme, profileSetupComplete
- **Message**: id, senderId, recipientId, content, timestamp

## Design System
- Minimalist, clean interface
- User-customizable accent colors
- Light and dark theme support
- Smooth animations and transitions
- Responsive layout

## Tech Stack
- Frontend: React 18, TypeScript, Wouter (routing), TanStack Query
- Backend: Express, WebSocket (ws)
- Authentication: bcrypt, jsonwebtoken
- Styling: Tailwind CSS, shadcn/ui components
- Data Validation: Zod

## User Flow
1. User lands on authentication page
2. Sign up with nickname, username, and password
3. Complete profile setup (confirm nickname, choose avatar color)
4. Access chat interface with user list
5. Select user and start real-time conversation
6. Customize settings (theme, nickname, avatar color)

## Real-time Features
- Instant message delivery via WebSocket
- Live user list updates
- Message synchronization across sessions

## Security
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens for session management (7-day expiration)
- WebSocket connections authenticated with JWT verification
- Nickname and username uniqueness validation
- **IMPORTANT**: Set `SESSION_SECRET` environment variable in production (defaults to insecure value in development)

## Development Status
- ✅ Schema and TypeScript interfaces defined
- ✅ All frontend pages and components created
- ✅ Backend API fully implemented with JWT auth
- ✅ WebSocket real-time messaging integrated
- ✅ All API endpoints working
- ⏳ End-to-end testing in progress
