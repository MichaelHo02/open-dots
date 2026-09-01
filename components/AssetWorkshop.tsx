"use client";

import { useEffect } from "react";
import { WorkshopCanvas } from "./WorkshopCanvas";
import { useFilm } from "@/lib/film-store";
import { ASSET_SIZE_PRESETS, MAX_ASSET_NAME } from "@/lib/types";

export function AssetWorkshop() {
  const {
    workshopOpen,
    workshopDraft,
    closeWorkshop,
    setWorkshopName,
    setWorkshopSize,
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

  const atAssetLimit = !workshopDraft.id && film.assets.length >= 48;

  return (
    <div className="workshop-stage" role="region" aria-label="Asset workshop">
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
              title={atAssetLimit ? "Asset library is full (48 max)" : undefined}
            >
              Done
            </button>
          </div>
        </div>
        {atAssetLimit ? (
          <p className="workshop-limit">Asset library is full (48 max).</p>
        ) : null}
      </header>

      <div className="workshop-canvas-wrap">
        <WorkshopCanvas />
      </div>
    </div>
  );
}
