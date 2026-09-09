import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate/></React.StrictMode>);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
