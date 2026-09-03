"use client";

import { Minus, Plus } from "lucide-react";
import { useFilm } from "@/lib/film-store";
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
      <button
        type="button"
        className="pill ghost zoom-btn"
        aria-label="Zoom out"
        disabled={atMin}
        onClick={() => stepStageZoom(-1)}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="size zoom-label">{stageZoomLabel(stageZoom)}</span>
      <button
        type="button"
        className="pill ghost zoom-btn"
        aria-label="Zoom in"
        disabled={atMax}
        onClick={() => stepStageZoom(1)}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
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
