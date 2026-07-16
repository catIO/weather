// ── Weather code → emoji + description mapping ──
const WMO_CODES = {
  0: ['☀️', 'Clear sky'],
  1: ['🌤️', 'Mainly clear'],
  2: ['⛅', 'Partly cloudy'],
  3: ['☁️', 'Overcast'],
  45: ['😶‍🌫️', 'Foggy'],
  48: ['😶‍🌫️', 'Depositing rime fog'],
  51: ['🌦️', 'Light drizzle'],
  53: ['🌦️', 'Moderate drizzle'],
  55: ['🌧️', 'Dense drizzle'],
  56: ['🌧️', 'Light freezing drizzle'],
  57: ['🌧️', 'Dense freezing drizzle'],
  61: ['🌧️', 'Slight rain'],
  63: ['🌧️', 'Moderate rain'],
  65: ['🌧️', 'Heavy rain'],
  66: ['🌧️', 'Light freezing rain'],
  67: ['🌧️', 'Heavy freezing rain'],
  71: ['🌨️', 'Slight snow'],
  73: ['🌨️', 'Moderate snow'],
  75: ['🌨️', 'Heavy snow'],
  77: ['🌨️', 'Snow grains'],
  80: ['🌦️', 'Slight rain showers'],
  81: ['🌧️', 'Moderate rain showers'],
  82: ['🌧️', 'Violent rain showers'],
  85: ['🌨️', 'Slight snow showers'],
  86: ['🌨️', 'Heavy snow showers'],
  95: ['⛈️', 'Thunderstorm'],
  96: ['⛈️', 'Thunderstorm with slight hail'],
  99: ['⛈️', 'Thunderstorm with heavy hail'],
};

function weatherInfo(code) {
  return WMO_CODES[code] || ['❓', 'Unknown'];
}

function getHourlyIcon(code, precipProb, cape) {
  if ([95, 96, 99].includes(code)) {
    return '⛈️';
  }
  if (cape >= 500 && precipProb >= 30) {
    return '⛈️';
  }
  return weatherInfo(code)[0];
}

// Derive a representative daily icon from hourly data (daytime hours 6am-9pm)
// instead of using the daily weather_code which picks the single "worst" event.
function getDailyIcon(data, dayStr) {
  const hourlyTimes = data.hourly.time;
  const daytimeStart = dayStr + 'T06:00';
  const daytimeEnd = dayStr + 'T21:00';

  // Collect daytime hourly codes and precip probabilities
  const daytimeHours = [];
  for (let h = 0; h < hourlyTimes.length; h++) {
    if (hourlyTimes[h] >= daytimeStart && hourlyTimes[h] <= daytimeEnd) {
      let hourlyAqi = null;
      let hourlyPm25 = null;
      if (data.aqi && data.aqi.hourly) {
        const timeStr = hourlyTimes[h];
        const aqiIdx = data.aqi.hourly.time.indexOf(timeStr);
        if (aqiIdx !== -1) {
          hourlyAqi = data.aqi.hourly.us_aqi[aqiIdx];
          hourlyPm25 = data.aqi.hourly.pm2_5[aqiIdx];
        }
      }
      daytimeHours.push({
        code: data.hourly.weather_code[h],
        precip: data.hourly.precipitation_probability[h] || 0,
        cape: data.hourly.cape ? data.hourly.cape[h] : 0,
        aqi: hourlyAqi,
        pm2_5: hourlyPm25,
      });
    }
  }

  if (daytimeHours.length === 0) {
    // Fallback to daily code if no hourly data
    return weatherInfo(data.daily.weather_code[
      data.daily.time.indexOf(dayStr)
    ])[0];
  }

  // Count hours by category, weighted by precipitation probability
  let thunderHours = 0;
  let rainHours = 0;
  let cloudyHours = 0;
  let clearHours = 0;
  let smokyHours = 0;

  for (const hr of daytimeHours) {
    const { code, precip, cape, aqi, pm2_5 } = hr;
    if ([95, 96, 99].includes(code) || (cape >= 500 && precip >= 40)) {
      thunderHours++;
    } else if (code >= 51 && precip >= 30) {
      // Only count as rain if precip probability supports it
      rainHours++;
    } else if (code >= 51 && precip >= 15) {
      // Borderline rain — count as half cloud, half rain
      rainHours += 0.5;
      cloudyHours += 0.5;
    } else if (aqi != null && (aqi >= 100 || pm2_5 >= 35) && (code <= 3 || code === 45 || code === 48)) {
      // Haze/smoke overrides clear/partly cloudy/foggy skies
      smokyHours++;
    } else if (code >= 2 || (precip >= 20 && precip < 30)) {
      cloudyHours++;
    } else {
      clearHours++;
    }
  }

  const total = daytimeHours.length;

  // Determine icon based on proportions
  if (thunderHours >= 2 || thunderHours / total >= 0.15) {
    return '⛈️';
  }
  if (rainHours / total >= 0.4) {
    return '🌧️';
  }
  if (rainHours / total >= 0.2) {
    return '🌦️';
  }
  if (smokyHours >= 2 || smokyHours / total >= 0.15) {
    return '😶‍🌫️';
  }
  if (cloudyHours / total >= 0.7) {
    return '☁️';
  }
  if (cloudyHours / total >= 0.4) {
    return '⛅';
  }
  if (cloudyHours / total >= 0.2 || (clearHours + smokyHours) < total) {
    return '🌤️';
  }
  return '☀️';
}

function windDirection(degrees) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(degrees / 22.5) % 16];
}

function pressureTrend(data) {
  const times = data.hourly.time;
  const pressures = data.hourly.pressure_msl;
  const now = new Date();
  let nowIdx = times.findIndex((t) => new Date(t) >= now);
  if (nowIdx < 0) nowIdx = times.length - 1;
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  let pastIdx = times.findIndex((t) => new Date(t) >= threeHoursAgo);
  if (pastIdx < 0) pastIdx = 0;
  const diff = pressures[nowIdx] - pressures[pastIdx];
  if (diff > 2) return 'Rising fast';
  if (diff > 0.5) return 'Rising';
  if (diff < -2) return 'Falling fast';
  if (diff < -0.5) return 'Falling';
  return 'Steady';
}

// ── DOM refs ──
const $ = (id) => document.getElementById(id);
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const geoBtn = $('geoBtn');
const shareBtn = $('shareBtn');
const settingsBtn = $('settingsBtn');
const settingsPanel = $('settingsPanel');
const closeSettings = $('closeSettings');
const suggestionsEl = $('suggestions');
const loadingEl = $('loading');
const errorEl = $('error');
const currentEl = $('current');
const hourlyEl = $('hourly');
const dailyEl = $('daily');
const emptyStateEl = $('emptyState');
const saveLocationBtn = $('saveLocationBtn');
const locationsList = $('locationsList');

const summaryModal = $('summaryModal');
const closeSummaryBtn = $('closeSummary');
const summaryText = $('summaryText');
const weatherSummaryBtn = $('weatherSummaryBtn');
const refreshIndicatorEl = $('refreshIndicator');
const stormAlertEl = $('stormAlert');
const stormAlertIconEl = $('stormAlertIcon');
const stormAlertTitleEl = $('stormAlertTitle');
const stormAlertDetailEl = $('stormAlertDetail');
let latestWeatherData = null;
let latestAlerts = [];

// ── Settings (localStorage) ──
// Country-based unit defaults (applied only on first use)
const METRIC_COUNTRIES = new Set(); // Most countries use metric; we track the exceptions
const IMPERIAL_COUNTRIES = new Set(['US', 'LR', 'MM']); // Fahrenheit / mph / inch

function getDefaultsForCountry(countryCode) {
  if (IMPERIAL_COUNTRIES.has(countryCode)) {
    return { unit: 'fahrenheit', windUnit: 'mph', precipUnit: 'inch', pressureUnit: 'inHg', distanceUnit: 'mi' };
  }
  if (countryCode === 'GB') {
    return { unit: 'celsius', windUnit: 'mph', precipUnit: 'mm', pressureUnit: 'hPa', distanceUnit: 'mi' };
  }
  // Metric defaults for all other countries
  return { unit: 'celsius', windUnit: 'kmh', precipUnit: 'mm', pressureUnit: 'hPa', distanceUnit: 'km' };
}

async function detectCountryDefaults() {
  // Only run on first use (no saved settings exist)
  if (localStorage.getItem('weather_settings')) return;
  try {
    const res = await fetch('https://ipapi.co/country/', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const country = (await res.text()).trim().toUpperCase();
    if (country.length === 2) {
      const defaults = getDefaultsForCountry(country);
      Object.assign(settings, defaults);
      saveSettings(settings);
      // Update UI toggles to reflect detected defaults
      document.querySelectorAll('.unit-btn').forEach((btn) =>
        btn.classList.toggle('active', btn.dataset.unit === settings.unit)
      );
      ['windUnit', 'precipUnit', 'pressureUnit', 'distanceUnit'].forEach(key => {
        const el = $(key);
        if (el) el.value = settings[key];
      });
    }
  } catch { /* Network error — keep hardcoded defaults */ }
}

function loadSettings() {
  try {
    return Object.assign({
      unit: 'fahrenheit',
      windUnit: 'mph',
      precipUnit: 'inch',
      pressureUnit: 'inHg',
      distanceUnit: 'mi'
    }, JSON.parse(localStorage.getItem('weather_settings')) || {});
  } catch {
    return { unit: 'fahrenheit', windUnit: 'mph', precipUnit: 'inch', pressureUnit: 'inHg', distanceUnit: 'mi' };
  }
}

function saveSettings(settings) {
  localStorage.setItem('weather_settings', JSON.stringify(settings));
}

let settings = loadSettings();

// ── Saved locations (localStorage) ──
function loadLocations() {
  try {
    return JSON.parse(localStorage.getItem('weather_locations')) || [];
  } catch { return []; }
}

function saveLocations(locations) {
  localStorage.setItem('weather_locations', JSON.stringify(locations));
}

let savedLocations = loadLocations();
let currentLocation = null; // { lat, lon, name }

// ── Toast ──
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Share button ──
shareBtn.addEventListener('click', () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied');
  });
});

// ── Settings UI ──
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

closeSettings.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

// Init unit toggle state
function initUnitToggle() {
  document.querySelectorAll('.unit-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.unit === settings.unit);
    btn.addEventListener('click', () => {
      if (btn.dataset.unit === settings.unit) return;
      settings.unit = btn.dataset.unit;
      saveSettings(settings);
      document.querySelectorAll('.unit-btn').forEach((b) =>
        b.classList.toggle('active', b.dataset.unit === settings.unit)
      );
      // Re-fetch if we have a current location
      if (currentLocation) {
        fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name, { silent: true, force: true });
      }
    });
  });

  ['windUnit', 'precipUnit', 'pressureUnit', 'distanceUnit'].forEach(key => {
    const select = $(key);
    if (select) {
      select.value = settings[key];
      select.addEventListener('change', () => {
        settings[key] = select.value;
        saveSettings(settings);
        if (currentLocation) {
          fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name, { silent: true, force: true });
        }
      });
    }
  });
}
initUnitToggle();

// ── Saved Locations UI ──
function renderLocations() {
  locationsList.innerHTML = '';
  if (savedLocations.length === 0) {
    locationsList.innerHTML = '<div class="empty-locations">Search for a city, then tap + to save it</div>';
    return;
  }
  savedLocations.forEach((loc, idx) => {
    const div = document.createElement('div');
    div.className = 'location-item';
    div.innerHTML = `
      <span class="location-name">${loc.name}</span>
      <button class="location-remove" data-idx="${idx}" aria-label="Remove"><span class="material-icons">delete</span></button>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.closest('.location-remove')) return;
      fetchWeather(loc.lat, loc.lon, loc.name);
    });
    div.querySelector('.location-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      savedLocations.splice(idx, 1);
      saveLocations(savedLocations);
      renderLocations();
    });
    locationsList.appendChild(div);
  });
}
renderLocations();

saveLocationBtn.addEventListener('click', () => {
  if (!currentLocation) {
    showError('Search for a city first, then save it.');
    return;
  }
  const exists = savedLocations.some(
    (l) => l.lat === currentLocation.lat && l.lon === currentLocation.lon
  );
  if (exists) return;
  savedLocations.push({ ...currentLocation });
  saveLocations(savedLocations);
  renderLocations();
});

// ── Recent searches (localStorage, max 3) ──
function loadRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem('weather_recent_searches')) || [];
  } catch { return []; }
}

function saveRecentSearch(loc) {
  let recents = loadRecentSearches();
  // Remove duplicate if exists
  recents = recents.filter(r => !(r.lat === loc.lat && r.lon === loc.lon));
  // Add to front
  recents.unshift(loc);
  // Keep only 3
  if (recents.length > 3) recents.length = 3;
  localStorage.setItem('weather_recent_searches', JSON.stringify(recents));
}

// ── Geocoding search ──
let debounceTimer;

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    suggestionsEl.classList.add('hidden');
    if (q.length === 0) showRecentSearches();
    return;
  }
  debounceTimer = setTimeout(() => searchLocations(q), 300);
});

searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim().length < 2) {
    showRecentSearches();
  }
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    suggestionsEl.classList.add('hidden');
    const q = searchInput.value.trim();
    if (currentLocation && q === currentLocation.name) {
      fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name);
      return;
    }
    if (q.length >= 2) searchLocations(q, true);
  }
});

searchBtn.addEventListener('click', () => {
  suggestionsEl.classList.add('hidden');
  const q = searchInput.value.trim();
  if (currentLocation && q === currentLocation.name) {
    fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name);
    return;
  }
  if (q.length >= 2) searchLocations(q, true);
});

geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      fetchWeather(pos.coords.latitude, pos.coords.longitude, 'My Location');
    },
    () => showError('Unable to retrieve your location.')
  );
});

async function searchLocations(query, autoSelect = false) {
  try {
    const cityName = query.split(',')[0].trim();
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      if (autoSelect) showError('No locations found.');
      suggestionsEl.classList.add('hidden');
      return;
    }
    if (autoSelect) {
      let selectedLoc = data.results[0];
      if (query.includes(',')) {
        const parts = query.toLowerCase().split(',').map(p => p.trim());
        const match = data.results.find(r => {
          const rStr = formatLocation(r).toLowerCase();
          return parts.every(p => rStr.includes(p));
        });
        if (match) selectedLoc = match;
      }

      const loc = selectedLoc;
      suggestionsEl.classList.add('hidden');
      searchInput.value = '';
      searchInput.blur();
      const name = formatLocation(loc);
      saveRecentSearch({ lat: loc.latitude, lon: loc.longitude, name });
      fetchWeather(loc.latitude, loc.longitude, name);
      return;
    }
    renderSuggestions(data.results);
  } catch {
    showError('Failed to search locations.');
  }
}

function formatLocation(loc) {
  const parts = [loc.name];
  if (loc.admin1 && loc.admin1 !== loc.name) parts.push(loc.admin1);
  if (loc.country_code) parts.push(loc.country_code);
  else if (loc.country) parts.push(loc.country);
  return parts.join(', ');
}

function renderSuggestions(results) {
  suggestionsEl.innerHTML = '';
  results.forEach((loc) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = formatLocation(loc);
    div.addEventListener('click', () => {
      suggestionsEl.classList.add('hidden');
      searchInput.value = '';
      searchInput.blur();
      const name = formatLocation(loc);
      saveRecentSearch({ lat: loc.latitude, lon: loc.longitude, name });
      fetchWeather(loc.latitude, loc.longitude, name);
    });
    suggestionsEl.appendChild(div);
  });
  suggestionsEl.classList.remove('hidden');
}

function showRecentSearches() {
  const recents = loadRecentSearches();
  if (recents.length === 0) {
    suggestionsEl.classList.add('hidden');
    return;
  }
  suggestionsEl.innerHTML = '';
  recents.forEach((loc) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = loc.name;
    div.addEventListener('click', () => {
      suggestionsEl.classList.add('hidden');
      searchInput.value = '';
      searchInput.blur();
      fetchWeather(loc.lat, loc.lon, loc.name);
    });
    suggestionsEl.appendChild(div);
  });
  suggestionsEl.classList.remove('hidden');
}

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('header')) {
    suggestionsEl.classList.add('hidden');
  }
});

// ── Weather fetching ──
async function fetchWeather(lat, lon, name, { silent = false, force = false } = {}) {
  // Skip if same location and data is still fresh (avoids duplicate calls)
  if (silent && !force && latestWeatherData && currentLocation &&
    currentLocation.lat === lat && currentLocation.lon === lon &&
    Date.now() - lastFetchTime < STALE_MS) {
    return;
  }

  const hasData = silent && latestWeatherData;
  emptyStateEl.classList.add('hidden');
  if (hasData) {
    showRefreshIndicator(true);
  } else {
    showLoading(true);
    hideError();
    hideWeather();
  }
  currentLocation = { lat, lon, name };
  latestAlerts = [];
  lastFetchTime = Date.now();
  localStorage.setItem('weather_last_fetch_time', String(lastFetchTime));
  localStorage.setItem('weather_last_location', JSON.stringify(currentLocation));

  // Update URL hash for sharing
  updatingHash = true;
  location.hash = `${lat},${lon},${name.replace(/ /g, '+')}`;
  updatingHash = false;

  const tempUnit = settings.unit;
  const windUnit = settings.windUnit;
  const precipUnit = settings.precipUnit;

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,dew_point_2m,uv_index,pressure_msl,wind_gusts_10m,precipitation',
      hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability,pressure_msl,wind_gusts_10m,cape',
      minutely_15: 'lightning_potential,cape,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max',
      temperature_unit: tempUnit,
      wind_speed_unit: windUnit,
      precipitation_unit: precipUnit,
      forecast_days: 10,
      timezone: 'auto',
    });

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?${params}`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&hourly=us_aqi,pm2_5,pm10&forecast_days=7&timezone=auto`;

    let data, aqiData = null;
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(aqiUrl).catch(err => {
        console.warn('AQI fetch failed:', err);
        return null;
      })
    ]);

    if (!weatherRes.ok) throw new Error('Weather API error');
    data = await weatherRes.json();

    if (aqiRes && aqiRes.ok) {
      try {
        aqiData = await aqiRes.json();
      } catch (e) {
        console.warn('Failed to parse AQI JSON:', e);
      }
    }

    if (aqiData) {
      data.aqi = aqiData;
    }

    latestWeatherData = data;

    renderCurrent(data, name);
    renderHourly(data);
    renderDaily(data);
    lastFetchTime = Date.now();
    localStorage.setItem('weather_last_fetch_time', String(lastFetchTime));

    // Fetch NWS alerts (US only, non-blocking)
    fetchNWSAlerts(lat, lon);
  } catch (err) {
    console.error(err);
    if (!hasData) {
      showError('Failed to fetch weather data. Please try again.');
    }
  } finally {
    showLoading(false);
    showRefreshIndicator(false);
  }
}

// ── Rendering ──
function unitLabel() { return settings.unit === 'fahrenheit' ? '°F' : '°C'; }
function windLabel() {
  if (settings.windUnit === 'kmh') return 'km/h';
  if (settings.windUnit === 'ms') return 'm/s';
  if (settings.windUnit === 'kn') return 'knots';
  return 'mph';
}

// ── Smart condition derivation using all available signals ──
function deriveCurrentCode(data) {
  const c = data.current;
  let code = c.weather_code;
  const precip = c.precipitation ?? 0; // mm or inch depending on unit

  // Check minutely_15 for thunderstorm codes in the current window (±15 min)
  const now = new Date();
  const m15Times = data.minutely_15?.time ?? [];
  const codeM15 = data.minutely_15?.weather_code ?? [];
  const lpiArr = data.minutely_15?.lightning_potential ?? [];
  const capeM15 = data.minutely_15?.cape ?? [];

  let m15Idx = m15Times.findIndex((t) => new Date(t) >= now);
  if (m15Idx < 0) m15Idx = Math.max(0, m15Times.length - 1);
  // Look at current slot and the one before (covers ±15 min window)
  const m15Window = [m15Idx - 1, m15Idx, m15Idx + 1].filter(
    (i) => i >= 0 && i < m15Times.length
  );

  let nearLPI = 0;
  let nearCape = 0;
  let m15StormCode = null;
  for (const i of m15Window) {
    if (lpiArr[i] != null && lpiArr[i] > nearLPI) nearLPI = lpiArr[i];
    if (capeM15[i] != null && capeM15[i] > nearCape) nearCape = capeM15[i];
    if ([95, 96, 99].includes(codeM15[i]) && m15StormCode === null) {
      m15StormCode = codeM15[i];
    }
  }

  // Also grab hourly CAPE for the current hour
  const hourTimes = data.hourly?.time ?? [];
  const capeHourly = data.hourly?.cape ?? [];
  let hIdx = hourTimes.findIndex((t) => new Date(t) >= now);
  if (hIdx < 0) hIdx = Math.max(0, hourTimes.length - 1);
  const hourlyCape = capeHourly[hIdx] ?? 0;
  const maxCape = Math.max(nearCape, hourlyCape);

  // --- Priority 1: Thunderstorm upgrade ---
  // If minutely_15 reports a storm code right now, trust it
  if (m15StormCode !== null) return m15StormCode;
  // If active lightning potential + precip, it's a thunderstorm
  if (nearLPI > 0 && precip > 0) return 95;
  // High CAPE + meaningful precip = likely convective storm
  if (maxCape >= 1000 && precip > 0) return 95;

  // --- Priority 2: Precipitation intensity mapping ---
  if (precip > 0 && code <= 3) {
    // Code says clear/cloudy but it's precipitating — use intensity bands
    // Thresholds differ by unit; Open-Meteo sends mm by default, inch if configured
    const isInch = settings.precipUnit === 'inch';
    const heavy = isInch ? 0.3 : 7.6;   // per hour equiv
    const moderate = isInch ? 0.1 : 2.5;
    if (precip >= heavy) return 65;       // Heavy rain
    if (precip >= moderate) return 63;    // Moderate rain
    return 61;                             // Slight rain
  }

  // --- Priority 3: Intensity correction when already raining ---
  // If code already indicates rain but intensity is higher, upgrade
  if ([61, 80].includes(code) && precip > 0) {
    const isInch = settings.precipUnit === 'inch';
    const heavy = isInch ? 0.3 : 7.6;
    const moderate = isInch ? 0.1 : 2.5;
    if (precip >= heavy) return 65;
    if (precip >= moderate) return 63;
  }

  return code;
}

function renderCurrent(data, name) {
  const c = data.current;
  const code = deriveCurrentCode(data);

  let [icon, desc] = weatherInfo(code);

  // Override weather icon and description if AQI is elevated (indicating smoke/haze)
  if (data.aqi && data.aqi.current) {
    const aqiVal = data.aqi.current.us_aqi;
    const pm2_5 = data.aqi.current.pm2_5;
    if ((aqiVal >= 100 || pm2_5 >= 35) && [0, 1, 2, 3, 45, 48].includes(code)) {
      icon = '😶‍🌫️';
      desc = aqiVal >= 150 ? 'Dense Smoke/Haze' : 'Haze (Smoke)';
    }
  }

  $('cityName').textContent = name;
  const now = new Date();
  const localDateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }) + '  ·  ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });

  // Show location's local time if it differs from user's timezone
  const locTz = data.timezone;
  let dateDisplay = localDateStr;
  if (locTz) {
    try {
      const locTime = now.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
        timeZone: locTz,
      });
      const myTime = now.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
      });
      if (locTime !== myTime) {
        dateDisplay += `  ·  ${locTime} local`;
      }
    } catch { /* invalid timezone, skip */ }
  }
  $('currentDate').textContent = dateDisplay;
  $('weatherIcon').textContent = icon;
  $('currentTemp').textContent = `${Math.round(c.temperature_2m)}${unitLabel()}`;
  $('weatherDesc').textContent = desc;
  $('dewPoint').textContent = `${Math.round(c.dew_point_2m)}${unitLabel()}`;
  $('humidity').textContent = `${c.relative_humidity_2m}%`;
  const windSpeed = Math.round(c.wind_speed_10m);
  const gusts = c.wind_gusts_10m;
  const gustsSpan = $('windGusts');
  if (gusts != null && gusts > windSpeed) {
    $('windSpeed').textContent = `${windSpeed} ${windLabel()}`;
    gustsSpan.textContent = `Gusts: ${Math.round(gusts)} ${windLabel()}`;
    gustsSpan.style.display = 'block';
  } else {
    $('windSpeed').textContent = `${windSpeed} ${windLabel()}`;
    gustsSpan.style.display = 'none';
  }
  $('windDir').innerHTML = `${windDirection(c.wind_direction_10m)}<span class="wind-dir">${String(Math.round(c.wind_direction_10m)).padStart(3, '0')}°</span>`;

  // Pressure with 3-hour trend
  let currentPressure = c.pressure_msl;
  let pressureUnitLabel = 'hPa';
  if (settings.pressureUnit === 'inHg') {
    currentPressure = (currentPressure * 0.02953).toFixed(2);
    pressureUnitLabel = 'inHg';
  } else {
    currentPressure = Math.round(currentPressure);
  }
  const trend = pressureTrend(data);
  $('pressure').innerHTML = `${currentPressure} ${pressureUnitLabel}<span class="pressure-trend">${trend}</span>`;

  $('uvIndex').textContent = c.uv_index != null ? Math.round(c.uv_index) : '—';

  // Air Quality index tile
  const aqiValueSpan = $('aqiValue');
  const aqiDescSpan = $('aqiDesc');
  const aqiTile = aqiValueSpan.closest('.detail');
  
  if (data.aqi && data.aqi.current) {
    const aqiVal = data.aqi.current.us_aqi;
    const pm2_5 = data.aqi.current.pm2_5;
    
    // Only show Air Quality tile if levels are elevated (AQI >= 100 or PM2.5 >= 35)
    const showTile = (aqiVal >= 100 || pm2_5 >= 35);
    aqiTile.classList.toggle('hidden', !showTile);
    
    aqiValueSpan.textContent = aqiVal != null ? Math.round(aqiVal) : '—';
    
    let aqiLabel = 'Good';
    let aqiColor = '#81c784';
    if (aqiVal > 300) {
      aqiLabel = 'Hazardous';
      aqiColor = '#7e0023';
    } else if (aqiVal > 200) {
      aqiLabel = 'Very Unhealthy';
      aqiColor = '#8f3f97';
    } else if (aqiVal > 150) {
      aqiLabel = 'Unhealthy';
      aqiColor = 'var(--storm-severe)';
    } else if (aqiVal > 100) {
      aqiLabel = 'Unhealthy for Sens.';
      aqiColor = 'var(--storm)';
    } else if (aqiVal > 50) {
      aqiLabel = 'Moderate';
      aqiColor = '#ffeb3b';
    }
    
    aqiDescSpan.textContent = aqiLabel;
    aqiDescSpan.style.color = aqiColor;
    aqiDescSpan.style.display = 'block';
    
    aqiTile.classList.toggle('elevated-severe', aqiVal >= 150);
    aqiTile.classList.toggle('elevated', aqiVal >= 101 && aqiVal < 150);
  } else {
    aqiTile.classList.add('hidden');
    aqiValueSpan.textContent = '—';
    aqiDescSpan.style.display = 'none';
    aqiTile.classList.remove('elevated', 'elevated-severe');
  }

  // Precip Rate
  const precip = c.precipitation ?? 0;
  const precipUnitLabel = settings.precipUnit === 'inch' ? 'in/hr' : 'mm/hr';
  $('precipRate').textContent = precip > 0 ? `${precip} ${precipUnitLabel}` : 'None';

  // CAPE (from nearest minutely_15 or hourly)
  const now2 = new Date();
  const m15T = data.minutely_15?.time ?? [];
  const m15C = data.minutely_15?.cape ?? [];
  let capeIdx = m15T.findIndex((t) => new Date(t) >= now2);
  if (capeIdx < 0) capeIdx = Math.max(0, m15T.length - 1);
  let capeVal = m15C[capeIdx] ?? null;
  if (capeVal == null) {
    const hT = data.hourly?.time ?? [];
    const hC = data.hourly?.cape ?? [];
    let hIdx = hT.findIndex((t) => new Date(t) >= now2);
    if (hIdx < 0) hIdx = Math.max(0, hT.length - 1);
    capeVal = hC[hIdx] ?? 0;
  }
  $('cape').textContent = `${Math.round(capeVal)} J/kg`;

  // ── Highlight elevated tiles ──
  const isFahrenheit = settings.unit === 'fahrenheit';
  const gustThresholdMph = settings.windUnit === 'kmh' ? 32 : (settings.windUnit === 'ms' ? 9 : 20);
  const gustSevere = settings.windUnit === 'kmh' ? 48 : (settings.windUnit === 'ms' ? 13 : 30);

  // Wind tile
  const windTile = $('windSpeed').closest('.detail');
  windTile.classList.toggle('elevated-severe', gusts >= gustSevere);
  windTile.classList.toggle('elevated', gusts >= gustThresholdMph && gusts < gustSevere);

  // UV tile
  const uvVal = c.uv_index ?? 0;
  const uvTile = $('uvIndex').closest('.detail');
  uvTile.classList.toggle('elevated-severe', uvVal >= 8);
  uvTile.classList.toggle('elevated', uvVal >= 6 && uvVal < 8);

  // Precip tile
  const precipTile = $('precipRate').closest('.detail');
  const heavyPrecip = settings.precipUnit === 'inch' ? 0.3 : 7.6;
  const modPrecip = settings.precipUnit === 'inch' ? 0.1 : 2.5;
  precipTile.classList.toggle('elevated-severe', precip >= heavyPrecip);
  precipTile.classList.toggle('elevated', precip >= modPrecip && precip < heavyPrecip);

  // CAPE tile
  const capeTile = $('cape').closest('.detail');
  capeTile.classList.toggle('elevated-severe', capeVal >= 1000);
  capeTile.classList.toggle('elevated', capeVal >= 500 && capeVal < 1000);

  // Pressure tile (falling fast)
  const pressureTile = $('pressure').closest('.detail');
  pressureTile.classList.toggle('elevated', trend === 'Falling fast');
  pressureTile.classList.remove('elevated-severe');

  // Update browser tab favicon dynamically to match the current condition emoji
  updateFavicon(icon);

  currentEl.classList.remove('hidden');
}

// ── NWS Alerts (US only) ──
async function fetchNWSAlerts(lat, lon) {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}&status=actual`,
      { headers: { 'User-Agent': '(weather-pwa, contact@example.com)' } }
    );
    if (!res.ok) {
      // Non-US location or API issue — just hide the alert
      stormAlertEl.classList.add('hidden');
      stormAlertEl.classList.remove('storm-severe');
      latestAlerts = [];
      return;
    }
    const json = await res.json();
    renderNWSAlert(json.features || []);
  } catch {
    // Network error — silently hide alert
    stormAlertEl.classList.add('hidden');
    stormAlertEl.classList.remove('storm-severe');
    latestAlerts = [];
  }
}

function cleanAlertText(text) {
  if (!text) return '';
  return text
    .replace(/\s*(?:by|issued by)\s+(?:NWS|National Weather Service)\s+[A-Za-z0-9/&,\s-]+?(?=\.|$|\.\.\.)/gi, '')
    .trim();
}

function renderNWSAlert(features) {
  // Filter to active alerts (use ends or expires as expiry)
  const now = new Date();
  let alerts = features
    .map((f) => {
      const p = f.properties;
      return {
        ...p,
        headline: cleanAlertText(p.headline),
        description: cleanAlertText(p.description),
      };
    })
    .filter((p) => {
      if (p.status !== 'Actual') return false;
      const expiry = p.ends || p.expires;
      return !expiry || new Date(expiry) > now;
    });

  // Keep only the latest alert if there are multiple of the same event
  alerts.sort((a, b) => new Date(b.sent || 0) - new Date(a.sent || 0));
  const seenEvents = new Set();
  alerts = alerts.filter((a) => {
    if (seenEvents.has(a.event)) return false;
    seenEvents.add(a.event);
    return true;
  });

  latestAlerts = alerts;

  if (alerts.length === 0) {
    stormAlertEl.classList.add('hidden');
    stormAlertEl.classList.remove('storm-severe');
    return;
  }

  // Sort by severity: Extreme > Severe > Moderate > Minor > Unknown
  const sevOrder = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
  alerts.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));

  const top = alerts[0];
  const isSevere = top.severity === 'Extreme' || top.severity === 'Severe';

  stormAlertEl.classList.remove('hidden');
  stormAlertEl.classList.toggle('storm-severe', isSevere);
  stormAlertIconEl.textContent = '⚠️';
  stormAlertIconEl.style.display = isSevere ? 'block' : 'none';
  stormAlertTitleEl.textContent = top.event;
  stormAlertDetailEl.textContent = top.headline || top.description?.slice(0, 120) || '';
}

function renderHourly(data) {
  const list = $('hourlyList');
  const fragment = document.createDocumentFragment();

  const now = new Date();
  const times = data.hourly.time;
  // Find the index of the current hour
  let startIdx = times.findIndex((t) => new Date(t) >= now);
  if (startIdx < 0) startIdx = 0;

  // Show next 24 hours
  const count = Math.min(24, times.length - startIdx);
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const dt = new Date(times[idx]);
    const precip = data.hourly.precipitation_probability[idx] ?? 0;
    const cape = data.hourly.cape?.[idx] ?? 0;
    const code = data.hourly.weather_code[idx];

    // Find matching AQI hourly data
    let hourlyAqi = null;
    let hourlyPm25 = null;
    if (data.aqi && data.aqi.hourly) {
      const timeStr = times[idx];
      const aqiIdx = data.aqi.hourly.time.indexOf(timeStr);
      if (aqiIdx !== -1) {
        hourlyAqi = data.aqi.hourly.us_aqi[aqiIdx];
        hourlyPm25 = data.aqi.hourly.pm2_5[aqiIdx];
      }
    }

    let icon = getHourlyIcon(code, precip, cape);
    if (hourlyAqi != null && (hourlyAqi >= 100 || hourlyPm25 >= 35) && [0, 1, 2, 3, 45, 48].includes(code)) {
      icon = '😶‍🌫️';
    }

    const temp = Math.round(data.hourly.temperature_2m[idx]);
    const wind = Math.round(data.hourly.wind_speed_10m[idx]);
    const wdir = windDirection(data.hourly.wind_direction_10m[idx]);

    let aqiHtml = '';
    let aqiTooltip = '';
    if (hourlyAqi != null) {
      let aqiColor = '#81c784'; // Good
      if (hourlyAqi > 300) aqiColor = '#7e0023';
      else if (hourlyAqi > 200) aqiColor = '#8f3f97';
      else if (hourlyAqi > 150) aqiColor = 'var(--storm-severe)';
      else if (hourlyAqi > 100) aqiColor = 'var(--storm)';
      else if (hourlyAqi > 50) aqiColor = '#ffeb3b';

      aqiHtml = `<div class="h-aqi" style="font-size: 10px; margin-top: 6px; color: ${aqiColor}; font-weight: 500;">AQI ${hourlyAqi}</div>`;
      aqiTooltip = ` · Air Quality: AQI ${hourlyAqi}`;
    }

    const div = document.createElement('div');
    div.className = 'hourly-item';
    div.title = `Wind: ${wind} ${wdir} · Precip Prob: ${precip}%${aqiTooltip}`;
    div.innerHTML = `
      <div class="hour">${i === 0 ? 'Now' : dt.toLocaleTimeString('en-US', { hour: 'numeric' })}</div>
      <div class="h-icon">${icon}</div>
      <div class="h-temp">${temp}°</div>
      <div class="h-precip${precip < 10 ? ' low-precip' : ''}"><span class="material-icons">water_drop</span> ${precip}%</div>
      <div class="h-wind"><span class="material-icons">air</span> ${wind} ${wdir}</div>
      ${aqiHtml}
    `;
    fragment.appendChild(div);
  }

  list.replaceChildren(fragment);
  hourlyEl.classList.remove('hidden');
}

function renderDaily(data) {
  const list = $('dailyList');

  // Capture which day index is currently expanded before rebuilding
  const expandedRow = list.querySelector('.daily-row.daily-expanded');
  let expandedIdx = -1;
  if (expandedRow) {
    const wrapper = expandedRow.closest('.daily-wrapper');
    expandedIdx = Array.from(list.children).indexOf(wrapper);
  }

  const fragment = document.createDocumentFragment();
  const days = data.daily.time;
  const hourlyTimes = data.hourly.time;

  for (let i = 0; i < days.length; i++) {
    const dt = new Date(days[i] + 'T00:00:00');
    const icon = getDailyIcon(data, days[i]);
    const high = Math.round(data.daily.temperature_2m_max[i]);
    const low = Math.round(data.daily.temperature_2m_min[i]);
    const dWind = Math.round(data.daily.wind_speed_10m_max[i]);
    // Find wind direction at the hour with peak wind speed for this day
    const dayStart = days[i] + 'T00:00';
    const dayEnd = days[i] + 'T23:00';
    let peakWindSpeed = -1;
    let peakWindDir = data.daily.wind_direction_10m_dominant[i];
    for (let h = 0; h < hourlyTimes.length; h++) {
      if (hourlyTimes[h] >= dayStart && hourlyTimes[h] <= dayEnd) {
        if (data.hourly.wind_speed_10m[h] > peakWindSpeed) {
          peakWindSpeed = data.hourly.wind_speed_10m[h];
          peakWindDir = data.hourly.wind_direction_10m[h];
        }
      }
    }
    const dDir = windDirection(peakWindDir);
    const dPrecip = data.daily.precipitation_probability_max[i] ?? 0;

    const dayName = i === 0
      ? 'Today'
      : dt.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const wrapper = document.createElement('div');
    wrapper.className = 'daily-wrapper';

    const coldThreshold = settings.unit === 'fahrenheit' ? 35 : 2;
    const hotThreshold = settings.unit === 'fahrenheit' ? 85 : 30;
    const lowClass = low < coldThreshold ? ' temp-cold' : '';
    const highClass = high > hotThreshold ? ' temp-hot' : '';

    const div = document.createElement('div');
    div.className = 'daily-row';
    if (i < 5) div.classList.add('daily-expandable');
    div.innerHTML = `
      <div class="daily-day">${dayName}<div class="daily-date">${dateStr}</div></div>
      <div class="daily-icon">${icon}</div>
      <div class="daily-temps"><span class="daily-low${lowClass}">${low}°</span><span class="daily-high${highClass}">${high}°</span></div>
      <div class="daily-precip${dPrecip < 10 ? ' low-precip' : ''}"><span class="material-icons">water_drop</span> ${dPrecip}%</div>
      <div class="daily-wind"><span class="material-icons">air</span><span class="dw-speed">${dWind} ${windLabel()}</span><span class="dw-dir">${dDir}</span></div>
    `;

    wrapper.appendChild(div);

    if (i < 5) {
      const detail = document.createElement('div');
      detail.className = 'daily-hourly hidden';
      wrapper.appendChild(detail);

      div.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !detail.classList.contains('hidden');
        // Close any other open panels
        list.querySelectorAll('.daily-hourly').forEach((el) => el.classList.add('hidden'));
        list.querySelectorAll('.daily-row').forEach((el) => el.classList.remove('daily-expanded'));
        if (!isOpen) {
          detail.classList.remove('hidden');
          div.classList.add('daily-expanded');
          if (!detail.dataset.loaded) {
            renderDayHourly(detail, data, days[i]);
            detail.dataset.loaded = '1';
          }
        }
      });
    }

    fragment.appendChild(wrapper);
  }

  list.replaceChildren(fragment);

  // Re-open the previously expanded day with fresh data
  if (expandedIdx >= 0) {
    const wrappers = list.querySelectorAll('.daily-wrapper');
    if (wrappers[expandedIdx]) {
      const row = wrappers[expandedIdx].querySelector('.daily-row.daily-expandable');
      const detail = wrappers[expandedIdx].querySelector('.daily-hourly');
      if (row && detail) {
        detail.classList.remove('hidden');
        row.classList.add('daily-expanded');
        renderDayHourly(detail, data, days[expandedIdx]);
        detail.dataset.loaded = '1';
      }
    }
  }

  dailyEl.classList.remove('hidden');
}

function renderDayHourly(container, data, dayStr) {
  const times = data.hourly.time;
  const dayStart = dayStr + 'T00:00';
  const dayEnd = dayStr + 'T23:00';
  const scroll = document.createElement('div');
  scroll.className = 'hourly-scroll';

  for (let idx = 0; idx < times.length; idx++) {
    if (times[idx] < dayStart || times[idx] > dayEnd) continue;
    const dt = new Date(times[idx]);
    const precip = data.hourly.precipitation_probability[idx] ?? 0;
    const cape = data.hourly.cape?.[idx] ?? 0;
    const code = data.hourly.weather_code[idx];

    // Find matching AQI hourly data
    let hourlyAqi = null;
    let hourlyPm25 = null;
    if (data.aqi && data.aqi.hourly) {
      const timeStr = times[idx];
      const aqiIdx = data.aqi.hourly.time.indexOf(timeStr);
      if (aqiIdx !== -1) {
        hourlyAqi = data.aqi.hourly.us_aqi[aqiIdx];
        hourlyPm25 = data.aqi.hourly.pm2_5[aqiIdx];
      }
    }

    let icon = getHourlyIcon(code, precip, cape);
    if (hourlyAqi != null && (hourlyAqi >= 100 || hourlyPm25 >= 35) && [0, 1, 2, 3, 45, 48].includes(code)) {
      icon = '😶‍🌫️';
    }

    const temp = Math.round(data.hourly.temperature_2m[idx]);
    const wind = Math.round(data.hourly.wind_speed_10m[idx]);
    const wdir = windDirection(data.hourly.wind_direction_10m[idx]);

    let aqiHtml = '';
    let aqiTooltip = '';
    if (hourlyAqi != null) {
      let aqiColor = '#81c784'; // Good
      if (hourlyAqi > 300) aqiColor = '#7e0023';
      else if (hourlyAqi > 200) aqiColor = '#8f3f97';
      else if (hourlyAqi > 150) aqiColor = 'var(--storm-severe)';
      else if (hourlyAqi > 100) aqiColor = 'var(--storm)';
      else if (hourlyAqi > 50) aqiColor = '#ffeb3b';

      aqiHtml = `<div class="h-aqi" style="font-size: 10px; margin-top: 6px; color: ${aqiColor}; font-weight: 500;">AQI ${hourlyAqi}</div>`;
      aqiTooltip = ` · Air Quality: AQI ${hourlyAqi}`;
    }

    const div = document.createElement('div');
    div.className = 'hourly-item';
    div.title = `Wind: ${wind} ${wdir} · Precip Prob: ${precip}%${aqiTooltip}`;
    div.innerHTML = `
      <div class="hour">${dt.toLocaleTimeString('en-US', { hour: 'numeric' })}</div>
      <div class="h-icon">${icon}</div>
      <div class="h-temp">${temp}°</div>
      <div class="h-precip${precip < 10 ? ' low-precip' : ''}"><span class="material-icons">water_drop</span> ${precip}%</div>
      <div class="h-wind"><span class="material-icons">air</span> ${wind} ${wdir}</div>
      ${aqiHtml}
    `;
    scroll.appendChild(div);
  }

  container.appendChild(scroll);
}

function updateFavicon(emoji) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.font = '28px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, 16, 16);

    const dataUrl = canvas.toDataURL('image/png');
    const links = document.querySelectorAll("link[rel*='icon']");
    links.forEach(link => {
      link.href = dataUrl;
    });
  } catch (e) {
    console.error('Failed to update favicon:', e);
  }
}

// ── Helpers ──
function showLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}

function hideWeather() {
  currentEl.classList.add('hidden');
  hourlyEl.classList.add('hidden');
  dailyEl.classList.add('hidden');
}

function showRefreshIndicator(show) {
  refreshIndicatorEl.classList.toggle('hidden', !show);
}

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ── Refresh on focus (if data is stale) ──
let lastFetchTime = 0;
// Refresh if data is more than 10 minutes old (Open-Meteo updates every 15 min;
// 10 min balances freshness vs unnecessary requests)
const STALE_MS = 10 * 60 * 1000;

// Persist lastFetchTime so staleness survives PWA suspend/resume
try {
  const stored = localStorage.getItem('weather_last_fetch_time');
  if (stored) lastFetchTime = parseInt(stored, 10) || 0;
} catch { /* ignore */ }

function refreshWeatherIfNeeded() {
  if (currentLocation && Date.now() - lastFetchTime > STALE_MS) {
    fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name, { silent: true });
  }
}

// Refresh only when user returns to the page (visibility/focus/pageshow),
// and only if data is more than 10 minutes stale. No periodic background polling.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshWeatherIfNeeded();
  }
});

window.addEventListener('pageshow', () => {
  refreshWeatherIfNeeded();
});

window.addEventListener('focus', refreshWeatherIfNeeded);

// ── Load last viewed or first saved location on startup ──
// ── Parse location from URL hash ──
function parseLocationHash() {
  const hash = location.hash.slice(1); // remove #
  if (!hash) return null;
  const parts = hash.split(',');
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  const name = parts.length >= 3 ? decodeURIComponent(parts.slice(2).join(',').replace(/\+/g, ' ')) : 'Shared Location';
  return { lat, lon, name };
}

let updatingHash = false;
window.addEventListener('hashchange', () => {
  if (updatingHash) return;
  const loc = parseLocationHash();
  if (loc) fetchWeather(loc.lat, loc.lon, loc.name);
});

(async function init() {
  // Detect country-based defaults on first use
  await detectCountryDefaults();

  // URL hash takes priority (shared link)
  const hashLoc = parseLocationHash();
  if (hashLoc) {
    fetchWeather(hashLoc.lat, hashLoc.lon, hashLoc.name);
    return;
  }

  const last = localStorage.getItem('weather_last_location');
  if (last) {
    try {
      const loc = JSON.parse(last);
      fetchWeather(loc.lat, loc.lon, loc.name);
      return;
    } catch { /* fall through */ }
  } else if (savedLocations.length > 0) {
    const loc = savedLocations[0];
    fetchWeather(loc.lat, loc.lon, loc.name);
  } else {
    emptyStateEl.classList.remove('hidden');
  }
})();

// ── Activity Outlook ──
function generateActivityOutlook(data) {
  const now = new Date();
  const times = data.hourly.time;
  let startIdx = times.findIndex((t) => new Date(t) >= now);
  if (startIdx < 0) startIdx = 0;

  const hoursToLook = 10;
  const indices = [];
  for (let i = 0; i < hoursToLook && (startIdx + i) < times.length; i++) {
    indices.push(startIdx + i);
  }

  // Check hourly AQI values in the forecast window (next 10 hours)
  let maxAqiInWindow = 0;
  if (data.aqi && data.aqi.hourly) {
    indices.forEach(idx => {
      const timeStr = times[idx];
      const aqiIdx = data.aqi.hourly.time.indexOf(timeStr);
      if (aqiIdx !== -1) {
        const aqiVal = data.aqi.hourly.us_aqi[aqiIdx];
        if (aqiVal != null && aqiVal > maxAqiInWindow) {
          maxAqiInWindow = aqiVal;
        }
      }
    });
  }

  let maxWind = 0;
  let maxGusts = 0;
  let willRain = false;
  let willSnow = false;
  let willIce = false;
  let willStorm = false;
  let willHail = false;
  let maxCape = 0;
  let minTemp = 1000;
  let maxTemp = -1000;
  let overcastCount = 0;
  let cloudyCount = 0;

  let peakWindIdx = indices[0];
  let peakWindSpeedForDir = -1;

  indices.forEach(idx => {
    const wind = data.hourly.wind_speed_10m[idx];
    const gusts = data.hourly.wind_gusts_10m[idx] ?? 0;
    const precipProb = data.hourly.precipitation_probability[idx] ?? 0;
    const code = data.hourly.weather_code[idx];
    const temp = data.hourly.temperature_2m[idx];
    const cape = data.hourly.cape?.[idx] ?? 0;

    if (wind > maxWind) maxWind = wind;
    if (gusts > maxGusts) maxGusts = gusts;
    if (temp < minTemp) minTemp = temp;
    if (code === 3) overcastCount++;
    else if (code === 2) cloudyCount++;
    if (temp > maxTemp) maxTemp = temp;
    if (cape > maxCape) maxCape = cape;

    if (wind > peakWindSpeedForDir) {
      peakWindSpeedForDir = wind;
      peakWindIdx = idx;
    }

    if ([95, 96, 99].includes(code)) willStorm = true;
    if ([96, 99].includes(code)) willHail = true;

    if (precipProb > 30) {
      if ([71, 73, 75, 77, 85, 86].includes(code)) willSnow = true;
      else if ([56, 57, 66, 67].includes(code)) willIce = true;
      else if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) willRain = true;
    }

    const freezingTemp = settings.unit === 'fahrenheit' ? 32 : 0;
    if (temp <= freezingTemp && (willRain || willSnow || precipProb > 30)) {
      willIce = true;
    }
  });

  const wLabel = windLabel();
  const tLabel = unitLabel();
  const peakWindDirDeg = data.hourly.wind_direction_10m[peakWindIdx];
  const peakWindDirStr = windDirection(peakWindDirDeg);

  let html = `<div style="display:flex; flex-direction:column; gap:16px;">`;

  // 1. Temperature range & Extreme temperatures
  const isFahrenheit = settings.unit === 'fahrenheit';
  const hotThreshold = isFahrenheit ? 95 : 35;
  const warmThreshold = isFahrenheit ? 85 : 30;
  const coldThreshold = isFahrenheit ? 32 : 0;
  const deepFreezeThreshold = isFahrenheit ? 15 : -10;

  let tempStatus = `Lows of <strong>${Math.round(minTemp)}${tLabel}</strong> and highs of <strong>${Math.round(maxTemp)}${tLabel}</strong>.`;
  let tempAlert = "";
  if (maxTemp >= hotThreshold) {
    tempAlert = `<div style="font-size:14px; line-height:1.5; color:var(--text-muted); background:var(--storm-severe-bg); border:1px solid var(--storm-severe-border); padding:10px 12px; border-radius:8px; margin-top:8px;">
      <strong style="color: var(--storm-severe);">Extreme Heat Warning:</strong> Peak of ${Math.round(maxTemp)}${tLabel}.
    </div>`;
  } else if (minTemp <= deepFreezeThreshold) {
    tempAlert = `<div style="font-size:14px; line-height:1.5; color:var(--text-muted); background:rgba(79, 195, 247, 0.05); border:1px solid rgba(79, 195, 247, 0.2); padding:10px 12px; border-radius:8px; margin-top:8px;">
      <strong style="color: var(--accent);">Severe Cold Warning:</strong> Lows around ${Math.round(minTemp)}${tLabel}.
    </div>`;
  } else if (minTemp <= coldThreshold) {
    tempAlert = `<div style="font-size:14px; line-height:1.5; color:var(--text-muted); background:rgba(255, 255, 255, 0.02); border:1px solid var(--border); padding:10px 12px; border-radius:8px; margin-top:8px;">
      <strong style="color: var(--text-muted);">Freezing Conditions:</strong> Lows dropping below freezing (${Math.round(minTemp)}${tLabel}).
    </div>`;
  }

  html += `<div>
    <h3 style="margin:0 0 6px; font-size:12px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Temperature Forecast</h3>
    <div style="font-size:15px; line-height:1.4;">${tempStatus}</div>
    ${tempAlert}
  </div>`;

  // 2. Storm & Precipitation Risk
  let precipText = "";
  let precipSeverity = "none"; // 'severe', 'warning', 'watch', 'none'

  const hasHighInstability = maxCape >= 1000;
  const hasModerateInstability = maxCape >= 500 && maxCape < 1000;
  const precipProbMax = indices.reduce((max, idx) => Math.max(max, data.hourly.precipitation_probability[idx] ?? 0), 0);

  if (willStorm || (hasHighInstability && (willRain || precipProbMax >= 30))) {
    precipSeverity = "severe";
    const hailNote = willHail ? ' Hail is possible.' : '';
    precipText = `<strong style="color: var(--storm-severe);">Thunderstorm Threat:</strong> Active storm conditions expected in the next ${hoursToLook} hours.${hailNote} Extreme atmospheric instability (CAPE: ${Math.round(maxCape)} J/kg) detected.`;
  } else if (hasModerateInstability && (willRain || precipProbMax >= 30)) {
    precipSeverity = "warning";
    precipText = `<strong style="color: var(--storm);">Storm Potential:</strong> Elevated instability (CAPE: ${Math.round(maxCape)} J/kg) coupled with moisture creates a strong chance of convective storm development.`;
  } else if (willIce) {
    precipSeverity = "severe";
    precipText = `<strong style="color: var(--storm-severe);">Freezing Rain / Ice Alert:</strong> Icy precipitation expected with high danger of black ice on roads and pathways.`;
  } else if (willSnow) {
    precipSeverity = "warning";
    precipText = `<strong style="color: var(--storm);">Snow Forecast:</strong> Snowfall is expected in this window.`;
  } else if (willRain) {
    precipSeverity = "watch";
    precipText = `<strong style="color: var(--accent);">Rain Forecast:</strong> Steady rain is expected.`;
  } else if (hasHighInstability) {
    precipSeverity = "warning";
    precipText = `<strong style="color: var(--storm);">High Instability:</strong> The atmosphere is highly unstable (CAPE: ${Math.round(maxCape)} J/kg). While dry now, any storm cells that form are expected to escalate rapidly.`;
  } else {
    precipText = `No significant rain, snow, or storm activity is expected.`;
  }

  let precipBg = "transparent";
  let precipBorder = "none";
  let precipPadding = "0";
  let precipRadius = "0";

  if (precipSeverity === "severe") {
    precipBg = "var(--storm-severe-bg)";
    precipBorder = "1px solid var(--storm-severe-border)";
    precipPadding = "10px 12px";
    precipRadius = "8px";
  } else if (precipSeverity === "warning") {
    precipBg = "var(--storm-bg)";
    precipBorder = "1px solid var(--storm-border)";
    precipPadding = "10px 12px";
    precipRadius = "8px";
  } else if (precipSeverity === "watch") {
    precipBg = "rgba(79, 195, 247, 0.05)";
    precipBorder = "1px solid rgba(79, 195, 247, 0.2)";
    precipPadding = "10px 12px";
    precipRadius = "8px";
  }

  html += `<div>
    <h3 style="margin:0 0 6px; font-size:12px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Weather Hazards</h3>
    <div style="font-size:14px; line-height:1.5; color:var(--text-muted); background:${precipBg}; border:${precipBorder}; padding:${precipPadding}; border-radius:${precipRadius};">${precipText}</div>
  </div>`;

  // 2b. Active Weather Alerts (NWS)
  if (latestAlerts && latestAlerts.length > 0) {
    const alertsList = latestAlerts.map(alert => {
      let color = "var(--storm)";
      let border = "var(--storm-border)";
      let bg = "var(--storm-bg)";
      if (alert.severity === "Extreme" || alert.severity === "Severe") {
        color = "var(--storm-severe)";
        border = "var(--storm-severe-border)";
        bg = "var(--storm-severe-bg)";
      }
      return `<div style="font-size:14px; line-height:1.5; color:var(--text-muted); background:${bg}; border:1px solid ${border}; padding:10px 12px; border-radius:8px; margin-bottom:8px;">
        <strong style="color: ${color};">${alert.event}:</strong> ${alert.headline || alert.description?.slice(0, 120) || ''}
      </div>`;
    }).join('');

    html += `<div>
      <h3 style="margin:0 0 6px; font-size:12px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Active Alerts</h3>
      ${alertsList}
    </div>`;
  }

  // 2c. Air Quality Outlook
  let aqiSection = "";
  if (maxAqiInWindow > 0) {
    let aqiSeverityClass = "none";
    let aqiText = `Air quality is expected to be good (peak AQI ${maxAqiInWindow}).`;

    if (maxAqiInWindow > 300) {
      aqiSeverityClass = "severe";
      aqiText = `<strong style="color: #7e0023;">Hazardous Air Quality:</strong> Peak AQI of ${maxAqiInWindow} is expected. Everyone should avoid all outdoor physical activity.`;
    } else if (maxAqiInWindow > 200) {
      aqiSeverityClass = "severe";
      aqiText = `<strong style="color: #8f3f97;">Very Unhealthy Air Quality:</strong> Peak AQI of ${maxAqiInWindow} is expected. Active children and adults, and people with respiratory disease, should avoid all outdoor exertion.`;
    } else if (maxAqiInWindow > 150) {
      aqiSeverityClass = "severe";
      aqiText = `<strong style="color: var(--storm-severe);">Unhealthy Air Quality:</strong> Peak AQI of ${maxAqiInWindow} is expected. Outdoor activity should be limited.`;
    } else if (maxAqiInWindow > 100) {
      aqiSeverityClass = "warning";
      aqiText = `<strong style="color: var(--storm);">Unhealthy for Sensitive Groups:</strong> Peak AQI of ${maxAqiInWindow} is expected. Sensitive individuals should reduce outdoor exertion.`;
    } else if (maxAqiInWindow > 50) {
      aqiSeverityClass = "watch";
      aqiText = `Air quality is expected to be moderate (peak AQI ${maxAqiInWindow}).`;
    }

    let aqiBg = "transparent";
    let aqiBorder = "none";
    let aqiPadding = "0";
    let aqiRadius = "0";

    if (aqiSeverityClass === "severe") {
      aqiBg = "var(--storm-severe-bg)";
      aqiBorder = "1px solid var(--storm-severe-border)";
      aqiPadding = "10px 12px";
      aqiRadius = "8px";
    } else if (aqiSeverityClass === "warning") {
      aqiBg = "var(--storm-bg)";
      aqiBorder = "1px solid var(--storm-border)";
      aqiPadding = "10px 12px";
      aqiRadius = "8px";
    } else if (aqiSeverityClass === "watch") {
      aqiBg = "rgba(79, 195, 247, 0.05)";
      aqiBorder = "1px solid rgba(79, 195, 247, 0.2)";
      aqiPadding = "10px 12px";
      aqiRadius = "8px";
    }

    aqiSection = `<div>
      <h3 style="margin:0 0 6px; font-size:12px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Air Quality Outlook</h3>
      <div style="font-size:14px; line-height:1.5; color:var(--text-muted); background:${aqiBg}; border:${aqiBorder}; padding:${aqiPadding}; border-radius:${aqiRadius};">${aqiText}</div>
    </div>`;
  }

  if (aqiSection) {
    html += aqiSection;
  }

  // 3. Wind & Activity Recommendation
  let windText = "";
  let windThreshold = settings.windUnit === 'kmh' ? 24 : (settings.windUnit === 'ms' ? 6 : 15);
  let gustThreshold = settings.windUnit === 'kmh' ? 32 : (settings.windUnit === 'ms' ? 9 : 20);
  let calmCeiling = settings.windUnit === 'kmh' ? 11 : (settings.windUnit === 'ms' ? 3 : 7);

  if (maxGusts > gustThreshold) {
    windText = `Wind gusts up to <strong>${Math.round(maxGusts)} ${wLabel}</strong> from the <strong>${peakWindDirStr}</strong>.`;
  } else if (maxWind > windThreshold) {
    windText = `Sustained winds up to <strong>${Math.round(maxWind)} ${wLabel}</strong> from the <strong>${peakWindDirStr}</strong>.`;
  } else if (maxGusts > calmCeiling) {
    windText = `Light winds with gusts to <strong>${Math.round(maxGusts)} ${wLabel}</strong> (${peakWindDirStr}).`;
  } else {
    windText = `Calm winds at <strong>${Math.round(maxWind)} ${wLabel}</strong> (${peakWindDirStr}).`;
  }

  // Final overall score/recommendation for outdoor sports/biking
  let rating = "Great";
  // Derive sky description from actual codes
  let skyDesc;
  if (overcastCount >= hoursToLook * 0.5) skyDesc = 'overcast skies';
  else if ((overcastCount + cloudyCount) >= hoursToLook * 0.5) skyDesc = 'partly cloudy skies';
  else skyDesc = 'clear skies';
  // Derive wind description from actual speeds
  let windDesc;
  if (maxGusts > gustThreshold) windDesc = 'gusty winds';
  else if (maxWind > windThreshold) windDesc = 'breezy conditions';
  else if (maxGusts > calmCeiling) windDesc = 'light winds';
  else windDesc = 'calm winds';
  let reason = `${windDesc.charAt(0).toUpperCase() + windDesc.slice(1)}, pleasant temperatures, and ${skyDesc}.`;
  let ratingColor = "#66bb6a"; // Green

  const reasons = [];

  if (precipSeverity === "severe") {
    if (willStorm) reasons.push("active thunderstorms");
    else if (willIce) reasons.push("freezing ice conditions");
    else reasons.push("severe weather hazards");
  } else if (precipSeverity === "warning") {
    if (willSnow) reasons.push("snowfall");
    else if (hasModerateInstability || hasHighInstability) reasons.push("convective storm potential");
    else reasons.push("unfavorable precipitation");
  } else if (precipSeverity === "watch") {
    if (willRain) reasons.push("rain showers");
    else if (hasHighInstability) reasons.push("atmospheric instability");
  }

  if (maxTemp >= hotThreshold) {
    reasons.push("dangerous extreme heat");
  } else if (maxTemp >= warmThreshold) {
    reasons.push("warm temperatures");
  }

  if (minTemp <= deepFreezeThreshold) {
    reasons.push("dangerous severe cold");
  } else if (minTemp <= coldThreshold) {
    reasons.push("freezing temperatures");
  }

  if (maxGusts > gustThreshold) {
    reasons.push("gusty winds");
  } else if (maxWind > windThreshold) {
    reasons.push("breezy winds");
  }

  if (maxAqiInWindow >= 200) {
    reasons.push(`very unhealthy air quality (AQI ${maxAqiInWindow})`);
  } else if (maxAqiInWindow >= 150) {
    reasons.push(`unhealthy air quality (AQI ${maxAqiInWindow})`);
  } else if (maxAqiInWindow >= 100) {
    reasons.push(`poor air quality (AQI ${maxAqiInWindow})`);
  }

  let alertDangerous = false;
  let alertPoor = false;
  let alertFair = false;

  if (latestAlerts && latestAlerts.length > 0) {
    latestAlerts.forEach(alert => {
      const eventLower = alert.event.toLowerCase();
      const severity = alert.severity;

      if (severity === "Extreme" || severity === "Severe") {
        alertDangerous = true;
        reasons.push(`active ${alert.event}`);
      } else if (severity === "Moderate" || eventLower.includes("air quality")) {
        alertPoor = true;
        reasons.push(`active ${alert.event}`);
      } else {
        alertFair = true;
        reasons.push(`active ${alert.event}`);
      }
    });
  }

  const isDangerous = precipSeverity === "severe" || maxTemp >= hotThreshold || minTemp <= deepFreezeThreshold || alertDangerous || maxAqiInWindow >= 200;
  const isPoor = precipSeverity === "warning" || maxGusts > gustThreshold || alertPoor || maxAqiInWindow >= 100;
  const isFair = precipSeverity === "watch" || maxWind > windThreshold || maxTemp >= warmThreshold || minTemp <= coldThreshold || alertFair || maxAqiInWindow > 50;

  if (isDangerous) {
    rating = "Dangerous";
    ratingColor = "var(--storm-severe)";
    reason = `Dangerous conditions due to ${reasons.join(' and ')}.`;
  } else if (isPoor) {
    rating = "Poor";
    ratingColor = "var(--storm)";
    reason = `Unfavorable weather due to ${reasons.join(' and ')}.`;
  } else if (isFair) {
    rating = "Fair";
    ratingColor = "var(--accent)";
    reason = `Moderate conditions due to ${reasons.join(' and ')}.`;
  }

  html += `<div>
    <h3 style="margin:0 0 6px; font-size:12px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Activity Rating</h3>
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
      <span style="background:${ratingColor}; color:#0f0f23; font-size:11px; font-weight:700; text-transform:uppercase; padding:3px 8px; border-radius:4px; letter-spacing:0.5px;">${rating}</span>
      <span style="font-size:13px; color:var(--text-muted);">${windText}</span>
    </div>
    <div style="font-size:14px; line-height:1.4; color:var(--text);">${reason}</div>
  </div>`;

  html += `</div>`;
  return html;
}

if (weatherSummaryBtn) {
  weatherSummaryBtn.addEventListener('click', () => {
    if (!latestWeatherData) return;
    summaryText.innerHTML = generateActivityOutlook(latestWeatherData);
    summaryModal.classList.remove('hidden');
  });
}

if (closeSummaryBtn) {
  closeSummaryBtn.addEventListener('click', () => {
    summaryModal.classList.add('hidden');
  });
}

if (summaryModal) {
  summaryModal.addEventListener('click', (e) => {
    if (e.target === summaryModal) {
      summaryModal.classList.add('hidden');
    }
  });
}
