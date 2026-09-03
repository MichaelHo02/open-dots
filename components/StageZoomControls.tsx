"use client";

import { Minus, Plus } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { AppTooltipTrigger } from "./AppTooltip";
import {
  MAX_STAGE_ZOOM,
  MIN_STAGE_ZOOM,
  stageZoomLabel,
} from "@/lib/types";

export function StageZoomControls() {
  const { stageZoom, stepStageZoom, resetStageZoom } = useFilm();
  const atMin = stageZoom <= MIN_STAGE_ZOOM + 0.001;
  const atMax = stageZoom >= MAX_STAGE_ZOOM - 0.001;
  const atFit = stageZoom === 1;

  return (
    <div className="zoom-controls">
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
      <button
        type="button"
        className="pill"
        data-active={atFit}
        aria-label="Fit canvas in view"
        onClick={() => resetStageZoom()}
      >
        Fit
      </button>
    </div>
  );
}
