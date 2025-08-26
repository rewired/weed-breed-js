/**
 * Loader that reconstructs engine structures, rooms and zones from a savegame.
 * @module engine/loaders/savegameLoader
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Structure } from '../Structure.js';
import { Room } from '../Room.js';
import { SimZone } from '../Zone.js';
import { SimPlant } from '../Plant.js';
import { loadStrainById } from './strainLoader.js';
import { loadCultivationMethod } from './cultivationMethodLoader.js';
import { loadAllDevices } from './deviceLoader.js';
import { createDevice } from '../factories/deviceFactory.js';

/**
 * Load a complete world from a savegame file.
 *
 * @param {object} [opts]
 * @param {string} [opts.path] - path to savegame; defaults to env SAVEGAME_PATH or data/savegames/default.json
 * @param {object} [opts.runtime] - optional runtime context passed to created objects
 * @returns {Promise<{structures:Array, rooms:Array, zones:Array}>}
 */
export async function loadFromSavegame({ path: savePath, runtime = {} } = {}) {
  const resolvedPath = savePath ?? process.env.SAVEGAME_PATH ?? 'data/savegames/default.json';
  const raw = await fs.readFile(resolvedPath, 'utf8');
  const data = JSON.parse(raw);

  const structures = [];
  const rooms = [];
  const zones = [];

  // Preload device blueprints and index by id
  const deviceBlueprints = await loadAllDevices();
  const blueprintMap = new Map(deviceBlueprints.map(d => [d.id, d]));

  const structData = data.structure;
  if (!structData) return { structures, rooms, zones };

  const structure = new Structure({ ...structData, runtime });
  structures.push(structure);

  for (const roomData of structData.rooms ?? []) {
    const room = new Room({ ...roomData, runtime });
    structure.addRoom(room);
    rooms.push(room);

    for (const zoneData of roomData.zones ?? []) {
      const zone = new SimZone({
        id: zoneData.id,
        ppfdVeg: 600,
        ppfdFlower: 700,
        temperature: 24,
        co2ppm: 800,
      });
      zone.name = zoneData.name ?? zoneData.id;
      zone.area = Number(zoneData.area ?? room.area ?? 0);
      zone.height = zoneData.height ?? room.height;
      zone.devices = [];

      // devices
      for (const d of zoneData.devices ?? []) {
        const bp = blueprintMap.get(d.blueprintId);
        if (!bp) continue;
        const count = Number(d.count ?? 1);
        for (let i = 0; i < count; i++) {
          const device = createDevice(bp, { tickLengthInHours: 1 }, d.overrides);
          zone.devices.push(device);
        }
      }

      const sim = zoneData.simulation ?? {};
      const strain = sim.strainId ? await loadStrainById(sim.strainId) : null;
      const method = sim.methodId ? await loadCultivationMethod(sim.methodId) : null;
      const areaPerPlant = method?.areaPerPlant ?? 0.25;
      const plantCount = Math.max(0, Math.floor(zone.area / areaPerPlant));
      for (let i = 0; i < plantCount; i++) {
        const plant = new SimPlant({
          strainName: strain?.name ?? 'Unknown',
          vegDays: strain?.photoperiod?.vegetationDays ?? 21,
          flowerDays: strain?.photoperiod?.floweringDays ?? 56,
        });
        zone.addPlant(plant);
      }

      room.addZone(zone);
      zones.push(zone);
    }
  }

  return { structures, rooms, zones };
}

