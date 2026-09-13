---
# weather-7scd
title: Enhance NWS observation ingestion, multi-station consensus, and active polling
status: completed
type: feature
priority: normal
created_at: 2026-09-13T09:22:21Z
updated_at: 2026-09-13T09:26:59Z
---

Improve current weather condition accuracy: parse presentWeather, raw METAR, and precipitationLastHour from NWS; fix variable wind rejection; implement nearest-station consensus when primary station is degraded or dry; add in-tab auto-refresh interval.


## Todo List
- [x] 1. Enhance NWS observation parser: parse `presentWeather` array, raw METAR codes, and `precipitationLastHour`
- [x] 2. Fix variable wind rejection: allow null wind direction for calm/light winds or `VRB` METARs
- [x] 3. Multi-station consensus: evaluate top candidate stations for active precipitation / degraded sensor fallback
- [x] 4. Ground precipitation upgrade in `deriveCurrentCode`
- [x] 5. In-tab periodic refresh interval
- [x] 6. Update `docs/data-sources-and-update-flow.md`
- [x] 7. Verify with test script and node execution

## Summary of Changes
- Replaced `mapNWSTextToWmoCode` with `parseNWSObservationCode`, extracting conditions from `p.presentWeather` array, `p.rawMessage` METAR tokens, `p.precipitationLastHour` rainfall, and `p.textDescription`.
- Fixed false rejection of observation stations reporting light variable winds (`VRB` or speed <= 6 kt) with null wind direction.
- Fixed `parseNWSPrecip` unit handling so `wmoUnit:mm` values are not erroneously multiplied by 1000.
- Implemented multi-station consensus in `fetchNWSObservation`: if the closest station has an inoperative rain sensor (`PNO`) or reports dry while a neighboring station within 10 miles detects rain, the ground condition upgrades to active rain.
- Updated `deriveCurrentCode` and `renderCurrent` so positive ground precipitation upgrades dry model predictions and populates the precipitation rate tile.
- Added 60-second in-tab background interval checking staleness (`STALE_MS = 10 min`) while the document is visible.
- Updated `docs/data-sources-and-update-flow.md`.
