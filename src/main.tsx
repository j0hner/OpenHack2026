import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import '@fontsource-variable/inter';
import './styles.css';
import './redesign.css';
import './dark-mode.css';
import './interface-polish.css';
import App from './App';
import { applyTheme, readTheme } from './lib/theme';

applyTheme(readTheme());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
