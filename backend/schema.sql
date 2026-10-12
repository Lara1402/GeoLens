-- ============================================================================
-- GeoLens – Geospatial Environmental Intelligence Platform
-- PostgreSQL 14+ / PostGIS 3+ Spatial Database Schema & Migrations
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Saved User Regions of Interest (ROI)
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    area_km2 NUMERIC(10, 2) GENERATED ALWAYS AS (ST_Area(boundary::geography) / 1000000.0) STORED,
    biome_type VARCHAR(100),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Environmental Observations Cache
CREATE TABLE IF NOT EXISTS observations (
    id BIGSERIAL PRIMARY KEY,
    region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL,
    data_source VARCHAR(100) NOT NULL,
    ndvi_mean NUMERIC(4, 3),
    ndwi_mean NUMERIC(4, 3),
    nir_band_reflectance NUMERIC(4, 3),
    red_band_reflectance NUMERIC(4, 3),
    precipitation_mm NUMERIC(6, 2),
    soil_moisture_0_7cm NUMERIC(5, 2),
    soil_moisture_7_28cm NUMERIC(5, 2),
    avg_temp_c NUMERIC(4, 1),
    cloud_cover_pct NUMERIC(4, 1),
    seasonal_anomaly_flag BOOLEAN DEFAULT FALSE,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(region_id, observation_date, data_source)
);

-- 3. User Configured Alert Thresholds
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
    metric_name VARCHAR(50) NOT NULL CHECK (metric_name IN ('NDVI', 'PRECIPITATION', 'SOIL_MOISTURE', 'VULNERABILITY_SCORE')),
    operator VARCHAR(2) NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '==')),
    threshold_value NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    notification_channel VARCHAR(50) DEFAULT 'IN_APP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Triggered System Alerts
CREATE TABLE IF NOT EXISTS alert_logs (
    id BIGSERIAL PRIMARY KEY,
    alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
    region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observed_value NUMERIC(10, 2) NOT NULL,
    threshold_value NUMERIC(10, 2) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    is_read BOOLEAN DEFAULT FALSE
);

-- 5. Spatial and Temporal Indexes
CREATE INDEX IF NOT EXISTS idx_regions_geo ON regions USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_obs_region_date ON observations (region_id, observation_date DESC);
CREATE INDEX IF NOT EXISTS idx_obs_source ON observations (data_source);
CREATE INDEX IF NOT EXISTS idx_alert_logs_read ON alert_logs (is_read, triggered_at DESC);

-- 6. Seed Sample Baseline Region (Amazon Basin Sample Sector)
INSERT INTO regions (id, name, description, boundary, biome_type)
VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Amazon Tapajós Monitoring Basin',
    'High-resolution rainforest canopy and riparian buffer monitoring polygon.',
    ST_GeomFromText('POLYGON((-55.20 -3.10, -54.80 -3.10, -54.80 -2.70, -55.20 -2.70, -55.20 -3.10))', 4326),
    'Tropical Rainforest'
) ON CONFLICT (id) DO NOTHING;

-- 7. Seed Sample Observations
INSERT INTO observations (region_id, observation_date, data_source, ndvi_mean, ndwi_mean, nir_band_reflectance, red_band_reflectance, precipitation_mm, soil_moisture_0_7cm, avg_temp_c, cloud_cover_pct)
VALUES 
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '2018-09-15',
    'Copernicus Sentinel-2 L2A',
    0.824,
    0.340,
    0.540,
    0.052,
    195.4,
    42.8,
    27.3,
    4.1
),
(
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '2026-09-18',
    'Copernicus Sentinel-2 L2A',
    0.558,
    0.180,
    0.390,
    0.110,
    112.0,
    28.2,
    29.7,
    6.8
) ON CONFLICT (region_id, observation_date, data_source) DO NOTHING;
