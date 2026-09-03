"use client";

import { useState } from "react";
import { SelectionControls } from "./SelectionControls";
import { X, Trash2 } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { activePageLayer, DEFAULT_WIDTH, DEFAULT_HEIGHT, MIN_WIDTH, MAX_WIDTH, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE, MIN_TEXT_SIZE, MAX_TEXT_SIZE, TEXT_FRAMES, brushSizeLabel, frameHint, frameLabel } from "@/lib/types";
import { FrameSample } from "./BubbleFrame";
import { TextSizePreview } from "./TextSizePreview";
import { LayersPanel } from "./LayersPanel";

export function CanvasInspector({ onClose, symmetry, onSymmetryChange, showGrid, onGridChange }: {
  onClose: () => void; symmetry: "none" | "x" | "y" | "both";
  onSymmetryChange: (value: "none" | "x" | "y" | "both") => void;
  showGrid: boolean; onGridChange: (value: boolean) => void;
}) {
  const [resizeMode, setResizeMode] = useState<"scale" | "canvas">("scale");
  const api = useFilm();
  const { film, active, tool, brushSize, textSize, textFont, color, frame, shapeFilled, workshopOpen } = api;
  const density = active ?? film.pages[0];
  const densityLocked = !!active && (activePageLayer(active).locked || !activePageLayer(active).visible);
  const number = film.activeIndex + 1;
  return (
    <aside className="canvas-inspector screen-only" aria-label="Canvas settings" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="inspector-heading">
        <div><p className="sidebar-label">{workshopOpen ? "Asset" : `Page ${number}`}</p><h2>{workshopOpen ? "Workshop settings" : "Canvas settings"}</h2></div>
        <button type="button" className="inspector-close" aria-label="Close canvas settings" onClick={onClose}><X size={16} aria-hidden="true" /></button>
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
                  <button type="button" aria-label="Decrease density" disabled={densityLocked || (density?.width ?? DEFAULT_WIDTH) <= MIN_WIDTH} onClick={() => api.resizeCanvas(Math.max(MIN_WIDTH, (density?.width ?? DEFAULT_WIDTH) - 16), resizeMode)}>−</button>
                  <span className="size">{density?.width ?? DEFAULT_WIDTH}×{density?.height ?? DEFAULT_HEIGHT}</span>
                  <button type="button" aria-label="Increase density" disabled={densityLocked || (density?.width ?? DEFAULT_WIDTH) >= MAX_WIDTH} onClick={() => api.resizeCanvas(Math.min(MAX_WIDTH, (density?.width ?? DEFAULT_WIDTH) + 16), resizeMode)}>+</button>
                </div>
              </section>
            ) : null}
            {tool === "pencil" || tool === "eraser" ? (
              <section className="access-group access-brush" aria-label="Brush size">
                <p className="sidebar-label">Brush size</p>
                <div className="compact-stepper" role="group" aria-label="Brush size">
                  <button type="button" aria-label="Decrease brush size" disabled={brushSize <= MIN_BRUSH_SIZE} onClick={() => api.setBrushSize(brushSize - 1)}>−</button>
                  <span className="size">{brushSizeLabel(brushSize)}</span>
                  <button type="button" aria-label="Increase brush size" disabled={brushSize >= MAX_BRUSH_SIZE} onClick={() => api.setBrushSize(brushSize + 1)}>+</button>
                </div>
              </section>
            ) : null}
          <div className="drawing-options">
            <label><input type="checkbox" checked={showGrid} onChange={event => onGridChange(event.target.checked)} />Pixel grid</label>
            <label>Symmetry<select aria-label="Drawing symmetry" value={symmetry} onChange={event => onSymmetryChange(event.target.value as typeof symmetry)}>
              <option value="none">None</option><option value="x">Left / right</option><option value="y">Top / bottom</option><option value="both">Both axes</option>
            </select></label>
          </div>
          {tool === "text" ? (
            <section className="sidebar-section" aria-label="Text size">
              <p className="sidebar-label">Text size</p>
              <div className="number-stepper" role="group" aria-label="Text size scale">
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Decrease text size"
                  disabled={textSize <= MIN_TEXT_SIZE}
                  onClick={() => api.setTextSize(textSize - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  className="stepper-input"
                  min={MIN_TEXT_SIZE}
                  max={MAX_TEXT_SIZE}
                  step={1}
                  value={textSize}
                  aria-label="Text size scale"
                  onChange={(event) =>
                    api.setTextSize(Number(event.target.value))
                  }
                />
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Increase text size"
                  disabled={textSize >= MAX_TEXT_SIZE}
                  onClick={() => api.setTextSize(textSize + 1)}
                >
                  +
                </button>
              </div>
              <TextSizePreview
                textSize={textSize}
                textFont={textFont}
                color={color}
              />
            </section>
          ) : null}

          {tool === "shape" ? (
            <>
              <section className="sidebar-section" aria-label="Shape">
                <p className="sidebar-label">Shape</p>
                <p className="sidebar-help">{frameHint(frame)}</p>
                <div className="frame-grid">
                  {TEXT_FRAMES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="frame-card"
                      data-active={frame === item}
                      aria-label={frameLabel(item)}
                      onClick={() => api.setFrame(item)}
                    >
                      <FrameSample frame={item} />
                      {frameLabel(item)}
                    </button>
                  ))}
                </div>
              </section>
              <section className="sidebar-section" aria-label="Fill">
                <p className="sidebar-label">Fill</p>
                <div className="choice-row">
                  <button
                    type="button"
                    className="pill"
                    data-active={shapeFilled}
                    onClick={() => api.setShapeFilled(true)}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    className="pill"
                    data-active={!shapeFilled}
                    onClick={() => api.setShapeFilled(false)}
                  >
                    Stroke
                  </button>
                </div>
              </section>
            </>
          ) : null}

      {!workshopOpen && <button type="button" className="pill ghost" disabled={film.pages.length <= 1} onClick={() => api.removePage(film.activeIndex)}><Trash2 size={14} aria-hidden="true" />Delete page</button>}
    </aside>
  );
}
