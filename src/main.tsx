import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

// Register the Service Worker for offline capability & model caching.
// Production only: in dev its stale-while-revalidate serves stale Vite modules
// (breaking HMR and masking code changes), and dev needs no offline cache.
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
