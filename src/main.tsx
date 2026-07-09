import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

// The app no longer uses a service worker, but existing visitors still have
// the old model-caching one active. Registering the replacement sw.js (a
// self-destructor: wipes all caches, unregisters, reloads) is the only way to
// evict it. Remove this block once the old SW population has cycled out.
if (import.meta.env.PROD && typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Construct absolute origin-relative URL compatible with Vercel and subdirectory hosts (GitHub Pages)
    const base = import.meta.env.BASE_URL === "./" 
      ? window.location.pathname.replace(/\/[^\/]*$/, "/") 
      : import.meta.env.BASE_URL;
    const swUrl = `${window.location.origin}${base.replace(/\/$/, "")}/sw.js`;
    
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        console.log("Service Worker registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
