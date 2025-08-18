/**
 * Development entry point that starts the UI bridge and then the simulation.
 * Adjust paths if your entry is not `src/index.js`.
 * @module devStartWithUI
 */
import { startUIBridge } from "./uiBridge.js";

// Port kannst du frei wählen, im UI ist default 8077 konfiguriert.
startUIBridge({ port: 8077 });

// Danach die Sim booten:
import "./index.js";
