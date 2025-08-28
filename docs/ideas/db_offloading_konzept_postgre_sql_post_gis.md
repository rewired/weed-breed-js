# DB Offloading Concept: PostgreSQL + PostGIS for **Weed Breed**

*Status:* Concept sketch (as of 2025‑08‑28)

## TL;DR

* The **core tick loop** (plant physics, RNG determinism, device states) stays in Node — deterministic, step‑able (single‑step), testable.
* **PostGIS** handles geometry/layout; **SQL** handles capacities & reporting (aggregations, window functions, materialized views).
* Goal: validation, coverage KPIs, planning features, reports — database‑side and performant.

## Candidates for Offloading

1. **Geometry & Layout (PostGIS)**
   Containment (Zone ⊂ Room ⊂ Structure), disjointness, areas/volumes (generated columns), lamp/HVAC coverage (buffer/union/difference → dark spots), simple planning optimization (lamp count given overlap X).

2. **Capacities & Slots (SQL)**
   `plantSlots = floor(zone.area / method.areaPerPlant) * packingFactor`, aisle losses, container requirements.

3. **KPIs & Reports (SQL/MatViews)**
   End‑of‑day snapshots from tick logs (window/DISTINCT ON), `firstHarvestDay`/`lastHarvestDay`, yield per m², OPEX/day, mean/quantiles for market prices & maintenance.

4. **What‑if / Off‑Core**
   Device replacement timing (maintenance curves), price smoothing, occupancy scenarios.

---

## Minimal Schema Draft (excerpt)

```sql
-- Requires: CREATE EXTENSION postgis;
CREATE TABLE structures(
  id uuid PRIMARY KEY,
  name text NOT NULL,
  geom geometry(Polygon, 3857) NOT NULL,
  area_m2 double precision GENERATED ALWAYS AS (ST_Area(geom)) STORED
);

CREATE TABLE rooms(
  id uuid PRIMARY KEY,
  structure_id uuid REFERENCES structures(id) ON DELETE CASCADE,
  name text NOT NULL,
  height_m double precision NOT NULL CHECK(height_m>0),
  geom geometry(Polygon, 3857) NOT NULL,
  area_m2 double precision GENERATED ALWAYS AS (ST_Area(geom)) STORED,
  volume_m3 double precision GENERATED ALWAYS AS (ST_Area(geom)*height_m) STORED
);

CREATE TABLE zones(
  id uuid PRIMARY KEY,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  height_m double precision NOT NULL CHECK(height_m>0),
  geom geometry(Polygon, 3857) NOT NULL,
  area_m2 double precision GENERATED ALWAYS AS (ST_Area(geom)) STORED,
  volume_m3 double precision GENERATED ALWAYS AS (ST_Area(geom)*height_m) STORED
);

CREATE TABLE devices(
  id uuid PRIMARY KEY,
  zone_id uuid REFERENCES zones(id) ON DELETE CASCADE,
  kind text NOT NULL,             -- 'Lamp','ClimateUnit',...
  position geometry(Point, 3857), -- optional per kind
  coverage_area_m2 double precision
);
```

## Validation & Coverage (sketch)

```sql
-- Zone‑in‑Room disjointness/containment checks: separate function/trigger
-- (see full schema.sql in the implementation)

CREATE OR REPLACE FUNCTION lamp_buffer_geom(dev_id uuid)
RETURNS geometry LANGUAGE sql IMMUTABLE AS $$
  SELECT ST_Buffer(d.position, sqrt(d.coverage_area_m2 / pi()))
  FROM devices d WHERE d.id = dev_id AND d.kind = 'Lamp';
$$;

CREATE OR REPLACE FUNCTION zone_light_coverage(p_zone uuid)
RETURNS TABLE(coverage_ratio double precision, covered_area_m2 double precision,
              zone_area_m2 double precision, uncovered_geom geometry)
LANGUAGE plpgsql AS $$
-- 1) zgeom = zone polygon, 2) cov_geom = ST_Union(buffer of all lamps),
-- 3) KPIs + ST_Difference(zgeom, cov_geom) for dark spots
BEGIN
  -- implementation in full schema.sql
  RETURN;
END$$;

CREATE OR REPLACE FUNCTION recommend_lamp_count(
  p_zone uuid, p_lamp_coverage_m2 double precision, p_overlap_ratio double precision DEFAULT 0.15
) RETURNS integer LANGUAGE sql AS $$
  WITH z AS (SELECT area_m2 FROM zones WHERE id = p_zone)
  SELECT CEIL(z.area_m2 / (p_lamp_coverage_m2 * GREATEST(0, 1 - p_overlap_ratio)))::int FROM z;
$$;
```

## KPIs & Daily Snapshots (pattern)

```sql
-- End‑of‑day snapshot per zone (fix for the "day1 >> total" anomaly)
WITH eod AS (
  SELECT DISTINCT ON (zone_id, day)
         zone_id, day, tick, biomass_g, buds_g
  FROM tick_log
  ORDER BY zone_id, day, tick DESC
)
SELECT * FROM eod;

-- Harvest window
WITH h AS (
  SELECT zone_id, day FROM tick_log WHERE harvested_buds_g > 0 GROUP BY zone_id, day
)
SELECT zone_id,
       MIN(day) AS firstHarvestDay,
       MAX(day) AS lastHarvestDay,
       COUNT(*) AS harvestEvents
FROM h GROUP BY zone_id;
```

## Node.js Adapter (ESM)

```js
// src/db/spatialPlanner.mjs
// Purpose: Call PostGIS helper functions from the sim or planning API.
import { Pool } from 'pg';

export class SpatialPlanner {
  /** @param {Pool} pool */
  constructor(pool) { this.pool = pool; }

  /** Recommend number of lamps for a zone. */
  async recommendLamps(zoneId, coverageM2, overlap = 0.15) {
    const { rows } = await this.pool.query(
      'SELECT recommend_lamp_count($1::uuid,$2::float8,$3::float8) AS n',
      [zoneId, coverageM2, overlap]
    );
    return rows[0]?.n ?? 0;
    }

  /** Compute coverage KPIs + uncovered areas as GeoJSON (nullable). */
  async zoneLightCoverage(zoneId) {
    const { rows } = await this.pool.query(
      `SELECT coverage_ratio, covered_area_m2, zone_area_m2,
              CASE WHEN uncovered_geom IS NULL OR ST_IsEmpty(uncovered_geom)
                   THEN NULL ELSE ST_AsGeoJSON(uncovered_geom) END AS gaps
         FROM zone_light_coverage($1::uuid)`, [zoneId]
    );
    const r = rows[0] || {};
    return {
      coverageRatio: Number(r.coverage_ratio || 0),
      coveredAreaM2: Number(r.covered_area_m2 || 0),
      zoneAreaM2: Number(r.zone_area_m2 || 0),
      uncoveredGeoJSON: r.gaps || null
    };
  }
}
```

## Decisions & Assumptions

* CRS: `EPSG:3857` (metric, sufficient for indoor use; switch to local ENU only if needed).
* Tick logs may live in PG (optional). If external, ingest via `COPY` for reporting.
* Node remains the source of truth for state; DB calls are synchronous only for planning/reporting.

## Next Steps

* [ ] Finish `schema.sql` (triggers for containment/disjointness).
* [ ] Integrate migration script (`npm run db:migrate`).
* [ ] API: `GET /zones/:id/coverage`, `GET /zones/:id/recommend-lamps`.
* [ ] Optional: materialized views for KPIs (nightly refresh).
* [ ] Load tests with realistic zone/lamp layouts.
