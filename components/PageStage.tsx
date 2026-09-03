"use client";

import { useRef, type CSSProperties, type RefObject } from "react";
import { activePageLayer } from "@/lib/types";
import { useFilm } from "@/lib/film-store";
import { PixelCanvas } from "./PixelCanvas";

export function PageStage({ viewportRef, inspectorOpen, onInspect, symmetry, showGrid }: {
  symmetry: "none" | "x" | "y" | "both";
  showGrid: boolean;
  viewportRef: RefObject<HTMLElement | null>;
  inspectorOpen: boolean;
  onInspect: () => void;
}) {
  const { active, stageZoom } = useFilm();
  const layer = active ? activePageLayer(active) : null;
  const inspectionPointer = useRef<number | null>(null);

  return <main ref={viewportRef} className="stage-wrap screen-only"
    data-zoomed={stageZoom > 1 ? "true" : undefined}
    style={{ "--stage-zoom": stageZoom } as CSSProperties}>
    <div className="leaf" data-grid={showGrid ? "true" : undefined}
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
      <PixelCanvas symmetry={symmetry} key={`${active?.id}:${layer?.id}:${layer?.locked}:${layer?.visible}`} />
    </div>
  </main>;
}
