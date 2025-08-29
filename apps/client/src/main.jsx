import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { startUiStream } from './store/uiStore.js';
import './styles.css';

startUiStream();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
