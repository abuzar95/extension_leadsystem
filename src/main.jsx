import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';

// Wait for DOM to be ready
function init() {
  // Check if root already exists
  let rootElement = document.getElementById('prospect-extension-root');
  
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'prospect-extension-root';
    document.body.appendChild(rootElement);
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
