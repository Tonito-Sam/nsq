import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log("App booting");
try {
    const rootEl = document.getElementById("root");
    if (!rootEl) throw new Error("Root element not found");
    createRoot(rootEl).render(<App />);
} catch (err) {
    // Ensure any mount-time exception is visible in console immediately
    // This helps identify crashes caused by third-party scripts or runtime errors
    // that would otherwise leave the app appearing to 'load forever'.
    // eslint-disable-next-line no-console
    console.error("Mount failed:", err);
}
