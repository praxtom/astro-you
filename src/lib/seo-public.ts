/** Public tool introductions shared with the static HTML generator. */
export const PUBLIC_TOOL_PAGES = [
  { path: '/free-kundali', title: 'Free Kundali: Vedic Birth Chart', description: 'Generate a free Vedic birth chart from your birth date, time and place. Explore your Ascendant, Moon sign and planetary positions.', sections: [
    { title: 'Create your birth chart', body: 'Enter your birth date, exact time and birthplace to calculate your Vedic Kundali. The chart shows the Ascendant, Moon sign and planetary positions.' },
    { title: 'Birth time matters', body: 'Use an accurate birth time for house placements. An uncertain time limits how precisely the chart can be interpreted.' },
  ] },
  { path: '/free-kundali-matching', title: 'Free Kundali Matching & Guna Milan', description: 'Compare two birth charts with free Kundali matching. Explore the Ashtakoot Guna Milan score and relationship compatibility.', sections: [
    { title: 'Compare two charts', body: 'Enter both people’s birth details to compare their Kundalis and explore the Ashtakoot Guna Milan score.' },
    { title: 'Use the score in context', body: 'A compatibility score is one traditional perspective. It cannot replace communication, shared values or your own judgment about a relationship.' },
  ] },
  { path: '/panchang', title: 'Today Panchang: Tithi & Timings', description: 'Check daily Panchang for your city: tithi, nakshatra, sunrise, sunset, Rahu Kaal and auspicious timings.', sections: [
    { title: 'Choose your date and city', body: 'The live Panchang tool shows the tithi, nakshatra, yoga, karana and local timing for your chosen date and city.' },
    { title: 'Local timing', body: 'Sunrise, sunset and timing windows vary with location. Check the city before using the results to plan your day.' },
  ] },
  { path: '/muhurat', title: 'Free Muhurat Finder', description: 'Explore business, marriage, property and travel Muhurat. Check Panchang timing for your chosen date and city.', sections: [
    { title: 'Choose a purpose', body: 'Select business, marriage, travel or home activities, then enter a date and city to check Panchang timing.' },
    { title: 'A first timing check', body: 'The tool considers Rahu Kaal and auspicious windows. Personal chart analysis and practical planning are still important for major decisions.' },
  ] },
  { path: '/numerology', title: 'Numerology: Life Path & Core Numbers', description: 'Explore your life path and core numerology numbers from your birth profile, with interpretations for personal reflection.', sections: [
    { title: 'Your core numbers', body: 'Complete your birth profile to explore life path and other core numbers, together with their symbolic meanings.' },
    { title: 'Reading the interpretation', body: 'Numerology is a framework for reflection. Treat its themes as prompts rather than fixed predictions about your future.' },
  ] },
  { path: '/tarot', title: 'Daily Tarot & Three-Card Readings', description: 'Draw a daily Tarot card or explore a three-card reading for your question. Use the symbolism as a prompt for reflection.', sections: [
    { title: 'Daily card', body: 'Explore a daily card and its symbolic meaning as a starting point for reflection.' },
    { title: 'Three-card reading', body: 'Bring a question to a three-card reading. Interpretations offer perspectives, not guaranteed outcomes or professional advice.' },
  ] },
  { path: '/eclipses', title: 'Eclipses & Your Vedic Birth Chart', description: 'Explore eclipse information and its traditional Vedic interpretation. Add your birth profile for personal chart context.', sections: [
    { title: 'Explore eclipse information', body: 'Review eclipse information and traditional astrological themes. Personal impact depends on your own chart rather than your Sun sign alone.' },
    { title: 'Personal chart context', body: 'Complete your birth profile to explore affected houses and planets. Interpretations are for reflection and do not guarantee events.' },
  ] },
  { path: '/trust', title: 'Trust, Reviews & Transparency', description: 'Read how AstroYou discloses that its guides are not people, moderates reviews, handles testimonials and reports prediction feedback.', sections: [
    { title: 'Who you are talking to', body: 'AstroYou\'s guides are not people, and every profile says so. Human expert claims require identity and profile review.' },
    { title: 'Reviews and testimonials', body: 'Reviews and opt-in testimonials are moderated before publication. Prediction feedback is shared in aggregate; testimonials are never invented.' },
  ] },
];

export const PUBLIC_PAGE_META = [
  { path: '/', title: 'Free Kundali, Panchang & Jyotish Guidance', description: 'Create your free Vedic Kundali, check compatibility and daily Panchang, and get Jyotish guidance that remembers your chart and questions.' },
  ...PUBLIC_TOOL_PAGES,
  { path: '/pricing', title: 'Pricing: Plans & Consultation Credits', description: 'Compare AstroYou plans and credit packs. See subscription prices, included credits and consultation costs before choosing a plan.' },
  { path: '/help', title: 'Help Centre', description: 'Find help with birth details, chart calculations, credits and your AstroYou account.' },
  { path: '/support', title: 'Contact Support', description: 'Get help with your AstroYou account, payments, reports or consultations. Sign in to send and track a support request.' },
  { path: '/wellness', title: 'Vedic Wellness & Daily Rhythm', description: 'Explore Vedic wellness themes and daily rhythms with context from your birth profile.' },
  { path: '/human-design', title: 'Human Design & Your Birth Profile', description: 'Explore your Human Design profile and how it differs from Vedic astrology. Birth details are required for personal results.' },
  { path: '/advanced-vedic', title: 'Advanced Vedic Chart Analysis', description: 'Explore divisional charts and advanced Vedic analysis using your birth profile.' },
  { path: '/astromap', title: 'Astrocartography & Your Birth Chart', description: 'Explore how places relate to your birth chart through astrocartography. Add your birth details for a personal map.' },
  // Reachable, but kept out of search: every guide on AstroYou is AI.
  { path: '/experts/apply', title: 'Apply as an Astrologer', description: 'Learn about applying as an astrologer on AstroYou and the profile review process.', noindex: true },
  { path: '/privacy', title: 'Privacy Policy', description: 'Read how AstroYou collects, uses and protects your account, birth details and guidance data.' },
  { path: '/terms', title: 'Terms of Service', description: 'Read the terms for using AstroYou, including accounts, credits, automated guidance and service limits.' },
  { path: '/refund-policy', title: 'Refund Policy', description: 'Read how AstroYou reviews failed payments, duplicate charges and requests involving credits, reports or consultations.' },
  { path: '/disclaimer', title: 'Astrology and Guidance Disclaimer', description: 'Read the limits of astrology and automated guidance, including predictions, remedies and professional advice.' },
];
