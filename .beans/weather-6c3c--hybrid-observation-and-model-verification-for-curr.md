---
id: weather-6c3c
title: Hybrid observation & model verification for current weather conditions
status: completed
type: feature
priority: normal
created_at: 2026-07-28T15:52:00Z
updated_at: 2026-07-28T16:02:00Z
---

Implement hybrid verification between live NWS ground station observations and Open-Meteo forecast model data to prevent false-positive rain/thunderstorm conditions during dry hours, and add support for "Thunderstorm in vicinity" (WMO code 94).

## Summary of Changes

- **Hybrid Ground Validation (`app.js`)**:
  - Refined `deriveCurrentCode` to verify active precipitation (`precip > 0`) or active lightning potential (`nearLPI > 0.1`) before displaying rain (`51..67`), shower (`80..86`), or storm (`94..99`) codes.
  - Falls back to live NWS ground station observation (e.g. Overcast, Partly Cloudy) or Open-Meteo `cloud_cover` when local precipitation is zero.

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
