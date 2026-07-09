# Oikaze

A minimal weather PWA built with vanilla JavaScript. No frameworks, no build step.

## Features

### Current Conditions
- Temperature, humidity, dew point, wind speed & direction, gusts
- Precipitation rate with intensity classification
- Barometric pressure with 3-hour trend (rising/falling/steady)
- UV index, CAPE (convective available potential energy)
- Detail tiles highlight in amber/red when values are elevated or severe

### Smart Weather Detection
- Derives current conditions from multiple data signals (minutely_15, hourly, current)
- Uses lightning potential index (LPI), CAPE, and precipitation to detect thunderstorms even when the base weather code lags
- Thunderstorm alert banner with 2-hour lookahead

### Activity Outlook
- AI-generated activity summary (tap the temperature to open)
- Powered by a Netlify edge function

### Forecasts
- 24-hour hourly forecast with precipitation probability and storm indicators
- 10-day daily forecast with high/low temps and precip probability

### Settings & Units
- Temperature: °F / °C
- Wind: mph / km/h / m/s / knots
- Precipitation: in / mm
- Pressure: inHg / hPa
- Distance: mi / km

### General
- City search with autocomplete via Open-Meteo geocoding API
- Geolocation support
- Saved locations (persisted to localStorage)
- Auto-refresh on focus, visibility change, and periodic check (10-minute staleness threshold)
- Installable as a PWA with offline support (stale-while-revalidate service worker)
- Dark theme

## Data

Weather data provided by [Open-Meteo](https://open-meteo.com/) (free, no API key required). Uses current, hourly, daily, and minutely_15 endpoints.

## Running locally

Serve the directory with any static file server:

```sh
npx serve .
```

Then open http://localhost:3000.

## Project structure

```
index.html      Main page
app.js          All application logic
styles.css      Styles
sw.js           Service worker (stale-while-revalidate caching)
manifest.json   PWA manifest
icons/          App icons
docs/           Planning documents
```

## License

MIT
