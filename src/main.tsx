import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';
import { HeaderTools } from './HeaderTools';
import './styles.css';
import './header-tools.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate/>
    <HeaderTools/>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
