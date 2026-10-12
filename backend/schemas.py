"""
GeoLens API Data Transfer Objects & Schemas
"""

from typing import List, Optional, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, Field

class PolygonGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]] = Field(
        ...,
        description="GeoJSON coordinates array [[[lng, lat], [lng, lat], ...]]"
    )

class RegionCreate(BaseModel):
    name: str = Field(..., example="Amazon Tapajós Monitoring Basin")
    description: Optional[str] = None
    biome_type: Optional[str] = Field("Tropical Rainforest", example="Tropical Rainforest")
    boundary: PolygonGeometry
    tags: Optional[List[str]] = []

class RegionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    area_km2: float
    biome_type: Optional[str]
    created_at: datetime
    boundary: PolygonGeometry

class NDVIAnalysisRequest(BaseModel):
    region_id: Optional[str] = None
    coordinates: Optional[List[List[float]]] = None
    date_t1: date = Field(..., example="2018-09-15")
    date_t2: date = Field(..., example="2026-09-18")
    max_cloud_cover_pct: float = Field(15.0, description="Cloud cover filter threshold")

class SpectralBandData(BaseModel):
    observation_date: date
    data_source: str = "Copernicus Sentinel-2 L2A via Sentinel Hub"
    nir_band: float
    red_band: float
    ndvi: float
    cloud_cover_pct: float

class NDVIAnalysisResponse(BaseModel):
    date_t1: SpectralBandData
    date_t2: SpectralBandData
    delta_ndvi: float
    percentage_change: float
    classification: str
    seasonal_guardrail: Dict[str, Any]
    vulnerability_index: Dict[str, Any]
    area_km2: float
    citation: str = "Sentinel-2 L2A Harmonized Surface Reflectance (Copernicus/ESA)"

class WeatherHistoryResponse(BaseModel):
    latitude: float
    longitude: float
    start_date: date
    end_date: date
    data_source: str = "Open-Meteo Historical Weather API (ERA5/ECMWF Reanalysis)"
    is_live: bool
    precipitation_sum_mm: float
    precipitation_anomaly_pct: float
    soil_moisture_0_7cm_mean: float
    avg_temperature_c: float
    monthly_series: List[Dict[str, Any]]

class AlertRuleCreate(BaseModel):
    region_id: str
    metric_name: str
    operator: str
    threshold_value: float
    notification_channel: Optional[str] = "IN_APP"

class AlertLogResponse(BaseModel):
    id: int
    region_id: str
    metric_name: str
    triggered_at: datetime
    observed_value: float
    threshold_value: float
    message: str
    severity: str
    is_read: bool
