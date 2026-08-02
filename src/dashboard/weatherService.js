// Real current-weather lookup via Open-Meteo (open-meteo.com) — free, no
// API key required, CORS-enabled for direct browser use. Location comes
// from the browser's own Geolocation API (a real permission prompt, same
// pattern as the microphone). No key to configure, no fake placeholder
// data: this either genuinely works or honestly says why it can't.
const CACHE_KEY = 'charlie_weather_cache_v1';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes — plenty fresh for a dashboard widget

const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mostly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy drizzle', icon: '🌧️' },
  56: { label: 'Freezing drizzle', icon: '🌧️' },
  57: { label: 'Freezing drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌦️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Freezing rain', icon: '🌧️' },
  67: { label: 'Freezing rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  77: { label: 'Snow grains', icon: '🌨️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Rain showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  85: { label: 'Snow showers', icon: '🌨️' },
  86: { label: 'Snow showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm with hail', icon: '⛈️' },
  99: { label: 'Thunderstorm with hail', icon: '⛈️' },
};

function describeWeatherCode(code) {
  return WEATHER_CODES[code] || { label: 'Unknown conditions', icon: '🌡️' };
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10_000,
      maximumAge: CACHE_DURATION_MS,
    });
  });
}

// sessionStorage, not localStorage — this is a short-lived cache, not app
// data worth backing up/exporting alongside the rest of Charlie's memory.
function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.at > CACHE_DURATION_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Some contexts (private browsing) can throw on sessionStorage writes —
    // losing the cache just means the next call re-fetches, nothing breaks.
  }
}

// Resolves to { temperature, label, icon } in Celsius, or throws if
// geolocation is denied/unavailable or the request fails — callers show an
// honest message rather than fabricated data either way.
export async function getCurrentWeather() {
  const cached = readCache();
  if (cached) return cached;

  const position = await getPosition();
  const { latitude, longitude } = position.coords;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather service unavailable right now.');

  const json = await res.json();
  const temperature = json?.current?.temperature_2m;
  const code = json?.current?.weather_code;
  if (typeof temperature !== 'number') throw new Error('Weather service returned no data.');

  const { label, icon } = describeWeatherCode(code);
  const result = { temperature, label, icon };
  writeCache(result);
  return result;
}
