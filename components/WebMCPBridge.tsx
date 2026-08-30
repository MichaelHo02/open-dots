"use client";

import { useEffect, useRef, useState } from "react";
import { registerStudioTools } from "@/lib/register-tools";
import { useStudio } from "@/lib/studio-store";

export function WebMCPBridge() {
  const api = useStudio();
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

    registerStudioTools(apiRef, controller.signal)
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
          ? "Native document.modelContext (Chrome flag or ChatGPT browser)"
          : "Spec polyfill is exposing document.modelContext on this page"
      }
    >
      <span className="dot" />
      {status === "live"
        ? `${native ? "Native" : "Polyfill"} WebMCP · ${count} tools`
        : status === "error"
          ? "WebMCP error"
          : "WebMCP booting"}
    </div>
  );
}
