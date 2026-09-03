"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AssetWorkshop } from "./AssetWorkshop";
import { ColorAddPopover } from "./ColorAddPopover";
import { PaletteProfileControls } from "./PaletteProfileControls";
import { useFilm } from "@/lib/film-store";
import { MAX_ASSETS, isBuiltInPalette, isDefaultPaletteId } from "@/lib/types";
import { ChromeIcon } from "./ChromeIcons";
import { CanvasInspector } from "./CanvasInspector";
import { EditorToolbar } from "./EditorToolbar";
import { AssetThumb, PagePreview } from "./PagePreview";
import { PageStage } from "./PageStage";
import { PresentMode } from "./PresentMode";
import { StageZoomControls } from "./StageZoomControls";
import { useStageZoomShortcuts } from "./useStageZoomShortcuts";

export function FilmApp() {
  const api = useFilm();
  const stageWrapRef = useRef<HTMLElement>(null);
  const selectedPageRef = useRef<HTMLButtonElement>(null);
  const {
    film,
    color,
    stageZoom,
    selectedAssetId,
    workshopOpen,
    active,
  } = api;
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  useEffect(() => {
    selectedPageRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [film.activeIndex, workshopOpen]);
  const presentPages = film.pages;
  const openPresent = () => {
    const start = presentPages.findIndex((page) => page.id === active?.id);
    setPresentIndex(start < 0 ? 0 : start);
    setPresenting(true);
  };
  useStageZoomShortcuts(stageWrapRef);

  return (
    <div
      className="film"
      data-present={presenting}
      data-workshop={workshopOpen ? "true" : undefined}
    >
      <EditorToolbar onPresent={openPresent} onToolSelect={() => setInspectorOpen(true)} />

      <div className="studio">
        <aside className="sidebar screen-only">
          <section className="sidebar-section sidebar-colors" aria-label="Color">
            <div className="sidebar-colors-head">
              <p className="sidebar-label">Color</p>
            </div>
            <PaletteProfileControls
              palettes={film.palettes ?? []}
              activePaletteId={film.activePaletteId ?? "default"}
              onSelect={(id) => api.selectPalette(id)}
              onCreate={(name) => api.addPaletteProfile(name)}
              onRename={(id, name) => api.renamePalette(id, name)}
            />
            <div className="panel-swatches">
              {film.palette.map((swatch, index) => (
                <button
                  key={`${swatch}-${index}`}
                  type="button"
                  className="swatch"
                  data-active={color === swatch}
                  style={{ background: swatch }}
                  aria-label={swatch}
                  onClick={() => api.setColor(swatch)}
                />
              ))}
            </div>
            <ColorAddPopover
              currentColor={color}
              onAdd={(hex) => api.addSwatch(hex)}
            />
            {isDefaultPaletteId(film.activePaletteId) &&
            !isBuiltInPalette(film.palette) ? (
              <button
                type="button"
                className="pill ghost palette-reset"
                onClick={() => api.resetPalette()}
              >
                <ChromeIcon name="reset" />
                Reset
              </button>
            ) : null}
          </section>
          <section className="sidebar-section sidebar-assets" aria-label="Assets">
            <div className="sidebar-assets-head">
              <p className="sidebar-label">Assets</p>
            </div>
            {!film.assets.length && !workshopOpen ? (
              <button
                type="button"
                className="asset-new-card"
                onClick={() => { api.openWorkshop(); setInspectorOpen(true); }}
                aria-label="New asset"
              >
                <ChromeIcon name="page" size={28} />
                <span className="asset-new-card-label">New asset</span>
              </button>
            ) : film.assets.length > 0 ? (
              <ul className="asset-list">
                {film.assets.length < MAX_ASSETS ? (
                  <li className="asset-new-slot">
                    <button
                      type="button"
                      className="asset-new-compact"
                      onClick={() => { api.openWorkshop(); setInspectorOpen(true); }}
                      aria-label="New asset"
                    >
                      <ChromeIcon name="page" size={18} />
                      <span>New asset</span>
                    </button>
                  </li>
                ) : null}
                {film.assets.map((asset) => (
                  <li key={asset.id}>
                    <button
                      type="button"
                      className="asset-card"
                      data-active={selectedAssetId === asset.id}
                      aria-label={`${asset.name}, ${asset.width} by ${asset.height}`}
                      onClick={() => api.selectAsset(asset.id)}
                      onDoubleClick={() => { api.openWorkshop(asset.id); setInspectorOpen(true); }}
                    >
                      <AssetThumb asset={asset} />
                      <span className="asset-card-name">{asset.name}</span>
                      <span className="asset-card-size">
                        {asset.width}×{asset.height}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="asset-edit"
                      aria-label={`Edit ${asset.name}`}
                      onClick={() => { api.openWorkshop(asset.id); setInspectorOpen(true); }}
                    >
                      <ChromeIcon name="draw" size={14} />
                    </button>
                    <button
                      type="button"
                      className="asset-remove"
                      aria-label={`Remove ${asset.name}`}
                      onClick={() => api.removeAsset(asset.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {workshopOpen ? (
            <section className="sidebar-section" aria-label="Workshop hint">
              <p className="sidebar-help workshop-sidebar-hint">
                Drawing a stamp — Done saves to your library.
              </p>
            </section>
          ) : selectedAssetId ? (
            <section className="sidebar-section" aria-label="Stamp hint">
              <p className="sidebar-label">Stamp</p>
              <p className="sidebar-help">
                {film.assets.find(asset => asset.id === selectedAssetId)?.name}
              </p>
              <button
                type="button"
                className="pill ghost"
                onClick={() => api.selectAsset(null)}
              >
                Cancel placement
              </button>
            </section>
          ) : null}
        </aside>

        <div className="workspace">
          <div className="page-workspace">
          <div className="workspace-zoom screen-only" aria-label="Zoom"><StageZoomControls /></div>
          {workshopOpen ? (
            <main
              ref={stageWrapRef}
              className="stage-wrap screen-only"
              data-mode="workshop"
              data-zoomed={stageZoom > 1 ? "true" : undefined}
              style={{ "--stage-zoom": stageZoom } as CSSProperties}
            >
              <AssetWorkshop />
            </main>
          ) : (
            <PageStage viewportRef={stageWrapRef} inspectorOpen={inspectorOpen} onInspect={() => setInspectorOpen(true)} />
          )}
          </div>
          {!workshopOpen && <nav className="strip screen-only" aria-label="Pages">
            <div className="strip-thumbs">
              {film.pages.map((page, index) => <button
                key={page.id} type="button" className="thumb"
                data-active={index === film.activeIndex}
                aria-label={`Page ${index + 1}`}
                aria-current={index === film.activeIndex ? "page" : undefined}
                ref={index === film.activeIndex ? selectedPageRef : undefined}
                onClick={() => { api.selectPage(index); api.resetStageZoom(); setInspectorOpen(true); }}
              >
                <PagePreview page={page} assets={film.assets} />
                <span className="page-index">Page {index + 1}</span>
              </button>)}
            </div>
            <div className="strip-actions">
              <span className="page-count">{film.activeIndex + 1} / {film.pages.length}</span>
              <button type="button" className="pill ghost" onClick={() => { api.addPage(); api.resetStageZoom(); setInspectorOpen(true); }}>
                <ChromeIcon name="page" size={16} />New page
              </button>
            </div>
          </nav>}
        </div>
        {inspectorOpen && <CanvasInspector onClose={() => setInspectorOpen(false)} />}
      </div>

      {presenting ? (
        <PresentMode
          pages={presentPages}
          assets={film.assets}
          index={Math.min(presentIndex, Math.max(0, presentPages.length - 1))}
          onClose={() => setPresenting(false)}
          onSelect={(next) => setPresentIndex(next)}
        />
      ) : null}
    </div>
  );
}
