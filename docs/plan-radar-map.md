# Radar Map Integration Plan — Oikaze Weather App

## Overview
Add a RainViewer radar map card that auto-shows when precipitation is active or expected.

## API: RainViewer (free, no key required)
- Endpoint: `https://api.rainviewer.com/public/weather-maps.json`
- Returns available radar timestamps (past ~2hrs + 30min forecast)
- Tile URL: `https://tilecache.rainviewer.com{path}/256/{z}/{x}/{y}/2/1_1.png`
- Global coverage, no rate limits for reasonable usage

## Trigger Logic
Show radar card when ANY of:
- `current.precipitation > 0` (actively precipitating)
- Any of next 6 hours `hourly.precipitation_probability >= 40`
Hide when neither condition is met.

## Implementation Steps

### 1. Add Leaflet dependency
- Add Leaflet CSS + JS from CDN to `index.html` `<head>`
- Leaflet is ~40KB gzipped, lightweight

### 2. Add radar card HTML (index.html)
- Place between current conditions and hourly forecast sections
- Structure:
  ```html
  <section id="radarCard" class="card hidden">
    <div class="card-header">
      <h2>Radar</h2>
      <button id="radarClose" class="icon-btn">
        <span class="material-icons">close</span>
      </button>
    </div>
    <div id="radarMap" style="height: 300px; border-radius: 12px;"></div>
    <div class="radar-controls">
      <button id="radarPlay" class="icon-btn"><span class="material-icons">play_arrow</span></button>
      <span id="radarTime" class="radar-timestamp"></span>
    </div>
  </section>
  ```

### 3. Add radar styles (styles.css)
- Style the radar card, map container, playback controls
- Match existing card styling
- Ensure map tiles have border-radius
- Dark-themed base map to match app aesthetic

### 4. Add radar logic (app.js)
```
Functions to add:

a) shouldShowRadar(data)
   - Check current.precipitation > 0
   - Check next 6 hours of hourly.precipitation_probability >= 40
   - Return boolean

b) initRadarMap(lat, lon)
   - Initialize Leaflet map centered on user's location
   - Use CartoDB dark_all tiles as base (free, matches dark theme)
   - Base tile URL: https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png

c) loadRadarFrames()
   - Fetch https://api.rainviewer.com/public/weather-maps.json
   - Store array of {path, time} for past + nowcast frames
   - Create Leaflet TileLayer for each frame

d) animateRadar()
   - Cycle through frames on play button press
   - Show timestamp for each frame
   - ~500ms per frame interval
   - Loop continuously until paused

e) Integration point — call from renderCurrent(data):
   - After existing render logic, call shouldShowRadar(data)
   - If true: show #radarCard, init map if needed, load frames
   - If false: hide #radarCard
```

### 5. Service Worker update (sw.js)
- Add Leaflet CDN and CartoDB tile URLs to allowed external fetches
- Do NOT cache radar tiles (they change frequently)
- Cache Leaflet library files

### 6. Cleanup
- Destroy Leaflet map instance when card is hidden to free memory
- Clear animation interval on hide
- Handle location changes (re-center map)

## File Changes Summary
| File         | Changes                                      |
|-------------|----------------------------------------------|
| index.html  | Add Leaflet CDN, radar card HTML             |
| styles.css  | Radar card & controls styling                |
| app.js      | Radar logic (~80-100 lines)                  |
| sw.js       | Allow Leaflet/tile external URLs             |

## Notes
- RainViewer radar data refreshes every ~10 minutes
- Consider re-fetching frames if card stays visible > 10 min
- Leaflet map should be zoom level ~8 for local radar view
- No API key needed for RainViewer or CartoDB dark tiles
