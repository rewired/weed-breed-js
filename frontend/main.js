import { makeSmooth } from "./smoother.js";
import formatUnits from "./format.js";

// --- Helpers -------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const txt = (s, v) => {
    const el = $(s);
    if (el) el.textContent = v;
};
const fmtNUM = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const fmtEUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

// --- State ---------------------------------------------------------------
const state = {
    treeMode: "structure", // 'structure' | 'company' | 'shop' | 'editor'
    level: "none",
    structureId: null,
    roomId: null,
    zoneId: null,
    plantId: null,
    companySel: null,
    shopSel: null,
    strainId: null,
    running: false,
    speed: "normal",
    tick: 0,
    day: 1,
    tickHours: 3,
    simTime: new Date(2025, 0, 1, 8, 0, 0),
    balance: 0,
    dailyEnergyKWh: 0,
    dailyWaterL: 0,
    tickEnergyKWh: 0,
    tickWaterL: 0,
    tickCostEUR: 0,
    grandTotals: {},
    aggregates: {},
    companyPeriod: '24h',
    structureData: { structures: [] },
    // per-zone smoothing helpers
    zoneSmoothers: {},
};

function setState(partial) {
    Object.assign(state, partial);
    renderTop();
    renderContent();
}

function ensureZoneSmoothers(zone) {
    if (!zone) return null;
    if (!state.zoneSmoothers[zone.id]) {
        state.zoneSmoothers[zone.id] = {
            humidity: makeSmooth({ windowHours: 24 }),
            ppfd: makeSmooth({ windowHours: 24 }),
            avgHumidity: null,
            avgPPFD: null,
            rawHumidity: null,
            rawPPFD: null,
        };
    }
    return state.zoneSmoothers[zone.id];
}

// --- WebSocket connection -------------------------------------------------
const socket = new WebSocket(`ws://${window.location.host}`);

socket.onopen = () => {
    console.log("WebSocket connection established");
    fetchInitialData();
};

socket.onmessage = (event) => {
    const serverData = JSON.parse(event.data);
    updateWithLiveData(serverData);
};

socket.onclose = () => {
    console.log("WebSocket connection closed");
};

socket.onerror = (error) => {
    console.error("WebSocket error:", error);
};

// --- Data Fetching -------------------------------------------------------
async function fetchInitialData() {
    try {
        const response = await fetch("/simulation/status");
        if (response.ok) {
            const data = await response.json();
            if (data.status === "running" || data.status === "paused") {
                setState({ running: data.status === "running" });
                $("#btn-play").disabled = true;
                $("#btn-pause").disabled = !state.running;
            }
            if (data.structure) {
                // The backend returns a single structure, but the frontend expects an array of structures.
                setState({ structureData: { structures: [data.structure] } });
                state.structureData.structures.forEach(s =>
                    s.rooms.forEach(r => r.zones.forEach(z => ensureZoneSmoothers(z)))
                );
                buildTree();
                // By default, select the first structure
                if (state.structureData.structures.length > 0) {
                    selectNode("structure", state.structureData.structures[0].id);
                }
            }
            if (data.tick !== undefined) {
                updateWithLiveData(data);
            }
        }
    } catch (error) {
        console.error("Error fetching initial status:", error);
    }
}

function updateWithLiveData(data) {
    console.log(JSON.stringify(data, null, 2));
    const newSimTime = new Date(data.isoTime);

    // Update live data in the structure data before state merge
    if (data.zoneSummaries) {
        data.zoneSummaries.forEach(summary => {
            for (const structure of state.structureData.structures) {
                for (const room of structure.rooms) {
                    const zone = room.zones.find(z => z.id === summary.id);
                    if (zone) {
                        const smoother = ensureZoneSmoothers(zone);
                        smoother.rawHumidity = summary.humidity;
                        smoother.rawPPFD = summary.ppfd;
                        smoother.avgHumidity = smoother.humidity(summary.humidity, newSimTime.getTime());
                        smoother.avgPPFD = smoother.ppfd(summary.ppfd, newSimTime.getTime());
                        Object.assign(zone, summary);
                    }
                }
            }
        });
    }
    if (data.roomSummaries) {
        data.roomSummaries.forEach(summary => {
            for (const structure of state.structureData.structures) {
                const room = structure.rooms.find(r => r.id === summary.id);
                if (room) {
                    Object.assign(room, summary);
                }
            }
        });
    }

    const partial = {
        tick: data.tick,
        simTime: newSimTime,
        balance: Number(data.balance),
        tickHours: Number(data.tickIntervalHours),
        day: Number(data.day ?? state.day),
        dailyEnergyKWh: Number(data.dailyEnergyKWh),
        dailyWaterL: Number(data.dailyWaterL),
        tickEnergyKWh: Number(data.energyKWh) || 0,
        tickWaterL: Number(data.waterL) || 0,
        tickCostEUR: Number(data.totalExpensesEUR) || 0,
    };
    if (data.grandTotals) partial.grandTotals = data.grandTotals;
    if (data.aggregates) partial.aggregates = data.aggregates;

    setState(partial);
}

// --- Tree Building -------------------------------------------------------
function buildTree() {
    const tree = $("#tree");
    tree.innerHTML = "";
    if (state.treeMode === "structure") buildStructureTree(tree);
    if (state.treeMode === "company") buildCompanyTree(tree);
    if (state.treeMode === "shop") buildShopTree(tree);
    if (state.treeMode === "editor") buildEditorTree(tree);
}

function nodeLi(kind, id, icon, title, alerts = 0, count = 0) {
    const li = document.createElement("li");
    li.setAttribute("role", "treeitem");

    const node = document.createElement("div");
    node.className = "node";
    node.tabIndex = 0;
    node.dataset.kind = kind;
    node.dataset.id = id;

    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.textContent = "▸";
    node.appendChild(twisty);
    node.appendChild(document.createTextNode(" "));

    const titleSpan = document.createElement("span");
    titleSpan.className = "title";
    titleSpan.textContent = `${icon} ${title}`;
    node.appendChild(titleSpan);
    node.appendChild(document.createTextNode(" "));

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.title = "Zähler/Status";
    badge.textContent = `${count}${alerts ? ` • ⚠${alerts}` : ""}`;
    node.appendChild(badge);

    const children = document.createElement("div");
    children.className = "children";
    children.hidden = true;

    li.appendChild(node);
    li.appendChild(children);
    node.addEventListener("click", () => {
        if (children.children.length) {
            children.hidden = !children.hidden;
            node.querySelector(".twisty").textContent = children.hidden ? "▸" : "▾";
        }
        selectNode(kind, id);
    });
    node.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            node.click();
        }
    });
    return li;
}

function buildStructureTree(root) {
    state.structureData.structures.forEach((s) => {
        const sLi = nodeLi("structure", s.id, "🏗️", s.name, s.alerts, s.rooms.length);
        const sCh = sLi.querySelector(".children");
        s.rooms.forEach((r) => {
            const rLi = nodeLi("room", r.id, "🚪", r.name, r.alerts, r.zones.length);
            const rCh = rLi.querySelector(".children");
            r.zones.forEach((z) => {
                const zCount = z.plants?.length || 0;
                const zLi = nodeLi("zone", z.id, "🧩", z.name, z.alerts, zCount);
                const zCh = zLi.querySelector(".children");
                // Devices
                if (z.devices && z.devices.length > 0) {
                    const devLi = nodeLi("devices", z.id, "🔧", `Devices (${z.devices.length})`, 0, z.devices.length);
                    zCh.appendChild(devLi);
                }
                // Plants
                if (z.plants && z.plants.length > 0) {
                    const plantLi = nodeLi('plants', z.id, '🌿', `Plants (${z.plants.length})`, 0, z.plants.length);
                    zCh.appendChild(plantLi);
                }
                rCh.appendChild(zLi);
            });
            sCh.appendChild(rLi);
        });
        root.appendChild(sLi);
    });
}

function buildCompanyTree(root) {
    const li = nodeLi("company", "overview", "🏢", "Overview");
    root.appendChild(li);
}

function buildShopTree(root) {
    // Placeholder for future shop tree
}

function buildEditorTree(root) {
    const li = nodeLi("strains", "strains", "🧬", "Strains");
    root.appendChild(li);
}

// --- Selection & Rendering -----------------------------------------------
function selectNode(kind, id) {
    if (state.treeMode === "structure") {
        const partial = { level: kind, plantId: null };

        if (kind === "structure") {
            Object.assign(partial, { structureId: id, roomId: null, zoneId: null });
        } else if (kind === "room") {
            const s = findStructureOfRoom(id);
            Object.assign(partial, { roomId: id, zoneId: null, structureId: s?.id || null });
        } else if (kind === "zone" || kind === "devices" || kind === "plants") {
            const { s, r } = findParentsOfZone(id) || {};
            Object.assign(partial, { zoneId: id, structureId: s?.id || null, roomId: r?.id || null });
        } else if (kind === "plant") {
            const p = findParentsOfPlant(id);
            Object.assign(partial, { plantId: id, structureId: p?.s?.id || null, roomId: p?.r?.id || null, zoneId: p?.z?.id || null });
        }
        setState(partial);
    } else if (state.treeMode === "company") {
        setState({ companySel: id });
    } else if (state.treeMode === "editor") {
        setState({ level: kind, strainId: id });
    }
    // ... other tree modes

    // Visual selection
    $$("#tree .node").forEach((n) => n.setAttribute("aria-selected", "false"));
    const current = $(`#tree .node[data-kind="${kind}"][data-id="${id}"]`);
    if (current) current.setAttribute("aria-selected", "true");

    renderBreadcrumbs();
}

function renderContent() {
    const root = $("#content");
    const scrollPos = root.scrollTop;
    root.innerHTML = "";
    if (state.treeMode === "structure") renderStructureContent(root);
    else if (state.treeMode === "company") renderCompanyContent(root);
    else if (state.treeMode === "editor") renderEditorContent(root);
    // ... other tree modes
    root.scrollTop = scrollPos;
}

function renderStructureContent(root) {
    const level = state.level;
    if (level === 'none') {
        root.innerHTML = '<p style="color:var(--muted)">Bitte links ein Element wählen…</p>';
        return;
    }

    const s = state.structureId ? findStructure(state.structureId) : null;
    const r = state.roomId ? s?.rooms.find(r => r.id === state.roomId) : null;
    const z = state.zoneId ? r?.zones.find(z => z.id === state.zoneId) : null;
    const p = state.plantId ? z?.plants.find(p => p.id === state.plantId) : null;

    // Header
    const header = document.createElement('div');
    header.className = 'section';
    let title = 'Übersicht', subtitle = 'Wähle links ein Element';
    if (level === 'structure' && s) { title = s.name; subtitle = `${s.rooms.length || 0} Rooms`; }
    if (level === 'room' && r) { title = r.name; subtitle = `${r.zones.length || 0} Zones`; }
    if (level === 'zone' && z) { title = z.name; subtitle = `${z.plants?.length || 0} Plants • ${z.devices?.length || 0} Devices`; }
    if (level === 'devices' && z) { title = `${z.name} · Devices`; subtitle = `${z.devices?.length || 0} Geräte`; }
    if (level === 'plant' && p) { title = p.name; subtitle = `${p.strain || '—'} • ${p.phase || '—'}`; }
    const headerEl = document.createElement("header");
    headerEl.style.display = "flex";
    headerEl.style.justifyContent = "space-between";
    headerEl.style.alignItems = "center";

    const left = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = title;
    left.appendChild(strong);
    const sub = document.createElement("div");
    sub.style.color = "var(--muted)";
    sub.style.fontSize = "12px";
    sub.textContent = subtitle;
    left.appendChild(sub);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = `Kontext: ${level}`;

    headerEl.appendChild(left);
    headerEl.appendChild(badge);
    header.appendChild(headerEl);
    root.appendChild(header);

    if (level === 'structure') {
        const consumptionGrid = document.createElement('div');
        consumptionGrid.className = 'grid';
        consumptionGrid.style.marginBottom = '12px';
        consumptionGrid.appendChild(card('Costs (Tick)', fmtEUR.format(state.tickCostEUR)));
        consumptionGrid.appendChild(card('Energy (Tick)', formatUnits(state.tickEnergyKWh, 'kWh')));
        consumptionGrid.appendChild(card('Water (Tick)', formatUnits(state.tickWaterL, 'liters')));
        header.insertAdjacentElement('afterend', consumptionGrid);
    }

    // KPI row
    const kpis = document.createElement('div');
    kpis.className = 'grid';
    if (level === 'structure' && s) {
        const counts = s.rooms.reduce((acc, r) => { acc.zones += r.zones.length; acc.plants += r.zones.reduce((p, z) => p + (z.plants?.length || 0), 0); acc.devices += r.zones.reduce((d, z) => d + (z.devices?.length || 0), 0); return acc; }, { zones: 0, plants: 0, devices: 0 });
        kpis.appendChild(card('Aktive Alerts', s.alerts || 0, 'gesamt'));
        kpis.appendChild(card('Rooms', s.rooms.length, 'in Structure'));
        kpis.appendChild(card('Zones', counts.zones, 'in Structure'));
    }
    if (level === 'room' && r) {
        const plants = r.zones.reduce((p, z) => p + (z.plants?.length || 0), 0);
        const devices = r.zones.reduce((d, z) => d + (z.devices?.length || 0), 0);
        kpis.appendChild(card('Zones', r.zones.length, 'im Room'));
        kpis.appendChild(card('Plants', plants, 'gesamt'));
        kpis.appendChild(card('Devices', devices, 'gesamt'));

        const consumptionGrid = document.createElement('div');
        consumptionGrid.className = 'grid';
        consumptionGrid.style.marginBottom = '12px';
        consumptionGrid.appendChild(card('Costs (Tick)', fmtEUR.format(Number(r.totalExpensesEUR) || 0)));
        consumptionGrid.appendChild(card('Energy (Tick)', formatUnits(Number(r.energyKWh) || 0, 'kWh')));
        consumptionGrid.appendChild(card('Water (Tick)', formatUnits(Number(r.waterL) || 0, 'liters')));
        // Insert after the header, before other content
        header.insertAdjacentElement('afterend', consumptionGrid);
    }
    if (level === 'zone' && z) {
        if (kpis.children.length === 0) {
            kpis.remove();
        }
        fetch(`/api/zones/${z.id}/overview`)
            .then(res => res.json().then(dto => ({ ok: res.ok, dto })))
            .then(({ ok, dto }) => {
                if (!ok || dto.error || dto.message) {
                    const msg = dto.error || dto.message || 'Unknown error';
                    const pErr = document.createElement('p');
                    pErr.style.color = 'var(--danger)';
                    pErr.textContent = `Error: ${msg}`;
                    root.appendChild(pErr);
                    return;
                }
                renderZoneOverview(root, dto, z);
            })
            .catch(err => {
                const msg = err.message === 'Simulation not running.'
                    ? 'Simulation gestartet? Details stehen nur bei laufender Simulation zur Verfügung.'
                    : err.message;
                const pErr = document.createElement('p');
                pErr.style.color = 'var(--danger)';
                pErr.textContent = `Error fetching zone overview: ${msg}`;
                root.appendChild(pErr);
            });
    } else if (level === 'plant' && p && z) {
        kpis.appendChild(card('Age', (p.ageHours / 24).toFixed(1) + ' d'));
        kpis.appendChild(card('Health', (p.health * 100).toFixed(1) + '%'));
        kpis.appendChild(card('Stress', (p.stress * 100).toFixed(1) + '%'));
        root.appendChild(kpis);
        fetch(`/api/zones/${z.id}/plants/${p.id}`)
            .then(res => res.json().then(dto => ({ ok: res.ok, dto })))
            .then(({ ok, dto }) => {
                if (!ok || dto.error || dto.message) {
                    const msg = dto.error || dto.message || 'Unknown error';
                    const pErr = document.createElement('p');
                    pErr.style.color = 'var(--danger)';
                    pErr.textContent = `Error: ${msg}`;
                    root.appendChild(pErr);
                    return;
                }
                renderPlantDetail(root, dto, z);
            })
            .catch(err => {
                const msg = err.message === 'Simulation not running.'
                    ? 'Simulation gestartet? Details stehen nur bei laufender Simulation zur Verfügung.'
                    : err.message;
                const pErr = document.createElement('p');
                pErr.style.color = 'var(--danger)';
                pErr.textContent = `Error fetching plant detail: ${msg}`;
                root.appendChild(pErr);
            });
        return;
    } else {
        if (level !== 'none') root.appendChild(kpis);
    }

    // Context detail blocks
    if (level === 'structure' && s) {
        root.appendChild(section('Rooms in Structure', table([
            ['Room', 'Zones', 'Plants', 'Yield', 'Devices', 'Alerts'],
            ...s.rooms.map(r => [
                link(`room:${r.id}`, r.name),
                r.zones.length,
                r.zones.reduce((p, z) => p + (z.plants?.length || 0), 0),
                formatUnits(r.zones.reduce((sum, z) => sum + (parseFloat(z.expectedYield) || 0), 0), 'grams'),
                r.zones.reduce((d, z) => d + (z.devices?.length || 0), 0),
                r.alerts ? `⚠ ${r.alerts}` : '—'
            ])
        ])));
    }
    if (level === 'room' && r) {
        root.appendChild(section('Zones in Room', table([
            ['Zone', 'Plants', 'Harvest in (d)', 'Yield', 'Devices', 'Alerts'],
            ...r.zones.map(z => [
                link(`zone:${z.id}`, z.name),
                z.plants?.length || 0,
                z.timeToHarvest ?? 'N/A',
                z.expectedYield != null ? formatUnits(z.expectedYield, 'grams') : 'N/A',
                z.devices?.length || 0,
                z.alerts ? `⚠ ${z.alerts}` : '—'
            ])
        ])));
    }
    if (level === 'devices' && z) {
        root.appendChild(section('Devices', table([
            ['Device', 'Kind', 'Health', 'Wartung/Tick'],
            ...(z.devices || []).map(d => [d.name, d.type, d.health ? d.health.toFixed(2) : 'N/A', fmtEUR.format(d.maintenanceCostPerTick || 0)])
        ])));
    }
    if (level === 'plants' && z) {
        fetch(`/api/zones/${z.id}/details`)
            .then(res => res.json().then(dto => ({ ok: res.ok, dto })))
            .then(({ ok, dto }) => {
                if (!ok || dto.error || dto.message) {
                    const msg = dto.error || dto.message || 'Unknown error';
                    const pErr = document.createElement('p');
                    pErr.style.color = 'var(--danger)';
                    pErr.textContent = `Error: ${msg}`;
                    root.appendChild(section('Plants', pErr));
                    return;
                }
                renderZonePlantsDetails(root, dto);
            })
            .catch(err => {
                const msg = err.message === 'Simulation not running.'
                    ? 'Simulation gestartet? Details stehen nur bei laufender Simulation zur Verfügung.'
                    : err.message;
                const pErr = document.createElement('p');
                pErr.style.color = 'var(--danger)';
                pErr.textContent = `Error fetching zone details: ${msg}`;
                root.appendChild(section('Plants', pErr));
            });
    }

    // Delegate jumps
    root.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-jump]'); if (!a) return; e.preventDefault();
        const [kind, id] = a.getAttribute('data-jump').split(':'); selectNode(kind, id);
    }, { once: true });
}

function renderBreadcrumbs() {
    const c = $('#crumbs'); c.innerHTML = '';
    if (state.treeMode === 'structure') {
        const parts = [];
        if (state.structureId) { const s = findStructure(state.structureId); if (s) parts.push({ label: s.name, kind: 'structure', id: s.id }); }
        if (state.roomId) { const s = findStructureOfRoom(state.roomId); const r = s?.rooms.find(r => r.id === state.roomId); if (r) parts.push({ label: r.name, kind: 'room', id: r.id }); }
        if (state.zoneId) { const p = findParentsOfZone(state.zoneId); const z = p?.z; if (z) parts.push({ label: z.name, kind: 'zone', id: z.id }); }
        if (state.level === 'devices') { parts.push({ label: 'Devices', kind: 'devices', id: state.zoneId }); }
        if (state.level === 'plants' || state.level === 'plant') { parts.push({ label: 'Plants', kind: 'plants', id: state.zoneId }); }
        if (state.level === 'plant' && state.plantId) {
            const info = findParentsOfPlant(state.plantId);
            const label = info?.p?.name || info?.p?.id.slice(0,8) || 'Plant';
            parts.push({ label, kind: 'plant', id: state.plantId });
        }
        if (!parts.length) { c.innerHTML = '<span style="color:var(--muted)">Bitte links ein Element wählen…</span>'; return; }
        parts.forEach((p, i) => { const a = document.createElement('a'); a.href = 'javascript:void(0)'; a.textContent = p.label; a.addEventListener('click', () => selectNode(p.kind, p.id)); c.appendChild(a); if (i < parts.length - 1) { const s = document.createElement('span'); s.textContent = '›'; s.style.color = 'var(--muted)'; s.style.margin = '0 4px'; c.appendChild(s); } });
    } else if (state.treeMode === 'editor') {
        const label = state.level === 'strains' ? 'Strains' : 'Editor';
        const strong = document.createElement('strong');
        strong.textContent = label;
        c.appendChild(strong);
    } else {
        const label = state.treeMode === 'company' ? 'Company Overview' : 'Shop Explorer';
        const strong = document.createElement('strong');
        strong.textContent = label;
        c.appendChild(strong);
    }
}

function section(title, inner) {
    const el = document.createElement('div');
    el.className = 'section';
    const header = document.createElement('header');
    const h3 = document.createElement('h3');
    h3.textContent = title;
    header.appendChild(h3);
    el.appendChild(header);
    if (inner instanceof Node) {
        el.appendChild(inner);
    }
    return el;
}

function table(rows) {
    const tableEl = document.createElement('table');
    const [head, ...body] = rows;
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    head.forEach(h => {
        const th = document.createElement('th');
        if (h instanceof Node) th.appendChild(h); else th.textContent = h;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    tableEl.appendChild(thead);
    const tbody = document.createElement('tbody');
    body.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
            const td = document.createElement('td');
            if (cell instanceof Node) td.appendChild(cell); else td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    return tableEl;
}

function link(target, label) {
    const a = document.createElement('a');
    a.href = '#';
    a.dataset.jump = target;
    a.textContent = label;
    return a;
}
function card(title, value, sub = '') {
    const el = document.createElement('div');
    el.className = 'card';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    el.appendChild(h3);
    const metric = document.createElement('div');
    metric.className = 'metric';
    const v = document.createElement('div');
    v.className = 'v';
    v.textContent = value;
    const s = document.createElement('div');
    s.className = 'sub';
    s.textContent = sub;
    metric.appendChild(v);
    metric.appendChild(s);
    el.appendChild(metric);
    return el;
}
function renderZoneOverview(root, dto, zone) {
    // 1. Header
    const headerGrid = document.createElement('div');
    headerGrid.className = 'grid';
    const cap = dto.capacity;
    const stageMix = cap.stageMix.map(s => `${s.stage} ${s.pct}%`).join(', ');
    headerGrid.appendChild(card('Occupancy', `${cap.plantsCount} / ${cap.capacitySlots} (${cap.occupancyPct}%)`));
    headerGrid.appendChild(card('Dominant Stage', `${cap.dominantStage}`, stageMix));
    headerGrid.appendChild(card('ETA', `${dto.predictions.harvestEtaDays} days`));
    headerGrid.appendChild(card('Yield Forecast', formatUnits(dto.predictions.yieldForecastGrams, 'grams')));
    root.appendChild(headerGrid);

    // 2. Environment Section
    const envGrid = document.createElement('div');
    envGrid.className = 'grid';
    const env = dto.environment;
    const smoother = ensureZoneSmoothers(zone);
    if (smoother) {
        env.humidity.actual = smoother.avgHumidity ?? env.humidity.actual;
        env.ppfd.actual = smoother.avgPPFD ?? env.ppfd.actual;
    }
    envGrid.appendChild(card('Temperature', `${env.temperature.actual.toFixed(1)}°C`, `Set: ${env.temperature.set}°C`));
    const humiditySub = `Raw: ${((smoother?.rawHumidity ?? env.humidity.actual) * 100).toFixed(0)}% • Set: ${(env.humidity.set * 100).toFixed(0)}%`;
    envGrid.appendChild(card('Humidity', `${(env.humidity.actual * 100).toFixed(0)}%`, humiditySub));
    envGrid.appendChild(card('CO2', `${env.co2.actual.toFixed(0)}ppm`, `Set: ${env.co2.set}ppm`));
    const ppfdSub = `Raw: ${(smoother?.rawPPFD ?? env.ppfd.actual).toFixed(0)} • Set: ${env.ppfd.set}`;
    envGrid.appendChild(card('PPFD', `${env.ppfd.actual.toFixed(0)}`, ppfdSub));
    root.appendChild(section('Environment', envGrid));

    // 3. Stress Section
    if (dto.plantStress) {
        const labels = { temperature: 'Temperature', humidity: 'Humidity', light: 'Light', nutrients: 'Nutrients' };
        const entries = Object.entries(dto.plantStress.breakdown)
            .filter(([, v]) => v.count > 0)
            .sort((a, b) => b[1].count - a[1].count);
        if (entries.length > 0) {
            const rows = [ ['Stressor', 'Plants', 'Avg Stress'],
                ...entries.map(([k, v]) => [labels[k] || k, v.count, v.avgStress.toFixed(2)]) ];
            const stressWrap = document.createElement('div');
            const avgP = document.createElement('p');
            avgP.textContent = `Avg Stress: ${dto.plantStress.avgStress.toFixed(2)}`;
            stressWrap.appendChild(avgP);
            stressWrap.appendChild(table(rows));
            root.appendChild(section('Stress', stressWrap));
        }
    }

    // 4. Plant Packages
    if (dto.plantPackages && dto.plantPackages.length > 0) {
        const pkgTable = table([
            ['Package', 'Count', 'Avg Age (d)', 'Avg Health', 'Biomass Idx'],
            ...dto.plantPackages.map(p => [p.label, p.count, p.avgAgeDays, `${p.avgHealth}%`, p.biomassIndex])
        ]);
        root.appendChild(section('Plant Packages', pkgTable));
    }

    // 5. Devices Section
    const dev = dto.devices;
    const devicesGrid = document.createElement('div');
    devicesGrid.className = 'grid';
    devicesGrid.appendChild(card('Devices', `${dev.active} / ${dev.total} active`));
    devicesGrid.appendChild(card('Avg. Health', `${dev.avgHealth}%`));
    devicesGrid.appendChild(card('Maintenance Due', `in ${dev.maintenanceDueInTicks} ticks`));
    const cta = document.createElement('p');
    const ctaLink = document.createElement('a');
    ctaLink.href = '#';
    ctaLink.dataset.jump = `devices:${zone.id}`;
    ctaLink.textContent = 'View All Devices';
    cta.appendChild(ctaLink);
    const devicesWrap = document.createElement('div');
    devicesWrap.appendChild(devicesGrid);
    devicesWrap.appendChild(cta);
    root.appendChild(section('Devices', devicesWrap));

    // Delegate jumps
    root.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-jump]'); if (!a) return; e.preventDefault();
        const [kind, id] = a.getAttribute('data-jump').split(':'); selectNode(kind, id);
    }, { once: true });
}

function renderPlantDetail(root, dto, zone) {
    const envRows = [
        ['Temperature (°C)',
            dto.environment.temperature.set.length ? `${dto.environment.temperature.set[0]}-${dto.environment.temperature.set[1]}` : 'N/A',
            dto.environment.temperature.actual.toFixed(1)],
        ['Humidity (%)',
            dto.environment.humidity.set.length ? `${(dto.environment.humidity.set[0]*100).toFixed(0)}-${(dto.environment.humidity.set[1]*100).toFixed(0)}` : 'N/A',
            (dto.environment.humidity.actual*100).toFixed(0)],
        ['CO2 (ppm)', dto.environment.co2.set, dto.environment.co2.actual.toFixed(0)],
        ['PPFD',
            dto.environment.light.set.length ? `${dto.environment.light.set[0]}-${dto.environment.light.set[1]}` : 'N/A',
            dto.environment.light.actual.toFixed(0)]
    ];
    root.appendChild(section('Environment vs. Required', table([['Factor','Required','Actual'], ...envRows])));

    const labels = { temperature: 'Temperature', humidity: 'Humidity', light: 'Light', nutrients: 'Nutrients' };
    const entries = Object.entries(dto.stressFactors.breakdown)
        .filter(([, v]) => v.count > 0)
        .sort((a, b) => b[1].count - a[1].count);
    if (entries.length) {
        const rows = [['Factor', 'Count', 'Avg Stress'], ...entries.map(([k, v]) => [labels[k] || k, v.count, v.avg.toFixed(2)])];
        const stressWrap = document.createElement('div');
        const avgP = document.createElement('p');
        avgP.textContent = `Avg Stress: ${dto.stressFactors.avgStress.toFixed(2)}`;
        stressWrap.appendChild(avgP);
        stressWrap.appendChild(table(rows));
        root.appendChild(section('Stress Factors', stressWrap));
    }

    const plantRows = [['ID', 'Strain', 'Age (d)', 'Health', 'Stress'],
        ...dto.plants.map(p => [
            link(`plant:${p.id}`, p.shortId),
            p.strain,
            p.ageDays,
            p.health,
            p.stress
        ])];
    root.appendChild(section('Plants in Zone', table(plantRows)));

    root.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-jump]'); if (!a) return; e.preventDefault();
        const [kind, id] = a.getAttribute('data-jump').split(':'); selectNode(kind, id);
    }, { once: true });
}

function renderZonePlantsDetails(root, dto) {
    const env = dto.environment;
    const headerGrid = document.createElement('div');
    headerGrid.className = 'grid';
    headerGrid.appendChild(card('Temperature', `${env.temperature.actual.toFixed(1)}°C`,
        env.temperature.target.length ? `Target: ${env.temperature.target[0].toFixed(1)}-${env.temperature.target[1].toFixed(1)}°C` : 'Target: N/A'));
    headerGrid.appendChild(card('Humidity', `${(env.humidity.actual * 100).toFixed(0)}%`,
        env.humidity.target.length ? `Target: ${(env.humidity.target[0]*100).toFixed(0)}-${(env.humidity.target[1]*100).toFixed(0)}%` : 'Target: N/A'));
    headerGrid.appendChild(card('CO₂', `${env.co2.actual.toFixed(0)}ppm`, `Target: ${env.co2.target.toFixed(0)}ppm`));
    headerGrid.appendChild(card('Light', `${env.light.actual.toFixed(0)}`,
        env.light.target.length ? `Target: ${env.light.target[0].toFixed(0)}-${env.light.target[1].toFixed(0)}` : 'Target: N/A'));
    root.appendChild(headerGrid);

    const stressEntries = Object.entries(dto.stress.breakdown).filter(([,v]) => v.count > 0);
    if (stressEntries.length) {
        const rows = [['Stressor', 'Plants', 'Avg Stress'],
            ...stressEntries.map(([k,v]) => [k, v.count, v.avg.toFixed(2)])];
        root.appendChild(section('Stress Breakdown', table(rows)));
    }

    const plantRows = [['ID', 'Strain', 'Stage', 'Age (d)', 'Health', 'Stress', 'Stressors'],
        ...dto.plants.map(p => [
            link(`plant:${p.id}`, p.id),
            p.strain,
            p.stage,
            (p.ageHours/24).toFixed(1),
            p.health.toFixed(1),
            p.stress.toFixed(1),
            Object.keys(p.stressors || {}).join(', ') || '—'
        ])];
    root.appendChild(section('Plants', table(plantRows)));
}

function renderCompanyContent(root) {
    const period = state.companyPeriod || '24h';
    const aggregates = state.aggregates || {};
    const agg = aggregates[period] || {};

    const header = document.createElement('div');
    header.className = 'section';
    header.innerHTML = `<header><strong>Company Overview</strong></header>`;

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    [ ['24h','24\u202fh'], ['7d','7\u202fd'], ['1m','1\u202fm'] ].forEach(([p,label]) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (p === period) btn.classList.add('active');
        btn.addEventListener('click', () => {
            setState({ companyPeriod: p });
        });
        tabs.appendChild(btn);
    });
    header.appendChild(tabs);
    root.appendChild(header);

    // Resource Usage
    const resSection = document.createElement('div');
    resSection.className = 'section';
    resSection.innerHTML = `<header>Resource Usage</header>`;
    const resGrid = document.createElement('div');
    resGrid.className = 'grid';
    resGrid.appendChild(card('Energy', formatUnits(agg.energyKWh || 0, 'kWh')));
    resGrid.appendChild(card('Water', formatUnits(agg.waterL || 0, 'liters')));
    resSection.appendChild(resGrid);
    root.appendChild(resSection);

    // Cost Breakdown
    const costSection = document.createElement('div');
    costSection.className = 'section';
    costSection.innerHTML = `<header>Cost Breakdown</header>`;
    const costGrid = document.createElement('div');
    costGrid.className = 'grid';
    costGrid.appendChild(card('Energy', fmtEUR.format(agg.energyEUR || 0)));
    costGrid.appendChild(card('Water', fmtEUR.format(agg.waterEUR || 0)));
    costGrid.appendChild(card('Fertilizer', fmtEUR.format(agg.fertilizerEUR || 0)));
    costGrid.appendChild(card('Rent', fmtEUR.format(agg.rentEUR || 0)));
    costGrid.appendChild(card('Maintenance', fmtEUR.format(agg.maintenanceEUR || 0)));
    costGrid.appendChild(card('Capex', fmtEUR.format(agg.capexEUR || 0)));
    costGrid.appendChild(card('Other', fmtEUR.format(agg.otherExpenseEUR || 0)));
    costGrid.appendChild(card('Total', fmtEUR.format(agg.totalExpensesEUR || 0)));
    costSection.appendChild(costGrid);
    root.appendChild(costSection);

    // Financial Position
    const finSection = document.createElement('div');
    finSection.className = 'section';
    finSection.innerHTML = `<header>Financial Position</header>`;
    const finGrid = document.createElement('div');
    finGrid.className = 'grid';
    finGrid.appendChild(card('Opening Balance', fmtEUR.format(agg.openingBalanceEUR || 0)));
    finGrid.appendChild(card('Closing Balance', fmtEUR.format(agg.closingBalanceEUR || 0)));
    finGrid.appendChild(card('Revenue', fmtEUR.format(agg.revenueEUR || 0)));
    finGrid.appendChild(card('Net', fmtEUR.format(agg.netEUR || 0)));
    finSection.appendChild(finGrid);
    root.appendChild(finSection);
}

async function renderEditorContent(root) {
    if (state.level === 'strains') {
        const mod = await import('./editor/strainEditor.js');
        await mod.default(root);
    } else {
        root.innerHTML = '<p style="color:var(--muted)">Bitte links ein Element wählen…</p>';
    }
}

function renderTop() {
    txt("#tick", state.tick);
    txt("#day", state.day);
    txt("#time", state.simTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    txt("#balance-top", fmtEUR.format(state.balance));
    txt("#tick-hours", state.tickHours);
    txt("#daily-energy", formatUnits(state.dailyEnergyKWh, 'kWh'));
    txt("#daily-water", formatUnits(state.dailyWaterL, 'liters'));
    const clock = $("#clock");
    if (clock) clock.classList.toggle("running", state.running);
}

// --- Finders -------------------------------------------------------------
function findStructure(id) { return state.structureData.structures.find((s) => s.id === id); }
function findStructureOfRoom(roomId) { return state.structureData.structures.find((s) => s.rooms.some((r) => r.id === roomId)); }
function findParentsOfZone(zoneId) {
    for (const s of state.structureData.structures) {
        for (const r of s.rooms) {
            const z = r.zones.find((z) => z.id === zoneId);
            if (z) return { s, r, z };
        }
    }
    return null;
}
function findParentsOfPlant(plantId) {
    for (const s of state.structureData.structures) {
        for (const r of s.rooms) {
            for (const z of r.zones) {
                const p = z.plants?.find((p) => p.id === plantId);
                if (p) return { s, r, z, p };
            }
        }
    }
    return null;
}

// --- Simulation Controls -------------------------------------------------
async function postToServer(url, body) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

$("#btn-play").addEventListener("click", async () => {
    await postToServer("/simulation/start", { preset: state.speed, savegame: "default", difficulty: "normal" });
    setState({ running: true });
    $("#btn-play").disabled = true;
    $("#btn-pause").disabled = false;
    await fetchInitialData();
});

$("#btn-pause").addEventListener("click", async () => {
    await postToServer("/simulation/pause");
    setState({ running: false });
    $("#btn-play").disabled = false;
    $("#btn-pause").disabled = true;
});

$("#btn-step").addEventListener("click", async () => {
    if (!state.running) {
        await postToServer("/simulation/step");
    }
});

$$(".speed").forEach((b) => {
    b.addEventListener("click", () => {
        setState({ speed: b.dataset.speed });
        $$(".speed").forEach((btn) => btn.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        if (state.running) {
            postToServer("/simulation/resume", { preset: state.speed });
        }
    });
});

// --- Init ----------------------------------------------------------------
function init() {
    $$(".rbtn").forEach((b) =>
        b.addEventListener("click", () => {
            $$(".rbtn").forEach((x) => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            setState({
                treeMode: b.dataset.mode,
                level: "none",
                structureId: null,
                roomId: null,
                zoneId: null,
                plantId: null,
                companySel: null,
                shopSel: null,
            });
            buildTree();
            renderBreadcrumbs();
        })
    );


    $("#btn-pause").disabled = true;
    renderTop();
}

document.addEventListener("DOMContentLoaded", init);
