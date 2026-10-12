/**
 * GeoLens – Map Engine
 * Handles Leaflet map initialization, base layers, overlays,
 * anomaly markers, draw tools, and split-compare maps.
 */

window.GeoLensMap = (() => {
  let map = null;
  let currentLayer = 'satellite';
  let currentLocIndex = 5; // Default: Ganges Plain
  let drawLayer = null;
  let ndviLayer = null;
  let soilLayer = null;
  let landUseLayer = null;
  let floodLayer = null;
  let riskLayer = null;
  let anomalyLayer = null;
  let drawControl = null;
  let drawnItems = null;
  let isPlaying = false;
  let playInterval = null;
  let compareMaps = { before: null, after: null };
  let activeMarker = null;
  let activeLocation = {
    lat: 26.8,
    lng: 80.9,
    name: 'Greater Ganges Plain, India',
    bounds: null
  };

  // ─── Tile URL providers ──────────────────────────────────────────
  const TILES = {
    satellite: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '©OpenStreetMap ©CARTO',
      options: { maxZoom: 18 }
    },
    ndvi: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      attribution: '©OpenStreetMap ©CARTO | NDVI: Simulated',
      options: { maxZoom: 18, opacity: 0.6 }
    },
    soilMoisture: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      attribution: '©OpenStreetMap ©CARTO | Soil: Simulated',
      options: { maxZoom: 18, opacity: 0.55 }
    },
    precipitation: {
      url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=demo',
      attribution: 'OpenWeatherMap',
      options: { maxZoom: 18, opacity: 0.7 }
    },
    thermal: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      attribution: '©OpenStreetMap ©CARTO | Thermal: Simulated',
      options: { maxZoom: 18, opacity: 0.6 }
    },
  };

  // ─── Legend definitions per layer ───────────────────────────────
  const LEGENDS = {
    satellite: {
      title: 'Optical Satellite',
      items: [
        { color: '#0d1117', label: 'No data' },
        { color: '#1a3a2a', label: 'Dense vegetation' },
        { color: '#4A9EFF', label: 'Water bodies' },
        { color: '#607d8b', label: 'Urban surfaces' },
      ]
    },
    ndvi: {
      title: 'NDVI (Vegetation)',
      items: [
        { color: '#1b5e20', label: '>0.70 – Dense' },
        { color: '#558b2f', label: '0.40–0.70 – Moderate' },
        { color: '#8d6e63', label: '0.10–0.40 – Sparse' },
        { color: '#bcaaa4', label: '<0.10 – Bare soil' },
      ]
    },
    soilMoisture: {
      title: 'Soil Moisture',
      items: [
        { color: '#1565C0', label: '>0.75 – Very wet' },
        { color: '#1E88E5', label: '0.40–0.75 – Moist' },
        { color: '#8d6e63', label: '0.25–0.40 – Dry' },
        { color: '#d7ccc8', label: '<0.25 – Very dry' },
      ]
    },
    precipitation: {
      title: 'Precipitation (mm)',
      items: [
        { color: '#1565C0', label: '>200 – Heavy' },
        { color: '#42A5F5', label: '100–200 – Moderate' },
        { color: '#B3E5FC', label: '25–100 – Light' },
        { color: '#E3F2FD', label: '<25 – Minimal' },
      ]
    },
    thermal: {
      title: 'Surface Temp (°C)',
      items: [
        { color: '#B71C1C', label: '>40°C – Extreme' },
        { color: '#EF5350', label: '30–40°C – Hot' },
        { color: '#FF8F00', label: '20–30°C – Warm' },
        { color: '#FFF176', label: '<20°C – Cool' },
      ]
    }
  };

  // ─── Initialize map ──────────────────────────────────────────────
  function init(containerId) {
    const loc = GeoLensData.LOCATIONS[currentLocIndex];

    map = L.map(containerId, {
      center: [loc.lat, loc.lng],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addTo(map);

    // Base tile layer
    L.tileLayer(TILES.satellite.url, {
      ...TILES.satellite.options,
      attribution: TILES.satellite.attribution,
      subdomains: 'abcd',
    }).addTo(map);

    // Initialize drawn items group
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Add draw control
    drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        marker: false,
        circle: false,
        circlemarker: false,
        polyline: false,
        polygon: { shapeOptions: { color: '#4A9EFF', fillOpacity: 0.15, weight: 2 } },
        rectangle: { shapeOptions: { color: '#4A9EFF', fillOpacity: 0.15, weight: 2 } },
      }
    });

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.addLayer(e.layer);
      updateVulnerabilityScore();

      let coords = [];
      if (e.layer.getLatLngs) {
        const raw = e.layer.getLatLngs();
        const pts = Array.isArray(raw[0]) ? raw[0] : raw;
        coords = pts.map(p => [p.lng, p.lat]);
      }
      const area_km2 = calculateAreaFromCoordinates(coords);

      window.dispatchEvent(new CustomEvent('geolens:roi-drawn', {
        detail: { area_km2, bounds: e.layer.getBounds(), coordinates: coords }
      }));

      window.GeoLensUI?.showToast(`ROI Delineated: ${area_km2.toLocaleString()} km² | Vulnerability updated`, 'success');
    });

    // Click handler for map popup
    map.on('click', (e) => {
      showLocationPopup(e.latlng);
    });

    updateLegend(currentLayer);
    renderLayerOverlays(currentLocIndex, 2026);
    renderAnomalies(currentLocIndex);
    updateLegend('satellite');
    setActiveLocation(loc.lat, loc.lng, loc.name);

    return map;
  }

  // ─── Switch base layer ───────────────────────────────────────────
  function switchLayer(layerKey) {
    currentLayer = layerKey;

    // Remove existing overlays
    clearOverlays();

    // Update base map appearance
    const tileConf = TILES[layerKey] || TILES.satellite;
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    L.tileLayer(tileConf.url, {
      ...tileConf.options,
      subdomains: 'abcd',
      attribution: tileConf.attribution,
    }).addTo(map);

    // Re-add data layers
    renderLayerOverlays(currentLocIndex, getCurrentYear());
    updateLegend(layerKey);
  }

  // ─── Render environmental data overlays ──────────────────────────
  function renderLayerOverlays(locIndex, year) {
    const loc = GeoLensData.LOCATIONS[locIndex];
    clearDataLayers();

    if (currentLayer === 'ndvi') {
      renderNDVILayer(loc, year);
    } else if (currentLayer === 'soilMoisture') {
      renderSoilLayer(loc, year);
    } else if (currentLayer === 'thermal') {
      renderThermalLayer(loc, year);
    } else if (currentLayer === 'precipitation') {
      renderPrecipLayer(loc);
    }

    // Always try land use overlay if checked
    if (document.getElementById('overlayLanduse')?.checked) {
      renderLandUse(loc);
    }
    if (document.getElementById('overlayFlood')?.checked) {
      renderFlood(loc);
    }
    if (document.getElementById('overlayRisk')?.checked) {
      renderRisk(loc);
    }
  }

  // ─── NDVI visualization ──────────────────────────────────────────
  function renderNDVILayer(loc, year) {
    const cells = GeoLensData.generateNDVIGrid(loc.lat, loc.lng, year);
    ndviLayer = L.layerGroup();
    cells.forEach(c => {
      L.rectangle(
        [[c.lat, c.lng], [c.lat + 0.15, c.lng + 0.15]],
        {
          color: 'none',
          fillColor: GeoLensData.ndviColor(c.ndvi),
          fillOpacity: 0.7,
          interactive: true,
        }
      ).bindTooltip(`NDVI: ${c.ndvi.toFixed(3)}`, { direction: 'top', sticky: true })
      .addTo(ndviLayer);
    });
    ndviLayer.addTo(map);
  }

  // ─── Soil moisture visualization ─────────────────────────────────
  function renderSoilLayer(loc, year) {
    const cells = GeoLensData.generateSoilGrid(loc.lat, loc.lng, year);
    soilLayer = L.layerGroup();
    cells.forEach(c => {
      L.rectangle(
        [[c.lat, c.lng], [c.lat + 0.15, c.lng + 0.15]],
        {
          color: 'none',
          fillColor: GeoLensData.soilColor(c.moisture),
          fillOpacity: 0.65,
          interactive: true,
        }
      ).bindTooltip(`Soil Moisture: ${(c.moisture * 100).toFixed(1)}%`, { direction: 'top', sticky: true })
      .addTo(soilLayer);
    });
    soilLayer.addTo(map);
  }

  // ─── Thermal pseudo-overlay ──────────────────────────────────────
  function renderThermalLayer(loc, year) {
    const rand = function(s) { let x = s; return () => { x=(x*9301+49297)%233280; return x/233280; }; };
    const r = rand(Math.round(loc.lat) + year);
    soilLayer = L.layerGroup();
    for (let i = 0; i < 64; i++) {
      const lat = loc.lat + (r() - 0.5) * 2.5;
      const lng = loc.lng + (r() - 0.5) * 2.5;
      const temp = 18 + r() * 26 + (year - 2015) * 0.2;
      const color = temp > 40 ? '#B71C1C' : temp > 30 ? '#EF5350' : temp > 22 ? '#FF8F00' : '#FFF176';
      L.rectangle(
        [[lat, lng], [lat + 0.13, lng + 0.13]],
        { color: 'none', fillColor: color, fillOpacity: 0.6 }
      ).bindTooltip(`Temp: ${temp.toFixed(1)}°C`, { direction: 'top', sticky: true })
      .addTo(soilLayer);
    }
    soilLayer.addTo(map);
  }

  // ─── Precipitation circles ───────────────────────────────────────
  function renderPrecipLayer(loc) {
    const zones = GeoLensData.generateFloodZones(loc.lat, loc.lng);
    floodLayer = L.layerGroup();
    zones.forEach(z => {
      L.circle([z.lat, z.lng], {
        radius: z.radius,
        color: z.color,
        fillColor: z.color,
        fillOpacity: z.intensity * 0.45,
        weight: 1,
      }).bindTooltip('Precipitation anomaly zone', { direction: 'top' })
      .addTo(floodLayer);
    });
    floodLayer.addTo(map);
  }

  // ─── Land use overlay ────────────────────────────────────────────
  function renderLandUse(loc) {
    if (landUseLayer) map.removeLayer(landUseLayer);
    const zones = GeoLensData.generateLandUseZones(loc.lat, loc.lng);
    landUseLayer = L.geoJSON({ type: 'FeatureCollection', features: zones }, {
      style: (feat) => ({
        color: feat.properties.color,
        fillColor: feat.properties.color,
        fillOpacity: feat.properties.opacity,
        weight: 1.5,
      }),
      onEachFeature: (feat, layer) => {
        layer.bindTooltip(`Land Use: ${feat.properties.zone}`, { direction: 'center', sticky: true });
      }
    }).addTo(map);
  }

  // ─── Flood overlay ───────────────────────────────────────────────
  function renderFlood(loc) {
    if (floodLayer) map.removeLayer(floodLayer);
    const zones = GeoLensData.generateFloodZones(loc.lat, loc.lng);
    floodLayer = L.layerGroup();
    zones.forEach(z => {
      L.circle([z.lat, z.lng], {
        radius: z.radius * 1.3,
        color: '#1565C0',
        fillColor: '#1565C0',
        fillOpacity: 0.35,
        weight: 2,
        dashArray: '6,4',
      }).bindTooltip('Flood Risk Zone', { direction: 'top' })
      .addTo(floodLayer);
    });
    floodLayer.addTo(map);
  }

  // ─── Risk heatmap overlay ────────────────────────────────────────
  function renderRisk(loc) {
    if (riskLayer) map.removeLayer(riskLayer);
    const points = GeoLensData.generateRiskPoints(loc.lat, loc.lng);
    riskLayer = L.layerGroup();
    points.forEach(p => {
      const color = p.intensity > 0.7 ? '#B71C1C' :
                    p.intensity > 0.45 ? '#FF8F00' : '#4CAF50';
      L.circleMarker([p.lat, p.lng], {
        radius: 12 + p.intensity * 20,
        color: 'none',
        fillColor: color,
        fillOpacity: p.intensity * 0.4,
      }).addTo(riskLayer);
    });
    riskLayer.addTo(map);
  }

  // ─── Anomaly markers ────────────────────────────────────────────
  function renderAnomalies(locIndex) {
    if (anomalyLayer) map.removeLayer(anomalyLayer);
    const loc = GeoLensData.LOCATIONS[locIndex];
    const anomalies = GeoLensData.generateAnomalies(loc.lat, loc.lng);
    anomalyLayer = L.layerGroup();

    anomalies.forEach(a => {
      const severityColors = { critical: '#f85149', high: '#f0883e', medium: '#f0883e' };
      const color = severityColors[a.severity] || '#4A9EFF';

      // Pulsing circle
      L.circleMarker([a.lat, a.lng], {
        radius: 16,
        color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(anomalyLayer);

      const icon = L.divIcon({
        html: `<div class="anomaly-marker" style="
          background:${color}22;
          border:2px solid ${color};
          border-radius:50%;
          width:28px;height:28px;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;
          cursor:pointer;
          backdrop-filter:blur(4px);
        ">${a.icon}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([a.lat, a.lng], { icon })
        .bindPopup(`
          <div class="gl-popup">
            <div class="gl-popup-title">${a.label}</div>
            <div class="gl-popup-row">
              <span class="gl-popup-label">Severity</span>
              <span class="gl-popup-val ${a.severity === 'critical' ? 'neg' : ''}">${a.severity.toUpperCase()}</span>
            </div>
            <div class="gl-popup-row">
              <span class="gl-popup-label">Detail</span>
              <span class="gl-popup-val">${a.detail}</span>
            </div>
            <div class="gl-popup-row">
              <span class="gl-popup-label">Lat/Lng</span>
              <span class="gl-popup-val">${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</span>
            </div>
          </div>
        `, { maxWidth: 260 })
        .addTo(anomalyLayer);
    });

    anomalyLayer.addTo(map);
    document.getElementById('anomalyText').textContent = `${anomalies.length} anomalies detected – ${loc.name}`;
  }

  // ─── Navigate to location ────────────────────────────────────────
  function flyToLocation(locIndex) {
    currentLocIndex = locIndex;
    const loc = GeoLensData.LOCATIONS[locIndex];
    setActiveLocation(loc.lat, loc.lng, loc.name);
    setTimeout(() => {
      renderLayerOverlays(locIndex, getCurrentYear());
      renderAnomalies(locIndex);
    }, 1800);
  }

  // ─── Show popup on click ─────────────────────────────────────────
  function showLocationPopup(latlng) {
    const ndviVal = (0.3 + Math.random() * 0.5).toFixed(3);
    const tempVal = (18 + Math.random() * 20).toFixed(1);
    const soilVal = (0.2 + Math.random() * 0.6).toFixed(2);

    L.popup({ maxWidth: 240, className: '' })
      .setLatLng(latlng)
      .setContent(`
        <div class="gl-popup">
          <div class="gl-popup-title">📍 ${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°</div>
          <div class="gl-popup-row">
            <span class="gl-popup-label">NDVI</span>
            <span class="gl-popup-val ${ndviVal > 0.5 ? 'pos' : 'neg'}">${ndviVal}</span>
          </div>
          <div class="gl-popup-row">
            <span class="gl-popup-label">Surface Temp</span>
            <span class="gl-popup-val ${tempVal > 30 ? 'neg' : ''}">${tempVal}°C</span>
          </div>
          <div class="gl-popup-row">
            <span class="gl-popup-label">Soil Moisture</span>
            <span class="gl-popup-val">${(soilVal * 100).toFixed(0)}%</span>
          </div>
          <div class="gl-popup-row">
            <span class="gl-popup-label">Layer</span>
            <span class="gl-popup-val">${currentLayer}</span>
          </div>
        </div>
      `)
      .openOn(map);
  }

  // ─── Update map legend ───────────────────────────────────────────
  function updateLegend(layerKey) {
    const legend = LEGENDS[layerKey] || LEGENDS.satellite;
    document.getElementById('legendTitle').textContent = legend.title;
    const items = document.getElementById('legendItems');
    items.innerHTML = legend.items.map(i => `
      <div class="legend-row">
        <div class="legend-color" style="background:${i.color}"></div>
        <span>${i.label}</span>
      </div>
    `).join('');
  }

  // ─── Clear helpers ───────────────────────────────────────────────
  function clearDataLayers() {
    [ndviLayer, soilLayer, landUseLayer, floodLayer, riskLayer].forEach(l => {
      if (l) map.removeLayer(l);
    });
    ndviLayer = soilLayer = landUseLayer = floodLayer = riskLayer = null;
  }

  function clearOverlays() {
    clearDataLayers();
    if (anomalyLayer) map.removeLayer(anomalyLayer);
  }

  // ─── Draw tools ─────────────────────────────────────────────────
  function startDrawPolygon() {
    const handler = new L.Draw.Polygon(map, {
      shapeOptions: { color: '#4A9EFF', fillOpacity: 0.15, weight: 2 }
    });
    handler.enable();
  }

  function startDrawRectangle() {
    const handler = new L.Draw.Rectangle(map, {
      shapeOptions: { color: '#4A9EFF', fillOpacity: 0.15, weight: 2 }
    });
    handler.enable();
  }

  function clearDrawings() {
    drawnItems.clearLayers();
    updateVulnerabilityScore(false);
  }

  // ─── Time-lapse playback ─────────────────────────────────────────
  function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;
    let year = 2015;
    const slider = document.getElementById('yearSlider');
    const label = document.getElementById('yearLabel');

    playInterval = setInterval(() => {
      year++;
      if (year > 2026) {
        stopPlayback();
        return;
      }
      slider.value = year;
      label.textContent = year;
      renderLayerOverlays(currentLocIndex, year);
      updateVulnerabilityForYear(year);
    }, 800);
  }

  function stopPlayback() {
    isPlaying = false;
    clearInterval(playInterval);
    document.getElementById('playBtn').classList.remove('hidden');
    document.getElementById('pauseBtn').classList.add('hidden');
  }

  // ─── Vulnerability score update ───────────────────────────────────
  function updateVulnerabilityScore(animate = true) {
    const score = 45 + Math.round(Math.random() * 45);
    setVulnerabilityScore(score, animate);
  }

  function updateVulnerabilityForYear(year) {
    const series = GeoLensData.generateTimeSeries(currentLocIndex);
    const entry = series.find(s => s.year === year) || series[series.length - 1];
    setVulnerabilityScore(entry.vulnIndex, false);
  }

  function setVulnerabilityScore(score, animate = true) {
    const circumference = 2 * Math.PI * 38;
    const dash = (score / 100) * circumference;
    const fill = document.getElementById('donutFill');
    const valEl = document.getElementById('vulnValue');

    fill.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
    fill.style.stroke = score > 70 ? '#f85149' : score > 45 ? '#f0883e' : '#3fb950';
    valEl.textContent = score;
    valEl.style.color = score > 70 ? '#f85149' : score > 45 ? '#f0883e' : '#3fb950';
  }

  // ─── Init compare maps ───────────────────────────────────────────
  function initCompareMaps() {
    const loc = GeoLensData.LOCATIONS[currentLocIndex];

    if (compareMaps.before) {
      compareMaps.before.remove();
      compareMaps.after.remove();
    }

    compareMaps.before = L.map('mapBefore', { zoomControl: false, attributionControl: false })
      .setView([loc.lat, loc.lng], 7);
    compareMaps.after = L.map('mapAfter', { zoomControl: false, attributionControl: false })
      .setView([loc.lat, loc.lng], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 18
    }).addTo(compareMaps.before);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 18
    }).addTo(compareMaps.after);

    // Add NDVI overlay to both
    const ndviBefore = GeoLensData.generateNDVIGrid(loc.lat, loc.lng, 2018);
    const ndviAfter = GeoLensData.generateNDVIGrid(loc.lat, loc.lng, 2026);

    [ndviBefore, ndviAfter].forEach((cells, i) => {
      const targetMap = i === 0 ? compareMaps.before : compareMaps.after;
      cells.forEach(c => {
        L.rectangle(
          [[c.lat, c.lng], [c.lat + 0.15, c.lng + 0.15]],
          { color: 'none', fillColor: GeoLensData.ndviColor(c.ndvi), fillOpacity: 0.7 }
        ).addTo(targetMap);
      });
    });

    // Sync maps
    compareMaps.before.on('moveend zoomend', () => {
      compareMaps.after.setView(compareMaps.before.getCenter(), compareMaps.before.getZoom(), { animate: false });
    });
    compareMaps.after.on('moveend zoomend', () => {
      compareMaps.before.setView(compareMaps.after.getCenter(), compareMaps.after.getZoom(), { animate: false });
    });
  }

  // ─── Helper: current year ────────────────────────────────────────
  function getCurrentYear() {
    return parseInt(document.getElementById('yearSlider')?.value) || 2026;
  }

  // ─── GeoJSON upload handler ─────────────────────────────────────
  function loadGeoJSON(geojsonData) {
    try {
      const layer = L.geoJSON(geojsonData, {
        style: { color: '#4A9EFF', fillOpacity: 0.15, weight: 2 }
      }).addTo(map);
      map.fitBounds(layer.getBounds());
      window.GeoLensUI?.showToast('GeoJSON loaded successfully!', 'success');
    } catch (e) {
      window.GeoLensUI?.showToast('Invalid GeoJSON file', 'error');
    }
  }

  function calculateAreaFromCoordinates(coords) {
    if (!coords || coords.length < 3) return 124.5;
    const ring = [...coords];
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }
    let total = 0;
    const R = 6371.0088; // Earth radius in km
    for (let i = 0; i < ring.length - 1; i++) {
      const lon1 = (ring[i][0] * Math.PI) / 180;
      const lat1 = (ring[i][1] * Math.PI) / 180;
      const lon2 = (ring[i + 1][0] * Math.PI) / 180;
      const lat2 = (ring[i + 1][1] * Math.PI) / 180;
      total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    const area_rad = Math.abs(total) / 2;
    return Math.round(area_rad * R * R * 100) / 100;
  }

  function setActiveLocation(lat, lng, name, bounds = null) {
    if (!map) return;
    const b = bounds || map.getBounds();
    activeLocation = { lat, lng, name, bounds: b };

    if (activeMarker) {
      map.removeLayer(activeMarker);
    }

    const pinIcon = L.divIcon({
      html: '<div class="active-location-pin"><div class="pin-pulse"></div><div class="pin-core"></div></div>',
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    activeMarker = L.marker([lat, lng], { icon: pinIcon })
      .bindPopup(`
        <div class="gl-popup">
          <div class="gl-popup-title">📍 ${name}</div>
          <div class="gl-popup-row"><span class="gl-popup-label">Coordinates</span><span class="gl-popup-val">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</span></div>
          <div class="gl-popup-row"><span class="gl-popup-label">Data Pipeline</span><span class="gl-popup-val pos">Synced (Open-Meteo & Sentinel)</span></div>
          <div class="gl-popup-row"><span class="gl-popup-label">Source</span><span class="gl-popup-val">Nominatim / Geocoded</span></div>
        </div>
      `, { maxWidth: 260 })
      .addTo(map);

    map.flyTo([lat, lng], Math.max(map.getZoom(), 7), { duration: 1.5 });

    // Expose active coordinates & bounds globally
    window.GeoLensState = window.GeoLensState || {};
    window.GeoLensState.activeLocation = activeLocation;

    window.dispatchEvent(new CustomEvent('geolens:location-changed', {
      detail: { lat, lng, name, bounds: b }
    }));
  }

  function getActiveLocation() {
    return activeLocation;
  }

  return {
    init,
    switchLayer,
    renderLayerOverlays,
    flyToLocation,
    setActiveLocation,
    getActiveLocation,
    startDrawPolygon,
    startDrawRectangle,
    clearDrawings,
    startPlayback,
    stopPlayback,
    initCompareMaps,
    updateVulnerabilityScore,
    setVulnerabilityScore,
    loadGeoJSON,
    getCurrentYear,
    get currentLocIndex() { return currentLocIndex; },
    get isPlaying() { return isPlaying; },
  };
})();
