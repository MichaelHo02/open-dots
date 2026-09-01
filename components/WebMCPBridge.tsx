"use client";

import { useEffect, useRef, useState } from "react";
import { registerFilmTools } from "@/lib/register-tools";
import { useFilm } from "@/lib/film-store";

export function WebMCPBridge() {
  const api = useFilm();
  const apiRef = useRef(api);
  const [status, setStatus] = useState<"booting" | "live" | "error">("booting");
  const [native, setNative] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    registerFilmTools(apiRef, controller.signal)
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

    return () => {
      cancelled = true;
      controller.abort();
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
