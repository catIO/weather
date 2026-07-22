# Weather Data Sources & Update Lifecycle

Documentation of where each metric in the current conditions tiles and hourly forecasts originates, how data is updated, the refresh lifecycle, and all external API endpoints consumed.

---

## 1. Current Conditions Tiles

In [`app.js`](../app.js) (`renderCurrent`), metric tiles prioritize **NWS Ground-Station Observations** (`latestNWSObservation`) for US locations when available and fresh, falling back to **Open-Meteo Forecast API** (`data.current`) model data.

| Metric Tile | Primary Source | Fallback / Model Source | Description / Notes |
| :--- | :--- | :--- | :--- |
| **Dew Point** | NWS Observation (`dewPoint`) | Open-Meteo `data.current.dew_point_2m` | Atmospheric dew point temperature |
| **Humidity** | NWS Observation (`relativeHumidity`) | Open-Meteo `data.current.relative_humidity_2m` | Relative humidity (%) |
| **Wind Speed & Gusts** | NWS Observation (`windSpeed`, `windGust`) | Open-Meteo `data.current.wind_speed_10m`, `wind_gusts_10m` | Sustained 10m wind speed & peak 3s gust speed |
| **Wind Direction** | NWS Observation (`windDirection` when not calm) | Open-Meteo `data.current.wind_direction_10m` | Direction wind originates from (deg/cardinal) |
| **Precip Rate** | NWS Observation (`precipitationLastHour`) | Open-Meteo `data.current.precipitation` | Current precipitation rate (`in/hr` or `mm/hr`) |
| **CAPE** | Open-Meteo `minutely_15.cape` (current slot) | Open-Meteo `hourly.cape` (current hour) | Convective Available Potential Energy ($J/kg$) |
| **Pressure** | NWS Observation (`barometricPressure`) | Open-Meteo `data.current.pressure_msl` | Sea-level pressure (`inHg` or `hPa`) |
| **Pressure Trend** | Derived calculation | Open-Meteo `data.hourly.pressure_msl` | Compares current pressure against 3 hours prior |
| **UV Index** | Open-Meteo `data.current.uv_index` | N/A | Erythemal UV index |
| **Air Quality** | WAQI Proxy (`/api/air-quality`) | Open-Meteo Air Quality API (`data.aqi.current.us_aqi`) | Rendered when AQI $\ge 100$ or active AQ alert |

---

## 2. Hourly Forecast Data

In [`app.js`](../app.js) (`renderHourly`):

- **Weather Metrics** (Hour, Icon, Temp, Precip Probability %, Wind Speed & Direction): Pulled from **Open-Meteo Forecast API** (`data.hourly` fields: `temperature_2m`, `weather_code`, `wind_speed_10m`, `wind_direction_10m`, `precipitation_probability`, `cape`).
- **Hourly Air Quality Badges**: Rendered when current AQI $\ge 100$, pulled from **Open-Meteo Air Quality API** (`data.aqi.hourly` fields: `us_aqi`, `pm2_5`).

---

## 3. API Endpoints Reference

### Weather & Air Quality APIs

1. **Open-Meteo Forecast API**
   - **URL**: `https://api.open-meteo.com/v1/forecast`
   - **Parameters**: `latitude`, `longitude`, `current` (`temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,dew_point_2m,uv_index,pressure_msl,wind_gusts_10m,precipitation`), `hourly` (`temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability,pressure_msl,wind_gusts_10m,cape`), `minutely_15` (`lightning_potential,cape,weather_code`), `daily` (`weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max`), `temperature_unit`, `wind_speed_unit`, `precipitation_unit`, `forecast_days=10`, `timezone=auto`
   - **Usage**: Primary numerical weather prediction model data for current conditions, minutely_15 storm windowing, hourly forecast, and 10-day daily forecast.

2. **Open-Meteo Air Quality API**
   - **URL**: `https://air-quality-api.open-meteo.com/v1/air-quality`
   - **Parameters**: `latitude`, `longitude`, `current=us_aqi,pm2_5,pm10`, `hourly=us_aqi,pm2_5,pm10`, `forecast_days=7`, `timezone=auto`
   - **Usage**: Fallback US AQI, PM2.5, and PM10 values, plus hourly AQI forecast array.

3. **WAQI Proxy (Netlify Serverless Function)**
   - **Client Route**: `/api/air-quality?lat={lat}&lon={lon}`
   - **Upstream URL**: `https://api.waqi.info/feed/geo:{lat};{lon}/?token={WAQI_TOKEN}`
   - **File**: [`netlify/functions/air-quality.js`](../netlify/functions/air-quality.js)
   - **Usage**: Real-time ground station measurements from World Air Quality Index (WAQI) for high-accuracy local US AQI and PM2.5 readings.

### National Weather Service (NWS) APIs (US Locations)

4. **NWS Active Alerts API**
   - **URL**: `https://api.weather.gov/alerts/active?point={lat},{lon}&status=actual`
   - **Headers**: `User-Agent: (weather-pwa, contact@example.com)`
   - **Usage**: Fetches active weather watches, warnings, and advisories for storm alert banners and condition overrides.

5. **NWS Point Metadata API**
   - **URL**: `https://api.weather.gov/points/{lat},{lon}`
   - **Headers**: `User-Agent: (weather-pwa, contact@example.com)`
   - **Usage**: Retrieves observation station list URL (`properties.observationStations`) for a coordinate point.

6. **NWS Observation Stations List API**
   - **URL**: Station collection URL returned by points API (e.g. `https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}/stations`)
   - **Headers**: `User-Agent: (weather-pwa, contact@example.com)`
   - **Usage**: Finds the closest physical weather station by computing haversine distance across all station coordinates.

7. **NWS Latest Station Observation API**
   - **URL**: `https://api.weather.gov/stations/{stationId}/observations/latest`
   - **Headers**: `User-Agent: (weather-pwa, contact@example.com)`
   - **Usage**: Fetches ground station telemetry (dew point, relative humidity, wind speed, gusts, direction, precipitation in last hour, barometric pressure, text description). Rejects observations older than 90 minutes.

### Search & Geolocation Support APIs

8. **Open-Meteo Geocoding API**
   - **URL**: `https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5&language=en&format=json`
   - **Usage**: Provides autocomplete suggestions for location search in header input.

9. **ipapi Country Detection API**
   - **URL**: `https://ipapi.co/country/`
   - **Usage**: Detects country code on first visit to configure default units (°F/mph/in vs °C/km/h/mm).

---

## 4. Update & Refresh Lifecycle

1. **Initial & Selection Fetch** ([`app.js`](../app.js) -> `fetchWeather`):
   - Fetches Open-Meteo weather and AQI endpoints.
   - Immediately renders UI (`renderCurrent`, `renderHourly`, `renderDaily`).
   - Asynchronously triggers NWS active alerts (`fetchNWSAlerts`) and NWS ground observations (`fetchNWSObservation`).
   - When NWS observation completes, re-runs `renderCurrent` to overwrite tiles with live ground-station data.

2. **Auto-Refresh Logic** ([`app.js`](../app.js) -> `refreshWeatherIfNeeded`):
   - Refreshes trigger when user returns to the app via `visibilitychange` (tab becomes visible), `pageshow`, or `focus`.
   - Data is only re-fetched if the previous fetch was more than **10 minutes old** (`STALE_MS = 10 * 60 * 1000`).

---

## 5. Precip Rate Update Behavior

- **No Periodic Polling**: The application does not run a continuous background `setInterval` loop while open on screen.
- **Station Reporting Intervals**: NWS stations typically update `precipitationLastHour` once per hour (around :50–:55 past the hour). Open-Meteo updates current model precipitation in 15-to-60 minute runs.
- **Update Requirement**: To pull fresh precipitation values after weather conditions change, either return to the app tab after 10 minutes or manually refresh the page.
