import React from 'react';
import { useConnection } from '@/store/uiStore.js';

/**
 * Small banner showing connection state and data flow.
 * Visible in all builds.
 */
export default function ConnectionBanner() {
  const { status, lastBatchSize } = useConnection();
  let text = status;
  if (status === 'connected' && lastBatchSize === 0) text = 'no data';
  const bg =
    status === 'connected' && lastBatchSize > 0 ? '#20c997' :
    status === 'connected' ? '#f59f00' :
    '#fa5252';
  return (
    <div style={{ background: bg, color: '#000', textAlign: 'center', padding: '2px 6px', fontSize: 12 }}>
      {text}
    </div>
  );
}
