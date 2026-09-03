"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  registerFilmTools,
  syncWebmcpApiRef,
} from "@/lib/register-tools";
import { useFilm } from "@/lib/film-store";

export function WebMCPBridge() {
  const api = useFilm();
  const apiRef = useRef(api);

  useLayoutEffect(() => {
    apiRef.current = api;
    syncWebmcpApiRef(apiRef);
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    // Defer until after hydration so document.modelContext and localStorage
    // film state are stable before agents poll get_film.
    const start = () => {
      // Page-lifetime registration: do not abort on React unmount (Strict Mode /
      // Fast Refresh). Aborting unregisters tools and invalidates the host's
      // snapshot. Tools last until this document unloads (refresh/navigation).
      registerFilmTools(apiRef)
        .then((result) => {
          if (cancelled) {
            return;
          }
          void result;
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          console.error("WebMCP registration failed", error);
        });
    };

    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(start);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
    };
  }, []);

  return null;
}
