# Weed-Breed Simulation

This project is a simulation game for breeding and growing weed. It includes a simulation engine that models plant growth, environmental factors, and costs.

## Getting Started

### Prerequisites

*   Node.js (v23 or higher)
*   npm

### Installation

1.  Clone the repository:
    ```sh
    git clone <repository-url>
    ```
2.  Navigate to the project directory:
    ```sh
    cd weed-breed-js-zwo
    ```
3.  Install the dependencies:
    ```sh
    npm install
    ```

### Running the Simulation

To run the main simulation scenario, use the following command:

```sh
npm run sim
```

This will execute the simulation defined in `src/index.js`.

To start the web server and interact with the simulation through the frontend, use:

```sh
npm run dev
```
This runs the server with `node --watch src/server/index.js`.

### Plant Detail View

The frontend includes a plant detail view reachable via the structure tree. Navigate to a zone, open its plant list and select a plant to inspect. The view compares current environmental readings with the strain's preferred ranges, highlights stress factors across plants in the zone and lists all plants for quick navigation.

## Documentation

For more detailed information about the project, please refer to the documentation in the `docs` directory:

*   [Naming Conventions](docs/naming_conventions.md)
*   [Cultivation Method Schema](docs/cultivation_method_schema.md)
*   [Device Schema](docs/device_schema.md)
*   [Strain Prices Schema](docs/strainPrices_schema.md)
*   [Strain Schema](docs/strain_schema.md)
*   [Architectural Decisions](docs/architectural_decisions.md)
*   [Architecture Guide](docs/architectural_guide.md)
