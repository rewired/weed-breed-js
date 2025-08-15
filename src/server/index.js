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

// Serve static files from the frontend directory
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

// --- Simulation State ---
let simulationState = {
  structure: null,
  costEngine: null,
  rng: null,
  tickMachineLogic: null,
  intervalId: null,
  status: 'stopped', // 'running', 'paused'
  tickCounter: 0,
};

// Keep a rolling history of tick totals for aggregation
const tickHistory = [];

function aggregateLastTicks(n) {
  const slice = tickHistory.slice(-n);
  if (slice.length === 0) {
    return {
      openingBalanceEUR: 0,
      closingBalanceEUR: 0,
      revenueEUR: 0,
      energyEUR: 0,
      waterEUR: 0,
      fertilizerEUR: 0,
      rentEUR: 0,
      maintenanceEUR: 0,
      capexEUR: 0,
      otherExpenseEUR: 0,
      totalExpensesEUR: 0,
      netEUR: 0,
      energyKWh: 0,
      waterL: 0,
    };
  }

  const agg = {
    openingBalanceEUR: slice[0].openingBalanceEUR,
    closingBalanceEUR: slice[slice.length - 1].closingBalanceEUR,
    revenueEUR: 0,
    energyEUR: 0,
    waterEUR: 0,
    fertilizerEUR: 0,
    rentEUR: 0,
    maintenanceEUR: 0,
    capexEUR: 0,
    otherExpenseEUR: 0,
    totalExpensesEUR: 0,
    netEUR: 0,
    energyKWh: 0,
    waterL: 0,
  };

  for (const t of slice) {
    agg.revenueEUR += t.revenueEUR;
    agg.energyEUR += t.energyEUR;
    agg.waterEUR += t.waterEUR;
    agg.fertilizerEUR += t.fertilizerEUR;
    agg.rentEUR += t.rentEUR;
    agg.maintenanceEUR += t.maintenanceEUR;
    agg.capexEUR += t.capexEUR;
    agg.otherExpenseEUR += t.otherExpenseEUR;
    agg.energyKWh += t.energyKWh;
    agg.waterL += t.waterL;
  }

  agg.totalExpensesEUR =
    agg.energyEUR +
    agg.waterEUR +
    agg.fertilizerEUR +
    agg.rentEUR +
    agg.maintenanceEUR +
    agg.capexEUR +
    agg.otherExpenseEUR;
  agg.netEUR = agg.revenueEUR - agg.totalExpensesEUR;

  return agg;
}

const speedPresets = {
  slow: 30,   // 30 seconds per sim-day
  normal: 22, // 22 seconds per sim-day
  fast: 12,   // 12 seconds per sim-day
  turbo: 4,   // 4 seconds per sim-day
  insane: 0.1, // for testing
};

// --- Simulation Tick Runner ----------------------------------------------
async function _runSimulationTick() {
  const { structure, costEngine, tickMachineLogic } = simulationState;
  if (!structure) return;

  const absoluteTick = (costEngine._tickCounter || 0) + 1;
  costEngine.startTick(absoluteTick);

  const wagePerTick = costEngine.wagePerTick;
  if (wagePerTick > 0) {
    costEngine.bookExpense('Labor', wagePerTick);
  }

  // --- Rent Calculation ---
  const structureRent = structure.usableArea * costEngine.rentPerSqmStructurePerTick;
  if (structureRent > 0) {
    costEngine.bookExpense(`Rent (Structure: ${structure.id})`, structureRent);
  }

  for (const room of structure.rooms) {
    const roomRent = room.area * costEngine.rentPerSqmRoomPerTick;
    if (roomRent > 0) {
      costEngine.bookExpense(`Rent (Room: ${room.id})`, roomRent, { roomId: room.id });
    }

    for (const zone of room.zones) {
        const tickActor = createActor(tickMachineLogic, {
            input: {
                zone,
                tick: absoluteTick,
                tickLengthInHours: zone.tickLengthInHours,
                logger: zone.logger, // Use contextual logger
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
  }

  costEngine.commitTick();
  simulationState.tickCounter = absoluteTick;
}

function _broadcastStatusUpdate() {
  const { structure, costEngine } = simulationState;
  if (!structure) return;

  const allZones = structure.rooms.flatMap(r => r.zones);
  if (!allZones.length) return;

  const tickTotals = costEngine.getTotals();
  const absoluteTick = simulationState.tickCounter;
  const representativeZone = allZones[0];
  const tickLengthInHours = representativeZone.tickLengthInHours;
  const ticksPerDay = 24 / tickLengthInHours;

  // store history and compute aggregates
  tickHistory.push(tickTotals);
  if (typeof costEngine.recordTickTotals === 'function') {
    costEngine.recordTickTotals(tickTotals);
  }
  const maxHistory = Math.ceil(ticksPerDay * 30);
  if (tickHistory.length > maxHistory) {
    tickHistory.splice(0, tickHistory.length - maxHistory);
  }
  const aggregates = {
    '24h': aggregateLastTicks(Math.ceil(ticksPerDay)),
    '7d': aggregateLastTicks(Math.ceil(ticksPerDay * 7)),
    '1m': aggregateLastTicks(Math.ceil(ticksPerDay * 30))
  };

  const dailyEnergyKWh = tickTotals.energyKWh * ticksPerDay;
  const dailyWaterL = tickTotals.waterL * ticksPerDay;

  // --- Zone Summary Calculation ---
  const zoneSummaries = allZones.map(zone => {
    if (zone.plants.length === 0) {
      return { id: zone.id, name: zone.name, plantCount: 0 };
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
      avgHealth: avgHealth * 100,
      expectedYield,
      timeToHarvest: timeToHarvest,
      temperatureC: zone.status.temperatureC,
      humidity: zone.status.humidity,
      co2ppm: zone.status.co2ppm,
      ppfd: zone.status.ppfd,
    };
  });

  const roomSummaries = structure.rooms.map(room => {
      const roomTotals = costEngine.getTickTotalsForRoom(room.id);
      return {
          id: room.id,
          ...roomTotals
      };
  });

  // Broadcast update to all connected clients
  const statusUpdate = {
    tick: absoluteTick,
    time: new Date(simulationState.tickCounter * tickLengthInHours * 60 * 60 * 1000).toISOString().substr(11, 8),
    day: Math.floor((simulationState.tickCounter * tickLengthInHours) / 24) + 1,
    isoTime: new Date(simulationState.tickCounter * tickLengthInHours * 60 * 60 * 1000).toISOString(),
    tickIntervalHours: tickLengthInHours,
    balance: costEngine.getGrandTotals().finalBalanceEUR ?? 0,
    zoneSummaries, // Changed from zoneSummary
    roomSummaries,
    dailyEnergyKWh,
    dailyWaterL,
    ...tickTotals,
    aggregates,
    grandTotals: costEngine.getGrandTotals()
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
  const { structure } = simulationState;
  if (!structure?.rooms?.length) return;
  const allZones = structure.rooms.flatMap(r => r.zones);
  if (!allZones.length) return;

  const ticksPerDay = Math.round(24 / allZones[0].tickLengthInHours);
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
    const { structure, costEngine, rng, tickMachineLogic } = await initializeSimulation(savegame, difficulty);

    simulationState = {
      ...simulationState,
      structure,
      costEngine,
      rng,
      tickMachineLogic,
      status: 'running',
      tickCounter: 0,
    };

    const ticksPerSimDay = 24 / structure.rooms[0].zones[0].tickLengthInHours;
    let tickIntervalMs;
    let tickHandler;

    if (preset === 'insane') {
      tickIntervalMs = speedPresets.insane * 1000;
      tickHandler = runDayAsBatch;
    } else {
      tickIntervalMs = (realSecondsPerSimDay / ticksPerSimDay) * 1000;
      tickHandler = runTick;
    }

    const run = () => {
      if (simulationState.status !== 'running') return;
      tickHandler().then(() => {
        simulationState.intervalId = setTimeout(run, tickIntervalMs);
      });
    };
    run();

    const allZones = structure.rooms.flatMap(r => r.zones);
    res.status(200).send({ message: `Simulation started with preset: ${preset}, found ${allZones.length} zones.` });
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
  const ticksPerSimDay = 24 / simulationState.structure.rooms[0].zones[0].tickLengthInHours;

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
  const { structure, costEngine, status, tickCounter } = simulationState;
  if (!structure) {
    return res.status(404).send({ message: 'Simulation not started.' });
  }

  const tickLengthInHours = structure.rooms[0]?.zones[0]?.tickLengthInHours ?? 3;

  res.status(200).send({
    status,
    tick: tickCounter,
    isoTime: new Date(tickCounter * tickLengthInHours * 60 * 60 * 1000).toISOString(),
    tickIntervalHours: tickLengthInHours,
    day: Math.floor((tickCounter * tickLengthInHours) / 24) + 1,
    balance: costEngine.getGrandTotals().finalBalanceEUR ?? 0,
    structure: structure,
    grandTotals: costEngine.getGrandTotals()
  });
});

import { createZoneOverviewDTO } from './services/zoneOverviewService.js';
import { createPlantDetailDTO } from './services/plantDetailService.js';
import { createZoneDetailDTO } from './services/zoneDetailService.js';

app.get('/api/zones/:zoneId/overview', (req, res) => {
  const { zoneId } = req.params;
  const { structure, costEngine } = simulationState;

  if (simulationState.status === 'stopped' || !structure) {
    return res.status(404).send({ error: 'Simulation not running.' });
  }

  let zone = null;
  for (const room of structure.rooms) {
    const foundZone = room.zones.find(z => z.id === zoneId);
    if (foundZone) {
      zone = foundZone;
      break;
    }
  }

  if (!zone) {
    return res.status(404).send({ error: `Zone with id ${zoneId} not found.` });
  }

  const dto = createZoneOverviewDTO(zone, costEngine);
  res.status(200).send(dto);
});

app.get('/api/zones/:zoneId/details', (req, res) => {
  const { zoneId } = req.params;
  const { structure } = simulationState;

  if (simulationState.status === 'stopped' || !structure) {
    return res.status(404).send({ error: 'Simulation not running.' });
  }

  // Find the zone in the hierarchy
  let zone = null;
  for (const room of structure.rooms) {
    const foundZone = room.zones.find(z => z.id === zoneId);
    if (foundZone) {
      zone = foundZone;
      break;
    }
  }

  if (!zone) {
    return res.status(404).send({ error: `Zone with id ${zoneId} not found.` });
  }

  const dto = createZoneDetailDTO(zone);
  res.status(200).send(dto);
});

app.get('/api/zones/:zoneId/plants/:plantId', (req, res) => {
  const { zoneId, plantId } = req.params;
  const { structure } = simulationState;

  if (simulationState.status === 'stopped' || !structure) {
    return res.status(404).send({ error: 'Simulation not running.' });
  }

  let zone = null;
  for (const room of structure.rooms) {
    const foundZone = room.zones.find(z => z.id === zoneId);
    if (foundZone) {
      zone = foundZone;
      break;
    }
  }
  if (!zone) {
    return res.status(404).send({ error: `Zone with id ${zoneId} not found.` });
  }

  const plant = zone.plants.find(p => p.id === plantId);
  if (!plant) {
    return res.status(404).send({ error: `Plant with id ${plantId} not found in zone ${zoneId}.` });
  }

  const dto = createPlantDetailDTO(zone, plant);
  res.status(200).send(dto);
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
