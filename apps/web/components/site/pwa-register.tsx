"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, and — importantly — unregisters it when the flag goes off.
 *
 * A service worker outlives the page that installed it. Turning the feature off without this would
 * leave every phone that ever visited still running the old worker, which is how a flag stops being a
 * flag.
 */
export function PwaRegister({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (enabled) {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.error("service worker registration failed", e));
      return;
    }
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) void r.unregister();
    });
    if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }, [enabled]);
  return null;
}
