"use client";

import { type CSSProperties, type RefObject } from "react";
import { activePageLayer } from "@/lib/types";
import { useFilm } from "@/lib/film-store";
import { PixelCanvas } from "./PixelCanvas";

export function PageStage({ viewportRef, symmetry, showGrid }: {
  symmetry: "none" | "x" | "y" | "both";
  showGrid: boolean;
  viewportRef: RefObject<HTMLElement | null>;
}) {
  const { active, stageZoom } = useFilm();
  const layer = active ? activePageLayer(active) : null;
  return <main ref={viewportRef} className="stage-wrap screen-only"
    data-zoomed={stageZoom > 1 ? "true" : undefined}
    style={{ "--stage-zoom": stageZoom } as CSSProperties}>
    <div className="leaf" data-grid={showGrid ? "true" : undefined}>
      <PixelCanvas symmetry={symmetry} key={`${active?.id}:${layer?.id}:${layer?.locked}:${layer?.visible}`} />
    </div>
  </main>;
}
