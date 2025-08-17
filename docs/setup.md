# Setup

## Voraussetzungen

- Node.js v22.18.0
- npm v11.4.2
- keine weiteren globalen Tools notwendig

## Installation

```bash
git clone <REPO_URL>
cd weed-breed-js
npm install
```

## Starten

- Simulation: `npm run sim`
- Server mit Hot Reload: `npm run dev`

## Standard-Umgebungsvariablen

- `PORT` – Port des Servers, Standardwert `3000`
- `SSE_ALLOW_ORIGIN` – erlaubter Origin für Server-Sent Events, Standardwert `http://localhost:5173`
