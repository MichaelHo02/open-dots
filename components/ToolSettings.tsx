"use client";

import { useFilm } from "@/lib/film-store";
import { MAX_BRUSH_SIZE, MAX_TEXT_SIZE, MIN_BRUSH_SIZE, MIN_TEXT_SIZE, TEXT_FRAMES, brushSizeLabel, frameHint, frameLabel } from "@/lib/types";
import { FrameSample } from "./BubbleFrame";
import { TextSizePreview } from "./TextSizePreview";
import { AppTooltipTrigger } from "./AppTooltip";

export function ToolSettings({ symmetry, onSymmetryChange, showGrid, onGridChange }: {
  symmetry: "none" | "x" | "y" | "both";
  onSymmetryChange: (value: "none" | "x" | "y" | "both") => void;
  showGrid: boolean;
  onGridChange: (value: boolean) => void;
}) {
  const api = useFilm();
  const { tool, brushSize, textSize, textFont, color, frame, shapeFilled } = api;
  return <section className="sidebar-section tool-settings" aria-label="Tool settings">
    <p className="sidebar-label">Tool settings</p>
    {tool === "pencil" || tool === "eraser" ? <div className="tool-setting-row">
      <span>Brush size</span><div className="compact-stepper" role="group" aria-label="Brush size">
        <AppTooltipTrigger label="Decrease brush size"><button type="button" className="icon-tooltip" aria-label="Decrease brush size" disabled={brushSize <= MIN_BRUSH_SIZE} onClick={() => api.setBrushSize(brushSize - 1)}>−</button></AppTooltipTrigger>
        <span className="size">{brushSizeLabel(brushSize)}</span>
        <AppTooltipTrigger label="Increase brush size"><button type="button" className="icon-tooltip" aria-label="Increase brush size" disabled={brushSize >= MAX_BRUSH_SIZE} onClick={() => api.setBrushSize(brushSize + 1)}>+</button></AppTooltipTrigger>
      </div>
    </div> : null}
    <div className="drawing-options">
      <label><input type="checkbox" checked={showGrid} onChange={event => onGridChange(event.target.checked)} />Pixel grid</label>
      <label>Symmetry<select aria-label="Drawing symmetry" value={symmetry} onChange={event => onSymmetryChange(event.target.value as typeof symmetry)}>
        <option value="none">None</option><option value="x">Left / right</option><option value="y">Top / bottom</option><option value="both">Both axes</option>
      </select></label>
    </div>
    {tool === "text" ? <div className="tool-option-block">
      <p className="sidebar-label">Text size</p>
      <div className="number-stepper" role="group" aria-label="Text size scale">
        <AppTooltipTrigger label="Decrease text size"><button type="button" className="stepper-btn icon-tooltip" aria-label="Decrease text size" disabled={textSize <= MIN_TEXT_SIZE} onClick={() => api.setTextSize(textSize - 1)}>−</button></AppTooltipTrigger>
        <input type="number" className="stepper-input" min={MIN_TEXT_SIZE} max={MAX_TEXT_SIZE} step={1} value={textSize} aria-label="Text size scale" onChange={event => api.setTextSize(Number(event.target.value))} />
        <AppTooltipTrigger label="Increase text size"><button type="button" className="stepper-btn icon-tooltip" aria-label="Increase text size" disabled={textSize >= MAX_TEXT_SIZE} onClick={() => api.setTextSize(textSize + 1)}>+</button></AppTooltipTrigger>
      </div>
      <TextSizePreview textSize={textSize} textFont={textFont} color={color} />
    </div> : null}
    {tool === "shape" ? <div className="tool-option-block">
      <p className="sidebar-label">Shape</p><p className="sidebar-help">{frameHint(frame)}</p>
      <div className="frame-grid">{TEXT_FRAMES.map(item => <button key={item} type="button" className="frame-card" data-active={frame === item} aria-label={frameLabel(item)} onClick={() => api.setFrame(item)}><FrameSample frame={item} />{frameLabel(item)}</button>)}</div>
      <div className="choice-row"><button type="button" className="pill" data-active={shapeFilled} onClick={() => api.setShapeFilled(true)}>Fill</button><button type="button" className="pill" data-active={!shapeFilled} onClick={() => api.setShapeFilled(false)}>Stroke</button></div>
    </div> : null}
  </section>;
}
