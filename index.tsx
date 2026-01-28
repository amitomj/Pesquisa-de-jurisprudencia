
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// SHIM CRÍTICO: Deve correr ANTES de qualquer outro import
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
  // Tenta recuperar a chave do armazenamento local imediatamente
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) {
    (window as any).process.env.API_KEY = savedKey;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
