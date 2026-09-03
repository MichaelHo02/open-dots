"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { AppTooltipTrigger } from "./AppTooltip";
import { ChromeIcon } from "./ChromeIcons";
import {
  MAX_STAGE_ZOOM,
  MIN_STAGE_ZOOM,
  stageZoomLabel,
} from "@/lib/types";

export function StageZoomControls() {
  const { stageZoom, stepStageZoom, resetStageZoom, canUndo, canRedo, undo, redo } = useFilm();
  const atMin = stageZoom <= MIN_STAGE_ZOOM + 0.001;
  const atMax = stageZoom >= MAX_STAGE_ZOOM - 0.001;
  const atFit = stageZoom === 1;

  return (
    <div className="zoom-controls">
      <AppTooltipTrigger label="Undo the last change"><button type="button" className="pill ghost zoom-btn icon-tooltip" aria-label="Undo" disabled={!canUndo} onClick={undo}><ChromeIcon name="undo" /></button></AppTooltipTrigger>
      <AppTooltipTrigger label="Redo (Ctrl/Cmd+Shift+Z)"><button type="button" className="pill ghost zoom-btn icon-tooltip" aria-label="Redo" disabled={!canRedo} onClick={redo}><ChromeIcon name="redo" /></button></AppTooltipTrigger>
      <span className="zoom-divider" aria-hidden="true" />
      <AppTooltipTrigger label="Zoom out"><button
        type="button"
        className="pill ghost zoom-btn icon-tooltip"
        aria-label="Zoom out"
        disabled={atMin}
        onClick={() => stepStageZoom(-1)}
      >
        <Minus size={14} aria-hidden="true" />
      </button></AppTooltipTrigger>
      <span className="size zoom-label">{stageZoomLabel(stageZoom)}</span>
      <AppTooltipTrigger label="Zoom in"><button
        type="button"
        className="pill ghost zoom-btn icon-tooltip"
        aria-label="Zoom in"
        disabled={atMax}
        onClick={() => stepStageZoom(1)}
      >
        <Plus size={14} aria-hidden="true" />
      </button></AppTooltipTrigger>
      <AppTooltipTrigger label="Fit canvas in view"><button
        type="button"
        className="pill ghost zoom-btn icon-tooltip"
        data-active={atFit}
        aria-label="Fit canvas in view"
        onClick={() => resetStageZoom()}
      >
        <Maximize2 size={14} aria-hidden="true" />
      </button></AppTooltipTrigger>
    </div>
  );
}
