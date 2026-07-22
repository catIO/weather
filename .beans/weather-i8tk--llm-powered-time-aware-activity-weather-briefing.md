---
# weather-i8tk
title: LLM-Powered Time-Aware Activity Weather Briefing
status: todo
type: feature
priority: normal
created_at: 2026-07-22T12:10:06Z
updated_at: 2026-07-22T12:15:07Z
---

Implement a Gemini-powered time-of-day aware activity weather briefing using current observations and hourly forecast data, replacing hardcoded rules with structured AI summaries, optimal window recommendations, and wind/weather shift analysis.

## Key Requirements
- Netlify serverless function proxying Gemini API (GEMINI_API_KEY)
- Time-of-day awareness (Morning: full day wind/temp outlook; Afternoon: evening transition; Evening/Night: overnight & next morning)
- Favorable window recommendation (e.g. best time slot for outdoor activities)
- Structured AI response (JSON schema / structured prompt)
- Client-side fallback to deterministic rule-based generator on timeout/error
- In-memory/session caching per location & hour

## Tasks
- [x] Turned plan into bean weather-i8tk and removed legacy plan doc from docs/
- [ ] (Human) Create new Gemini API key in Google AI Studio & set GEMINI_API_KEY in Netlify dashboard
- [ ] Create Netlify function `netlify/functions/summary.js` with Gemini API integration & structured JSON output
- [ ] Add Gemini system prompt with time-of-day windowing and favorable activity timing rules
- [ ] Integrate client-side API call in `app.js` with 5s timeout & fallback to `generateActivityOutlook`
- [ ] Add caching for LLM responses per location+hour
- [ ] Verify functionality via non-browser inspection and unit/integration testing
