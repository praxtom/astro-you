# AstroYou — Product Development Plan

> **Vision**: The definitive AI-powered Vedic astrology platform  
> **Quality Bar**: Production-ready, premium, polished  
> **Last Updated**: 2026-01-05

---

## 📐 Architecture First

> **⚠️ MANDATORY**: Before implementing ANY feature, review [ARCHITECTURE.md](./ARCHITECTURE.md)

### Key Principles:

1. **Use `netlify/functions/shared/`** for all API integrations (astro-api.ts, gemini.ts)
2. **Use `src/types/`** for TypeScript interfaces — never inline types
3. **Use `src/hooks/`** for data access — never inline Firestore queries
4. **Shared collections** for global data (panchang, transits) — not per-user

---

## Product Philosophy

AstroYou is not an experiment or prototype. It is a **complete, premium astrology product** that combines:

- **Ancient Vedic Wisdom** — Authentic Jyotish calculations (Kundali, Dashas, Nakshatras)
- **Modern AI Intelligence** — Gemini-powered personalized interpretations
- **Premium User Experience** — Dark, sophisticated, spiritual aesthetic
- **Production Infrastructure** — Scalable, secure, performant

Every feature ships complete. Every interaction is polished. Every detail matters.

---

## Product Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AstroYou Platform                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                                  │
│  ├── Landing Page → Premium conversion-focused                  │
│  ├── Onboarding → Cosmic birth data collection                  │
│  ├── Dashboard → Personal celestial command center              │
│  ├── Synthesis → AI astrologer chat with charts                 │
│  ├── Reports → Detailed PDF astrological analyses               │
│  └── Settings → Profile, subscriptions, preferences             │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Netlify Functions)                                    │
│  ├── /api/kundali → Birth chart calculation                     │
│  ├── /api/synthesis → AI chat with Kundali context              │
│  ├── /api/horoscope → Daily/weekly/monthly predictions          │
│  ├── /api/transit → Real-time planetary positions               │
│  ├── /api/match → Compatibility analysis                        │
│  └── /api/auth/* → Authentication flows                         │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer (Firebase)                                          │
│  ├── Firestore → Users, Kundalis, Chats, Horoscopes            │
│  ├── Auth → Google, Email OTP, Anonymous                        │
│  └── Storage → Chart images, PDF reports                        │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                              │
│  ├── Gemini API → AI interpretations                            │
│  ├── Astrology API → Vedic calculations                         │
│  ├── Razorpay → Payments & subscriptions                        │
│  └── Resend → Transactional emails                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Development Phases

### Phase 1: Foundation ✅ COMPLETE

**Status**: Core infrastructure and UI complete

**Delivered**:

- Project architecture & build system
- Design system (premium dark cosmic theme)
- Landing page with 3D Kundali visualization
- 4-step onboarding wizard (full birth data capture)
- Firebase Auth (Google + Email OTP)
- AI Chat connected to Gemini
- Free trial system with auth gate
- Razorpay payment integration

---

### Phase 2: Kundali Engine ✅ COMPLETE

**Goal**: Transform birth data into authentic Vedic astrology

| Component           | Description                                       | Status      |
| ------------------- | ------------------------------------------------- | ----------- |
| Astrology API       | Calculate planetary positions, houses, nakshatras | ✅ COMPLETE |
| Kundali Schema      | Comprehensive TypeScript data model               | ✅ COMPLETE |
| 2D Chart Generation | North Indian SVG Kundali chart                    | ✅ COMPLETE |
| Cloud Storage       | Persistent chart data & profile mapping           | ✅ COMPLETE |
| AI Integration      | Feed real Kundali to Gemini (Jyotir)              | ✅ COMPLETE |
| Multimodal Chat     | Charts & 3D visualizations in chat context        | ✅ COMPLETE |

**Definition of Done**:

- User completes onboarding → Kundali calculated in <3 seconds
- Beautiful, accurate SVG chart displayed in Synthesis
- AI references actual planetary positions in responses
- Real-time birth chart data passed to Gemini for synthesis

---

### Phase 3: Intelligent Experience 🔄 IN PROGRESS

**Goal**: Deep, persistent, context-aware AI astrologer with immersive 3D visualization

| Component         | Description                       | Status      |
| ----------------- | --------------------------------- | ----------- |
| Chat Persistence  | Full history saved to nested FS   | ✅ COMPLETE |
| 3D Celestial View | Animated 3D Cosmic Circle         | ✅ COMPLETE |
| 3D Diamond View   | 3D North Indian Chart Layout      | ✅ COMPLETE |
| Asset Refinement  | 4K Textures & Sanskrit full names | ✅ COMPLETE |
| WebGL Stability   | Texture Pre-loading & Suspense    | ✅ COMPLETE |
| Conversation Mgmt | Multiple chats, titles, archive   | ⏳          |
| Transit Engine    | Real-time planetary positions     | ⏳          |

**Definition of Done**:

- Conversations persist across sessions
- Immersive 3D expansion allows toggling between Cosmic & Diamond views
- Planets feature realistic textures and full names
- UI remains stable with optimized WebGL rendering

---

### Phase 4: Daily Engagement

**Goal**: Become part of the user's daily spiritual routine

| Component          | Description                               | Status |
| ------------------ | ----------------------------------------- | ------ |
| Dashboard          | Personal celestial command center         | ⏳     |
| Daily Horoscope    | Personalized Moon sign + transit insights | ⏳     |
| Weekly Forecast    | Upcoming planetary influences             | ⏳     |
| Monthly Report     | Detailed predictions PDF                  | ⏳     |
| Push Notifications | Sunrise insights, cosmic events           | ⏳     |
| Email Digests      | Weekly/monthly email summaries            | ⏳     |

**Definition of Done**:

- User opens dashboard → sees fresh daily insight
- Notifications delivered at optimal times
- Reports are beautifully formatted PDFs
- Users check AstroYou every morning

---

### Phase 5: Relationships & Community

**Goal**: Connect users through astrological compatibility

| Component         | Description                           | Status |
| ----------------- | ------------------------------------- | ------ |
| User Profiles     | Public/private celestial identity     | ⏳     |
| Friends System    | Connect, follow, compare              | ⏳     |
| Kundali Matching  | Guna Milan (36-point score)           | ⏳     |
| Synastry Analysis | Two-chart overlay & AI interpretation | ⏳     |
| Share Features    | Export charts, share predictions      | ⏳     |

**Definition of Done**:

- Users can find and connect with others
- Compatibility reports are detailed and accurate
- Shareable chart images for social media
- Community feels alive and engaged

---

### Phase 6: Premium Business

**Goal**: Sustainable revenue through genuine value

| Component               | Description                      | Status |
| ----------------------- | -------------------------------- | ------ |
| Subscription Tiers      | Free / Premium / Pro             | ⏳     |
| Premium Features        | Unlimited chat, detailed reports | ⏳     |
| Subscription Management | Upgrade, downgrade, cancel       | ⏳     |
| Usage Analytics         | Track engagement, conversion     | ⏳     |
| Admin Dashboard         | Manage users, content, revenue   | ⏳     |

**Definition of Done**:

- Clear value proposition for each tier
- Seamless payment UX (Razorpay subscriptions)
- Healthy conversion rate from free to paid
- Admin can monitor business health

---

### Phase 7: Market Leadership

**Goal**: Close competitive gaps and establish market dominance

| Component                | Description                                    | Status |
| ------------------------ | ---------------------------------------------- | ------ |
| **Regional Languages**   | Hindi, Tamil, Telugu, Bengali, Marathi support | ⏳     |
| **Native Mobile Apps**   | iOS & Android apps with native push            | ⏳     |
| **Marketplace**          | Gemstones, pujas, remedies e-commerce          | ⏳     |
| **SEO Content Moat**     | Thousands of evergreen astrology articles      | ⏳     |
| **Human Astrologers**    | On-demand paid consultations marketplace       | ⏳     |
| **Advanced Astrology**   | Full D-chart system, KP, Lal Kitab             | ⏳     |
| **Community & Virality** | Forums, sharing, courses, WhatsApp integration | ⏳     |
| **Social Proof**         | Testimonials, credentials, media mentions      | ⏳     |

#### 7.1 Regional Language Support

- [ ] Hindi interface (primary)
- [ ] Tamil, Telugu, Bengali, Marathi support
- [ ] AI responses in regional languages
- [ ] Voice input in regional languages
- [ ] RTL support for Urdu (future)

#### 7.2 Native Mobile Apps

- [ ] React Native / Expo wrapper for existing PWA
- [ ] iOS App Store submission
- [ ] Android Play Store submission
- [ ] Native push notifications (FCM + APNs)
- [ ] Offline chart & horoscope access
- [ ] App Store Optimization (ASO)

#### 7.3 Marketplace & E-commerce

- [ ] Gemstone recommendations engine
- [ ] E-commerce for gemstones, rudraksha, yantras
- [ ] Puja booking services (temple partnerships)
- [ ] Personalized remedy kits
- [ ] Payment integration for physical products
- [ ] Shipping & fulfillment partnerships

#### 7.4 SEO Content Moat

- [ ] Daily/weekly/monthly horoscope pages (all 12 signs)
- [ ] Celebrity Kundali database (Bollywood, cricketers)
- [ ] Festival & Muhurat pages (Diwali, Navratri, etc.)
- [ ] Panchang calendar pages (daily Tithi traffic)
- [ ] Transit analysis articles (Saturn, Rahu/Ketu)
- [ ] "Best time to..." utility pages
- [ ] Structured data for rich snippets

#### 7.5 Human Astrologers Marketplace

- [ ] Astrologer onboarding & verification
- [ ] Profile pages with credentials & reviews
- [ ] Video/voice call infrastructure (WebRTC or Agora)
- [ ] Chat-based consultations
- [ ] Booking & scheduling system
- [ ] Payment split (platform commission)
- [ ] Quality ratings & feedback

#### 7.6 Advanced Astrological Features

- [ ] Prashna Kundali (horary astrology)
- [ ] Varshphal (annual solar return chart)
- [ ] Ashtakvarga scoring system
- [ ] Full divisional charts (D1-D60)
  - [ ] D10 (Dashamsha - career)
  - [ ] D7 (Saptamsha - children)
  - [ ] D12 (Dwadashamsha - parents)
  - [ ] D24 (Chaturvimshamsha - education)
- [ ] KP (Krishnamurti Paddhati) system
- [ ] Lal Kitab remedies
- [ ] Nadi Jyotish basics

#### 7.7 Community & Virality

- [ ] Discussion forums (by sign, topic)
- [ ] User-generated content moderation
- [ ] Daily horoscope WhatsApp sharing
- [ ] Social media auto-posting
- [ ] Astrology courses (beginner to advanced)
- [ ] Astrologer certification program
- [ ] Referral rewards system
- [ ] Influencer partnership program

#### 7.8 Social Proof & Trust

- [ ] User testimonials collection
- [ ] "Prediction came true" stories
- [ ] Astrologer credentials display
- [ ] Media mentions section
- [ ] Prediction accuracy tracking
- [ ] Trust badges & certifications

**Definition of Done**:

- Hindi language live with 90%+ coverage
- Native apps with 4.5+ star ratings
- Organic traffic growing 20%+ MoM
- Marketplace generating revenue
- Community active with daily engagement

---

## Quality Standards

### Code Quality

- TypeScript strict mode
- Comprehensive error handling
- Loading states for all async operations
- Proper accessibility (ARIA, keyboard nav)
- Performance optimization (lazy loading, memoization)

### User Experience

- <3 second page loads
- Smooth 60fps animations
- Mobile-first responsive design
- Intuitive navigation
- Delightful micro-interactions

### Security

- Firebase security rules enforced
- API rate limiting
- Input validation (client + server)
- Secrets never exposed to client
- HTTPS everywhere

### SEO & Marketing

- Meta tags on all pages
- Open Graph / Twitter cards
- Sitemap.xml
- Structured data (JSON-LD)
- Fast Core Web Vitals

---

## Success Metrics

| Metric                 | Target                    |
| ---------------------- | ------------------------- |
| Page Load              | <3s on 3G                 |
| Kundali Calculation    | <3s                       |
| AI Response            | <5s                       |
| Chat Satisfaction      | 4.5+ star rating (future) |
| Free → Paid Conversion | >5%                       |
| Daily Active Users     | Growth metric (future)    |

---

## Current Priority

**Phase 3.5: Quick Wins Sprint** is the immediate focus.

Based on competitive analysis, we score **C+ (11/25)** vs competitors' **A (22/25)**. We need to achieve parity on basics while maintaining our AI/UX advantage.

---

## 🔴 Competitive Gap Analysis

| Feature                   | AstroSage | Astroyogi | AstroYou | Status      |
| ------------------------- | --------- | --------- | -------- | ----------- |
| Daily Horoscope           | ✅        | ✅        | ❌       | 🔴 Critical |
| Transit Tracking          | ✅        | ✅        | ❌       | 🔴 Critical |
| Push Notifications        | ✅        | ✅        | ❌       | 🔴 Critical |
| Dasha Display             | ✅        | ✅        | ⚠️       | 🟡 Gap      |
| Yogas Detection           | ✅        | ✅        | ❌       | 🟡 Gap      |
| AI Conversational Quality | ⚠️        | ❌        | ✅       | 🟢 WINNING  |
| Chat Persistence          | ❌        | ❌        | ✅       | 🟢 WINNING  |
| 3D Visualization          | ❌        | ❌        | ✅       | 🟢 WINNING  |
| Modern UI/UX              | ⚠️        | ⚠️        | ✅       | 🟢 WINNING  |

---

## 🛣️ 8-Week Roadmap to Parity

### Week 1-2: Table Stakes (Quick Wins)

- [ ] Daily horoscope generation (API + Display)
- [ ] Current Dasha period display in sidebar
- [ ] Basic transit overlay
- [ ] Push notification infrastructure

### Week 3-4: Astrological Depth

- [ ] D9 (Navamsa) chart display
- [ ] Top 10 Yogas detection & display
- [ ] Weekly/Monthly predictions
- [ ] Panchang integration (Tithi, Nakshatra)

### Week 5-6: Engagement Loop

- [ ] Morning push notification with daily insight
- [ ] Transit alerts ("Saturn enters Pisces")
- [ ] Muhurat calendar
- [ ] Remedy section (Mantras, Fasting days)

### Week 7-8: Differentiation Polish

- [ ] Kundli matching (basic 36-point Guna Milan)
- [ ] Shareable chart images for social media
- [ ] Voice input for questions
- [ ] Memory references ("Last time you asked...")

---

## 💡 The AstroYou Promise

> "The only astrology app that **knows you, grows with you, and never scares you.**"

This positioning directly attacks:

- AstroSage's generic, transactional nature
- Astroyogi's fear-based upselling and ₹100/min pricing
- Kundli GPT's shallow, gimmicky approach
