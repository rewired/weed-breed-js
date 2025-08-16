// Dev-Starter: startet die UI-Bridge und DANN deine normale Simulation.
// ⚠️ Pfade ggf. anpassen, falls dein Entry nicht src/index.js ist.
import { startUIBridge } from "./uiBridge.js";

// Port kannst du frei wählen, im UI ist default 8077 konfiguriert.
startUIBridge({ port: 8077 });

// Danach die Sim booten:
import "./index.js";
