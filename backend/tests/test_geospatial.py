"""
Unit and Integration Tests for GeoLens Backend
Tests mathematical accuracy of:
- Spectral NDVI formula
- Delta-NDVI and category assignment
- Seasonal vs. True Loss Guardrail decision logic
- Spherical Polygon Area calculation
- Vulnerability Index compounding & metadata
"""

import unittest
import math
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.geospatial import (
    calculate_ndvi,
    calculate_delta_ndvi,
    seasonal_vs_true_loss_guardrail,
    calculate_polygon_area_km2,
    calculate_vulnerability_index
)

class TestGeoSpatialCalculations(unittest.TestCase):

    def test_calculate_ndvi_healthy_canopy(self):
        # NIR = 0.60, RED = 0.10 -> (0.6 - 0.1) / (0.6 + 0.1) = 0.5 / 0.7 = 0.7143
        result = calculate_ndvi(0.60, 0.10)
        self.assertAlmostEqual(result, 0.7143, places=3)
        self.assertGreater(result, 0.5)

    def test_calculate_ndvi_water_bare_soil(self):
        # Water/deep moisture reflects very little NIR
        water_ndvi = calculate_ndvi(0.05, 0.15)
        self.assertLess(water_ndvi, 0.0)

        # Zero denominator safety
        zero_res = calculate_ndvi(0.0, 0.0)
        self.assertEqual(zero_res, 0.0)

    def test_delta_ndvi_classification(self):
        # Severe loss
        res_loss = calculate_delta_ndvi(0.75, 0.40)
        self.assertEqual(res_loss["delta"], -0.35)
        self.assertEqual(res_loss["classification"], "SEVERE_LOSS")
        self.assertEqual(res_loss["severity"], "CRITICAL")

        # Stable
        res_stable = calculate_delta_ndvi(0.60, 0.62)
        self.assertEqual(res_stable["classification"], "STABLE")

        # Recovery
        res_rec = calculate_delta_ndvi(0.40, 0.60)
        self.assertEqual(res_rec["classification"], "SIGNIFICANT_RECOVERY")

    def test_seasonal_vs_true_loss_guardrail_dry_season(self):
        # Drought condition: -28% NDVI, -45% rainfall anomaly, low soil moisture
        guardrail = seasonal_vs_true_loss_guardrail(
            delta_ndvi=-0.28,
            rainfall_anomaly_pct=-45.0,
            soil_moisture_pct=22.0,
            dry_season_active=True
        )
        self.assertEqual(guardrail["flag"], "SEASONAL_DROUGHT_ADVISORY")
        self.assertFalse(guardrail["is_permanent_loss"])
        self.assertIn("transient", guardrail["advisory"].lower())

    def test_seasonal_vs_true_loss_guardrail_true_deforestation(self):
        # Deforestation condition: -30% NDVI, but rainfall was normal/positive (+10%)
        guardrail = seasonal_vs_true_loss_guardrail(
            delta_ndvi=-0.30,
            rainfall_anomaly_pct=10.0,
            soil_moisture_pct=45.0,
            dry_season_active=False
        )
        self.assertEqual(guardrail["flag"], "CONFIRMED_CANOPY_LOSS")
        self.assertTrue(guardrail["is_permanent_loss"])
        self.assertTrue("anthropogenic" in guardrail["advisory"].lower() or "clearing" in guardrail["advisory"].lower())

    def test_polygon_area_equatorial_bounding_box(self):
        # 1 degree x 1 degree box at equator: [-55.0, 0.0] to [-54.0, 1.0]
        # Approx 111.32 km x 110.57 km ≈ 12,300 km²
        coords = [
            [-55.0, 0.0],
            [-54.0, 0.0],
            [-54.0, 1.0],
            [-55.0, 1.0],
            [-55.0, 0.0]
        ]
        area = calculate_polygon_area_km2(coords)
        self.assertGreater(area, 11000.0)
        self.assertLess(area, 13000.0)

    def test_vulnerability_index_bounds_and_disclaimer(self):
        result = calculate_vulnerability_index(
            ndvi_current=0.35,
            ndvi_loss_pct=-32.0,
            rainfall_volatility_pct=45.0,
            soil_moisture_pct=18.0,
            terrain_slope_deg=25.0
        )
        score = result["vulnerability_score"]
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)
        self.assertIn("disclaimer", result)
        self.assertIn("statistical correlations", result["disclaimer"])

if __name__ == '__main__':
    unittest.main()
