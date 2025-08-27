import React from 'react';
import ReactDOM from 'react-dom/client';
import AppShell from './components/AppShell.jsx';
import Router from './routes/Router.jsx';
import { startUiStream } from './store/uiStore.js';
import './styles.css';

startUiStream();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppShell>
      <Router />
    </AppShell>
  </React.StrictMode>
);
