---
# weather-b63k
title: Dynamic live radar map for active precipitation
status: completed
type: feature
priority: normal
created_at: 2026-09-13T09:31:57Z
updated_at: 2026-09-13T09:35:13Z
---

Add conditional live radar card when rain is detected or on-demand via precip tile. Lazy-load Leaflet and RainViewer tile layers with dark theme, animation playback controls, and zero overhead when dry.


## Todo List
- [x] 1. Add radar card markup in `index.html` and styles in `styles.css`
- [x] 2. Implement lazy Leaflet loader and RainViewer tile controller in `app.js`
- [x] 3. Add conditional trigger in `renderCurrent` (active rain or user toggle)
- [x] 4. Add playback timeline controls (play/pause, frame scrubber, relative time indicator)
- [x] 5. Ensure zero background calls when dry or tab is hidden
- [x] 6. Update `docs/data-sources-and-update-flow.md`
- [x] 7. Validate syntax and run simulation checks

## Summary of Changes
- Added Live Radar card markup to `index.html` with live pulsing badge, map wrapper, color legend, and player controls (play/pause, scrubber, timestamp).
- Added Live Radar toggle button to the Precipitation Rate detail tile.
- Styled `.radar-card`, `.radar-map`, Leaflet dark overrides, and responsive controls in `styles.css`.
- Implemented zero-overhead dynamic Leaflet loader (`loadLeaflet`) and RainViewer radar controller in `app.js`:
  - Never downloads map assets or tiles during dry weather unless user explicitly taps Live Radar.
  - Automatically loads and expands radar when active rain/storm is detected.
  - Automatically halts animation playback when the tab is hidden or minimized.
- Updated `docs/data-sources-and-update-flow.md` with RainViewer and CartoDB Dark Matter API specifications.
