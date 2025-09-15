# Weed-Breed Simulation

This project is a simulation game for breeding and growing weed. It includes a simulation engine that models plant growth, environmental factors, and costs.

![Weed Breed Splash](docs/images/weed-breed-splash.png "Weed Breed Splash")

## Units

Units are implicit across the data model; field names never contain unit suffixes. Power is in kW, temperature in °C, area in m² and time in hours or days.

## Getting Started

### Prerequisites

* Node.js (v23 or higher)
* npm

### Installation

1. Clone the repository:
    ```sh
    git clone <repository-url>
    ```
    // .
    [.](.)
2. Navigate to the project directory:
    ```sh
    cd weed-breed-js
    ```
    // .
    [.](.)
3. Install the dependencies:
    ```sh
    npm install
    ```
    // package.json
    [package.json](package.json)

### Data Layout

## Testing

Run unit tests and ensure deterministic behaviour:

```sh
npm test
```

Validate bundled data files:

```sh
npm run validate:data
```

The simulation uses seedable random number generators. Provide the same seed to repeat runs deterministically.

Strain and device definitions are split into drafts and published variants. The server writes backups before overwriting files.

```
data/
  drafts/
    strains/
    devices/
  published/
    strains/
    devices/
  backups/
```

Set environment variables in `.env` to customize paths and retention:

```
WB_DATA_DIR=./data
WB_BACKUP_RETENTION_DAYS=30
```

### Running the Simulation

To run the main simulation scenario, use the following command:

```sh
npm run sim
```
// src/demos/structure_rooms_zones_demo.js
[src/demos/structure_rooms_zones_demo.js](src/demos/structure_rooms_zones_demo.js)

This will execute the simulation defined in `src/index.js`.

To start the web server and frontend during development run two processes:

```sh
npm run dev:server
npm run dev:client
```
// src/server/index.mjs
[src/server/index.mjs](src/server/index.mjs)

The server listens on [http://localhost:7071](http://localhost:7071) and the client on [http://localhost:5173](http://localhost:5173).
Socket.IO uses the path `/ui`.

Simulation can be controlled via Socket.IO events (`sim.control`, `sim.step`, `sim.speed`) or HTTP endpoints under `/api/sim` (`POST start|pause|step|speed`).
Set `ALLOW_UNSAFE_CONTROL=false` to disable these endpoints in production.

Opening `apps/client/index.html` directly in the browser will not load the
modules correctly; always use the dev server or a production build.

### Logging

The default log level is conservative (`warn`) to keep the console output tidy.
When you need more insight for debugging, raise the verbosity by setting
`LOG_LEVEL`:

```sh
LOG_LEVEL=debug npm run dev
```

### Plant Detail View

The frontend includes a plant detail view reachable via the structure tree. Navigate to a zone, open its plant list and select a plant to inspect. The view compares current environmental readings with the strain's preferred ranges, highlights stress factors across plants in the zone and lists all plants for quick navigation.

## Documentation

See the consolidated [documentation](docs/README.md) for architecture, data model, frontend and reference guides.
