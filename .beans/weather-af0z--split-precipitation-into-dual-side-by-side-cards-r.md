---
# weather-af0z
title: Split precipitation into dual side-by-side cards replacing UV index during rain, reorder CAPE and Pressure last
status: completed
type: feature
priority: normal
created_at: 2026-09-27T00:27:22Z
updated_at: 2026-09-27T00:28:42Z
---

Split overcrowded precipitation card into two dedicated side-by-side tiles (Past 24h Accumulation & Next 24h Outlook with live rate and radar). Conditionally swap UV index for the second precip card during rain events, and move CAPE and Pressure to the end of the grid.

### Todo Checklist
- [x] Update index.html structure: two side-by-side precip cards, followed by UV index, then Pressure and CAPE last
- [x] Update styles.css for clean dual precip card styling
- [x] Update app.js renderCurrent to conditionally swap UV index for the second precip card during rain events
- [x] Update docs/data-sources-and-update-flow.md
- [x] Non-browser verification and tests

## Summary of Changes

- **Split Precipitation into Dual Cards (`index.html`, `styles.css`)**:
  - **Card 1 (Precipitation)**: Focuses purely on past 24-hour accumulation (`0.55″ in last 24h`).
  - **Card 2 (Expected Rain)**: Focuses on future 24-hour volume (`1.25″ in next 24h`), active rate badge (`Active: 0.18 in/hr`), and the Live Radar button.
  - Placed side-by-side in Row 2 of the grid.

- **Dynamic UV Index Replacement (`app.js`)**:
  - During precipitation events (past rain, future rain, or active rain), UV Index is automatically hidden in favor of the Expected Rain card.
  - During clear/dry weather, the secondary precip card is hidden and UV Index returns.

- **Grid Reordering**:
  - Moved **Pressure** and **CAPE** to the very end of the grid as requested.

- **Documentation**:
  - Updated `docs/data-sources-and-update-flow.md` to document the dual precipitation cards, grid layout, and dynamic UV swapping.
