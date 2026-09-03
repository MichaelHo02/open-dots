"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useFilm } from "@/lib/film-store";
import { PixelCanvas } from "./PixelCanvas";

export function PageStage({ viewportRef, inspectorOpen, onInspect }: {
  viewportRef: RefObject<HTMLElement | null>;
  inspectorOpen: boolean;
  onInspect: () => void;
}) {
  const { active, stageZoom } = useFilm();
  const leafRef = useRef<HTMLDivElement>(null);
  const inspectionPointer = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const leaf = leafRef.current;
    if (!leaf) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(leaf);
    return () => observer.disconnect();
  }, []);

  return <main ref={viewportRef} className="stage-wrap screen-only"
    data-zoomed={stageZoom > 1 ? "true" : undefined}
    style={{ "--stage-zoom": stageZoom } as CSSProperties}>
    <div ref={leafRef} className="leaf" data-grid={active && width / active.width >= 8 ? "true" : undefined}
      onPointerDownCapture={event => {
        if (!event.isPrimary || event.button !== 0 || inspectorOpen) return;
        // Inspect on the first click without painting or stamping the artwork.
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        inspectionPointer.current = event.pointerId;
      }}
      onPointerUpCapture={event => {
        if (inspectionPointer.current !== event.pointerId) return;
        event.stopPropagation();
        inspectionPointer.current = null;
        onInspect();
      }}
      onPointerCancel={() => { inspectionPointer.current = null; }}
      onClick={() => { if (!inspectorOpen) onInspect(); }}
      onKeyDown={event => {
        if (event.key === "Enter" && !inspectorOpen) { event.preventDefault(); onInspect(); }
      }}>
      <PixelCanvas key={active?.id} />
    </div>
  </main>;
}
