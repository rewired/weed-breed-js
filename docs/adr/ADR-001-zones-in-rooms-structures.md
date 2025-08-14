# ADR-001: Hierarchical World Model (Structure → Room → Zone)

Date: 2025-08-14

## Status

Accepted

## Context

The initial simulation model represented `Zone` objects as top-level entities. This meant that zones existed "in a vacuum," without a clear physical or logical container. This approach posed several problems:

1.  **Lack of Realism**: In a real-world cultivation scenario, growing zones are located within rooms, which are themselves inside a building. The flat model did not capture this reality.
2.  **Scalability Issues**: Managing a large number of independent zones would become difficult without a logical grouping.
3.  **Impossible Invariants**: It was not possible to enforce physical constraints, such as ensuring that the total area of all zones does not exceed the area of the building they are in.
4.  **Ambiguous Cost Allocation**: Overhead costs, such as rent for the building or base costs for a room, could not be logically allocated to the zones within them.

The `architectural_guide.md` had already envisioned a hierarchical model, but it was not yet implemented.

## Decision

We decided to implement a strict hierarchical data model: `Structure → Room → Zone`.

-   A **Structure** is the top-level container, representing a building. It has a `usableArea` and a base rent.
-   A **Room** exists within a `Structure`. It has a defined `area` and its own base costs. The sum of all room areas within a structure cannot exceed the structure's `usableArea`.
-   A **Zone** exists within a **Room**. It has a defined `area`. The sum of all zone areas within a room cannot exceed the room's `area`.
-   Devices and plants remain directly associated with a `Zone`.

This hierarchy is enforced through parent references (`roomId`, `structureId`) stored on child entities and validated upon creation.

## Consequences

### Positive

-   **Improved Model Clarity**: The data model now accurately reflects a realistic physical arrangement.
-   **Enforced Invariants**: The system now validates that the sum of child areas does not exceed the parent's area, preventing impossible physical setups.
-   **Hierarchical Cost Aggregation**: A `getTickCosts()` method on each entity allows for a clear, bottom-up cost roll-up. The total cost of a structure for a tick is the sum of its room costs plus its own base rent, and so on. This provides a much more granular and understandable financial overview.
-   **Contextual Logging**: All logs and events generated from within a zone now carry the full context (`structureId`, `roomId`, `zoneId`), making debugging and analysis significantly easier.
-   **Height Inheritance**: A clear parent-child relationship allows for logical inheritance of properties like `height`, reducing configuration boilerplate. A zone will inherit its height from its room, which in turn inherits from the structure, unless explicitly overridden.

### Negative

-   **Increased Complexity**: The simulation initialization logic is now more complex, as it has to build a nested object graph instead of a flat list.
-   **Stricter Configuration**: The savegame/configuration format is now stricter and requires a nested structure. This is a one-time migration cost.
-   **No More "Orphan" Zones**: It is no longer possible to run a simulation with a zone that is not part of a room and a structure. This is an intentional and desired limitation.
