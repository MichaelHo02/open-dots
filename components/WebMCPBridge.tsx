"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getWebmcpStatus,
  registerFilmTools,
  syncWebmcpApiRef,
} from "@/lib/register-tools";
import { useFilm } from "@/lib/film-store";
import { Dotm3x3_15 } from "@/components/ui/dotm-3x3-15";
import { AppTooltipTrigger } from "./AppTooltip";

export function WebMCPBridge() {
  const api = useFilm();
  const apiRef = useRef(api);
  const [status, setStatus] = useState<"booting" | "live" | "error">("booting");
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
          setCount(result.count);
          setStatus("live");
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          const current = getWebmcpStatus();
          if (current.ready && current.toolCount) {
            setCount(current.toolCount);
            setStatus("live");
          } else {
            console.error("WebMCP registration failed", error);
            setStatus("error");
          }
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

  const label = status === "live" ? `WebMCP · ${count} tools` : status === "error" ? "WebMCP unavailable" : "WebMCP starting";
  const color = status === "live" ? "#1ea64a" : status === "error" ? "var(--accent-magenta)" : "var(--hairline)";
  return <AppTooltipTrigger label={label}><span className="webmcp-status-dot"><Dotm3x3_15 size={16} dotSize={3} cellPadding={3.5} speed={0.35} color={color} ariaLabel={label} /></span></AppTooltipTrigger>;
}
