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
let latestWeatherData = null;

// ── Settings (localStorage) ──
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
        fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name, { silent: true });
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
          fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name, { silent: true });
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
      searchInput.value = '';
      searchInput.blur();
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
async function fetchWeather(lat, lon, name, { silent = false } = {}) {
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
  lastFetchTime = Date.now();
  localStorage.setItem('weather_last_location', JSON.stringify(currentLocation));

  const tempUnit = settings.unit;
  const windUnit = settings.windUnit;
  const precipUnit = settings.precipUnit;

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,dew_point_2m,uv_index,pressure_msl,wind_gusts_10m',
      hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability,pressure_msl,wind_gusts_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max',
      temperature_unit: tempUnit,
      wind_speed_unit: windUnit,
      precipitation_unit: precipUnit,
      forecast_days: 10,
      timezone: 'auto',
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();
    latestWeatherData = data;

    renderCurrent(data, name);
    renderHourly(data);
    renderDaily(data);
    lastFetchTime = Date.now();
  } catch {
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
  const windSpeed = Math.round(c.wind_speed_10m);
  $('windSpeed').textContent = `${windSpeed} ${windLabel()}`;

  const gusts = c.wind_gusts_10m;
  const gustsSpan = $('windGusts');
  if (gusts != null && gusts - windSpeed >= 6) {
    gustsSpan.textContent = `Gusts: ${Math.round(gusts)} ${windLabel()}`;
    gustsSpan.style.display = 'block';
  } else {
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

  currentEl.classList.remove('hidden');
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
    const [icon] = weatherInfo(data.daily.weather_code[i]);
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
    const [icon] = weatherInfo(data.hourly.weather_code[idx]);
    const temp = Math.round(data.hourly.temperature_2m[idx]);
    const wind = Math.round(data.hourly.wind_speed_10m[idx]);
    const wdir = windDirection(data.hourly.wind_direction_10m[idx]);
    const precip = data.hourly.precipitation_probability[idx] ?? 0;

    const div = document.createElement('div');
    div.className = 'hourly-item';
    div.innerHTML = `
      <div class="hour">${dt.toLocaleTimeString('en-US', { hour: 'numeric' })}</div>
      <div class="h-icon">${icon}</div>
      <div class="h-temp">${temp}°</div>
      <div class="h-precip${precip < 10 ? ' low-precip' : ''}"><span class="material-icons">water_drop</span> ${precip}%</div>
      <div class="h-wind"><span class="material-icons">air</span> ${wind} ${wdir}</div>
    `;
    scroll.appendChild(div);
  }

  container.appendChild(scroll);
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
// Only refresh if data is more than 5 minutes old
const STALE_MS = 5 * 60 * 1000;

function refreshWeatherIfNeeded() {
  if (currentLocation && Date.now() - lastFetchTime > STALE_MS) {
    fetchWeather(currentLocation.lat, currentLocation.lon, currentLocation.name, { silent: true });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshWeatherIfNeeded();
  }
});

window.addEventListener('focus', refreshWeatherIfNeeded);

// ── Load last viewed or first saved location on startup ──
(function init() {
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

// ── Activity Summary ──
function generateActivitySummary(data) {
  const now = new Date();
  const times = data.hourly.time;
  let startIdx = times.findIndex((t) => new Date(t) >= now);
  if (startIdx < 0) startIdx = 0;

  const hoursToLook = 10;
  const indices = [];
  for (let i = 0; i < hoursToLook && (startIdx + i) < times.length; i++) {
    indices.push(startIdx + i);
  }

  let maxWind = 0;
  let maxGusts = 0;
  let willRain = false;
  let willSnow = false;
  let willIce = false;
  let minTemp = 1000;
  let maxTemp = -1000;

  indices.forEach(idx => {
    const wind = data.hourly.wind_speed_10m[idx];
    const gusts = data.hourly.wind_gusts_10m[idx] ?? 0;
    const precipProb = data.hourly.precipitation_probability[idx] ?? 0;
    const code = data.hourly.weather_code[idx];
    const temp = data.hourly.temperature_2m[idx];

    if (wind > maxWind) maxWind = wind;
    if (gusts > maxGusts) maxGusts = gusts;
    if (temp < minTemp) minTemp = temp;
    if (temp > maxTemp) maxTemp = temp;

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
  let summary = `Over the next ${hoursToLook} hours, temperatures will range from ${Math.round(minTemp)}${tLabel} to ${Math.round(maxTemp)}${tLabel}. `;

  if (willIce) {
    summary += "Freezing conditions with precipitation are expected, creating a high risk of ice. Watch out for slick or icy surfaces! ";
  } else if (willSnow) {
    summary += "Expect snow! Biking is likely not recommended unless you have specialized gear. ";
  } else if (willRain) {
    summary += "There is a solid chance of rain. If you're biking, be sure to pack rain gear. ";
  } else {
    summary += "No significant precipitation is expected. ";
  }

  // Activity thresholds based on common wind factors
  // Using generic units for simplicity, but thresholds technically vary by mph vs kmh.
  // We'll normalize to mph roughly for comparison if needed, but simple numerical thresholds work fine enough for a basic summary.
  let windThreshold = settings.windUnit === 'kmh' ? 24 : (settings.windUnit === 'ms' ? 6 : 15);
  let gustThreshold = settings.windUnit === 'kmh' ? 32 : (settings.windUnit === 'ms' ? 9 : 20);

  if (maxGusts > gustThreshold) {
    summary += `Winds will be quite gusty, peaking around ${Math.round(maxGusts)} ${wLabel}. This could make biking or other activities difficult. `;
  } else if (maxWind > windThreshold) {
    summary += `It will be breezy with sustained winds up to ${Math.round(maxWind)} ${wLabel}. `;
  } else {
    summary += `Winds should remain relatively calm, peaking at just ${Math.round(maxGusts)} ${wLabel} gusts, making it a great time for outdoor activities!`;
  }

  return summary;
}

if (weatherSummaryBtn) {
  weatherSummaryBtn.addEventListener('click', () => {
    if (!latestWeatherData) return;
    summaryText.innerHTML = generateActivitySummary(latestWeatherData);
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
