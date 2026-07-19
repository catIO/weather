async function run() {
  const lat = 40.846937860470476;
  const lon = -73.96729433028028;
  
  // 1. Fetch NWS alerts
  const nwsUrl = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
  console.log(`Fetching NWS alerts from: ${nwsUrl}`);
  try {
    const res = await fetch(nwsUrl, { headers: { 'User-Agent': 'WeatherApp-Debug-Agent' } });
    const json = await res.json();
    console.log('\n--- NWS Alerts ---');
    if (json.features) {
      json.features.forEach(f => {
        console.log(`Event: ${f.properties.event}`);
        console.log(`Headline: ${f.properties.headline}`);
        console.log(`Severity: ${f.properties.severity}`);
        console.log(`Status: ${f.properties.status}`);
        console.log(`Ends/Expires: ${f.properties.ends || f.properties.expires}`);
        console.log(`Description Snippet: ${f.properties.description?.slice(0, 150)}...\n`);
      });
    } else {
      console.log('No features key found');
    }
  } catch (e) {
    console.error('NWS Fetch error:', e);
  }

  // 2. Fetch Open-Meteo weather
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,dew_point_2m,uv_index,pressure_msl,wind_gusts_10m,precipitation',
    hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability,pressure_msl,wind_gusts_10m,cape',
    minutely_15: 'lightning_potential,cape,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max',
    timezone: 'auto',
  });
  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?${params}`;
  console.log(`Fetching Open-Meteo from: ${openMeteoUrl}`);
  try {
    const res = await fetch(openMeteoUrl);
    const data = await res.json();
    console.log('\n--- Open-Meteo Current Weather ---');
    console.log('Current Data:', data.current);
    
    // Check if there is lightning or cape or rain codes in minutely_15
    const now = new Date();
    const m15Times = data.minutely_15?.time ?? [];
    const codeM15 = data.minutely_15?.weather_code ?? [];
    const lpiArr = data.minutely_15?.lightning_potential ?? [];
    const capeM15 = data.minutely_15?.cape ?? [];

    let m15Idx = m15Times.findIndex((t) => new Date(t) >= now);
    if (m15Idx < 0) m15Idx = Math.max(0, m15Times.length - 1);
    const m15Window = [m15Idx - 1, m15Idx, m15Idx + 1].filter(
      (i) => i >= 0 && i < m15Times.length
    );

    console.log('\n--- Open-Meteo Minutely_15 Window Data ---');
    m15Window.forEach(i => {
      console.log(`Time: ${m15Times[i]} | Code: ${codeM15[i]} | LPI: ${lpiArr[i]} | CAPE: ${capeM15[i]}`);
    });
  } catch (e) {
    console.error('OpenMeteo Fetch error:', e);
  }
}

run();
