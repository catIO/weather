---
id: weather-6c3c
title: Hybrid observation & model verification for current weather conditions
status: completed
type: feature
priority: normal
created_at: 2026-07-28T15:52:00Z
updated_at: 2026-07-28T19:37:00Z
---

Implement hybrid verification between live NWS ground station observations and Open-Meteo forecast model data to prevent false-positive rain/thunderstorm conditions during dry hours, and add support for "Thunderstorm in vicinity" (WMO code 94).

## Summary of Changes

- **Unified Dry Sky Condition Validation (`app.js`)**:
  - Expanded Priority 3 in `deriveCurrentCode` to validate ALL dry periods (`precip === 0 && nearLPI <= 0.1`) against both live NWS ground station observations (`obs.weatherCode`) and location grid cloud cover (`c.cloud_cover`).
  - Completely fixed bug where raw model `weather_code: 0` ("Clear sky") bypassed cloud cover verification and falsely displayed `☀️ Clear sky` during 80–100% overcast conditions.

- **NWS Alert Filter Fix (`app.js`)**:
  - Restricted Priority 0 alert condition upgrades strictly to active severe **WARNINGS** (e.g. *Severe Thunderstorm Warning*, *Tornado Warning*).
  - Excluded non-warning statements, advisories, and *Severe Thunderstorm Watches* from forcing active storm codes on the main card (watches continue displaying properly in the `#stormAlert` banner).
  - Updated `renderNWSAlert` to re-trigger `renderCurrent` as soon as background alert fetches complete.

- **Thunderstorm in Vicinity Support (`app.js`)**:
  - Added WMO Code `94`: `['🌩️', 'Thunderstorm in vicinity']`.
  - Mapped NWS station text descriptions containing `"Thunderstorm in Vicinity"` to code `94`.
  - Configured model/lightning convective signals with zero local precipitation to report `94` (**🌩️ Thunderstorm in vicinity**) instead of implying an active overhead thunderstorm.

- **Open-Meteo Query & Documentation**:
  - Added `cloud_cover` parameter to Open-Meteo forecast API queries.
  - Updated `docs/data-sources-and-update-flow.md` with Section 1.1 detailing priority levels and hybrid validation logic.
