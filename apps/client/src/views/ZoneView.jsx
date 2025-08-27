import React, { useEffect, useState } from 'react';
import { useUiState } from '../store/uiStore.js';
import {
  fmtCelsius,
  fmtPercent,
  fmtPPM,
  fmtPPFD,
  fmtGram,
  fmtNumber,
} from '../utils/format.js';

/** View for a single zone. */
export default function ZoneView({ zoneId }) {
  const { zones, plants } = useUiState();
  const zone = zones.get(zoneId);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!zone) return;
    setHistory((h) => [...h.slice(-19), zone.temp_C ?? 0]);
  }, [zone && zone.temp_C]);

  if (!zone) return <div>Zone {zoneId} not found.</div>;

  const plantCount = Array.from(plants.values()).filter((p) => p.zoneId === zoneId).length;
  const points = history.map((v, i) => `${i * 5},${50 - (v || 0)}`).join(' ');
  const lastHarvest = zone.lastHarvestTs ? new Date(zone.lastHarvestTs).toLocaleString() : 'n/a';

  return (
    <div>
      <h2>Zone {zoneId}</h2>
      <div>
        Temp: {fmtCelsius(zone.temp_C)} | Humidity: {fmtPercent(zone.humidity_rel)} | CO₂: {fmtPPM(zone.co2_ppm)} | PPFD: {fmtPPFD(zone.ppfd_umol_m2s)}
      </div>
      <div>
        Plants: {fmtNumber(plantCount)} | Buds: {fmtGram(zone.buds_g)} | Biomass: {fmtGram(zone.biomass_g)} | Last harvest: {lastHarvest}
      </div>
      <svg width="100" height="50" style={{ marginTop: '0.5rem' }}>
        <polyline fill="none" stroke="var(--accent)" points={points} />
      </svg>
    </div>
  );
}
