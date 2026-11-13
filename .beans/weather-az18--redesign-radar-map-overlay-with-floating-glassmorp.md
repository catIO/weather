---
# weather-az18
title: Redesign radar map overlay with floating glassmorphic timeline control
status: completed
type: feature
priority: normal
created_at: 2026-11-13T11:17:34Z
updated_at: 2026-11-13T11:19:11Z
---

Update the radar map overlay to feature a floating dark translucent glassmorphic control bar at the bottom of the map with play/pause button, status/date header, time-range pill toggle, progress scrubber track, and timeline tick labels.

## Summary of Changes
- Replaced the below-map `.radar-controls` bar in `index.html` with a floating `.radar-overlay-controls` bar inside `#radarMapContainer`, featuring play/pause, centered status/date readout, `1h`/`2h` range toggle, custom progress scrubber, and clickable timeline ticks.
- Updated `styles.css` with frosted dark-navy glassmorphic styling (`backdrop-filter: blur(18px) saturate(160%)`), white-filled progress track (`--progress`), top-right legend pill positioning, and `315px` map wrapper height.
- Updated `app.js` to manage `radarAllFrames`, `1h`/`2h` slicing via `applyRadarRange()`, dynamic `renderRadarTicks()` with `Now` label, and `--progress` scrubber updates.
