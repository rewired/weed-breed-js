import React, { useEffect, useState } from 'react';
import StructurePage from '../pages/Structure.jsx';
import RoomView from '../views/RoomView.jsx';
import ZoneView from '../views/ZoneView.jsx';
import DevicesView from '../views/DevicesView.jsx';
import PlantsView from '../views/PlantsView.jsx';

/** Simple hash router. */
export default function Router() {
  const [hash, setHash] = useState(location.hash || '#/structure');
  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/structure');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  let View = StructurePage;
  let params = {};
  const mRoom = hash.match(/^#\/room\/(.+)$/);
  const mZone = hash.match(/^#\/zone\/(.+)$/);
  if (mRoom) {
    View = RoomView;
    params = { roomId: mRoom[1] };
  } else if (mZone) {
    View = ZoneView;
    params = { zoneId: mZone[1] };
  } else if (hash.startsWith('#/devices')) {
    View = DevicesView;
  } else if (hash.startsWith('#/plants')) {
    View = PlantsView;
  }

  return <View {...params} />;
}
