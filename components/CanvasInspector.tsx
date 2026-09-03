"use client";

import { useState } from "react";
import { SelectionControls } from "./SelectionControls";
import { Trash2, X } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { activePageLayer, DEFAULT_WIDTH, DEFAULT_HEIGHT, MIN_WIDTH, MAX_WIDTH } from "@/lib/types";
import { LayersPanel } from "./LayersPanel";
import { AppTooltipTrigger } from "./AppTooltip";
import { ConfirmAction } from "./ConfirmAction";

export function CanvasInspector({ onClose }: { onClose: () => void }) {
  const [resizeMode, setResizeMode] = useState<"scale" | "canvas">("scale");
  const api = useFilm();
  const { film, active, workshopOpen } = api;
  const density = active ?? film.pages[0];
  const densityLocked = !!active && (activePageLayer(active).locked || !activePageLayer(active).visible);
  const number = film.activeIndex + 1;
  return (
    <aside className="canvas-inspector screen-only" aria-label="Canvas settings" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="inspector-heading">
        <div><p className="sidebar-label">{workshopOpen ? "Asset" : `Page ${number}`}</p><h2>{workshopOpen ? "Workshop settings" : "Canvas settings"}</h2></div>
        <AppTooltipTrigger label="Close canvas settings"><button type="button" className="inspector-close icon-tooltip" aria-label="Close canvas settings" autoFocus onClick={onClose}><X size={16} aria-hidden="true" /></button></AppTooltipTrigger>
      </div>
            {!workshopOpen ? (
              <><LayersPanel /><SelectionControls /></>
            ) : null}
            {!workshopOpen ? (
              <section className="access-group access-density" aria-label="Density">
                <label className="sidebar-label"><select aria-label="Resize mode" value={resizeMode} onChange={event => setResizeMode(event.target.value as "scale" | "canvas")}>
                  <option value="scale">Scale art</option><option value="canvas">Canvas bounds</option>
                </select></label>
                <div className="compact-stepper" role="group" aria-label="Page density">
                  <AppTooltipTrigger label="Decrease density"><button type="button" className="icon-tooltip" aria-label="Decrease density" disabled={densityLocked || (density?.width ?? DEFAULT_WIDTH) <= MIN_WIDTH} onClick={() => api.resizeCanvas(Math.max(MIN_WIDTH, (density?.width ?? DEFAULT_WIDTH) - 16), resizeMode)}>−</button></AppTooltipTrigger>
                  <span className="size">{density?.width ?? DEFAULT_WIDTH}×{density?.height ?? DEFAULT_HEIGHT}</span>
                  <AppTooltipTrigger label="Increase density"><button type="button" className="icon-tooltip" aria-label="Increase density" disabled={densityLocked || (density?.width ?? DEFAULT_WIDTH) >= MAX_WIDTH} onClick={() => api.resizeCanvas(Math.min(MAX_WIDTH, (density?.width ?? DEFAULT_WIDTH) + 16), resizeMode)}>+</button></AppTooltipTrigger>
                </div>
              </section>
            ) : null}
            {!workshopOpen ? (
              <section className="sidebar-section">
                <ConfirmAction className="pill danger-subtle" label="Clear selected layer" confirmLabel="Click again to clear" onConfirm={() => api.clearPage()} confirmChildren={<><Trash2 size={15} aria-hidden="true" />Click again to clear</>}><Trash2 size={15} aria-hidden="true" />Clear selected layer</ConfirmAction>
              </section>
            ) : null}
    </aside>
  );
}
