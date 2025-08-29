import React from 'react';
import { useDevLog } from '@/store/uiStore.js';

/** Dev console showing recent event log in development builds. */
export default function DevConsole() {
  if (!import.meta.env.DEV) return null;
  const logs = useDevLog();
  return (
    <pre style={{ position:'fixed', bottom:0, left:0, right:0, maxHeight:'30%', overflowY:'auto', margin:0, padding:'4px', background:'#111', color:'#0f0', fontSize:10 }}>
      {logs.join('\n')}
    </pre>
  );
}
