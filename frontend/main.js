import formatUnits from './format.js';

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const speedControls = document.getElementById('speed-controls');
  const difficultyControls = document.getElementById('difficulty-controls');

  const simDay = document.getElementById('sim-day');
  const simTime = document.getElementById('sim-time');
  const simBalance = document.getElementById('sim-balance');
  const simTick = document.getElementById('sim-tick');
  const simStatus = document.getElementById('sim-status');

  const kpiBalance = document.getElementById('kpi-balance');
  const kpiProfit = document.getElementById('kpi-profit');
  const kpiEnergy = document.getElementById('kpi-energy');
  const kpiWater = document.getElementById('kpi-water');

  let currentSpeed = 'normal';
  let currentDifficulty = 'normal';
  let isPaused = false;

  // --- WebSocket Setup ---
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connection established');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received data from server:', data);
    updateUI(data);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  // --- Event Listeners ---
  startBtn.addEventListener('click', () => {
    fetch('/simulation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: currentSpeed, difficulty: currentDifficulty }),
    })
    .then(res => res.json())
    .then(data => {
      console.log(data.message);
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      simStatus.textContent = 'running';
      isPaused = false;
    });
  });

  pauseBtn.addEventListener('click', () => {
    if (isPaused) {
      // Resume
      fetch('/simulation/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: currentSpeed }),
      })
      .then(res => res.json())
      .then(data => {
        console.log(data.message);
        pauseBtn.textContent = '▮▮';
        pauseBtn.title = 'Pause';
        simStatus.textContent = 'running';
        isPaused = false;
      });
    } else {
      // Pause
      fetch('/simulation/pause', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          console.log(data.message);
          pauseBtn.textContent = '▶︎';
          pauseBtn.title = 'Resume';
          simStatus.textContent = 'paused';
          isPaused = true;
        });
    }
  });


  speedControls.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      currentSpeed = e.target.dataset.speed;
      for (const btn of speedControls.children) {
        btn.setAttribute('aria-pressed', 'false');
      }
      e.target.setAttribute('aria-pressed', 'true');
      console.log(`Speed changed to ${currentSpeed}`);
    }
  });

  difficultyControls.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      currentDifficulty = e.target.dataset.difficulty;
      for (const btn of difficultyControls.children) {
        btn.setAttribute('aria-pressed', 'false');
      }
      e.target.setAttribute('aria-pressed', 'true');
      console.log(`Difficulty changed to ${currentDifficulty}`);
    }
  });


  // --- UI Update Function ---
  function updateUI(data) {
    simDay.textContent = data.day;
    simTime.textContent = data.time;
    simBalance.textContent = data.balance;
    simTick.textContent = data.tick;

    kpiBalance.textContent = `€ ${data.balance}`;
    if (data.netEUR != null) {
        kpiProfit.textContent = `€ ${data.netEUR.toFixed(2)}`;
    }
    if (data.dailyEnergyKWh != null) {
        kpiEnergy.textContent = formatUnits(data.dailyEnergyKWh, 'kWh');
    }
    if (data.dailyWaterL != null) {
        kpiWater.textContent = formatUnits(data.dailyWaterL, 'liters');
    }

    if (data.zoneSummaries) {
      renderZoneSummaries(data.zoneSummaries);
    }
  }

  function renderZoneSummaries(summaries) {
    const container = document.getElementById('zone-summary');
    if (!container) return;

    let html = '';
    for (const summary of summaries) {
      html += `
        <div class="tile">
          <div class="hdr">
            <div><a href="#/sim/zone/${summary.id}"><b>${summary.name}</b></a></div>
            <div class="muted" style="font-size: 11px;">
              <span title="Strain">${summary.strainName}</span>
              ·
              <span title="Anzahl Pflanzen">🌱 ${summary.plantCount}</span>
            </div>
          </div>

          <div class="stat-grid" style="margin-top:8px; font-size: 12px;">
            <div>Ø Gesundheit:</div>
            <div><b>${summary.avgHealth}%</b></div>

            <div>Erwart. Ertrag:</div>
            <div><b>${formatUnits(parseFloat(summary.expectedYield), 'grams')}</b></div>
            <div>Tage z. Ernte:</div>
            <div><b>~${summary.timeToHarvest}</b></div>
          </div>

          <div class="climate-grid" style="margin-top: 10px; font-size: 11px;">
              <div title="Temperatur">🌡️ ${summary.temperatureC.toFixed(1)}°C</div>
              <div title="rel. Luftfeuchtigkeit">💧 ${(summary.humidity * 100).toFixed(0)}%</div>
              <div title="CO₂-Konzentration">💨 ${summary.co2ppm.toFixed(0)}ppm</div>
          </div>

        </div>
      `;
    }
    container.innerHTML = html;
  }

  function renderZoneEnvironment(env) {
    const container = document.getElementById('zone-environment-summary');
    if (!container) return;
    const html = `
      <span>Temp:</span> <b>${env.temperatureC.toFixed(2)}°C</b>
      <span>RH:</span> <b>${(env.humidity * 100).toFixed(1)}%</b>
      <span>CO2:</span> <b>${env.co2ppm.toFixed(0)}ppm</b>
      <span>PPFD:</span> <b>${env.ppfd.toFixed(0)}</b>
    `;
    container.innerHTML = html;
  }

  // --- Simple Hash-based Router ---
  const mainNav = document.getElementById('main-nav');
  const sections = document.querySelectorAll('main > .content > section');

  async function fetchAndRenderZoneDetails() {
    const hash = window.location.hash;
    const zoneId = hash.split('/')[3]; // Based on #/sim/zone/{zoneId}
    if (!zoneId) {
      console.error('No zoneId found in URL hash');
      return;
    }

    try {
      const res = await fetch(`/api/zones/${zoneId}/details`);
      if (!res.ok) {
        throw new Error(`Failed to fetch zone details for ${zoneId}: ${res.statusText}`);
      }
      const data = await res.json();
      renderZoneEnvironment(data.environment);
      renderDeviceTable(data.devices);
      renderPlantTable(data.plants);
    } catch (error) {
      console.error(error);
      // Optionally, display an error in the UI
    }
  }

  function renderDeviceTable(devices) {
    const container = document.querySelector('#view-zone-detail #device-table-body');
    if (!container) return;
    container.innerHTML = devices.map(d => `
      <tr>
        <td>${d.name} (${d.kind})</td>
        <td>${d.status}</td>
        <td>${d.powerConsumptionKW} kW</td>
        <td>€${d.maintenanceCostPerTick.toFixed(4)}/tick</td>
      </tr>
    `).join('');
  }

  function renderPlantTable(plants) {
    const container = document.querySelector('#view-zone-detail #plant-table-body');
    if (!container) return;
    container.innerHTML = plants.map(p => {
      const npk = p.nutrientConsumption;
      const npkString = npk ? `${npk.N.toFixed(2)}/${npk.P.toFixed(2)}/${npk.K.toFixed(2)}` : '-';

      const stressors = Object.entries(p.stressors || {}).map(([key, value]) => {
        if (key === 'temperature') return `Temp: ${value.actual.toFixed(1)}°C (Ziel: ${value.target.toFixed(1)}°C)`;
        if (key === 'humidity') return `RH: ${(value.actual * 100).toFixed(0)}% (Ziel: ${(value.target * 100).toFixed(0)}%)`;
        if (key === 'light') return `Licht: ${value.actual.toFixed(0)} (Ziel: ${value.target[0]}-${value.target[1]})`;
        if (key === 'nutrients') return `Nährstoffe: ${value.level}`;
        return '';
      }).filter(Boolean).join(', ');

      return `
        <tr>
          <td>${p.id}</td>
          <td>${p.stage}</td>
          <td>${p.health}%</td>
          <td>${p.stress}% ${stressors ? `(${stressors})` : ''}</td>
          <td>${p.waterConsumptionL} L/tick</td>
          <td>${npkString}</td>
        </tr>
      `;
    }).join('');
  }

  function handleRouteChange() {
    const hash = window.location.hash || '#/';

    // This is a simple router. A more robust solution would use a library.
    mainNav.querySelectorAll('a').forEach(a => {
      // Handle parent paths being active, e.g., #/sim should make #/sim/zone/z1 active
      const linkHash = a.getAttribute('href');
      const isActive = (hash === linkHash) || (hash.startsWith(linkHash) && linkHash !== '#/');
      a.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    let activeSectionId = 'view-dashboard';
    if (hash.startsWith('#/sim/zone/')) {
      activeSectionId = 'view-zone-detail';
      fetchAndRenderZoneDetails();
    } else if (hash.startsWith('#/sim')) {
      activeSectionId = 'view-sim';
    } // etc. for other routes

    sections.forEach(section => {
      section.hidden = section.id !== activeSectionId;
    });
  }

  window.addEventListener('hashchange', handleRouteChange);
  handleRouteChange(); // Initial call
});
