"use client";

import { useEffect } from "react";
import { WorkshopCanvas } from "./WorkshopCanvas";
import { AssetThumb } from "./PagePreview";
import { useFilm } from "@/lib/film-store";
import { ASSET_SIZE_PRESETS, MAX_ASSET_NAME, MAX_ASSETS } from "@/lib/types";
import { CopyPlus, Trash2 } from "lucide-react";

export function AssetWorkshop({ symmetry, showGrid }: { symmetry: "none" | "x" | "y" | "both"; showGrid: boolean }) {
  const {
    workshopOpen,
    workshopDraft,
    closeWorkshop,
    setWorkshopName,
    setWorkshopSize,
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
            <div className="workshop-size-group">
              <span className="sidebar-label">Size</span>
              <div
                className="choice-row workshop-size-choices"
                role="group"
                aria-label="Canvas size"
              >
                {ASSET_SIZE_PRESETS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="pill"
                    data-active={workshopDraft.width === item}
                    aria-label={`${item} by ${item} pixels`}
                    onClick={() => setWorkshopSize(item)}
                  >
                    {item}×{item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="workshop-chrome-actions">
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
      <nav className="strip workshop-strip" aria-label="Animation frames">
        <div className="strip-thumbs">
          {workshopDraft.frames.map((pixels, index) => (
            <button
              key={index}
              type="button"
              className="thumb workshop-frame-thumb"
              data-active={index === workshopDraft.frameIndex}
              aria-label={`Frame ${index + 1}`}
              aria-current={index === workshopDraft.frameIndex ? "true" : undefined}
              onClick={() => selectWorkshopFrame(index)}
            >
              <AssetThumb asset={{
                id: `workshop-frame-${index}`,
                name: `Frame ${index + 1}`,
                width: workshopDraft.width,
                height: workshopDraft.height,
                pixels,
              }} />
              <span className="page-index">{index + 1}</span>
            </button>
          ))}
        </div>
        <div className="strip-actions">
          <span className="page-count">{workshopDraft.frameIndex + 1} / {workshopDraft.frames.length}</span>
          <button
            type="button"
            className="pill danger-subtle page-action-icon"
            onClick={removeWorkshopFrame}
            disabled={workshopDraft.frames.length <= 1}
            aria-label="Delete animation frame"
            title="Delete frame"
          ><Trash2 size={16} aria-hidden="true" /></button>
          <button
            type="button"
            className="pill ghost page-action-icon"
            onClick={addWorkshopFrame}
            aria-label="Add animation frame"
            title="Add frame"
          ><CopyPlus size={16} aria-hidden="true" /></button>
        </div>
      </nav>
    </div>
  );
}
