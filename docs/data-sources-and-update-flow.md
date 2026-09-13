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
| **CAPE** | Open-Meteo `data.current.cape` | Open-Meteo `minutely_15.cape` / `hourly.cape` | Convective Available Potential Energy ($J/kg$) |
| **Pressure** | NWS Observation (`barometricPressure`) | Open-Meteo `data.current.pressure_msl` | Sea-level pressure (`inHg` or `hPa`) |
| **Pressure Trend** | Derived calculation | Open-Meteo `data.hourly.pressure_msl` | Compares current pressure against 3 hours prior |
| **UV Index** | Open-Meteo `data.current.uv_index` | N/A | Erythemal UV index |
| **Air Quality** | WAQI Proxy (`/api/air-quality`) | Open-Meteo Air Quality API (`data.aqi.current.us_aqi`) | Rendered when AQI $\ge 100$ or active AQ alert |


### 1.1 Condition Derivation & Hybrid Validation

Condition text and icons are derived in `deriveCurrentCode` using a hybrid model + observation strategy:
- **Priority 0 (NWS Severe Warning Event Titles)**: Severe warnings/watches matching event titles (e.g. *Severe Thunderstorm Warning*, *Tornado Warning*) force active storm (`95`), heavy rain (`65`), or snow (`75`) codes. Text inside advisory descriptions is ignored to avoid false positives from non-warning statements.
- **Priority 1 (Convective/Lightning Check)**: Active minutely_15 lightning potential ($LPI > 0.1$) or storm codes with zero precipitation map to **Thunderstorm in vicinity** (`94`, icon `🌩️`). Active precipitation + lightning maps to active **Thunderstorm** (`95`, icon `⛈️`).
- **Priority 2 (Precipitation Intensity)**: Active precipitation rate (from model or ground observation) sets rain intensity (Slight `61`, Moderate `63`, Heavy `65`).
- **Priority 3 (Hybrid Validation)**: If NWS station observes *"Thunderstorm in Vicinity"* or model storm code exists without local rain, sets **Thunderstorm in vicinity** (`94`). If ground observation is dry ($\le 45$) and lightning potential is absent ($LPI \le 0.1$), prioritizes coordinate-specific grid cloud cover (`cloud_cover`) to set sky cover (`0..3`), falling back to NWS station observation or model weather code if cloud cover is missing.
- **Ground Observation Rain Upgrade**: If model indicates dry sky (`code <= 3`) or light drizzle (`code < 61`), ground station observations of active precipitation (`obs.weatherCode >= 51` or `obs.precipitation > 0`) upgrade the condition directly to rain/snow/storm.

### 1.2 Multi-Station Consensus & Sensor Fallback

- **Candidate Inspection**: The app ranks the 3 nearest NWS physical observation stations by Haversine distance.
- **Primary Station**: Station #1 (closest) provides primary ground metrics (temperature, dew point, relative humidity, barometric pressure).
- **Consensus / Fallback for Precipitation**: If Station #1 reports dry/cloudy conditions or has an inoperative precipitation sensor (`PNO` remark in raw METAR / null precipitation), the app inspects Stations #2 and #3 within 10 miles. If a neighboring station reports active rain (`weatherCode >= 51` or `precipitation > 0`), the ground condition and precipitation rate upgrade to reflect local rain.
- **Variable Wind Support**: Stations reporting light variable winds (`VRB` in METAR or speed $\le 6\text{ kt}$ / $3.1\text{ m/s}$) with `windDirection: null` are accepted rather than rejected.

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
   - **Parameters**: `latitude`, `longitude`, `current` (`temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,dew_point_2m,uv_index,pressure_msl,wind_gusts_10m,precipitation,cape`), `hourly` (`temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability,pressure_msl,wind_gusts_10m,cape`), `minutely_15` (`lightning_potential,cape,weather_code`), `daily` (`weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max`), `temperature_unit`, `wind_speed_unit`, `precipitation_unit`, `forecast_days=10`, `timezone=auto`
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
   - **Usage**: Fetches ground station telemetry (dew point, relative humidity, wind speed, gusts, direction, precipitation in last hour, barometric pressure, structured present weather, raw METAR). Rejects observations older than 60 minutes.

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
   - **In-Tab Periodic Check**: While the tab remains open and visible, a 60-second timer checks whether data is older than **10 minutes** (`STALE_MS = 10 * 60 * 1000`) and silently re-fetches.
   - Prevents stale conditions on dashboard displays or open desktop/tablet monitors.

---

## 5. Precip Rate Update Behavior

- **Station Reporting Intervals**: NWS stations typically update `precipitationLastHour` once per hour (around :50–:55 past the hour). Open-Meteo updates current model precipitation in 15-to-60 minute runs.
- **Update Frequency**: While the app is visible, data automatically re-fetches every 10 minutes. Users can also manually refresh or trigger an update on tab focus.
