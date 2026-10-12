/**
 * GeoLens – Application Bootstrapper
 * Coordinates initialization of data, map engine, charts engine,
 * UI controller, and live API connectivity with graceful fallbacks.
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🌍 Initializing GeoLens Environmental Intelligence Platform…');

  // 1. Initialize Map Canvas
  const map = window.GeoLensMap.init('map');

  // 2. Initialize Charts for initial location (Ganges Plain / default location)
  const defaultLocIndex = window.GeoLensMap.currentLocIndex;
  window.GeoLensCharts.initCharts(defaultLocIndex);
  window.GeoLensCharts.populateDataTable(defaultLocIndex);

  // 3. Initialize UI controllers, navigation, and exports
  window.GeoLensUI.init();

  // 4. Initial Provenance Tag
  window.GeoLensUI.updateDataProvenanceTag('satellite');
  window.GeoLensUI.updateSeasonalGuardrailDisplay(26.8, 80.9);

  // 5. Test Live Open-Meteo Integration with Graceful Fallback
  await checkLiveWeatherIntegration();

  // 6. Refresh Lucide Icons across all rendered markup
  if (window.lucide) {
    window.lucide.createIcons();
  }

  window.GeoLensUI.showToast('GeoLens Platform ready. All spatial layers active.', 'success');
});

/**
 * Checks connectivity to Open-Meteo API.
 * Demonstrates live API integration and ensures graceful fallback banner if offline.
 */
async function checkLiveWeatherIntegration() {
  const statusEl = document.getElementById('anomalyText');
  const loc = GeoLensData.LOCATIONS[window.GeoLensMap?.currentLocIndex ?? 0];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat.toFixed(4)}&longitude=${loc.lng.toFixed(4)}&current_weather=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Connected to Open-Meteo Live API:', data);
      displayApiStatusBanner('LIVE', `Live Open-Meteo API Connected | Lat: ${loc.lat.toFixed(2)}°, Lon: ${loc.lng.toFixed(2)}° | Temp: ${data.current_weather.temperature}°C`);
      return;
    }
  } catch (err) {
    console.warn('⚠️ Open-Meteo live request timed out or blocked by sandbox/offline. Activating high-fidelity fallback cache.');
  }

  // Fallback status
  displayApiStatusBanner('FALLBACK', 'Using Cached Historical Sample Data (Sentinel Hub & Open-Meteo Fallback Mode)');
}

function displayApiStatusBanner(mode, text) {
  let banner = document.getElementById('apiStatusBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'apiStatusBanner';
    banner.className = 'api-status-banner';
    const topnav = document.querySelector('.topnav');
    if (topnav && topnav.nextSibling) {
      topnav.parentNode.insertBefore(banner, topnav.nextSibling);
    }
  }

  if (mode === 'LIVE') {
    banner.className = 'api-status-banner live';
    banner.innerHTML = `<span class="status-indicator live"></span> <strong>Live API Pipeline:</strong> ${text}`;
  } else {
    banner.className = 'api-status-banner fallback';
    banner.innerHTML = `<span class="status-indicator fallback"></span> <strong>Reliability Mode:</strong> ${text}`;
  }
}
