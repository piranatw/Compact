"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installation guidance in Settings covers the unsupported/failed case explicitly.
      });
    }
  }, []);
  return null;
}
