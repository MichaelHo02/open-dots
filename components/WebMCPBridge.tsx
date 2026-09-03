"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  registerFilmTools,
  syncWebmcpApiRef,
} from "@/lib/register-tools";
import { useFilm } from "@/lib/film-store";

export function WebMCPBridge() {
  const api = useFilm();
  const apiRef = useRef(api);
  const [status, setStatus] = useState<"booting" | "live" | "error">("booting");
  const [native, setNative] = useState(false);
  const [count, setCount] = useState(0);

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
          setNative(result.native);
          setCount(result.count);
          setStatus("live");
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          console.error("WebMCP registration failed", error);
          setStatus("error");
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

  return (
    <div
      className={`webmcp-badge ${status}`}
      title={
        native
          ? "Native document.modelContext"
          : "Polyfill document.modelContext — agents can still draw"
      }
    >
      <span className="dot" />
      {status === "live"
        ? `WebMCP · ${count}`
        : status === "error"
          ? "WebMCP error"
          : "…"}
    </div>
  );
}
