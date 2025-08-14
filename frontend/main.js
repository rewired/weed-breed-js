import { makeSmoother } from "./smoother.js";
import formatUnits from "./format.js";

// --- Value Smoothers ------------------------------------------------------
const smoothWater = makeSmoother({ alpha: 0.5, deadband: 0.1, maxUpdateMs: 1000 });
const smoothEnergy = makeSmoother({ alpha: 0.5, deadband: 0.1, maxUpdateMs: 1000 });

// --- Formatting helpers ---------------------------------------------------
const fmtEUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const fmtNUM = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const $ = (sel, root = document) => root.querySelector(sel);

// --- UI State -------------------------------------------------------------
const uiState = {
  running: false,
  speed: 'normal',
  day: 1,
  revenueToday: 0,
  expensesToday: 0,
  lastTickDay: 1,
};

// --- Render function ------------------------------------------------------
function render(data) {
  // Clock
  $('#tick').textContent = data.tick;
  $('#day').textContent = data.day;
  $('#time').textContent = data.time;

  if (data.day > uiState.lastTickDay) {
    uiState.revenueToday = 0;
    uiState.expensesToday = 0;
    uiState.lastTickDay = data.day;
  }
  // The server sends the total cost per tick as `expenses`
  if(data.expenses) {
    uiState.expensesToday += data.expenses;
  }
  if(data.revenue) {
    uiState.revenueToday += data.revenue;
  }

  // KPIs
  $('#balance').textContent = fmtEUR.format(data.balance);
  $('#revenue-today').textContent = fmtEUR.format(uiState.revenueToday);
  $('#expenses-today').textContent = fmtEUR.format(uiState.expensesToday);

  const smoothedWater = smoothWater(data.waterL || 0);
  if (smoothedWater !== null) {
    $('#water-tick').textContent = formatUnits(smoothedWater, 'liters');
  }
  const smoothedEnergy = smoothEnergy(data.energyKWh || 0);
  if (smoothedEnergy !== null) {
    $('#energy-tick').textContent = formatUnits(smoothedEnergy, 'kWh');
  }

  $('#rent-tick').textContent = fmtEUR.format(data.rentCost || 0);
  $('#energy-cost-tick').textContent = fmtEUR.format(data.energyCost || 0);
  $('#water-cost-tick').textContent = fmtEUR.format(data.waterCost || 0);
  $('#other-costs-tick').textContent = fmtEUR.format(data.maintenanceCost || 0);
  $('#sum-costs-tick').textContent = fmtEUR.format(data.expenses || 0);

  const zonesTbody = $('#zones-tbody');
  zonesTbody.innerHTML = '';
  if (data.zoneSummaries && data.zoneSummaries.length > 0) {
    let plantCount = 0;

    data.zoneSummaries.forEach(zone => {
      plantCount += zone.plantCount;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${zone.name}</td>
        <td>${zone.strainName || 'N/A'}</td>
        <td>${zone.plantCount}</td>
        <td>${zone.avgHealth ? zone.avgHealth + '%' : 'N/A'}</td>
        <td>${zone.expectedYield ? formatUnits(zone.expectedYield, 'grams') : 'N/A'}</td>
        <td>${zone.timeToHarvest === undefined ? 'N/A' : zone.timeToHarvest}</td>
        <td>${zone.temperatureC ? parseFloat(zone.temperatureC).toFixed(1) + '°C' : 'N/A'}</td>
        <td>${zone.humidity !== undefined ? (zone.humidity * 100).toFixed(1) + '%' : 'N/A'}</td>
        <td>${zone.co2ppm ? parseFloat(zone.co2ppm).toFixed(0) + 'ppm' : 'N/A'}</td>
      `;
      zonesTbody.appendChild(tr);
    });
    $('#zones-count').textContent = data.zoneSummaries.length;
    $('#zones-tag').textContent = `${data.zoneSummaries.length} Zonen`;
    $('#zones-kpi').textContent = data.zoneSummaries.length;
    $('#plants-kpi').textContent = plantCount;

  } else {
    zonesTbody.innerHTML = '<tr><td colspan="9" style="color:var(--muted)">Noch keine Zonen-Daten. Simulation starten.</td></tr>';
  }

  const clock = $('#clock');
  clock.classList.toggle('running', uiState.running);
}

// --- WebSocket connection -------------------------------------------------
const socket = new WebSocket(`ws://${window.location.host}`);

socket.onopen = () => {
  console.log('WebSocket connection established');
  fetchInitialData();
};

socket.onmessage = (event) => {
  const serverData = JSON.parse(event.data);
  if (serverData.day > uiState.lastTickDay) {
    uiState.revenueToday = 0;
    uiState.expensesToday = 0;
    uiState.lastTickDay = serverData.day;
  }
  uiState.expensesToday += serverData.expenses || 0;
  uiState.revenueToday += serverData.revenue || 0;
  render(serverData);
};

socket.onclose = () => {
  console.log('WebSocket connection closed');
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// --- Simulation controls --------------------------------------------------
async function postToServer(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json();
      console.error(`Error posting to ${url}:`, err.message);
      alert(`Error: ${err.message}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error posting to ${url}:`, error);
  }
}

$('#btn-play').addEventListener('click', async () => {
  await postToServer('/simulation/start', { preset: uiState.speed, savegame: 'default', difficulty: 'normal' });
  uiState.running = true;
  $('#btn-play').disabled = true;
  $('#btn-pause').disabled = false;
  const clock = $('#clock');
  clock.classList.add('running');
  fetchInitialData();
});

$('#btn-pause').addEventListener('click', async () => {
  await postToServer('/simulation/pause');
  uiState.running = false;
  $('#btn-play').disabled = false;
  $('#btn-pause').disabled = true;
  const clock = $('#clock');
  clock.classList.remove('running');
});

$('#btn-step').addEventListener('click', async () => {
    if (!uiState.running) {
        // The server does not have a single step endpoint, so we will not implement this.
    }
});

document.querySelectorAll('.speed').forEach(b => {
  b.addEventListener('click', () => {
    uiState.speed = b.dataset.speed;
    document.querySelectorAll('.speed').forEach(btn => btn.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    if (uiState.running) {
        postToServer('/simulation/resume', { preset: uiState.speed });
    }
  });
});

// --- Initial state ---
$('#btn-pause').disabled = true;

async function fetchInitialData() {
    try {
        const response = await fetch('/simulation/status');
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'running' || data.status === 'paused') {
                uiState.running = data.status === 'running';
                $('#btn-play').disabled = true;
                $('#btn-pause').disabled = !uiState.running;
                const clock = $('#clock');
                clock.classList.toggle('running', uiState.running);
            }
            if (data.structure) {
                const { structure } = data;
                const rooms = structure.rooms;
                const zones = rooms.flatMap(r => r.zones);
                let deviceCount = 0;

                const structureTbody = $('#structure-tbody');
                if (structureTbody) {
                    structureTbody.innerHTML = '';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${structure.name}</td><td>${fmtNUM.format(structure.usableArea)}</td><td>${fmtNUM.format(structure.height)}</td><td>${fmtNUM.format(structure.usableArea * structure.height)}</td><td>N/A</td>`;
                    structureTbody.appendChild(tr);
                }


                const roomsTbody = $('#rooms-tbody');
                if (roomsTbody) {
                    roomsTbody.innerHTML = '';
                    rooms.forEach(r => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `<td>${r.name}</td><td>${r.type || 'N/A'}</td><td>${fmtNUM.format(r.area)}</td><td>${fmtNUM.format(r.height || 2.5)}</td><td>${fmtEUR.format(r.rentPerTick || 0)}</td>`;
                        roomsTbody.appendChild(tr);
                        if(r.zones) {
                            r.zones.forEach(z => {
                                deviceCount += z.deviceCount;
                            })
                        }
                    });
                }

                $('#rooms-count').textContent = rooms.length;
                $('#zones-count').textContent = zones.length;
                $('#rooms-kpi').textContent = rooms.length;
                $('#zones-kpi').textContent = zones.length;
                $('#rooms-tag').textContent = `${rooms.length} Räume`;
                $('#zones-tag').textContent = `${zones.length} Zonen`;
                $('#devices-kpi').textContent = deviceCount;
            }
        }
    } catch (error) {
        console.error('Error fetching initial status:', error);
    }
}

fetchInitialData();
