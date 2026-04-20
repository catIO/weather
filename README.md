# Oikaze

A minimal weather PWA built with vanilla JavaScript. No frameworks, no build step.

## Features

- Current conditions: temperature, humidity, dew point, wind, barometric pressure with 3-hour trend, UV index
- 24-hour hourly forecast
- 10-day daily forecast
- City search with autocomplete
- Geolocation support
- Saved locations
- Fahrenheit / Celsius toggle
- Auto-refresh when the app regains focus (after 10 minutes)
- Installable as a PWA with offline support
- Dark theme

## Data

Weather data provided by [Open-Meteo](https://open-meteo.com/) (free, no API key required).

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
```

## License

MIT
