import { makeSmoother } from "./smoother.js";
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
    treeMode: "structure", // 'structure' | 'finance' | 'shop'
    level: "none",
    structureId: null,
    roomId: null,
    zoneId: null,
    plantId: null,
    finSel: null,
    shopSel: null,
    running: false,
    speed: 1,
    tick: 0,
    tickHours: 3,
    simTime: new Date(2025, 0, 1, 8, 0, 0),
    balance: 0,
    structureData: { structures: [] },
};

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
                state.running = data.status === "running";
                $("#btn-play").disabled = true;
                $("#btn-pause").disabled = !state.running;
                const clock = $("#clock");
                clock.classList.toggle("running", state.running);
            }
            if (data.structure) {
                // The backend returns a single structure, but the frontend expects an array of structures.
                state.structureData = { structures: [data.structure] };
                buildTree();
                // By default, select the first structure
                if (state.structureData.structures.length > 0) {
                    selectNode("structure", state.structureData.structures[0].id);
                }
            }
            if (data.tick) {
                updateWithLiveData(data);
            }
        }
    } catch (error) {
        console.error("Error fetching initial status:", error);
    }
}

function updateWithLiveData(data) {
    console.log(JSON.stringify(data, null, 2));
    state.tick = data.tick;
    state.simTime = new Date(data.isoTime);
    state.balance = data.balance;
    state.tickHours = data.tickIntervalHours;

    // Update live data in the structure data
    if (data.zoneSummaries) {
        data.zoneSummaries.forEach(summary => {
            for (const structure of state.structureData.structures) {
                for (const room of structure.rooms) {
                    const zone = room.zones.find(z => z.id === summary.id);
                    if (zone) {
                        Object.assign(zone, summary);
                    }
                }
            }
        });
    }
    renderTop();
    renderContent();
}

// --- Tree Building -------------------------------------------------------
function buildTree() {
    const tree = $("#tree");
    tree.innerHTML = "";
    if (state.treeMode === "structure") buildStructureTree(tree);
    // Placeholder for other trees
    if (state.treeMode === "finance") buildFinanceTree(tree);
    if (state.treeMode === "shop") buildShopTree(tree);
}

function nodeLi(kind, id, icon, title, alerts = 0, count = 0) {
    const li = document.createElement("li");
    li.setAttribute("role", "treeitem");
    li.innerHTML = `<div class="node" tabindex="0" data-kind="${kind}" data-id="${id}">
        <span class="twisty">▸</span> <span class="title">${icon} ${title}</span>
        <span class="badge" title="Zähler/Status">${count}${alerts ? ` • ⚠${alerts}` : ""}</span>
    </div><div class="children" hidden></div>`;
    const node = li.firstElementChild;
    const children = li.lastElementChild;
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

// --- Selection & Rendering -----------------------------------------------
function selectNode(kind, id) {
    if (state.treeMode === "structure") {
        state.level = kind;
        state.plantId = null; // Reset plantId on any new selection

        if (kind === "structure") {
            state.structureId = id;
            state.roomId = null;
            state.zoneId = null;
        } else if (kind === "room") {
            state.roomId = id;
            state.zoneId = null;
            const s = findStructureOfRoom(id);
            state.structureId = s?.id || null;
        } else if (kind === "zone" || kind === "devices" || kind === "plants") {
            state.zoneId = id;
            const { s, r } = findParentsOfZone(id) || {};
            state.structureId = s?.id || null;
            state.roomId = r?.id || null;
        } else if (kind === "plant") {
            state.plantId = id;
            const p = findParentsOfPlant(id);
            state.structureId = p?.s?.id || null;
            state.roomId = p?.r?.id || null;
            state.zoneId = p?.z?.id || null;
        }
    }
    // ... other tree modes

    // Visual selection
    $$("#tree .node").forEach((n) => n.setAttribute("aria-selected", "false"));
    const current = $(`#tree .node[data-kind="${kind}"][data-id="${id}"]`);
    if (current) current.setAttribute("aria-selected", "true");

    renderBreadcrumbs();
    renderContent();
}

function renderContent() {
    const root = $("#content");
    root.innerHTML = "";
    if (state.treeMode === "structure") return renderStructureContent(root);
    // ... other tree modes
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
    header.innerHTML = `<header style="display:flex;justify-content:space-between;align-items:center"><div><strong>${title}</strong><div style="color:var(--muted);font-size:12px">${subtitle}</div></div><div class="badge">Kontext: ${level}</div></header>`;
    root.appendChild(header);

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
    }
    if (level === 'zone' && z) {
        kpis.appendChild(card('Temp', `${z.temperatureC ? z.temperatureC.toFixed(1) : 'N/A'} °C`, 'Soll 24'));
        kpis.appendChild(card('RH', `${z.humidity ? (z.humidity * 100).toFixed(1) : 'N/A'} %`, 'Soll 55–65'));
        kpis.appendChild(card('CO₂', `${z.co2ppm ? z.co2ppm.toFixed(0) : 'N/A'} ppm`, 'Soll 800-1200'));
    }
    if (level === 'devices' && z) {
        const list = z.devices || [];
        const avgHealth = list.length ? (list.reduce((a, d) => a + (d.health || 0), 0) / list.length) : 0;
        const maint = list.reduce((a, d) => a + (d.maintenanceEUR_tick || 0), 0);
        kpis.appendChild(card('Geräte gesamt', list.length, 'in Zone'));
        kpis.appendChild(card('Ø Health', fmtNUM.format(avgHealth), '0–1'));
        kpis.appendChild(card('Wartung/Tick', fmtEUR.format(maint), 'Summe'));
    }
    if (level === 'plant' && p) {
        kpis.appendChild(card('Age', p ? `${p.age} d` : '—', 'Tage'));
        kpis.appendChild(card('Biomasse', p ? `${p.biomass.toFixed(2)} g` : '—', 'geschätzt'));
        kpis.appendChild(card('Stress', p?.stress ?? '—', '0–1'));
    }
    if (level !== 'none') root.appendChild(kpis);

    // Context detail blocks
    if (level === 'structure' && s) {
        root.appendChild(section('Rooms in Structure', table([
            ['Room', 'Zones', 'Plants', 'Yield (g)', 'Devices', 'Alerts'],
            ...s.rooms.map(r => [
                link(`room:${r.id}`, r.name),
                r.zones.length,
                r.zones.reduce((p, z) => p + (z.plants?.length || 0), 0),
                r.zones.reduce((sum, z) => sum + (parseFloat(z.expectedYield) || 0), 0).toFixed(2),
                r.zones.reduce((d, z) => d + (z.devices?.length || 0), 0),
                r.alerts ? `⚠ ${r.alerts}` : '—'
            ])
        ])));
    }
    if (level === 'room' && r) {
        root.appendChild(section('Zones in Room', table([
            ['Zone', 'Plants', 'Harvest in (d)', 'Yield (g)', 'Devices', 'Alerts'],
            ...r.zones.map(z => [
                link(`zone:${z.id}`, z.name),
                z.plants?.length || 0,
                z.timeToHarvest ?? 'N/A',
                z.expectedYield ?? 'N/A',
                z.devices?.length || 0,
                z.alerts ? `⚠ ${z.alerts}` : '—'
            ])
        ])));
    }
    if (level === 'zone' && z) {
        root.appendChild(section('Navigiere zu…', `<ul style="margin:0;padding-left:16px">
            <li>${link(`devices:${z.id}`, 'Devices')}</li>
            <li>${link(`plants:${z.id}`, 'Plants')}</li>
        </ul>`));
    }
    if (level === 'devices' && z) {
        root.appendChild(section('Devices', table([
            ['Device', 'Kind', 'Health', 'Wartung/Tick'],
            ...(z.devices || []).map(d => [d.name, d.type, d.health ? d.health.toFixed(2) : 'N/A', fmtEUR.format(d.maintenanceCostPerTick || 0)])
        ])));
    }
    if (level === 'plants' && z) {
        root.appendChild(section('Plants', table([
            ['Plant', 'Strain', 'Age (d)', 'Biomass (g)', 'Health', 'Stress'],
            ...(z.plants || []).map(p => [
                p.name,
                p.strain?.name || 'N/A',
                (p.ageHours / 24).toFixed(1),
                p.biomass.toFixed(2),
                p.health.toFixed(2),
                p.stress.toFixed(2)
            ])
        ])));
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
        if (state.level === 'plants') { parts.push({ label: 'Plants', kind: 'plants', id: state.zoneId }); }
        if (!parts.length) { c.innerHTML = '<span style="color:var(--muted)">Bitte links ein Element wählen…</span>'; return; }
        parts.forEach((p, i) => { const a = document.createElement('a'); a.href = 'javascript:void(0)'; a.textContent = p.label; a.addEventListener('click', () => selectNode(p.kind, p.id)); c.appendChild(a); if (i < parts.length - 1) { const s = document.createElement('span'); s.textContent = '›'; s.style.color = 'var(--muted)'; s.style.margin = '0 4px'; c.appendChild(s); } });
    } else {
        const label = state.treeMode === 'finance' ? 'Finance Explorer' : 'Shop Explorer';
        c.innerHTML = `<strong>${label}</strong>`;
    }
}

function section(title, inner) { const el = document.createElement('div'); el.className = 'section'; el.innerHTML = `<header><h3>${title}</h3></header>` + inner; return el; }
function table(rows) { return `<table>${rows.map((row, i) => i ? `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>` : `<thead><tr>${row.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`).join('')}</tbody></table>`; }
function card(title, value, sub = '') { const el = document.createElement('div'); el.className = 'card'; el.innerHTML = `<h3>${title}</h3><div class="metric"><div class="v">${value}</div><div class="sub">${sub}</div></div>`; return el; }
function link(target, label) { return `<a href="#" data-jump="${target}">${label}</a>`; }


function renderTop() {
    txt("#tick", state.tick);
    txt("#day", Math.ceil((state.simTime.getTime() - new Date(state.simTime).setHours(0, 0, 0, 0)) / (24 * 3600 * 1000)));
    txt("#time", state.simTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    txt("#balance-top", fmtEUR.format(state.balance));
    txt("#tick-hours", state.tickHours);
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
    state.running = true;
    $("#btn-play").disabled = true;
    $("#btn-pause").disabled = false;
    renderTop();
});

$("#btn-pause").addEventListener("click", async () => {
    await postToServer("/simulation/pause");
    state.running = false;
    $("#btn-play").disabled = false;
    $("#btn-pause").disabled = true;
    renderTop();
});

$("#btn-step").addEventListener("click", async () => {
    if (!state.running) {
        await postToServer("/simulation/step");
    }
});

$$(".speed").forEach((b) => {
    b.addEventListener("click", () => {
        state.speed = parseFloat(b.dataset.speed);
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
            state.treeMode = b.dataset.mode;
            state.level = "none";
            state.structureId = state.roomId = state.zoneId = state.plantId = null;
            state.finSel = state.shopSel = null;
            buildTree();
            renderBreadcrumbs();
            renderContent();
        })
    );


    $("#btn-pause").disabled = true;
    renderTop();
}

document.addEventListener("DOMContentLoaded", init);
