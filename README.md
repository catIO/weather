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
- Derives current conditions from multiple data signals (minutely_15, hourly, current, air quality)
- Integrates Open-Meteo Air Quality API to retrieve real-time US AQI, PM2.5, and PM10 measurements
- Detects smoke and haze from elevated particulate levels and overrides clear weather descriptions/icons to show hazy conditions
- Uses lightning potential index (LPI), CAPE, and precipitation to detect thunderstorms even when the base weather code lags
- Thunderstorm alert banner with 2-hour lookahead

### Activity Outlook
- Activity summary and safety recommendation adjusted for poor air quality (e.g., wildfire smoke) and severe hazards (tap the temperature to open)
- Powered by a Netlify edge function

### Forecasts
- 24-hour hourly forecast with precipitation probability, storm indicators, and hourly AQI levels
- 10-day daily forecast with high/low temps, precip probability, and smoke/haze icon adjustments

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

Weather data is provided by [Open-Meteo](https://open-meteo.com/) (free, no API key required) and live US [NWS Observations](https://api.weather.gov/). For a complete mapping of detail tiles, hourly sources, and update lifecycles, see [docs/data-sources-and-update-flow.md](docs/data-sources-and-update-flow.md).

Air Quality data defaults to the Open-Meteo Air Quality API (using CAMS forecasts) for client-side queries. For highly accurate live station measurements, the app is integrated with a **Netlify Serverless Function** that queries the **WAQI (World Air Quality Index)** API. To enable this, add your free WAQI API token as the `WAQI_TOKEN` environment variable in your Netlify settings. The app will automatically request live station data via this proxy with a seamless client-side fallback if unavailable.

## Running locally

You can run the app locally in one of two modes:

### 1. Static Fallback Mode (Default)
Runs a simple static server. The app automatically falls back to Open-Meteo for air quality data.
```sh
npx serve .
```
Then open http://localhost:3000.

### 2. High-Accuracy Proxy Mode
Runs the Netlify serverless function emulator locally. Reads from your local `.env` file to fetch real-time WAQI telemetry.
```sh
npx netlify dev
```

## Project structure

```
index.html          Main page
app.js              All application logic
styles.css          Styles
sw.js               Service worker (stale-while-revalidate caching)
manifest.json       PWA manifest
icons/              App icons
netlify/functions/  Netlify serverless functions (WAQI API proxy)
.env                Local environment variables (git-ignored)
docs/               Planning documents
```

## License

MIT
