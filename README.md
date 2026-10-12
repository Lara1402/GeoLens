# GeoLens – Geospatial Environmental Intelligence Platform

GeoLens is an environmental intelligence web application that aggregates satellite imagery, meteorological patterns, soil metrics, and land cover data into localized geospatial dashboards with time-series comparison, change detection, and correlation engines.

---

## 1. Architecture Overview

GeoLens follows an end-to-end geospatial intelligence pipeline:
$$\text{Location Target / ROI} \longrightarrow \text{Data Harmonization} \longrightarrow \text{Historical Slider Comparison} \longrightarrow \text{Change Detection Engine} \longrightarrow \text{Correlational Analysis} \longrightarrow \text{Actionable Insights \& Reports}$$

### Core Features Implemented:
1. **Interactive Map Studio**: Full-screen Leaflet mapping with dynamic base layer toggles (Optical Satellite, NDVI, Soil Moisture, Precipitation, Thermal Anomalies) and overlays (Flood extent, Land use zones, Risk heatmap).
2. **Instant Area Calculation ($km^2$)**: Geodesic spherical polygon area calculation computed immediately upon drawing an ROI or uploading GeoJSON/KML.
3. **Data Provenance & Observation Dates**: Every layer, chart, and metric explicitly displays its `Observation Date`, ground resolution, and `Data Source Provider` (e.g. *Source: Sentinel-2 L2A via Sentinel Hub | Observed: Oct 02, 2026*).
4. **Spectral Analysis & $\Delta\text{NDVI}$**: 
   $$\text{NDVI} = \frac{\text{NIR} - \text{RED}}{\text{NIR} + \text{RED}}$$
   Pixel and raster-level change detection highlighting growth vs. degradation.
5. **Seasonal vs. True Loss Guardrail**: Automated classification distinguishing seasonal phenological drought from permanent anthropogenic deforestation or wildfire disturbance.
6. **Multi-API Pipeline with Fallback Reliability**: Integration readiness for Sentinel Hub (Copernicus Sentinel-2 L2A) and live Open-Meteo API with graceful fallback to high-fidelity cached climatological baselines.
7. **Cause-Correlation & Vulnerability Score ($0\text{--}100$)**: Multi-factor environmental risk model with explicit analytical disclaimers.
8. **User Workspace & Reporting**: Saved custom ROI locations, threshold alerts, and one-click PDF/GeoJSON/CSV report generation.

---

## 2. Directory Structure

```
geolens/
├── index.html                    # Main web application entry point
├── styles.css                    # Spatial intelligence dark/light theme
├── app.js                        # Bootstrapper & API reliability engine
├── ui.js                         # UI controls, drawers, modals, exports
├── map.js                        # Leaflet map engine, layers, draw tools, split compare
├── charts.js                     # Chart.js time-series & transition matrix
├── data/
│   └── mockData.js               # High-fidelity synthetic datasets & geocoder
├── backend/
│   ├── main.py                   # FastAPI application & REST endpoints
│   ├── schemas.py                # Pydantic data schemas
│   ├── requirements.txt          # Python backend dependencies
│   ├── schema.sql                # PostgreSQL 14+ / PostGIS 3+ migrations
│   ├── services/
│   │   ├── geospatial.py         # NDVI math, geodesic area, seasonal guardrail, vuln score
│   │   ├── satellite.py          # Sentinel-2 L2A surface reflectance engine
│   │   └── weather.py            # Open-Meteo client & climatology cache
│   └── tests/
│       └── test_geospatial.py    # Unit test suite (100% passing)
└── README.md
```

---

## 3. How to Run Locally

### Option A: Instant Browser Launch (Zero Dependencies)
Simply open `index.html` in your web browser:
```bash
open /Users/lara/Documents/anshr/geolens/index.html
```
Or start a local static server:
```bash
cd /Users/lara/Documents/anshr/geolens
python3 -m http.server 8000
```
Then navigate to `http://localhost:8000`.

---

### Option B: FastAPI Backend + PostGIS Production Setup

#### 1. Setup Virtual Environment
```bash
cd /Users/lara/Documents/anshr/geolens
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

#### 2. Run Database Migrations
Execute the spatial schema migration on PostgreSQL with PostGIS installed:
```bash
psql -U postgres -d geolens_db -f backend/schema.sql
```

#### 3. Environment Variables (`.env`)
Create a `.env` file in `backend/`:
```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/geolens_db

# Copernicus Sentinel Hub Credentials
SENTINEL_HUB_INSTANCE_ID=your_instance_id_here
SENTINEL_HUB_CLIENT_ID=your_client_id_here
SENTINEL_HUB_CLIENT_SECRET=your_client_secret_here

# Open-Meteo (Free Open API, no key required for standard tier)
OPEN_METEO_BASE_URL=https://archive-api.open-meteo.com/v1/archive
OPEN_METEO_FORECAST_URL=https://api.open-meteo.com/v1/forecast
```

#### 4. Launch FastAPI Server
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API documentation will be available at `http://localhost:8000/docs`.

#### 5. Run Verification Test Suite
```bash
python3 -m unittest backend/tests/test_geospatial.py
```
Outputs:
```
Ran 7 tests in 0.000s
OK
```

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health check and API connectivity status |
| `GET` | `/api/v1/regions` | Retrieve all saved Regions of Interest (ROI) |
| `POST` | `/api/v1/regions` | Save custom polygon ROI with auto geodesic area ($km^2$) |
| `POST` | `/api/v1/analysis/ndvi` | Spectral $\Delta\text{NDVI}$ calculation & seasonal guardrail analysis |
| `GET` | `/api/v1/weather/history` | Open-Meteo 10-year historical weather and soil moisture |
| `GET` | `/api/v1/alerts` | Active environmental threshold breach logs |
