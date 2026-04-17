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

function windDirection(degrees) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(degrees / 22.5) % 16];
}

// ── DOM refs ──
const $ = (id) => document.getElementById(id);
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const geoBtn = $('geoBtn');
const settingsBtn = $('settingsBtn');
const settingsPanel = $('settingsPanel');
const closeSettings = $('closeSettings');
const suggestionsEl = $('suggestions');
const loadingEl = $('loading');
const errorEl = $('error');
const currentEl = $('current');
const hourlyEl = $('hourly');
const dailyEl = $('daily');
const saveLocationBtn = $('saveLocationBtn');
const locationsList = $('locationsList');

// ── Settings (localStorage) ──
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('weather_settings')) || { unit: 'fahrenheit' };
  } catch { return { unit: 'fahrenheit' }; }
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
        fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name);
      }
    });
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

// ── Geocoding search ──
let debounceTimer;

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    suggestionsEl.classList.add('hidden');
    return;
  }
  debounceTimer = setTimeout(() => searchLocations(q), 300);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    suggestionsEl.classList.add('hidden');
    const q = searchInput.value.trim();
    if (q.length >= 2) searchLocations(q, true);
  }
});

searchBtn.addEventListener('click', () => {
  suggestionsEl.classList.add('hidden');
  const q = searchInput.value.trim();
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
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      if (autoSelect) showError('No locations found.');
      suggestionsEl.classList.add('hidden');
      return;
    }
    if (autoSelect) {
      const loc = data.results[0];
      suggestionsEl.classList.add('hidden');
      searchInput.value = formatLocation(loc);
      fetchWeather(loc.latitude, loc.longitude, formatLocation(loc));
      return;
    }
    renderSuggestions(data.results);
  } catch {
    showError('Failed to search locations.');
  }
}

function formatLocation(loc) {
  const parts = [loc.name];
  if (loc.admin1) parts.push(loc.admin1);
  if (loc.country) parts.push(loc.country);
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
      searchInput.value = formatLocation(loc);
      fetchWeather(loc.latitude, loc.longitude, formatLocation(loc));
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
async function fetchWeather(lat, lon, name) {
  showLoading(true);
  hideError();
  hideWeather();
  currentLocation = { lat, lon, name };
  localStorage.setItem('weather_last_location', JSON.stringify(currentLocation));

  const tempUnit = settings.unit;
  const windUnit = tempUnit === 'fahrenheit' ? 'mph' : 'kmh';

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,dew_point_2m,uv_index',
      hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max',
      temperature_unit: tempUnit,
      wind_speed_unit: windUnit,
      forecast_days: 10,
      timezone: 'auto',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();

    renderCurrent(data, name);
    renderHourly(data);
    renderDaily(data);
    lastFetchTime = Date.now();
  } catch {
    showError('Failed to fetch weather data. Please try again.');
  } finally {
    showLoading(false);
  }
}

// ── Rendering ──
function unitLabel() { return settings.unit === 'fahrenheit' ? '°F' : '°C'; }
function windLabel() { return settings.unit === 'fahrenheit' ? 'mph' : 'km/h'; }

function renderCurrent(data, name) {
  const c = data.current;
  const [icon, desc] = weatherInfo(c.weather_code);

  $('cityName').textContent = name;
  const now = new Date();
  $('currentDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }) + '  ·  ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  $('weatherIcon').textContent = icon;
  $('currentTemp').textContent = `${Math.round(c.temperature_2m)}${unitLabel()}`;
  $('weatherDesc').textContent = desc;
  $('dewPoint').textContent = `${Math.round(c.dew_point_2m)}${unitLabel()}`;
  $('humidity').textContent = `${c.relative_humidity_2m}%`;
  $('windSpeed').textContent = `${Math.round(c.wind_speed_10m)} ${windLabel()}`;
  $('windDir').textContent = `${windDirection(c.wind_direction_10m)} (${c.wind_direction_10m}°)`;
  $('feelsLike').textContent = `${Math.round(c.apparent_temperature)}${unitLabel()}`;
  $('uvIndex').textContent = c.uv_index != null ? Math.round(c.uv_index) : '—';

  currentEl.classList.remove('hidden');
}

function renderHourly(data) {
  const list = $('hourlyList');
  list.innerHTML = '';

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
    const [icon] = weatherInfo(data.hourly.weather_code[idx]);
    const temp = Math.round(data.hourly.temperature_2m[idx]);

    const div = document.createElement('div');
    div.className = 'hourly-item';
    const wind = Math.round(data.hourly.wind_speed_10m[idx]);
    const wdir = windDirection(data.hourly.wind_direction_10m[idx]);
    const precip = data.hourly.precipitation_probability[idx] ?? 0;

    div.innerHTML = `
      <div class="hour">${i === 0 ? 'Now' : dt.toLocaleTimeString('en-US', { hour: 'numeric' })}</div>
      <div class="h-icon">${icon}</div>
      <div class="h-temp">${temp}°</div>
      <div class="h-precip${precip < 10 ? ' low-precip' : ''}"><span class="material-icons">water_drop</span> ${precip}%</div>
      <div class="h-wind"><span class="material-icons">air</span> ${wind} ${wdir}</div>
    `;
    list.appendChild(div);
  }

  hourlyEl.classList.remove('hidden');
}

function renderDaily(data) {
  const list = $('dailyList');
  list.innerHTML = '';

  const days = data.daily.time;
  for (let i = 0; i < days.length; i++) {
    const dt = new Date(days[i] + 'T00:00:00');
    const [icon] = weatherInfo(data.daily.weather_code[i]);
    const high = Math.round(data.daily.temperature_2m_max[i]);
    const low = Math.round(data.daily.temperature_2m_min[i]);
    const dWind = Math.round(data.daily.wind_speed_10m_max[i]);
    const dDir = windDirection(data.daily.wind_direction_10m_dominant[i]);
    const dPrecip = data.daily.precipitation_probability_max[i] ?? 0;

    const dayName = i === 0
      ? 'Today'
      : dt.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const div = document.createElement('div');
    div.className = 'daily-row';
    div.innerHTML = `
      <div class="daily-day">${dayName}<div class="daily-date">${dateStr}</div></div>
      <div class="daily-icon">${icon}</div>
      <div class="daily-temps"><span class="daily-high">${high}°</span><span class="daily-low">${low}°</span></div>
      <div class="daily-precip${dPrecip < 10 ? ' low-precip' : ''}"><span class="material-icons">water_drop</span> ${dPrecip}%</div>
      <div class="daily-wind"><span class="material-icons">air</span> ${dWind} ${windLabel()} ${dDir}</div>
    `;
    list.appendChild(div);
  }

  dailyEl.classList.remove('hidden');
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

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ── Refresh on focus (if data is stale) ──
let lastFetchTime = 0;
const STALE_MS = 10 * 60 * 1000; // 10 minutes

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentLocation && Date.now() - lastFetchTime > STALE_MS) {
    fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name);
  }
});

// ── Load last viewed or first saved location on startup ──
(function init() {
  const last = localStorage.getItem('weather_last_location');
  if (last) {
    try {
      const loc = JSON.parse(last);
      fetchWeather(loc.lat, loc.lon, loc.name);
      return;
    } catch { /* fall through */ }
  }
  if (savedLocations.length > 0) {
    const loc = savedLocations[0];
    fetchWeather(loc.lat, loc.lon, loc.name);
  }
})();
