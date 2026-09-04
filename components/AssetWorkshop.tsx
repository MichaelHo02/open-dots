"use client";

import { useEffect } from "react";
import { WorkshopCanvas } from "./WorkshopCanvas";
import { useFilm } from "@/lib/film-store";
import { MAX_ASSET_NAME, MAX_ASSETS } from "@/lib/types";
import { CopyPlus, Trash2 } from "lucide-react";

export function AssetWorkshop({ symmetry, showGrid }: { symmetry: "none" | "x" | "y" | "both"; showGrid: boolean }) {
  const {
    workshopOpen,
    workshopDraft,
    closeWorkshop,
    setWorkshopName,
    addWorkshopFrame,
    removeWorkshopFrame,
    selectWorkshopFrame,
    film,
  } = useFilm();

  useEffect(() => {
    if (!workshopOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, input")) {
        return;
      }
      event.preventDefault();
      closeWorkshop(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeWorkshop, workshopOpen]);

  if (!workshopOpen || !workshopDraft) {
    return null;
  }

  const atAssetLimit = !workshopDraft.id && film.assets.length >= MAX_ASSETS;

  return (
    <div data-show-grid={showGrid} className="workshop-stage" role="region" aria-label="Asset workshop">
      <header className="workshop-chrome">
        <div className="workshop-chrome-row">
          <div className="workshop-chrome-main">
            <input
              type="text"
              className="workshop-title-input"
              value={workshopDraft.name}
              placeholder="Untitled asset"
              aria-label="Asset name"
              maxLength={MAX_ASSET_NAME}
              onChange={(event) => setWorkshopName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
          <div className="workshop-chrome-actions">
            <div className="workshop-frames" aria-label="Animation frames">
              <button type="button" className="pill" onClick={removeWorkshopFrame} disabled={workshopDraft.frames.length <= 1} aria-label="Delete animation frame"><Trash2 size={14} /></button>
              <select aria-label="Animation frame" value={workshopDraft.frameIndex} onChange={event => selectWorkshopFrame(Number(event.target.value))}>{workshopDraft.frames.map((_, index) => <option key={index} value={index}>Frame {index + 1}</option>)}</select>
              <button type="button" className="pill" onClick={addWorkshopFrame}><CopyPlus size={14} />Add frame</button>
            </div>
            <button
              type="button"
              className="pill workshop-back"
              onClick={() => closeWorkshop(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pill primary workshop-done"
              onClick={() => closeWorkshop(true)}
              disabled={atAssetLimit}
              title={atAssetLimit ? `Asset library is full (${MAX_ASSETS} max)` : undefined}
            >
              Done
            </button>
          </div>
        </div>
        {atAssetLimit ? (
          <p className="workshop-limit">Asset library is full ({MAX_ASSETS} max).</p>
        ) : null}
      </header>

      <div className="workshop-canvas-wrap">
        <WorkshopCanvas symmetry={symmetry} />
      </div>
    </div>
  );
}
