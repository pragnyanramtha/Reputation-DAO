// ===== Polyfills for ICP compatibility =====
import { Buffer } from 'buffer';

(window as any).global ||= window;
(window as any).Buffer ||= Buffer;
(window as any).process ||= { env: {} };

// ===== App Bootstrapping =====
import React from "react";
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { VeraWidget } from "./components/VeraWidget";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <VeraWidget />
  </React.StrictMode>,
);
