# AstroYou — Development Tasks

> **Quality Bar**: Production-ready, premium, polished  
> **Legend**: ✅ Complete | 🔄 In Progress | ⏳ Not Started | 🔴 Blocked

---

## 🚀 Deployment & Infrastructure

### Production Setup

- [ ] Configure Netlify environment variables
- [ ] Add production domain to Firebase Auth
- [ ] Configure Resend production domain (for deliverability)
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Configure CDN caching headers
- [ ] Set up staging environment

### Security Hardening

- [ ] Audit Firebase security rules
- [ ] Add API rate limiting
- [ ] Implement CSRF protection
- [ ] Add input sanitization on all endpoints
- [ ] Validate all user inputs server-side
- [ ] Security audit before launch

### Performance Optimization

- [ ] Bundle analysis and optimization
- [ ] Image optimization pipeline
- [ ] Lazy load non-critical components
- [ ] Preload critical assets
- [ ] Measure and optimize Core Web Vitals

---

## Phase 1: Foundation ✅ COMPLETE

### Core Infrastructure

- [x] Initialize Vite + React + TypeScript project
- [x] Configure Netlify deployment
- [x] Set up Firebase project (Auth, Firestore, Storage)
- [x] Create folder structure and routing

### Design System

- [x] Create CSS variables and theme
- [x] Implement dark cosmic aesthetic
- [x] Add glassmorphism card styles
- [x] Configure typography (Inter, display fonts)
- [x] Add animation utilities

### Landing Page

- [x] Create 3D CelestialEngine component
- [x] Build North Indian Kundali grid visualization
- [x] Animate planets with orbital motion
- [x] Add hero section with CTAs
- [x] Create feature cards section
- [x] Build footer with navigation

### Onboarding Flow

- [x] Step 1: Name & Gender capture
- [x] Step 2: Date & Time of birth
- [x] Step 3: Place of birth
- [x] Step 4: Current location with geolocation
- [x] Session storage for guest data persistence
- [x] Firestore sync for authenticated users

### Authentication System

- [x] Create AuthContext for state management
- [x] Build AuthModal component
- [x] Implement Google Sign-In (popup/redirect)
- [x] Implement Email OTP authentication
- [x] Create send-otp serverless function
- [x] Create verify-otp serverless function
- [x] Integrate Resend for email delivery
- [x] Handle redirect result for production

### AI Chat (Synthesis)

- [x] Create chat interface component
- [x] Connect to Gemini 1.5 Flash API
- [x] Personalize prompts with birth data
- [x] Implement 5-minute free trial timer
- [x] Persist trial usage in localStorage
- [x] Show auth modal on trial expiry
- [x] Enforce onboarding before chat access

### Payment System

- [x] Create useRazorpay hook for script loading
- [x] Create razorpay-order serverless function
- [x] Create razorpay-verify serverless function
- [x] Implement "Celestial Minutes" credit system
- [x] Add buy credits button to chat header
- [x] Update Firestore on successful payment
- [x] Deduct credits per message for paid users

---

## Phase 2: Kundali Engine ⏳

### Astrology API Integration

- [ ] Research and compare API providers (Astrology-API.io, Prokerala)
- [ ] Sign up and obtain API credentials
- [ ] Add `ASTROLOGY_API_KEY` to environment
- [ ] Create `netlify/functions/kundali.ts`
- [ ] Implement birth chart calculation endpoint
- [ ] Handle timezone conversion for birth time
- [ ] Implement geocoding for birth place (lat/lng)
- [ ] Parse API response into structured data
- [ ] Cache calculations to reduce API calls
- [ ] Handle API errors with user-friendly messages

### Kundali Data Model

- [ ] Create `/src/types/kundali.ts`
- [ ] Define comprehensive interfaces:
  - [ ] `KundaliData` (main container)
  - [ ] `PlanetPosition` (planet, sign, degree, house, nakshatra)
  - [ ] `HouseData` (house number, sign, planets)
  - [ ] `DashaData` (planet, start date, end date)
  - [ ] `NakshatraData` (name, pada, lord)
  - [ ] `YogaData` (name, type, description)
- [ ] Add Zod validation schemas
- [ ] Create utility functions for data transformation

### Kundali Calculation Flow

- [ ] Trigger calculation after onboarding completion
- [ ] Show full-screen loading animation during calculation
- [ ] Validate all inputs before API call
- [ ] Parse and store result in Firestore
- [ ] Handle partial data (unknown birth time)
- [ ] Redirect to dashboard after successful calculation
- [ ] Allow recalculation if birth data updated

### SVG Chart Component

- [ ] Create `src/components/KundaliChart.tsx`
- [ ] Implement North Indian diamond grid layout
- [ ] Render 12 houses with proper geometry
- [ ] Add zodiac sign abbreviations (Me, Ve, Ma, etc.)
- [ ] Place planet glyphs in correct houses
- [ ] Handle multiple planets in same house
- [ ] Add retrograde indicators (R)
- [ ] Add degree markers
- [ ] Create color-coded planet legend
- [ ] Make chart fully responsive
- [ ] Add print-friendly styles
- [ ] Support dark and light themes

### Chart Storage & Delivery

- [ ] Convert SVG to PNG for storage
- [ ] Upload chart to Firebase Storage on generation
- [ ] Organize storage: `/users/{uid}/charts/birth_chart.png`
- [ ] Store chart URL in Firestore user profile
- [ ] Generate thumbnail for list views
- [ ] Implement chart regeneration on profile update

### Enhanced AI Integration

- [ ] Load full Kundali data in Synthesis page
- [ ] Create structured Kundali summary for Gemini:
  ```
  Lagna: {sign} at {degree}
  Moon: {sign}, {nakshatra} ({pada})
  Current Dasha: {planet}-{sub} until {date}
  Planets: {detailed positions}
  Key Yogas: {list}
  ```
- [ ] Update Gemini system prompt with Vedic terminology
- [ ] Add prompt instructions for referencing specific placements
- [ ] Test and refine AI accuracy

### Multimodal Chat Experience

- [ ] Detect chart-related user queries
- [ ] Keywords: "chart", "house", "planet", "show me", "visualize"
- [ ] Generate relevant chart on detection
- [ ] Return chart image URL in API response
- [ ] Render inline chart in chat message
- [ ] Add chart zoom/expand modal
- [ ] Allow downloading chart from chat

---

## Phase 3: Intelligent Experience ⏳

### Chat Persistence

- [ ] Create Firestore structure for chats
- [ ] Save messages after each exchange
- [ ] Load full history on page mount
- [ ] Implement infinite scroll for long histories
- [ ] Show message timestamps
- [ ] Add "typing" indicator during AI response

### Conversation Management

- [ ] Create chat sidebar component
- [ ] List all conversations (newest first)
- [ ] Auto-generate titles from first message
- [ ] Allow manual title editing
- [ ] "New Chat" button
- [ ] Delete conversation (with confirmation)
- [ ] Archive old conversations
- [ ] Search across conversations (future)

### Vision-Based Kundali Parsing

- [ ] Add image upload button to chat
- [ ] Accept common formats (JPG, PNG, PDF)
- [ ] Upload to Firebase Storage
- [ ] Send to Gemini Vision API
- [ ] Prompt: "Extract all planet positions from this Kundali chart"
- [ ] Parse extracted text into Kundali structure
- [ ] Show parsed results for user confirmation
- [ ] Save confirmed data to Firestore
- [ ] Handle low-quality or unclear images

### Transit Engine

- [ ] Create `netlify/functions/transit.ts`
- [ ] Fetch current planetary positions
- [ ] Calculate transits relative to natal chart
- [ ] Create transit overlay visualization
- [ ] Highlight significant transits (conjunctions, aspects)
- [ ] Generate transit-based predictions

### Advanced Predictions

- [ ] Calculate current Dasha/Antardasha period
- [ ] Generate Dasha timeline visualization
- [ ] Create yearly prediction summary
- [ ] Create monthly prediction summary
- [ ] Identify upcoming significant transits
- [ ] AI-generated remedies for challenging periods

---

## Phase 4: Daily Engagement ⏳

### Dashboard

- [ ] Create `src/pages/Dashboard.tsx`
- [ ] Add route `/dashboard`
- [ ] Design "Day at a Glance" widget:
  - [ ] Daily mood/energy indicator
  - [ ] Today's focus area
  - [ ] Lucky times/colors
- [ ] Kundali summary card with chart thumbnail
- [ ] Quick action buttons (Chat, Reports, Settings)
- [ ] Credit balance display
- [ ] Upcoming planetary events card

### Daily Horoscope Engine

- [ ] Create `netlify/functions/horoscope.ts`
- [ ] Calculate daily predictions based on:
  - [ ] Moon sign
  - [ ] Current transits
  - [ ] Dasha period
- [ ] Cache daily horoscope in Firestore
- [ ] Return cached if already generated today
- [ ] Regenerate at midnight (user's timezone)
- [ ] AI-powered interpretation

### Weekly & Monthly Forecasts

- [ ] Generate comprehensive weekly forecast
- [ ] Generate detailed monthly forecast
- [ ] Create forecast email template
- [ ] Allow users to set delivery preferences
- [ ] Premium: detailed analysis with remedies

### Push Notifications

- [ ] Integrate Firebase Cloud Messaging
- [ ] Request notification permission
- [ ] Store FCM token in user profile
- [ ] Create notification scheduler function
- [ ] Daily sunrise insight notification
- [ ] Cosmic event alerts (retrogrades, eclipses, full moons)
- [ ] Important transit notifications
- [ ] Allow notification preferences

### PDF Reports

- [ ] Create PDF generation utility
- [ ] Design beautiful report template
- [ ] Include:
  - [ ] Birth chart visualization
  - [ ] Planetary positions table
  - [ ] House analysis
  - [ ] Dasha periods
  - [ ] Current transit analysis
  - [ ] Predictions and remedies
- [ ] Generate on-demand
- [ ] Email delivery option
- [ ] Premium feature gating

---

## Phase 5: Relationships & Community ⏳

### User Profiles

- [ ] Add `username` field to user schema
- [ ] Username uniqueness validation
- [ ] Create public profile page `/u/{username}`
- [ ] Privacy settings (public/private chart)
- [ ] Profile picture upload
- [ ] Bio / personal description
- [ ] Share profile link button

### Friends System

- [ ] Create `friends` subcollection in Firestore
- [ ] Search users by email or username
- [ ] Send friend request
- [ ] Receive request notifications
- [ ] Accept / Decline UI
- [ ] Friends list in dashboard
- [ ] View friends' public charts
- [ ] Unfriend functionality

### Kundali Matching

- [ ] Create partner details input form
- [ ] Calculate partner's Kundali
- [ ] Implement Guna Milan algorithm (36 points)
- [ ] Calculate individual guna scores:
  - [ ] Varna (1 point)
  - [ ] Vashya (2 points)
  - [ ] Tara (3 points)
  - [ ] Yoni (4 points)
  - [ ] Graha Maitri (5 points)
  - [ ] Gana (6 points)
  - [ ] Bhakoot (7 points)
  - [ ] Nadi (8 points)
- [ ] Generate detailed compatibility report
- [ ] AI interpretation of compatibility

### Chart Comparison

- [ ] Synastry view (two charts overlaid)
- [ ] Side-by-side chart comparison
- [ ] Highlight inter-chart aspects
- [ ] AI-powered relationship insights
- [ ] Save comparison for future reference

### Social Features

- [ ] Share chart as image
- [ ] Share predictions on social media
- [ ] Generate Open Graph images for sharing
- [ ] Referral system (invite friends, earn credits)

---

## Phase 6: Premium Business ⏳

### Subscription Tiers

- [ ] Define tier structure:
  - [ ] Free: 5 credits, basic features
  - [ ] Premium (₹499/mo): Unlimited chat, daily horoscopes
  - [ ] Pro (₹999/mo): All Premium + reports + priority
- [ ] Create pricing page
- [ ] Implement feature gating
- [ ] Show upgrade prompts at right moments

### Razorpay Subscriptions

- [ ] Integrate Razorpay Subscriptions API
- [ ] Create subscription plans in Razorpay dashboard
- [ ] Implement subscription checkout flow
- [ ] Handle subscription webhooks
- [ ] Update user tier on webhook events
- [ ] Implement grace period for failed payments

### Subscription Management

- [ ] Create `/settings/subscription` page
- [ ] Show current plan and billing date
- [ ] Upgrade / downgrade options
- [ ] View payment history
- [ ] Cancel subscription (with retention flow)
- [ ] Invoice download

### Admin Dashboard

- [ ] Create `/admin` protected route
- [ ] Role-based access control
- [ ] User analytics:
  - [ ] Total users
  - [ ] Active users (DAU, MAU)
  - [ ] Conversion rate
  - [ ] Churn rate
- [ ] Revenue dashboard:
  - [ ] MRR
  - [ ] Transaction history
  - [ ] Subscription breakdown
- [ ] Content moderation tools
- [ ] User management (view, suspend, delete)

---

## 🔧 Technical Excellence 🔄

### Error Handling

- [x] Global error boundary component
- [x] Friendly error messages for all failures
- [x] Retry mechanisms for network errors
- [x] Offline state detection and handling
- [ ] Error logging to monitoring service

### Loading States

- [x] Skeleton loaders for all data-fetching views
- [ ] Progress indicators for long operations
- [ ] Optimistic UI updates where appropriate
- [ ] Smooth transitions between states

### Accessibility

- [x] ARIA labels on all interactive elements
- [x] Keyboard navigation support
- [ ] Screen reader testing
- [ ] Color contrast compliance (WCAG AA)
- [x] Focus management for modals

### SEO & Discoverability

- [x] Add meta tags to all pages
- [x] Open Graph tags for social sharing
- [x] Twitter Card tags
- [x] Structured data (JSON-LD)
- [x] Create sitemap.xml
- [x] Create robots.txt
- [x] Implement canonical URLs

### Testing

- [ ] Unit tests for utility functions
- [ ] Component tests for critical UI
- [ ] Integration tests for auth flows
- [ ] E2E tests with Playwright
- [ ] Visual regression tests

### Documentation

- [ ] API documentation for all endpoints
- [ ] Component storybook (optional)
- [ ] README with setup instructions
- [ ] Contributing guidelines

---

## � Launch Checklist

### Pre-Launch

- [ ] All Phase 1-4 features complete
- [ ] Full security audit passed
- [ ] Performance benchmarks met
- [ ] Cross-browser testing complete
- [ ] Mobile responsiveness verified
- [ ] Accessibility audit passed
- [ ] Legal: Privacy Policy
- [ ] Legal: Terms of Service
- [ ] Analytics setup (Firebase Analytics)
- [ ] Error monitoring active

### Launch Day

- [ ] DNS configured for production domain
- [ ] SSL certificate active
- [ ] CDN configured
- [ ] Database backups enabled
- [ ] Monitoring dashboards ready
- [ ] Support channels ready

### Post-Launch

- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Iterate based on usage patterns
- [ ] Plan Phase 5-6 features
