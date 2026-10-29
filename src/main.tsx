import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
// Initialize Day.js plugins
import './lib/dayjs';

console.log("App booting");
console.log("Starting app bootstrap...");

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message, event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});

// Force unregister all service workers immediately
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      console.log('Unregistering service worker:', registration);
      registration.unregister();
    }
  }).catch(function(err) {
    console.log('Service Worker unregistration failed:', err);
  });
}

// Also clear any cached data
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
    }
  });
}

try {
    const rootEl = document.getElementById("root");
    if (!rootEl) throw new Error("Root element not found");
    createRoot(rootEl).render(<App />);
} catch (err) {
    console.error("Mount failed:", err);
}