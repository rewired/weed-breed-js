import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startUiStream } from './store/uiStore.js';
import './styles.css';

/** Bootstraps the React app safely and logs diagnostics. */
startUiStream();

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[boot] #root not found');
} else {
  console.info('[boot] React', React.version, 'mode', import.meta.env.MODE);
  const t = performance.now();
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.info('[boot] mounted in', Math.round(performance.now() - t), 'ms');
}
