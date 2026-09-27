---
# weather-v5af
title: Hybrid 24-hour precipitation accumulation card with past 24h total and future outlook
status: completed
type: feature
priority: normal
created_at: 2026-09-27T00:20:27Z
updated_at: 2026-09-27T00:23:53Z
---

Transform the single-value Precip Rate tile into an Apple Weather-style 24-hour accumulation card: requesting past_days=1 from Open-Meteo, computing past 24h accumulation, next 24h expected accumulation, and displaying live rain rate when actively precipitating.

### Todo Checklist
- [x] Add past_hours: 24 to Open-Meteo API query in app.js
- [x] Update index.html precipitation tile with hero accumulation, past 24h label, expected next 24h label, and active rate tag
- [x] Style 24h precipitation card in styles.css
- [x] Implement past 24h and next 24h precipitation calculations in renderCurrent (app.js)
- [x] Update docs/data-sources-and-update-flow.md
- [x] Non-browser verification and tests

## Summary of Changes

- **Added `past_hours: 24` to Forecast Queries (`app.js`)**:
  - In `fetchWeatherData`, added `past_hours: 24` without altering daily forecast array indexing.
  - Enables accurate past 24h accumulation rollups and real 3-hour pressure trend comparisons.

- **Re-architected Precipitation Tile to 24-Hour Card (`index.html`, `styles.css`)**:
  - Modeled after Apple Weather: prominent hero accumulation value (`0.55″`), subtext `in last 24h`, and forward projection (`1.25″ expected in next 24h`).
  - Added live intensity badge (`Active: 0.18 in/hr`) when precipitation is actively falling.
  - Maintained full integration with the Live Radar toggle button.

- **Accumulation & Outlook Calculations (`app.js`)**:
  - Implemented rolling past-24-hour summation (`startIdx - 24` to `startIdx`) and next-24-hour forecast accumulation (`startIdx` to `startIdx + 24`).
  - Synced tile elevation borders to trigger `elevated` ($\ge 0.25\text{ in}$) and `elevated-severe` ($\ge 0.75\text{ in}$) during major storm events.

- **Documentation**:
  - Updated `docs/data-sources-and-update-flow.md` to document the 24-hour accumulation card structure and `past_hours=24` parameter.
