---
# weather-qvzi
title: Fix NWS unit parsing and rate blending for precipitation rate
status: completed
type: bug
priority: high
created_at: 2026-09-27T00:15:00Z
updated_at: 2026-09-27T00:16:27Z
---

Fix parseNWSPrecip unitCode bug where unit:m was not recognized as meters, causing measured precipitation to be off by a factor of 1,000. Blend model and gauge rates with Math.max.

## Summary of Changes

- **Fixed 1,000x Unit Conversion Bug in `parseNWSPrecip` (`app.js`)**:
  - NWS station JSON returns `precipitationLastHour` with `unitCode: 'unit:m'` (meters).
  - Previously, `parseNWSPrecip` only matched `wmoUnit:m`, causing `unit:m` readings to bypass meter-to-millimeter conversion. Measured rain (e.g. 0.005 m = 5 mm / 0.20 in) was treated as 0.005 mm (0.0002 in), resulting in `0.00 in/hr` display.
  - Updated parser to handle `unit:m`, `wmoUnit:m`, meters, mm, and inches.

- **Added METAR Precipitation Fallback (`app.js`)**:
  - If `precipitationLastHour.value` is null or missing from the station payload, the parser extracts rainfall depth from the raw METAR string's `Pxxxx` group (hundredths of an inch).

- **Multi-Source Precipitation Rate Blending (`app.js`)**:
  - In `renderCurrent` and `deriveCurrentCode`, replaced strict override of model rate with `Math.max(obsPrecip, modelPrecip)`. Sudden convective downpours captured by the high-resolution 3km HRRR model and hourly accumulations measured by physical ground gauges now reinforce each other rather than suppressing active rain intensity.
