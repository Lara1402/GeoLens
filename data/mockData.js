/**
 * GeoLens – Mock Environmental Data Service
 * Generates realistic synthetic datasets for all map layers,
 * time-series charts, and change detection analysis.
 */

window.GeoLensData = (() => {

  // ─── Seed locations (lat, lng, name, region) ───────────────────
  const LOCATIONS = [
    { name: 'Amazon Basin, Brazil', lat: -3.4653, lng: -62.2159, region: 'South America', biome: 'Tropical Rainforest' },
    { name: 'Sahel Region, Niger', lat: 15.7167, lng: 9.3333, region: 'West Africa', biome: 'Semi-Arid Savanna' },
    { name: 'Yangtze Delta, China', lat: 31.2304, lng: 121.4737, region: 'East Asia', biome: 'Urban-Wetland' },
    { name: 'Mekong Delta, Vietnam', lat: 10.0341, lng: 105.7880, region: 'Southeast Asia', biome: 'River Delta' },
    { name: 'Murray-Darling Basin, Australia', lat: -34.0, lng: 146.0, region: 'Oceania', biome: 'Dryland Agriculture' },
    { name: 'Greater Ganges Plain, India', lat: 26.8, lng: 80.9, region: 'South Asia', biome: 'Alluvial Plain' },
    { name: 'Congo Basin, DRC', lat: -1.6, lng: 23.5, region: 'Central Africa', biome: 'Equatorial Forest' },
    { name: 'Ganges-Brahmaputra Delta, Bangladesh', lat: 23.7, lng: 90.4, region: 'South Asia', biome: 'Coastal Delta' },
  ];

  // ─── Year range ─────────────────────────────────────────────────
  const YEARS = Array.from({ length: 12 }, (_, i) => 2015 + i);

  // ─── Seeded random (deterministic for a given location) ─────────
  function seededRand(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  // ─── Generate time-series for a location ────────────────────────
  function generateTimeSeries(locIndex) {
    const rand = seededRand(locIndex * 137);
    const loc = LOCATIONS[locIndex] || LOCATIONS[0];

    // Base values per biome
    const biomeBase = {
      'Tropical Rainforest':  { ndvi: 0.82, precip: 210, temp: 27.5, soil: 0.72, forest: 88, urban: 2.1 },
      'Semi-Arid Savanna':    { ndvi: 0.31, precip: 45,  temp: 33.0, soil: 0.22, forest: 18, urban: 3.4 },
      'Urban-Wetland':        { ndvi: 0.41, precip: 95,  temp: 17.2, soil: 0.45, forest: 12, urban: 62.0 },
      'River Delta':          { ndvi: 0.64, precip: 170, temp: 28.1, soil: 0.68, forest: 42, urban: 18.0 },
      'Dryland Agriculture':  { ndvi: 0.44, precip: 38,  temp: 22.0, soil: 0.30, forest: 22, urban: 8.5 },
      'Alluvial Plain':       { ndvi: 0.55, precip: 88,  temp: 26.3, soil: 0.51, forest: 28, urban: 25.0 },
      'Equatorial Forest':    { ndvi: 0.79, precip: 185, temp: 26.8, soil: 0.70, forest: 82, urban: 1.2 },
      'Coastal Delta':        { ndvi: 0.58, precip: 145, temp: 27.9, soil: 0.63, forest: 35, urban: 28.0 },
    };

    const base = biomeBase[loc.biome] || biomeBase['Alluvial Plain'];

    return YEARS.map((year, i) => {
      const trend = i / 11; // 0→1 over time
      const noise = (rand() - 0.5) * 0.08;
      const yearNoise = rand() - 0.5;

      // Declining vegetation / rising temp trend
      const ndvi = +(base.ndvi - trend * 0.18 * base.ndvi + noise).toFixed(3);
      const precip = +(base.precip * (1 + (rand() - 0.45) * 0.35)).toFixed(1);
      const temp = +(base.temp + trend * 2.4 + yearNoise * 0.8).toFixed(1);
      const soil = +(base.soil - trend * 0.18 * base.soil + (rand() - 0.5) * 0.06).toFixed(3);
      const forest = +(base.forest * (1 - trend * 0.32 * rand())).toFixed(1);
      const urban = +(base.urban * (1 + trend * 0.45)).toFixed(2);
      const vulnIndex = Math.round(
        (1 - ndvi) * 25 +
        (temp / 40) * 30 +
        (1 - soil) * 25 +
        (urban / 100) * 20
      );

      return { year, ndvi, precip, temp, soil, forest, urban, vulnIndex };
    });
  }

  // ─── NDVI raster simulation (grid of values) ────────────────────
  function generateNDVIGrid(centerLat, centerLng, year) {
    const rand = seededRand(Math.round(centerLat * 100) + year);
    const cells = [];
    const gridSize = 8;
    const span = 1.2;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const lat = centerLat - span / 2 + (r / gridSize) * span;
        const lng = centerLng - span / 2 + (c / gridSize) * span;
        const distFromCenter = Math.sqrt(Math.pow((r - gridSize/2)/gridSize, 2) + Math.pow((c - gridSize/2)/gridSize, 2));
        const baseVal = 0.7 - distFromCenter * 0.6 - (year - 2015) * 0.012;
        const val = Math.max(0.05, Math.min(0.95, baseVal + (rand() - 0.5) * 0.3));
        cells.push({ lat, lng, ndvi: +val.toFixed(3) });
      }
    }
    return cells;
  }

  // ─── Soil moisture grid ─────────────────────────────────────────
  function generateSoilGrid(centerLat, centerLng, year) {
    const rand = seededRand(Math.round(centerLng * 100) + year + 42);
    const cells = [];
    const gridSize = 8;
    const span = 1.2;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const lat = centerLat - span / 2 + (r / gridSize) * span;
        const lng = centerLng - span / 2 + (c / gridSize) * span;
        const baseVal = 0.6 - (year - 2015) * 0.015 + (rand() - 0.5) * 0.4;
        const val = Math.max(0.05, Math.min(0.95, baseVal));
        cells.push({ lat, lng, moisture: +val.toFixed(3) });
      }
    }
    return cells;
  }

  // ─── Land use zones (GeoJSON-style polygons) ────────────────────
  function generateLandUseZones(centerLat, centerLng) {
    return [
      {
        type: 'Feature',
        properties: { zone: 'Dense Forest', color: '#2d6a4f', opacity: 0.5 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [centerLng - 0.9, centerLat + 0.3],
            [centerLng - 0.1, centerLat + 0.3],
            [centerLng - 0.1, centerLat + 0.9],
            [centerLng - 0.9, centerLat + 0.9],
            [centerLng - 0.9, centerLat + 0.3],
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { zone: 'Agriculture', color: '#c9a44a', opacity: 0.4 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [centerLng + 0.1, centerLat - 0.1],
            [centerLng + 0.8, centerLat - 0.1],
            [centerLng + 0.8, centerLat + 0.5],
            [centerLng + 0.1, centerLat + 0.5],
            [centerLng + 0.1, centerLat - 0.1],
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { zone: 'Urban Area', color: '#607d8b', opacity: 0.55 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [centerLng - 0.2, centerLat - 0.6],
            [centerLng + 0.3, centerLat - 0.6],
            [centerLng + 0.3, centerLat - 0.1],
            [centerLng - 0.2, centerLat - 0.1],
            [centerLng - 0.2, centerLat - 0.6],
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { zone: 'Wetlands', color: '#4fc3f7', opacity: 0.4 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [centerLng - 0.8, centerLat - 0.8],
            [centerLng - 0.4, centerLat - 0.8],
            [centerLng - 0.4, centerLat - 0.3],
            [centerLng - 0.8, centerLat - 0.3],
            [centerLng - 0.8, centerLat - 0.8],
          ]]
        }
      },
      {
        type: 'Feature',
        properties: { zone: 'Degraded Land', color: '#8d6e63', opacity: 0.5 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [centerLng + 0.2, centerLat - 0.9],
            [centerLng + 0.9, centerLat - 0.9],
            [centerLng + 0.9, centerLat - 0.4],
            [centerLng + 0.2, centerLat - 0.4],
            [centerLng + 0.2, centerLat - 0.9],
          ]]
        }
      }
    ];
  }

  // ─── Anomaly hotspots ───────────────────────────────────────────
  function generateAnomalies(centerLat, centerLng) {
    return [
      {
        lat: centerLat + 0.3,
        lng: centerLng - 0.2,
        type: 'deforestation',
        severity: 'high',
        label: 'Deforestation Hotspot',
        detail: 'Canopy density dropped 38% — 1,240 ha affected',
        icon: '🌲',
      },
      {
        lat: centerLat - 0.4,
        lng: centerLng + 0.5,
        type: 'flood_risk',
        severity: 'critical',
        label: 'Flood Risk Zone',
        detail: 'Precipitation 210% above seasonal norm',
        icon: '🌊',
      },
      {
        lat: centerLat + 0.1,
        lng: centerLng + 0.8,
        type: 'heat',
        severity: 'medium',
        label: 'Urban Heat Anomaly',
        detail: 'Surface temperature +3.2°C above baseline',
        icon: '🔥',
      },
    ];
  }

  // ─── Precipitation risk zones ───────────────────────────────────
  function generateFloodZones(centerLat, centerLng) {
    return [
      { lat: centerLat - 0.3, lng: centerLng + 0.4, radius: 35000, color: '#1565C0', intensity: 0.7 },
      { lat: centerLat - 0.5, lng: centerLng - 0.2, radius: 25000, color: '#0288D1', intensity: 0.5 },
      { lat: centerLat + 0.2, lng: centerLng + 0.1, radius: 18000, color: '#4FC3F7', intensity: 0.3 },
    ];
  }

  // ─── Risk heatmap points ─────────────────────────────────────────
  function generateRiskPoints(centerLat, centerLng) {
    const rand = seededRand(Math.round((centerLat + centerLng) * 50));
    const points = [];
    for (let i = 0; i < 25; i++) {
      points.push({
        lat: centerLat + (rand() - 0.5) * 2,
        lng: centerLng + (rand() - 0.5) * 2,
        intensity: rand(),
      });
    }
    return points;
  }

  // ─── Search suggestions (mock geocoder) ─────────────────────────
  function searchLocations(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return LOCATIONS.filter(l =>
      l.name.toLowerCase().includes(q) || l.region.toLowerCase().includes(q)
    ).slice(0, 5);
  }

  // ─── NDVI color scale ────────────────────────────────────────────
  function ndviColor(val) {
    if (val > 0.7) return '#1b5e20';
    if (val > 0.55) return '#2e7d32';
    if (val > 0.40) return '#558b2f';
    if (val > 0.25) return '#8d6e63';
    if (val > 0.10) return '#bcaaa4';
    return '#f5f5f0';
  }

  // ─── Soil moisture color scale ───────────────────────────────────
  function soilColor(val) {
    if (val > 0.75) return '#1565C0';
    if (val > 0.55) return '#1976D2';
    if (val > 0.40) return '#1E88E5';
    if (val > 0.25) return '#8d6e63';
    if (val > 0.10) return '#a1887f';
    return '#d7ccc8';
  }

  // ─── Land cover chart data ──────────────────────────────────────
  function getLandCoverData() {
    return {
      labels: ['Dense Forest', 'Open Forest', 'Agriculture', 'Urban', 'Wetland', 'Degraded'],
      datasets: [
        {
          label: '2018',
          data: [32, 18, 24, 8, 10, 8],
          backgroundColor: 'rgba(74,158,255,0.7)',
        },
        {
          label: '2026',
          data: [22, 12, 28, 14, 8, 16],
          backgroundColor: 'rgba(248,81,73,0.7)',
        }
      ]
    };
  }

  // ─── Export all public API ───────────────────────────────────────
  return {
    LOCATIONS,
    YEARS,
    generateTimeSeries,
    generateNDVIGrid,
    generateSoilGrid,
    generateLandUseZones,
    generateAnomalies,
    generateFloodZones,
    generateRiskPoints,
    searchLocations,
    ndviColor,
    soilColor,
    getLandCoverData,
  };
})();
