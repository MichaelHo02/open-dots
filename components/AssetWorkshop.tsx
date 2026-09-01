"use client";

import { useEffect } from "react";
import { ChromeIcon } from "./ChromeIcons";
import { WorkshopCanvas } from "./WorkshopCanvas";
import { useFilm } from "@/lib/film-store";
import { ASSET_SIZE_PRESETS } from "@/lib/types";

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
  const modeLabel = workshopDraft.id
    ? workshopDraft.name
    : "Untitled asset";
  const modeSubtitle = workshopDraft.id
    ? "Editing saved asset"
    : "Create a reusable stamp";

  return (
    <div className="workshop-stage" role="region" aria-label="Asset workshop">
      <header className="workshop-mode-banner">
        <div className="workshop-mode-label">
          <span className="workshop-mode-chip">
            <ChromeIcon name="asset" size={14} />
            Asset workshop
          </span>
          <h2 className="workshop-title">{modeLabel}</h2>
          <p className="workshop-subtitle">{modeSubtitle}</p>
        </div>
        <div className="workshop-actions">
          <button
            type="button"
            className="pill ghost"
            onClick={() => closeWorkshop(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pill primary"
            onClick={() => closeWorkshop(true)}
            disabled={atAssetLimit}
            title={atAssetLimit ? "Asset library is full (48 max)" : undefined}
          >
            Done
          </button>
        </div>
      </header>

      <div className="workshop-panel">
        <div className="workshop-controls">
          <label className="asset-name-field">
            <span className="sidebar-label">Name</span>
            <input
              type="text"
              value={workshopDraft.name}
              placeholder="e.g. Hero, Tree, Cloud"
              aria-label="Asset name"
              onChange={(event) => setWorkshopName(event.target.value)}
            />
          </label>
          <div className="workshop-size-row">
            <div className="workshop-size-head">
              <p className="sidebar-label">Canvas size</p>
              <span className="workshop-size-value">
                {workshopDraft.width}×{workshopDraft.height} px
              </span>
            </div>
            <div className="choice-row">
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
          {atAssetLimit ? (
            <p className="workshop-limit">Asset library is full (48 max).</p>
          ) : null}
        </div>

        <div className="workshop-canvas-wrap">
          <WorkshopCanvas />
        </div>

        <p className="workshop-hint">
          <ChromeIcon name="draw" size={14} />
          Draw with the toolbar, then Done to save. Stamp it on any page from
          the sidebar.
        </p>
      </div>
    </div>
  );
}
