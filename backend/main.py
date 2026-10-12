"""
GeoLens – Geospatial Environmental Intelligence Platform
FastAPI Application Entry Point
"""

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import uuid
from datetime import datetime, date

from schemas import (
    RegionCreate,
    RegionResponse,
    NDVIAnalysisRequest,
    NDVIAnalysisResponse,
    WeatherHistoryResponse,
    AlertRuleCreate,
    AlertLogResponse,
    SpectralBandData
)
from services.geospatial import (
    calculate_ndvi,
    calculate_delta_ndvi,
    seasonal_vs_true_loss_guardrail,
    calculate_polygon_area_km2,
    calculate_vulnerability_index
)
from services.satellite import SatelliteService
from services.weather import WeatherService

app = FastAPI(
    title="GeoLens API",
    description="Geospatial Environmental Intelligence & Change Detection Platform API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory mock storage for regions & alerts (synchronized with PostGIS schema definitions)
IN_MEMORY_REGIONS = [
    {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "name": "Amazon Tapajós Monitoring Basin",
        "description": "High-resolution rainforest canopy and riparian buffer monitoring polygon.",
        "area_km2": 1968.45,
        "biome_type": "Tropical Rainforest",
        "created_at": datetime.now(),
        "boundary": {
            "type": "Polygon",
            "coordinates": [[
                [-55.20, -3.10],
                [-54.80, -3.10],
                [-54.80, -2.70],
                [-55.20, -2.70],
                [-55.20, -3.10]
            ]]
        }
    },
    {
        "id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
        "name": "Sundarbans Delta Mangrove Buffer",
        "description": "Tidal mangrove vulnerability zone with cyclone erosion tracking.",
        "area_km2": 842.10,
        "biome_type": "Coastal Mangrove",
        "created_at": datetime.now(),
        "boundary": {
            "type": "Polygon",
            "coordinates": [[
                [88.80, 21.60],
                [89.20, 21.60],
                [89.20, 22.00],
                [88.80, 22.00],
                [88.80, 21.60]
            ]]
        }
    }
]

IN_MEMORY_ALERTS = [
    {
        "id": 1,
        "region_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "metric_name": "NDVI",
        "triggered_at": datetime.now(),
        "observed_value": -0.28,
        "threshold_value": -0.15,
        "message": "NDVI dropped 28% below 5-year baseline in Amazon Tapajós Monitoring Basin.",
        "severity": "CRITICAL",
        "is_read": False
    },
    {
        "id": 2,
        "region_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
        "metric_name": "PRECIPITATION",
        "triggered_at": datetime.now(),
        "observed_value": 310.5,
        "threshold_value": 200.0,
        "message": "Heavy monsoon rainfall threshold exceeded (+55% anomaly). Flood surge warning active.",
        "severity": "WARNING",
        "is_read": False
    }
]

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "HEALTHY",
        "timestamp": datetime.now().isoformat(),
        "postgis_extension": "READY",
        "apis": {
            "sentinel_hub": "ONLINE",
            "open_meteo": "ONLINE"
        }
    }

@app.get("/api/v1/regions", response_model=List[RegionResponse], tags=["Regions"])
def get_regions():
    """Returns saved Regions of Interest."""
    return IN_MEMORY_REGIONS

@app.post("/api/v1/regions", response_model=RegionResponse, status_code=status.HTTP_201_CREATED, tags=["Regions"])
def create_region(region: RegionCreate):
    """Saves a new user ROI with automatic geodesic area calculation."""
    coords = region.boundary.coordinates[0]
    area = calculate_polygon_area_km2(coords)
    new_reg = {
        "id": str(uuid.uuid4()),
        "name": region.name,
        "description": region.description,
        "area_km2": area,
        "biome_type": region.biome_type,
        "created_at": datetime.now(),
        "boundary": region.boundary.dict()
    }
    IN_MEMORY_REGIONS.append(new_reg)
    return new_reg

@app.post("/api/v1/analysis/ndvi", response_model=NDVIAnalysisResponse, tags=["Analysis"])
async def analyze_ndvi_change(payload: NDVIAnalysisRequest):
    """
    Performs spectral NDVI comparison between Date T1 and Date T2.
    Integrates seasonal vs true loss guardrails and vulnerability scoring.
    """
    # Sample point extraction from coordinates or default Amazon Basin
    lat = -2.90
    lon = -55.00
    area = 1240.5
    if payload.coordinates and len(payload.coordinates) > 0:
        lat = sum(p[1] for p in payload.coordinates) / len(payload.coordinates)
        lon = sum(p[0] for p in payload.coordinates) / len(payload.coordinates)
        area = calculate_polygon_area_km2(payload.coordinates)

    # 1. Fetch satellite reflectance
    spec_t1 = SatelliteService.get_surface_reflectance(lat, lon, str(payload.date_t1), payload.max_cloud_cover_pct)
    spec_t2 = SatelliteService.get_surface_reflectance(lat, lon, str(payload.date_t2), payload.max_cloud_cover_pct)

    # 2. Spectral delta
    change = calculate_delta_ndvi(spec_t1["ndvi"], spec_t2["ndvi"])

    # 3. Weather context for seasonal guardrail
    weather = await WeatherService.get_historical_weather(lat, lon, str(payload.date_t1), str(payload.date_t2))
    guardrail = seasonal_vs_true_loss_guardrail(
        delta_ndvi=change["delta"],
        rainfall_anomaly_pct=weather["precipitation_anomaly_pct"],
        soil_moisture_pct=weather["soil_moisture_0_7cm_mean"],
        dry_season_active=(payload.date_t2.month in [7, 8, 9, 10])
    )

    # 4. Vulnerability Score
    vuln = calculate_vulnerability_index(
        ndvi_current=spec_t2["ndvi"],
        ndvi_loss_pct=change["percentage_change"],
        rainfall_volatility_pct=weather["precipitation_anomaly_pct"],
        soil_moisture_pct=weather["soil_moisture_0_7cm_mean"]
    )

    return NDVIAnalysisResponse(
        date_t1=SpectralBandData(**spec_t1),
        date_t2=SpectralBandData(**spec_t2),
        delta_ndvi=change["delta"],
        percentage_change=change["percentage_change"],
        classification=change["classification"],
        seasonal_guardrail=guardrail,
        vulnerability_index=vuln,
        area_km2=area,
        citation="Copernicus Sentinel-2 L2A via Sentinel Hub | ESA Earth Observation"
    )

@app.get("/api/v1/weather/history", response_model=WeatherHistoryResponse, tags=["Meteorology"])
async def get_weather_history(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    start_date: str = Query("2018-01-01"),
    end_date: str = Query("2026-09-01")
):
    """Fetches weather and soil metrics with Open-Meteo live integration and climatology fallback."""
    data = await WeatherService.get_historical_weather(latitude, longitude, start_date, end_date)
    return WeatherHistoryResponse(
        latitude=latitude,
        longitude=longitude,
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date),
        data_source=data["data_source"],
        is_live=data["is_live"],
        precipitation_sum_mm=data["precipitation_sum_mm"],
        precipitation_anomaly_pct=data["precipitation_anomaly_pct"],
        soil_moisture_0_7cm_mean=data["soil_moisture_0_7cm_mean"],
        avg_temperature_c=data["avg_temperature_c"],
        monthly_series=[]
    )

@app.get("/api/v1/alerts", response_model=List[AlertLogResponse], tags=["Alerts"])
def get_alerts():
    """Returns triggered environmental threshold alerts."""
    return IN_MEMORY_ALERTS
