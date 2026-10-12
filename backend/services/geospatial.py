"""
GeoLens Geospatial & Spectral Computation Engine
Implements:
1. Normalized Difference Vegetation Index (NDVI = (NIR - RED) / (NIR + RED))
2. Delta-NDVI and canopy change classification
3. Seasonal vs. True Loss Guardrail (correlating rainfall anomaly with spectral change)
4. Spherical Polygon Geodesic Area Calculation (km²)
5. Composite Environmental Vulnerability Score (0-100)
"""

import math
from typing import List, Tuple, Dict, Any

EARTH_RADIUS_KM = 6371.0088

def calculate_ndvi(nir: float, red: float) -> float:
    """
    Computes Normalized Difference Vegetation Index:
    NDVI = (NIR - RED) / (NIR + RED)
    Enforces valid range [-1.0, 1.0].
    """
    denominator = nir + red
    if abs(denominator) < 1e-7:
        return 0.0
    val = (nir - red) / denominator
    return max(-1.0, min(1.0, round(val, 4)))

def calculate_delta_ndvi(ndvi_t1: float, ndvi_t2: float) -> Dict[str, Any]:
    """
    Calculates change between two observation epochs (T2 - T1).
    Classifies ecological impact.
    """
    delta = round(ndvi_t2 - ndvi_t1, 4)
    pct_change = round((delta / ndvi_t1) * 100, 2) if abs(ndvi_t1) > 1e-5 else 0.0

    if delta <= -0.25:
        category = "SEVERE_LOSS"
        severity = "CRITICAL"
    elif delta <= -0.10:
        category = "MODERATE_LOSS"
        severity = "WARNING"
    elif delta >= 0.15:
        category = "SIGNIFICANT_RECOVERY"
        severity = "POSITIVE"
    elif delta >= 0.05:
        category = "MODEST_GROWTH"
        severity = "POSITIVE"
    else:
        category = "STABLE"
        severity = "NEUTRAL"

    return {
        "ndvi_t1": ndvi_t1,
        "ndvi_t2": ndvi_t2,
        "delta": delta,
        "percentage_change": pct_change,
        "classification": category,
        "severity": severity
    }

def seasonal_vs_true_loss_guardrail(
    delta_ndvi: float,
    rainfall_anomaly_pct: float,
    soil_moisture_pct: float,
    dry_season_active: bool = False
) -> Dict[str, Any]:
    """
    Guardrail to prevent misclassifying seasonal drought as permanent deforestation.
    If rainfall is severely below normal (-30% or more) and it is the regional dry season,
    the NDVI drop is likely phenological/seasonal.
    """
    if delta_ndvi >= -0.05:
        return {
            "flag": "NO_DEGRADATION",
            "is_permanent_loss": False,
            "confidence_pct": 95.0,
            "advisory": "Vegetation index indicates stable or expanding canopy cover."
        }

    # Significant NDVI decline detected. Now evaluate meteorology:
    if rainfall_anomaly_pct <= -25.0 and (dry_season_active or soil_moisture_pct < 28.0):
        confidence = round(max(50.0, 85.0 - abs(delta_ndvi) * 30), 1)
        return {
            "flag": "SEASONAL_DROUGHT_ADVISORY",
            "is_permanent_loss": False,
            "confidence_pct": confidence,
            "advisory": (
                f"Observed NDVI decline ({delta_ndvi:+.3f}) strongly correlates with a seasonal "
                f"rainfall deficit ({rainfall_anomaly_pct:+.1f}%) and low soil moisture ({soil_moisture_pct:.1f}%). "
                "Vegetation senescence is likely transient. Recommend follow-up audit in wet season."
            )
        }
    else:
        confidence = round(min(98.0, 75.0 + abs(delta_ndvi) * 50), 1)
        return {
            "flag": "CONFIRMED_CANOPY_LOSS",
            "is_permanent_loss": True,
            "confidence_pct": confidence,
            "advisory": (
                f"High-confidence canopy loss ({delta_ndvi:+.3f}) detected independent of precipitation anomalies "
                f"({rainfall_anomaly_pct:+.1f}%). Consistent with mechanical clearing, infrastructure encroachment, or severe wildfire."
            )
        }

def calculate_polygon_area_km2(coordinates: List[List[float]]) -> float:
    """
    Calculates the geodesic spherical surface area of a polygon in square kilometers.
    Coordinates format: [[lng, lat], [lng, lat], ...] (WGS84 EPSG:4326)
    """
    if not coordinates or len(coordinates) < 3:
        return 0.0

    # Ensure closed polygon
    ring = list(coordinates)
    if ring[0] != ring[-1]:
        ring.append(ring[0])

    total = 0.0
    num_points = len(ring) - 1
    if num_points < 3:
        return 0.0

    # Spherical Excess formula
    for i in range(num_points):
        p1 = ring[i]
        p2 = ring[i + 1]
        lon1 = math.radians(p1[0])
        lat1 = math.radians(p1[1])
        lon2 = math.radians(p2[0])
        lat2 = math.radians(p2[1])

        total += (lon2 - lon1) * (2.0 + math.sin(lat1) + math.sin(lat2))

    area_sq_rad = abs(total) / 2.0
    area_km2 = area_sq_rad * (EARTH_RADIUS_KM ** 2)
    return round(area_km2, 2)

def calculate_vulnerability_index(
    ndvi_current: float,
    ndvi_loss_pct: float,
    rainfall_volatility_pct: float,
    soil_moisture_pct: float,
    terrain_slope_deg: float = 12.0
) -> Dict[str, Any]:
    """
    Composite Environmental Vulnerability Score (0-100).
    Components:
    - Canopy Volatility (35%)
    - Hydrological Instability (30%)
    - Soil Moisture Depletion (20%)
    - Slope/Topographic Risk (15%)
    """
    # Canopy factor (0-100): lower NDVI or larger loss = higher vulnerability
    canopy_score = min(100.0, max(0.0, (1.0 - ndvi_current) * 60.0 + max(0.0, -ndvi_loss_pct) * 1.2))
    
    # Hydrology factor (0-100): high rainfall volatility = high flood/landslide risk
    hydro_score = min(100.0, max(0.0, abs(rainfall_volatility_pct) * 1.5))
    
    # Soil factor (0-100): dry soil = erosion risk; oversaturated = slide risk
    soil_score = min(100.0, max(0.0, (100.0 - soil_moisture_pct) * 0.9 if soil_moisture_pct < 40 else (soil_moisture_pct - 60) * 1.8))
    
    # Terrain factor (0-100): steeper slopes amplify runoff and slides
    terrain_score = min(100.0, max(0.0, (terrain_slope_deg / 45.0) * 100.0))

    composite = (
        canopy_score * 0.35 +
        hydro_score * 0.30 +
        soil_score * 0.20 +
        terrain_score * 0.15
    )
    score = int(round(composite))
    score = max(0, min(100, score))

    if score >= 75:
        level = "CRITICAL"
        color = "#f85149"
    elif score >= 50:
        level = "HIGH"
        color = "#f0883e"
    elif score >= 30:
        level = "MODERATE"
        color = "#e3b341"
    else:
        level = "LOW"
        color = "#3fb950"

    return {
        "vulnerability_score": score,
        "risk_level": level,
        "color_code": color,
        "sub_indices": {
            "canopy_loss_stress": round(canopy_score, 1),
            "rainfall_volatility": round(hydro_score, 1),
            "soil_depletion": round(soil_score, 1),
            "terrain_instability": round(terrain_score, 1)
        },
        "disclaimer": "Highlighted relationships represent statistical correlations and spatial overlap for investigation—not definitive causal proof."
    }
