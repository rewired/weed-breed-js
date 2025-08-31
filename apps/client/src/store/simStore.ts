import { BehaviorSubject } from 'rxjs';
import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket.js';

export interface SimState {
  cash: number;
  dailyCosts: number;
  zones: Record<string, { avgStress?: number; totalBiomass_g?: number; totalBuds_g?: number; lastHarvestDay?: number }>;
}

const initial: SimState = { cash: 0, dailyCosts: 0, zones: {} };
export const simState$ = new BehaviorSubject<SimState>(initial);

export function applySimDay(payload: any) {
  const cur = simState$.value;
  const zones = { ...cur.zones };
  const day = payload?.day;
  for (const z of payload?.zoneStats ?? []) {
    zones[z.zoneId] = {
      ...(zones[z.zoneId] || {}),
      avgStress: z.avgStress,
      totalBiomass_g: z.totalBiomass_g,
      totalBuds_g: z.totalBuds_g,
      lastHarvestDay: z.harvestEventsToday > 0 ? day : zones[z.zoneId]?.lastHarvestDay,
    };
  }
  const finance = payload?.finance || {};
  simState$.next({
    cash: finance.cash ?? cur.cash,
    dailyCosts: finance.dailyCosts ?? cur.dailyCosts,
    zones,
  });
}

export function applyFinanceUpdate(payload: any) {
  const cur = simState$.value;
  simState$.next({ ...cur, cash: payload?.cash ?? cur.cash });
}

export function applyHarvestEvent(payload: any) {
  if (!payload?.zoneId) return;
  const cur = simState$.value;
  const zones = { ...cur.zones };
  const z = zones[payload.zoneId] || {};
  z.lastHarvestDay = payload.day ?? z.lastHarvestDay;
  zones[payload.zoneId] = z;
  simState$.next({ ...cur, zones });
}

socket.on('sim:day', applySimDay);
socket.on('finance:update', applyFinanceUpdate);
socket.on('harvest:event', applyHarvestEvent);

export function useSimState() {
  const [val, setVal] = useState(simState$.value);
  useEffect(() => {
    const s = simState$.subscribe(setVal);
    return () => s.unsubscribe();
  }, []);
  return val;
}
