---
# weather-kilt
title: Enhance precipitation accuracy with high-res models, live PoP ground truth, and cumulative daily PoP
status: completed
type: feature
priority: normal
created_at: 2026-09-27T00:08:02Z
updated_at: 2026-09-27T00:11:16Z
---

Improve precipitation probability accuracy by switching US forecast queries from ncep_gfs_seamless to best_match (HRRR 3km), syncing current-hour PoP to 100% when live station observations detect active rain, and computing true cumulative daily PoP from hourly probabilities and precipitation totals.

### Todo Checklist
- [x] Switch US forecast query from ncep_gfs_seamless to best_match (HRRR 3km) in app.js
- [x] Add precipitation_sum and precipitation_hours to Open-Meteo daily query parameters
- [x] Sync current-hour PoP to 100% in hourly view when live station observation or radar confirms active precipitation
- [x] Compute true cumulative daily PoP in renderDaily using hourly probabilities, precipitation sum, and duration
- [x] Non-browser verification and code inspection

## Summary of Changes

- **High-Resolution Model Blend (`app.js`)**:
  - Removed explicit `models=ncep_gfs_seamless` override that restricted US forecasts to coarse 25km GFS.
  - Enabled Open-Meteo default `best_match`, which blends NOAA 3km HRRR for short-term convective and precipitation resolution in CONUS before transitioning to GFS for extended days.

- **Ground-Truth Nowcasting for Current Hour (`app.js`)**:
  - In `renderHourly` and `renderDayHourly`, when physical NWS ground station telemetry (`obs.precipitation > 0`, active rain/storm codes) or current conditions confirm active rain, the 'Now' hourly probability is set to 100% and icon synchronized, eliminating false dry/sunny indicators while rain is falling.

- **Cumulative Daily PoP Calculation (`app.js`)**:
  - Added `calculateDailyPoP`, replacing raw `precipitation_probability_max` which only reflected single-hour peaks.
  - Groups the 24 hours into 4-hour decorrelation blocks to calculate multi-hour event probability.
  - Incorporates confidence floors from daily `precipitation_sum` and `precipitation_hours`.
  - Upgrades Today's PoP to 100% when active precipitation is verified on the ground.
  - Updated `getDailyIcon` to accept daily PoP, preventing rain hours from being treated as borderline cloud cover on confirmed wet days.

- **API Parameters & Documentation**:
  - Added `precipitation_sum` and `precipitation_hours` to Open-Meteo daily query parameters.
  - Updated `docs/data-sources-and-update-flow.md` with Section 2.1 detailing the new daily PoP calculation and hourly nowcasting rules.
