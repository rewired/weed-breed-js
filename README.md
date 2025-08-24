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
    cd weed-breed-js-zwo
    ```
    // .
    [.](.)
3. Install the dependencies:
    ```sh
    npm install
    ```
    // package.json
    [package.json](package.json)

### Running the Simulation

To run the main simulation scenario, use the following command:

```sh
npm run sim
```
// src/demos/structure_rooms_zones_demo.js
[src/demos/structure_rooms_zones_demo.js](src/demos/structure_rooms_zones_demo.js)

This will execute the simulation defined in `src/index.js`.

To start the web server and interact with the simulation through the frontend, use:

```sh
npm run dev
```
// src/server/index.js
[src/server/index.js](src/server/index.js)

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
