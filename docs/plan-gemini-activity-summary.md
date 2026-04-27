## Plan: LLM-Powered Activity Summary via Gemini Flash

Replace the hardcoded `generateActivitySummary()` with a Gemini 2.5 Flash call, proxied through a Netlify Edge Function to keep the API key server-side. Current logic becomes fallback.

---

### Steps

**Phase 1 — Netlify Edge Function (backend proxy)**

1. Create `netlify/edge-functions/summary.ts` — accepts POST with weather data, constructs a prompt, calls Gemini Flash, returns the generated summary. 5s timeout.
2. Create `netlify.toml` — map `/api/summary` to the edge function.
3. Set `GEMINI_API_KEY` as an environment variable in the Netlify dashboard (never in code).

**Phase 2 — Client-side integration**

4. Rename current `generateActivitySummary()` → `generateFallbackSummary()` in app.js.
5. Create new async `generateActivitySummary()` that POSTs weather data to `/api/summary` with a 5s `AbortController` timeout, falling back to `generateFallbackSummary()` on failure.
6. Update the `weatherSummaryBtn` click handler to show the modal immediately with a loading spinner, then fill in text when ready.

**Phase 3 — Prompt engineering**

7. Craft a system prompt in the edge function: concise outdoor activity advisor covering running, cycling, hiking. 2-3 short paragraphs, using the user's configured units.

---

### Relevant files

- app.js — modify `generateActivitySummary()` and summary button handler
- `netlify/edge-functions/summary.ts` — **new**, Gemini proxy
- `netlify.toml` — **new**, edge function routing
- sw.js — may need to skip `/api/summary` from caching

### Testing (cheap)

- **Google AI Studio** (free) — test prompts interactively at aistudio.google.com before writing code
- **Cost**: ~$0.0002 per summary call with Flash (~300 input + ~200 output tokens)
- **Local dev**: `npx netlify dev` runs edge functions locally against the real Gemini API
- **Free tiers**: Google gives 15 RPM free for Flash; Netlify gives 3M edge invocations/month free

### Verification

1. `npx netlify dev` → click Activity Summary → LLM summary appears
2. Disable network or use invalid key → fallback summary appears within 5s
3. Check DevTools network → `/api/summary` POST, no API key in client code
4. Deploy to Netlify preview → end-to-end test

### Decisions

- **Edge Function over client-side call** — keeps API key server-side
- **Edge function owns the prompt template** — client sends only weather data, preventing prompt injection
- **5s timeout** — Flash typically responds in 1-2s; falls back gracefully if slow

### Further Considerations

1. **Caching** — Cache LLM responses per location+hour to reduce calls. Add later based on usage.
2. **Streaming** — Gemini supports streaming into the modal for a nicer UX. Good follow-up enhancement.
