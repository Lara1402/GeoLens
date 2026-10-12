/**
 * GeoLens – Chart Engine
 * Time-series charts (NDVI, Precipitation, Temperature, Soil Moisture)
 * and Land Cover Transition chart using Chart.js
 */

window.GeoLensCharts = (() => {
  const charts = {};

  // ─── Shared chart theme ──────────────────────────────────────────
  function getThemeColors() {
    const isDark = document.documentElement.dataset.theme !== 'light';
    return {
      gridColor: isDark ? 'rgba(48,54,61,0.6)' : 'rgba(0,0,0,0.08)',
      tickColor: isDark ? '#484f58' : '#8c959f',
      textColor: isDark ? '#8b949e' : '#57606a',
    };
  }

  function baseChartOptions(yLabel = '') {
    const t = getThemeColors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161b22',
          borderColor: 'rgba(48,54,61,0.8)',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          padding: 10,
          displayColors: true,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}${yLabel ? ' ' + yLabel : ''}`
          }
        },
      },
      scales: {
        x: {
          grid: { color: t.gridColor, drawBorder: false },
          ticks: { color: t.tickColor, font: { size: 10 } },
        },
        y: {
          grid: { color: t.gridColor, drawBorder: false },
          ticks: { color: t.tickColor, font: { size: 10 } },
          border: { display: false },
        },
      },
    };
  }

  // ─── Build gradient fill ─────────────────────────────────────────
  function makeGradient(ctx, color, alpha = 0.25) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 130);
    gradient.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
    gradient.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
    return gradient;
  }

  // ─── Initialize all charts for a given location ──────────────────
  function initCharts(locIndex) {
    const series = GeoLensData.generateTimeSeries(locIndex);
    const labels = series.map(d => String(d.year));

    initNDVIChart(labels, series);
    initPrecipChart(labels, series);
    initTempChart(labels, series);
    initSoilChart(labels, series);
    initLandCoverChart();
  }

  // ─── NDVI Chart ──────────────────────────────────────────────────
  function initNDVIChart(labels, series) {
    const canvas = document.getElementById('ndviChart');
    if (!canvas) return;
    if (charts.ndvi) charts.ndvi.destroy();

    const ctx = canvas.getContext('2d');
    const values = series.map(d => d.ndvi);
    const gradient = ctx.createLinearGradient(0, 0, 0, 130);
    gradient.addColorStop(0, 'rgba(63,185,80,0.3)');
    gradient.addColorStop(1, 'rgba(63,185,80,0)');

    charts.ndvi = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'NDVI Index',
            data: values,
            borderColor: '#3fb950',
            borderWidth: 2,
            pointBackgroundColor: '#3fb950',
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: gradient,
            tension: 0.35,
          },
          {
            label: '5yr Average',
            data: labels.map(() => 0.58),
            borderColor: 'rgba(74,158,255,0.5)',
            borderWidth: 1.5,
            borderDash: [5, 3],
            pointRadius: 0,
            fill: false,
            tension: 0,
          }
        ]
      },
      options: {
        ...baseChartOptions(''),
        plugins: {
          ...baseChartOptions('').plugins,
          legend: {
            display: true,
            labels: { color: getThemeColors().textColor, font: { size: 10 }, boxWidth: 12 }
          }
        },
        scales: {
          ...baseChartOptions().scales,
          y: { ...baseChartOptions().scales.y, min: 0, max: 1 }
        }
      }
    });
  }

  // ─── Precipitation Chart ─────────────────────────────────────────
  function initPrecipChart(labels, series) {
    const canvas = document.getElementById('precipChart');
    if (!canvas) return;
    if (charts.precip) charts.precip.destroy();

    const ctx = canvas.getContext('2d');
    const values = series.map(d => d.precip);

    charts.precip = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Precipitation (mm)',
            data: values,
            backgroundColor: values.map(v => {
              if (v > 180) return 'rgba(21,101,192,0.8)';
              if (v > 120) return 'rgba(30,136,229,0.8)';
              if (v > 60) return 'rgba(79,195,247,0.8)';
              return 'rgba(179,229,252,0.8)';
            }),
            borderRadius: 3,
            borderSkipped: false,
          }
        ]
      },
      options: {
        ...baseChartOptions('mm'),
        plugins: {
          ...baseChartOptions('mm').plugins,
          legend: { display: false }
        }
      }
    });
  }

  // ─── Temperature Chart ───────────────────────────────────────────
  function initTempChart(labels, series) {
    const canvas = document.getElementById('tempChart');
    if (!canvas) return;
    if (charts.temp) charts.temp.destroy();

    const ctx = canvas.getContext('2d');
    const values = series.map(d => d.temp);
    const gradient = ctx.createLinearGradient(0, 0, 0, 130);
    gradient.addColorStop(0, 'rgba(255,87,34,0.3)');
    gradient.addColorStop(1, 'rgba(255,87,34,0)');

    // Baseline reference
    const baseline = +(values[0] - 0.4).toFixed(1);

    charts.temp = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Surface Temp (°C)',
            data: values,
            borderColor: '#f0883e',
            borderWidth: 2,
            pointBackgroundColor: values.map(v => v > baseline + 1.5 ? '#f85149' : '#f0883e'),
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: gradient,
            tension: 0.3,
          },
          {
            label: 'Baseline',
            data: labels.map(() => baseline),
            borderColor: 'rgba(74,158,255,0.4)',
            borderWidth: 1.5,
            borderDash: [5, 3],
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        ...baseChartOptions('°C'),
        plugins: {
          ...baseChartOptions('°C').plugins,
          legend: {
            display: true,
            labels: { color: getThemeColors().textColor, font: { size: 10 }, boxWidth: 12 }
          }
        }
      }
    });
  }

  // ─── Soil Moisture Chart ─────────────────────────────────────────
  function initSoilChart(labels, series) {
    const canvas = document.getElementById('soilChart');
    if (!canvas) return;
    if (charts.soil) charts.soil.destroy();

    const ctx = canvas.getContext('2d');
    const values = series.map(d => +(d.soil * 100).toFixed(1));
    const gradient = ctx.createLinearGradient(0, 0, 0, 130);
    gradient.addColorStop(0, 'rgba(74,158,255,0.25)');
    gradient.addColorStop(1, 'rgba(74,158,255,0)');

    charts.soil = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Soil Moisture (%)',
            data: values,
            borderColor: '#4A9EFF',
            borderWidth: 2,
            pointBackgroundColor: values.map(v => v < 35 ? '#f85149' : '#4A9EFF'),
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: gradient,
            tension: 0.35,
          },
          {
            label: '5yr Avg',
            data: labels.map(() => values.slice(0, 5).reduce((a, b) => a + b, 0) / 5),
            borderColor: 'rgba(240,136,62,0.5)',
            borderWidth: 1.5,
            borderDash: [5, 3],
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        ...baseChartOptions('%'),
        plugins: {
          ...baseChartOptions('%').plugins,
          legend: {
            display: true,
            labels: { color: getThemeColors().textColor, font: { size: 10 }, boxWidth: 12 }
          }
        },
        scales: {
          ...baseChartOptions('%').scales,
          y: { ...baseChartOptions('%').scales.y, min: 0, max: 100 }
        }
      }
    });
  }

  // ─── Land Cover Transition Chart ─────────────────────────────────
  function initLandCoverChart() {
    const canvas = document.getElementById('landcoverChart');
    if (!canvas) return;
    if (charts.landcover) charts.landcover.destroy();

    const data = GeoLensData.getLandCoverData();
    const ctx = canvas.getContext('2d');

    charts.landcover = new Chart(ctx, {
      type: 'bar',
      data,
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: getThemeColors().textColor,
              font: { size: 10 },
              boxWidth: 12,
              padding: 8,
            }
          },
          tooltip: {
            backgroundColor: '#161b22',
            borderColor: 'rgba(48,54,61,0.8)',
            borderWidth: 1,
            titleColor: '#e6edf3',
            bodyColor: '#8b949e',
            padding: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}%`
            }
          },
        },
        scales: {
          x: {
            stacked: false,
            max: 50,
            grid: { color: getThemeColors().gridColor, drawBorder: false },
            ticks: { color: getThemeColors().tickColor, font: { size: 10 }, callback: v => v + '%' },
          },
          y: {
            grid: { display: false },
            ticks: { color: getThemeColors().tickColor, font: { size: 10 } },
            border: { display: false },
          },
        }
      }
    });
  }

  // ─── Update charts when location changes ─────────────────────────
  function updateCharts(locIndex) {
    initCharts(locIndex);
    populateDataTable(locIndex);
  }

  // ─── Update theme (dark ↔ light) ─────────────────────────────────
  function refreshTheme() {
    Object.values(charts).forEach(c => {
      if (!c) return;
      const t = getThemeColors();
      if (c.options.scales?.x) {
        c.options.scales.x.grid.color = t.gridColor;
        c.options.scales.x.ticks.color = t.tickColor;
      }
      if (c.options.scales?.y) {
        c.options.scales.y.grid.color = t.gridColor;
        c.options.scales.y.ticks.color = t.tickColor;
      }
      if (c.options.plugins?.legend?.labels) {
        c.options.plugins.legend.labels.color = t.textColor;
      }
      c.update();
    });
  }

  // ─── Populate data table ─────────────────────────────────────────
  function populateDataTable(locIndex) {
    const series = GeoLensData.generateTimeSeries(locIndex);
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = series.map(d => {
      const ndviClass = d.ndvi < 0.4 ? 'td-bad' : d.ndvi < 0.6 ? 'td-warn' : 'td-good';
      const soilClass = d.soil < 0.3 ? 'td-bad' : d.soil < 0.5 ? 'td-warn' : 'td-good';
      const vulnClass = d.vulnIndex > 70 ? 'td-bad' : d.vulnIndex > 50 ? 'td-warn' : 'td-good';
      return `
        <tr>
          <td>${d.year}</td>
          <td class="${ndviClass}">${d.ndvi}</td>
          <td>${d.precip}</td>
          <td>${d.temp}°C</td>
          <td class="${soilClass}">${(d.soil * 100).toFixed(1)}%</td>
          <td>${d.forest}%</td>
          <td>${d.urban} km²</td>
          <td class="${vulnClass}">${d.vulnIndex}</td>
        </tr>
      `;
    }).join('');

    // Store for search/CSV
    window._tableData = series;
  }

  return {
    initCharts,
    updateCharts,
    refreshTheme,
    populateDataTable,
  };
})();
