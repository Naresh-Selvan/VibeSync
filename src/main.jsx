import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global Console Logger wrapper for Diagnostics
window.__debugLogs = [];
const wrapConsole = (method) => {
  const original = console[method];
  console[method] = (...args) => {
    try {
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      window.__debugLogs.push(`[${method.toUpperCase()}] ${msg}`);
      if (window.__debugLogs.length > 80) {
        window.__debugLogs.shift();
      }
    } catch(e) {}
    original.apply(console, args);
  };
};
wrapConsole('log');
wrapConsole('warn');
wrapConsole('error');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
