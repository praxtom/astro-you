# Project Atman: The Conscious Guru Architecture
*Moving AstroYou from an Astrological Tool to a Conscious Life Companion.*

## 1. Vision & Philosophy
The goal is to create a digital entity that feels less like a chatbot and more like a "Guru" (remover of darkness). This entity does not just answer questions; it:
- **Observes** the user's emotional and behavioral patterns over time.
- **Intervenes** proactively when it detects chaos or imbalance.
- **Guides** the user through practical exercises (Meditation, Routine, Sound) to restore balance.
- **Connects** the cosmic (Astrology) with the practical (Daily Life).

---

## 2. Core Modules

### Module A: The "Atman" Engine (Memory & Consciousness)
*The brain of the system. It transforms stateless interactions into a continuous relationship.*

**Features:**
1.  **Emotional Profiling:**
    - Analyzes chat history to detect recurring emotional states (e.g., "User gets anxious during Mercury Retrograde").
    - Stores "Vibe Checks" (e.g., "User responds better to direct advice than soothing words").
2.  **Life Context Graph:**
    - Tracks active life events (e.g., "Interview on Friday," "Breakup last month").
    - **Proactive Follow-up:** "How did the interview go?" (The Guru remembers).
3.  **Astrological Correlation:**
    - Maps user behavior to real-time transits.
    - *Insight:* "You feel drained. This aligns with the Moon in your 12th House."

**Tech Stack:**
- **Storage:** Firestore Collection `user_insights` (Stores patterns, events, preferences).
- **Logic:** Context Injection in LLM Prompts (Injecting the "Story" before the "Chart").

### Module B: The "Prana" System (Breath & Sound)
*The somatic intervention layer. When words fail, we use breath and sound.*

**Features:**
1.  **Interactive Meditation UI:**
    - **Trigger:** High stress/anxiety detected in chat.
    - **Visual:** A "Cosmic Circle" expanding/contracting for breath guidance.
    - **Personalization:**
        - *Fire Signs:* Fast, energizing breath (4-4-4).
        - *Water Signs:* Slow, calming breath (4-7-8).
2.  **"Nada" (Sound) Mode:**
    - **Trigger:** Panic, chaotic typing, or user explicit request.
    - **Action:** "Shh. Just listen."
    - **Audio:** Brown Noise, 432Hz, or specific Beeja Mantras based on the planetary affliction.

### Module C: The "Dharma" Framework (Routine & Counselling)
*The behavioral correction layer. Fixing chaos through structure.*

**Features:**
1.  **Routine Injection:**
    - **Observation:** "User is awake at 2 AM."
    - **Negotiation:** "Let's agree on a 15-min morning sun ritual to fix your solar energy. Can we try this for 3 days?"
    - **Tracking:** Simple "Did you do it?" check-ins.
2.  **Counsellor Mode (Chaos to Clarity):**
    - **Trigger:** "I'm overwhelmed," "I don't know what to do."
    - **The "Neti Neti" Method:** The AI stops answering and starts asking clarifying questions to filter the noise.
    - **Goal:** Single-tasking. Clearing the mental fog.

### Module D: The "Sadhana" Dashboard (Daily Altar)
*The entry point. Making the app a daily habit.*

**Features:**
1.  **Daily Intention:**
    - Morning check-in: "The energy today is [X]. Your intention is [Y]."
2.  **Evening Reflection:**
    - "How did you handle the Mars energy today?"
3.  **Karmic Journal:**
    - A visible log of what the Guru has learned about the user.
    - User can verify/correct: "Yes, I am anxious about money."

---

## 3. Implementation Roadmap

### Phase 1: The Foundation (Memory) - *Current Priority*
1.  **Database Design:** Create `user_insights` and `user_routines` schemas in Firestore.
2.  **Analysis Layer:** Build the "Observer" function that runs after chats to extract insights.
3.  **Context Injection:** Update the `gemini.ts` system prompt to include this new memory.

### Phase 2: The Intervention (UI/UX)
1.  **Meditation Component:** Build the `BreathingCircle` overlay.
2.  **Sound Player:** Integrate basic audio assets for "Nada" mode.
3.  **Dashboard Redesign:** Update the home screen to show the "Daily Altar" view.

### Phase 3: The Intelligence (Logic)
1.  **Routine Logic:** Build the habit negotiation and tracking system.
2.  **Counsellor Switching:** Implement the logic to switch AI personas based on stress levels.

---

## 4. Technical Architecture Schema

```typescript
// The new "User" object in the Guru's mind
interface ConsciousUser {
  profile: UserProfile; // Standard data (Name, DOB)
  astrology: KundaliData; // The Chart
  
  // The "Atman" Layer
  consciousness: {
    emotionalState: 'stable' | 'anxious' | 'chaotic' | 'depressive';
    activeEvents: Event[]; // [{id: 'job_interview', date: '2023-10-27', status: 'pending'}]
    knownPatterns: string[]; // ["Struggles with authority", "Insomniac during full moon"]
  };

  // The "Dharma" Layer
  practice: {
    currentRoutine: Routine | null;
    meditationStreak: number;
    lastCheckIn: Date;
  };
}
```

## 5. Summary
This plan shifts AstroYou from a "Utility" (like a calculator) to a "Companion" (like a friend). It leverages the USP of Astrology not just as a prediction tool, but as a framework for understanding and improving the user's psychology and daily life.
