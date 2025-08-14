import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from '../lib/logger.js';
import { createActor } from 'xstate';
import fs from 'fs';
import { uiStream$ } from '../sim/eventBus.js';
import { initializeSimulation } from '../sim/simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// --- Simulation State ---
let simulationState = {
  zones: [], // Changed from zone: null
  costEngine: null,
  rng: null,
  tickMachineLogic: null,
  intervalId: null,
  status: 'stopped', // 'running', 'paused'
  tickCounter: 0,
};

const speedPresets = {
  slow: 30,   // 30 seconds per sim-day
  normal: 22, // 22 seconds per sim-day
  fast: 12,   // 12 seconds per sim-day
  turbo: 4,   // 4 seconds per sim-day
  insane: 0.1, // for testing
};

// --- Simulation Tick Runner ----------------------------------------------
async function _runSimulationTick() {
  const { zones, costEngine, tickMachineLogic } = simulationState;
  const absoluteTick = (costEngine._tickCounter || 0) + 1;
  costEngine.startTick(absoluteTick);

  for (const zone of zones) {
    const tickActor = createActor(tickMachineLogic, {
      input: {
        zone,
        tick: absoluteTick,
        tickLengthInHours: zone.tickLengthInHours,
        logger,
      },
    });

    await new Promise((resolve) => {
      tickActor.subscribe((snapshot) => {
        if (snapshot.status === 'done') {
          resolve(snapshot);
        }
      });
      tickActor.start();
    });
  }

  costEngine.commitTick();
  simulationState.tickCounter = absoluteTick;
}

function _broadcastStatusUpdate() {
  const { zones, costEngine } = simulationState;
  if (!zones.length) return;

  const tickTotals = costEngine.getTotals();
  const absoluteTick = simulationState.tickCounter;
  const representativeZone = zones[0];
  const tickLengthInHours = representativeZone.tickLengthInHours;
  const ticksPerDay = 24 / tickLengthInHours;

  const dailyEnergyKWh = tickTotals.energyKWh * ticksPerDay;
  const dailyWaterL = tickTotals.waterL * ticksPerDay;

  // --- Zone Summary Calculation ---
  const zoneSummaries = zones.map(zone => {
    if (zone.plants.length === 0) {
      return { name: zone.name, plantCount: 0 };
    }
    const p0 = zone.plants[0];
    const vegDays = p0.strain?.photoperiod?.vegetationDays ?? 21;
    const flowerDays = p0.strain?.photoperiod?.floweringDays ?? 56;
    const HARVEST_READY_HOURS = 24 * (vegDays + flowerDays);

    const avgHealth = zone.plants.reduce((sum, p) => sum + p.health, 0) / zone.plants.length;
    const expectedYield = zone.plants.reduce((sum, p) => sum + p.calculateYield(), 0);
    const remainingHours = zone.plants.map(p => Math.max(0, HARVEST_READY_HOURS - p.ageHours));
    const avgRemainingHours = remainingHours.reduce((sum, h) => sum + h, 0) / remainingHours.length;
    const timeToHarvest = Math.round(avgRemainingHours / 24);

    return {
      id: zone.id,
      name: zone.name,
      strainName: p0.strain?.name,
      plantCount: zone.plants.length,
      avgHealth: (avgHealth * 100).toFixed(0),
      expectedYield: expectedYield.toFixed(2),
      timeToHarvest: timeToHarvest,
      temperatureC: zone.status.temperatureC,
      humidity: zone.status.humidity,
      co2ppm: zone.status.co2ppm,
    };
  });

  // Broadcast update to all connected clients
  const statusUpdate = {
    tick: absoluteTick,
    time: new Date(simulationState.tickCounter * tickLengthInHours * 60 * 60 * 1000).toISOString().substr(11, 8),
    day: Math.floor((simulationState.tickCounter * tickLengthInHours) / 24) + 1,
    balance: (costEngine.getGrandTotals().finalBalanceEUR ?? 0).toFixed(2),
    zoneSummaries, // Changed from zoneSummary
    dailyEnergyKWh: dailyEnergyKWh.toFixed(2),
    dailyWaterL: dailyWaterL.toFixed(2),
    ...tickTotals
  };

  logger.info({ tick: absoluteTick, zones: zoneSummaries.length }, 'Broadcasting update to clients');
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(statusUpdate));
    }
  });
}


async function runTick() {
  await _runSimulationTick();
  _broadcastStatusUpdate();
}

async function runDayAsBatch() {
  const { zones } = simulationState;
  if (!zones.length) return;

  const ticksPerDay = Math.round(24 / zones[0].tickLengthInHours);
  for (let i = 0; i < ticksPerDay; i++) {
    await _runSimulationTick();
  }
  _broadcastStatusUpdate();
}


// --- API Endpoints ----------------------------------------------------------
app.post('/simulation/start', async (req, res) => {
  if (simulationState.status === 'running') {
    return res.status(400).send({ message: 'Simulation is already running.' });
  }

  const { preset = 'normal', savegame = 'default', difficulty = 'normal' } = req.body;
  const realSecondsPerSimDay = speedPresets[preset] || speedPresets.normal;

  try {
    const { zones, costEngine, rng, tickMachineLogic } = await initializeSimulation(savegame, difficulty);

    simulationState = {
      ...simulationState,
      zones,
      costEngine,
      rng,
      tickMachineLogic,
      status: 'running',
      tickCounter: 0,
    };

    const ticksPerSimDay = 24 / zones[0].tickLengthInHours;
    let tickIntervalMs;
    let tickHandler;

    if (preset === 'insane') {
      tickIntervalMs = speedPresets.insane * 1000;
      tickHandler = runDayAsBatch;
    } else {
      tickIntervalMs = (realSecondsPerSimDay / ticksPerSimDay) * 1000;
      tickHandler = runTick;
    }

    simulationState.intervalId = setInterval(tickHandler, tickIntervalMs);

    res.status(200).send({ message: `Simulation started with preset: ${preset}, found ${zones.length} zones.` });
  } catch (err) {
    logger.error({ err }, 'Error starting simulation');
    res.status(500).send({ message: 'Failed to start simulation.' });
  }
});

app.post('/simulation/pause', (req, res) => {
  if (simulationState.status !== 'running') {
    return res.status(400).send({ message: 'Simulation is not running.' });
  }
  clearInterval(simulationState.intervalId);
  simulationState.status = 'paused';
  res.status(200).send({ message: 'Simulation paused.' });
});

app.post('/simulation/resume', (req, res) => {
  if (simulationState.status !== 'paused') {
    return res.status(400).send({ message: 'Simulation is not paused.' });
  }
  const { preset = 'normal' } = req.body;
  const realSecondsPerSimDay = speedPresets[preset] || speedPresets.normal;
  const ticksPerSimDay = 24 / simulationState.zones[0].tickLengthInHours;

  let tickIntervalMs;
  let tickHandler;

  if (preset === 'insane') {
    tickIntervalMs = speedPresets.insane * 1000;
    tickHandler = runDayAsBatch;
  } else {
    tickIntervalMs = (realSecondsPerSimDay / ticksPerSimDay) * 1000;
    tickHandler = runTick;
  }

  simulationState.intervalId = setInterval(tickHandler, tickIntervalMs);
  simulationState.status = 'running';
  res.status(200).send({ message: 'Simulation resumed.' });
});

app.get('/simulation/status', (req, res) => {
  if (!simulationState.zones.length) {
    return res.status(404).send({ message: 'Simulation not started.' });
  }
  const { zones, costEngine, status, tickCounter } = simulationState;
  const zone = zones[0]; // Temporary
  res.status(200).send({
    status,
    tick: tickCounter,
    time: new Date(tickCounter * zone.tickLengthInHours * 60 * 60 * 1000).toISOString().substr(11, 8),
    day: Math.floor((tickCounter * zone.tickLengthInHours) / 24) + 1,
    balance: (costEngine.getGrandTotals().finalBalanceEUR ?? 0).toFixed(2),
    zone: zone.status, // Temporary
  });
});

app.get('/api/zone/details', (req, res) => {
  if (simulationState.status === 'stopped' || !simulationState.zones.length) {
    return res.status(404).send({ message: 'Simulation not running or zone not found.' });
  }

  const { zones, costEngine } = simulationState;
  const zone = zones[0]; // Temporary, for now just show the first zone

  const devices = zone.devices.map(d => {
    const maintenanceCost = costEngine.devicePriceMap.get(d.blueprintId)?.baseMaintenanceCostPerTick ?? 0;
    return {
      id: d.id,
      name: d.name,
      kind: d.kind,
      status: d.status,
      powerConsumptionKW: d.settings.power,
      maintenanceCostPerTick: maintenanceCost,
    };
  });

  const plants = zone.plants.map(p => ({
    id: p.id.slice(0, 8),
    stage: p.stage,
    health: (p.health * 100).toFixed(1),
    stress: (p.stress * 100).toFixed(1),
    stressors: p.stressors,
    waterConsumptionL: p.lastWaterConsumptionL.toFixed(4),
    nutrientConsumption: p.lastNutrientConsumption,
  }));

  res.status(200).send({
    environment: zone.status,
    devices,
    plants,
  });
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => {
    console.log('Client disconnected');
  });
  ws.on('message', (message) => {
    console.log(`Received message => ${message}`);
    // Here you could add logic to handle messages from the client, e.g. to change speed
    try {
      const { event, payload } = JSON.parse(message);
      if (event === 'changeSpeed') {
        // ... logic to change speed ...
      }
    } catch (e) {
      console.error('Failed to parse message', e);
    }
  });
});

// --- Telemetry Logger ---
// Ensure log directory exists
const logDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const telemetryLogStream = fs.createWriteStream(path.join(logDir, 'telemetry.ndjson'), { flags: 'a' });
uiStream$.subscribe(batch => {
  batch.forEach(e => telemetryLogStream.write(JSON.stringify(e) + '\n'));
});

server.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
