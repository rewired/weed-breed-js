# Weed Breed — Frontend Views Overview

> Clean, structured description of the current UI concept for the simulation frontend.

## Purpose & Scope

This document specifies **what** the frontend shows and **how** the views are organized. It intentionally avoids implementation details beyond module/function names that already exist in the codebase.

---

## Top Bar

**Always visible** at the top of the content area.

* Displays: **Tick**, **Day**, **Simulation Time**, **Account Balance**, **daily Energy** & **Water consumption**.
* Shows **Run/Pause** state and current **speed**.
* Updated by `renderTop` using the live state.
* Controls:

  * **Start / Pause / Step** buttons
  * **Speed selector** (five speeds)
  * Triggers backend actions via HTTP POST and updates local state accordingly.

---

## Modes & Views

The UI is organized into modes. The left tree switches the active mode; the right pane renders the corresponding view.

### Structure Mode

High-level operational views for **Structure → Rooms → Zones → Plants**.

#### Structure View

* KPIs for the **entire site**: per‑tick cost, energy and water consumption.
* Additional KPIs: **Alerts**, **Rooms**, **Zones**.
* **Table: Rooms in Structure** with per‑room columns: Zone count, Plant count, Yield (actual/forecast), Device count, Alert count.

#### Room View

* KPIs for the selected **Room**: Zones, Plants, Devices; energy & water consumption.
* **Table: Zones in Room** with columns: Plant count, **Harvest‑ETA**, Yield (actual/forecast), Device count, Alert count.

#### Zone View

* **Capacity & Occupancy** (slots/used), **dominant growth stage**.
* **Harvest‑ETA** and **Yield forecast**.
* Environment snapshot: **Temperature**, **Humidity**, **CO₂**, **PPFD**.
* **Stress breakdown**, **Plant Packages**, **Device status** (health/flags). Links to the associated device modules.

#### Devices View (Zone)

* **Table: Zone Devices** with columns: Name, Type, **Health**, **Maintenance cost per Tick**.

#### Plants View (Zone Plants)

* **Actual vs Target** environment deltas (Temp, Humidity, CO₂, PPFD).
* **Stress breakdown** (contributors and weights).
* **Plant list** with columns: Strain, Stage, Age, Health, Stress, Stressors.

#### Plant Detail

* KPIs of the selected plant: **Age**, **Health**, **Stress**.
* **Setpoint vs Actual** environment and current **stress factors**.
* **Table: All Plants in Zone** (ID, Strain, Age, Health, Stress) for quick cross‑navigation.

### Company Mode (Overview)

* **Tabs:** 24 h / 7 d / 1 m.
* **Resource consumption:** Energy, Water (aggregated and chart‑ready).
* **Cost breakdown:** Energy, Water, Fertilizer, Rent, Maintenance, CapEx, Other, **Total**.
* **Financial KPIs:** Opening Balance, Closing Balance, Revenue, Net.

### Editor Mode (Strains)

* When **“Strains”** is selected, loads the **Strain Editor module**.
* Otherwise shows an instructional placeholder (“Select an element”).

### Shop Mode

* **Not implemented** yet. A placeholder exists in the tree to reserve structure and URLs.

---

## Layout & Navigation

* **Static HTML/CSS** defines a split view:

  * **Left:** tree navigation with mode toggles (**Structure**, **Company**, **Shop**, **Editor**).
  * **Right:** dynamic content area with **Top Bar**, **Breadcrumbs**, and the **content container** for the active view.

---

## State Management & Live Data

* `state` holds:

  * current selection (**Structure / Room / Zone / Plant**),
  * simulation status & speed,
  * consumption metrics & aggregations,
  * lookup maps for fast ID → entity access.
* **Initial data**: fetched from `GET /simulation/status`.
* **Live updates**: pushed via **WebSocket** and merged through `updateWithLiveData`.
* **Smoothing**: environmental values (e.g., humidity, PPFD) are augmented with rolling/EMA filters for stable UI.

---

## Tree Building & Rendering Flow

* `buildTree` + `nodeLi` dynamically construct the explorer tree for **Structure**, **Company**, and future **Shop / Editor**.
* `selectNode` updates the selection, refreshes **breadcrumbs**, and triggers re‑render of the appropriate view.

---

## Rendering by Hierarchy

* `renderStructureContent` chooses the correct detail level:

  * Structure → KPIs + resource cards + **Rooms table**
  * Room → KPIs + **Zones table**
  * Zone → device/plant summaries (or delegates to the dedicated Zone view)
  * As needed, performs backend calls to hydrate **Zone** or **Plant** details lazily.

### Zone & Plant Detail Views

* `renderZoneOverview` merges live readings with smoothed **Humidity/PPFD**, shows **Stress breakdown**, **Plant Packages**, and **Device status** with deep links.
* `renderPlantDetail` and `renderZonePlantsDetails` render **setpoint vs actual** environment, list of stressors, and anchored plant tables for quick navigation.

### Company & Editor Views

* `renderCompanyContent` provides periodizable aggregates (24 h / 7 d / 1 m) for **consumption**, **cost breakdown**, and **financial position**.
* `renderEditorContent` loads the Strain editor module when **“Strains”** is selected; otherwise shows a helpful placeholder.

---

## Simulation Controls & Top Bar (Behavior)

* The **Top Bar** continuously updates **Tick, Day, Time, Balance** and **today’s consumption**.
* **Run/Pause** state visualization is part of `renderTop`.
* **Start/Pause/Step** and **speed** changes call backend endpoints and update the view in place.

---

## Utility Helpers

* `formatUnits(value, kind)` converts and formats **g↔kg↔t**, **kWh↔MWh**, **L↔m³**, etc., with sensible precision.
* `smoother.js` exports:

  * `makeSmoother` — **EMA** smoothing with **deadband** and **slew‑rate limiting** (great for noisy live readouts).
  * `makeSmooth` — rolling **24‑hour averages** for zone environment series.

---

## Notes & Conventions

* Units follow SI (°C, L, kWh, µmol/m²·s). Percentages are expressed as **0–1** where applicable.
* “ETA” = estimated time to harvest; “KPI” = key performance indicator; “PPFD” = photosynthetic photon flux density.
* All timings are expressed in **Ticks** (simulation time), with a globally defined tick length.
