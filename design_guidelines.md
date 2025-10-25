# Design Guidelines for "Assm" Messenger

## Design Approach
**Custom Minimalist Messenger Design** - A clean, modern messenger interface with custom split-screen authentication and real-time chat functionality. The design emphasizes simplicity, smooth animations, and personalization through user accent colors.

## Core Design Principles
1. **Minimalist Philosophy**: Clean interfaces with generous whitespace, focusing on functionality
2. **Smooth Transitions**: All screen changes, message appearances, and interactions feature fluid animations
3. **User Personalization**: Each user selects an accent color that appears throughout their interface
4. **Real-time Visual Feedback**: Instant visual confirmation of messages and user actions

## Typography
- **Font Family**: System fonts for optimal performance (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- **Headings**: 
  - H1: 32px, weight 600 (Auth screen titles)
  - H2: 24px, weight 600 (Section headers)
  - H3: 18px, weight 500 (User names, chat headers)
- **Body Text**: 15px, weight 400 (Messages, form labels)
- **Small Text**: 13px, weight 400 (Timestamps, hints)
- **Line Height**: 1.5 for body text, 1.2 for headings

## Layout System
**Spacing Units**: Use increments of 4px - primary values are 8px, 12px, 16px, 24px, 32px
- **Component Padding**: 16px for cards, 24px for major sections
- **Message Spacing**: 8px between consecutive messages, 16px for time gaps
- **Form Fields**: 12px vertical spacing between inputs

## Color System
**Base Palette**:
- **Black Background**: #000000 (auth left panel, dark theme)
- **White Background**: #FFFFFF (auth right panel, light theme)
- **Gray Scale**: 
  - Light Gray: #F5F5F5 (hover states, subtle backgrounds)
  - Medium Gray: #E0E0E0 (borders, dividers)
  - Dark Gray: #333333 (text on light backgrounds)
  - Soft Gray: #666666 (secondary text)

**User Accent Colors**: Users select their personal accent color during setup
- Applied to: Avatar backgrounds, active chat indicators, send buttons, highlights
- Default options: Blue (#2196F3), Green (#4CAF50), Purple (#9C27B0), Orange (#FF9800), Red (#F44336), Teal (#009688)

**CSS Variables Structure**:
```
--main-color: User's accent color
--accent: Lighter shade of main color
--bg: Background color (depends on theme)
--text-primary: Primary text color
--text-secondary: Secondary text color
--border: Border color
```

## Screen-Specific Layouts

### 1. Authentication Screen (Full-Screen Split)
**Layout**: 50/50 horizontal split
- **Left Panel** (Black #000000):
  - Centered vertical form container (max-width: 400px)
  - Form fields with white text and borders
  - Toggle between "Sign Up" and "Sign In" modes
  - Fields: Nickname, Username, Password (all required)
  - Primary button at bottom
  
- **Right Panel** (White #FFFFFF):
  - Animated benefits carousel (OpenAI-style slide animation)
  - Main benefit text (large, bold)
  - List of sub-benefits below
  - Dot indicators showing current slide
  - Auto-advance every 4 seconds with smooth fade/slide transition
  - Benefits to showcase: "Real-time messaging", "Secure encryption", "Custom themes", "Simple & fast"

### 2. Profile Setup Screen (Post-Login)
**Layout**: Centered modal-style interface (max-width: 500px)
- **Nickname Confirmation**:
  - Large input field with real-time availability check
  - Visual indicator (green checkmark/red X) next to field
  - "Username available" / "Username taken" feedback text
  
- **Avatar Color Selector**:
  - Animated color picker interface
  - Display circular color swatches (60px diameter)
  - Grid layout: 3 columns of color options
  - Selected color shows larger preview circle above (100px)
  - Smooth scale animation on selection
  - "Continue to Messenger" button at bottom

### 3. Main Chat Interface
**Layout**: Full viewport split
- **Left Sidebar** (280px fixed width):
  - Search bar at top (40px height)
  - Scrollable user list below
  - Each user item: 
    - Circular avatar (40px) with their accent color
    - Nickname and last message preview
    - Timestamp of last message
    - Unread badge if applicable
  - Active chat highlighted with subtle background
  
- **Right Chat Area** (Remaining width):
  - **Header** (60px height):
    - Selected user's avatar and nickname
    - "Call" button (audio/video icon)
    - Settings gear icon
  - **Messages Area** (Scrollable):
    - Messages appear from bottom
    - Own messages: right-aligned, accent color background
    - Other messages: left-aligned, light gray background
    - Timestamps (HH:MM format) below each message cluster
    - Smooth fade-in animation for new messages
  - **Input Area** (Fixed bottom):
    - Text input field with rounded corners
    - Send button (paper plane icon) with accent color
    - Auto-expand textarea (max 120px height)

### 4. Settings Page
**Layout**: Centered container (max-width: 600px)
- **Section 1 - Profile**:
  - Nickname change field with availability check
  - Current avatar color preview
  - "Change color" button opens color picker modal
  
- **Section 2 - Theme Selection**:
  - Radio buttons or visual theme cards
  - Options: Light, Dark, Custom
  - Live preview of selected theme
  
- **Section 3 - Notifications**:
  - Toggle switches for:
    - Message notifications
    - Sound effects
    - Desktop notifications
  - Volume slider for notification sounds

## Component Library

### Buttons
- **Primary Button**: 
  - Background: User's accent color
  - Text: White, 15px, weight 500
  - Padding: 12px 24px
  - Border-radius: 8px
  - Hover: Slightly darker shade (10% darker)
  - Transition: 200ms ease
  
- **Secondary Button**:
  - Background: Transparent
  - Border: 1px solid accent color
  - Text: Accent color
  - Same dimensions as primary

### Form Inputs
- **Text Fields**:
  - Height: 44px
  - Border: 1px solid #E0E0E0
  - Border-radius: 6px
  - Padding: 0 16px
  - Focus: Border color changes to accent color, subtle shadow
  - Transition: 150ms ease

### Message Bubbles
- **Own Messages**:
  - Background: User's accent color
  - Text: White
  - Border-radius: 16px 16px 4px 16px
  - Max-width: 70%
  - Padding: 10px 14px
  
- **Received Messages**:
  - Background: #F5F5F5
  - Text: #333333
  - Border-radius: 16px 16px 16px 4px
  - Same dimensions as own messages

### User List Items
- Height: 64px
- Padding: 12px
- Hover: Background #F5F5F5
- Active: Background #E8F4F8 (light accent tint)
- Transition: 150ms ease

## Animations

### Screen Transitions
- Fade in/out: 300ms ease-in-out
- Slide transitions: 250ms cubic-bezier(0.4, 0, 0.2, 1)

### Message Animations
- New message: Fade in + slide up (200ms)
- Typing indicator: Pulsing dots animation

### Benefit Carousel (Auth Screen)
- Slide animation: 500ms ease-in-out
- Fade overlay: 300ms
- Dot indicator: Scale pulse on active (150ms)

### Hover Effects
- Buttons: Scale 1.02 (100ms)
- User list items: Subtle lift with shadow (150ms)
- Color swatches: Scale 1.1 (120ms)

### Color Picker Modal
- Modal backdrop: Fade in (200ms)
- Modal content: Scale from 0.9 to 1 + fade (250ms)

## Responsive Behavior
- **Desktop** (>768px): Full split-screen layouts as described
- **Tablet** (768px): Collapsible sidebar, full-width chat when active
- **Mobile** (<768px): 
  - Auth screen: Vertical stack (benefits above form)
  - Chat: Full-screen chat view, sidebar as overlay/drawer
  - Bottom navigation for settings access

## Images
**No hero images required** - This is a functional messenger application focused on clean UI and real-time communication rather than marketing content.

## Accessibility Notes
- All interactive elements have visible focus states (accent color outline)
- Minimum touch target size: 44x44px
- Color contrast ratios meet WCAG AA standards
- Form inputs have associated labels
- Error messages clearly visible with icons and text