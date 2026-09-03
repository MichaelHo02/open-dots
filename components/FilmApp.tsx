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
import { ToolSettings } from "./ToolSettings";
import { AppTooltip, AppTooltipTrigger } from "./AppTooltip";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useStageZoomShortcuts } from "./useStageZoomShortcuts";
import { Check, ChevronDown, CopyPlus, Plus, Trash2 } from "lucide-react";
import { ConfirmAction } from "./ConfirmAction";
import { ReferencePanel } from "./ReferencePanel";
import { AssetImageImport } from "./AssetImageImport";

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
  const [symmetry, setSymmetry] = useState<"none" | "x" | "y" | "both">("none");
  const [showGrid, setShowGrid] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [draggedPage, setDraggedPage] = useState<{ id: string; index: number } | null>(null);
  const [pageDrop, setPageDrop] = useState<{ index: number; after: boolean } | null>(null);
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
  useEditorShortcuts(presenting, () => setInspectorOpen(true));

  return (
    <div
      className="film"
      data-present={presenting}
      data-workshop={workshopOpen ? "true" : undefined}
    >
      <EditorToolbar onPresent={openPresent} inspectorOpen={inspectorOpen} onToggleInspector={() => setInspectorOpen(open => !open)} />

      <div className="studio">
        <aside className="sidebar screen-only">
          <details className="sidebar-section sidebar-colors sidebar-collapsible" open>
            <summary><span className="sidebar-label">Color</span><ChevronDown size={14} aria-hidden="true" /></summary>
            <div className="sidebar-section-body">
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
            </div>
          </details>
          <ToolSettings symmetry={symmetry} onSymmetryChange={setSymmetry} showGrid={showGrid} onGridChange={setShowGrid} />
          <ReferencePanel />
          <details className="sidebar-section sidebar-assets sidebar-collapsible" open>
            <summary>
              <span className="sidebar-label">Assets</span>
              <span className="asset-count">{film.assets.length}/{MAX_ASSETS}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="sidebar-section-body">
            <button
              type="button"
              className="color-add"
              disabled={film.assets.length >= MAX_ASSETS}
              aria-label={film.assets.length >= MAX_ASSETS ? "Asset library full — remove an asset to create another" : "New asset"}
              onClick={() => { api.openWorkshop(); setInspectorOpen(true); }}
            ><ChromeIcon name="plus" />New asset</button>
            <AssetImageImport api={api} disabled={film.assets.length >= MAX_ASSETS} />
            {film.assets.length > 0 ? (
              <ul className="asset-list">
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
                      <AssetThumb asset={asset} hoverAnimated />
                      <span className="asset-card-name">{asset.name}</span>
                      <span className="asset-card-size">
                        {asset.width}×{asset.height}
                      </span>
                    </button>
                    <AppTooltipTrigger label={`Edit ${asset.name}`}><button
                      type="button"
                      className="asset-edit icon-tooltip"
                      aria-label={`Edit ${asset.name}`}
                      onClick={() => { api.openWorkshop(asset.id); setInspectorOpen(true); }}
                    >
                      <ChromeIcon name="draw" size={14} />
                    </button></AppTooltipTrigger>
                    <ConfirmAction
                      className="asset-remove icon-tooltip"
                      label={`Remove ${asset.name}`}
                      confirmLabel={`Click again to remove ${asset.name}`}
                      onConfirm={() => api.removeAsset(asset.id)}
                      confirmChildren={<Check size={14} aria-hidden="true" />}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </ConfirmAction>
                  </li>
                ))}
              </ul>
            ) : null}
            </div>
          </details>

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
          <div className="page-workspace" data-workshop={workshopOpen ? "true" : undefined}>
          <div className="workspace-zoom screen-only" aria-label="Zoom"><StageZoomControls /></div>
          {workshopOpen ? (
            <main
              ref={stageWrapRef}
              className="stage-wrap screen-only"
              data-mode="workshop"
              data-zoomed={stageZoom > 1 ? "true" : undefined}
              style={{ "--stage-zoom": stageZoom } as CSSProperties}
            >
              <AssetWorkshop symmetry={symmetry} showGrid={showGrid} />
            </main>
          ) : (
            <PageStage symmetry={symmetry} showGrid={showGrid} viewportRef={stageWrapRef} />
          )}
          </div>
          {!workshopOpen && <nav className="strip screen-only" aria-label="Pages">
            <div className="strip-thumbs" data-dragging={draggedPage ? "true" : undefined}>
              {film.pages.map((page, index) => <button
                key={page.id} type="button" className="thumb"
                draggable
                data-active={index === film.activeIndex}
                data-dragging={draggedPage?.id === page.id ? "true" : undefined}
                data-drop={pageDrop?.index === index ? (pageDrop.after ? "after" : "before") : undefined}
                aria-label={`Page ${index + 1}. Drag to reorder.`}
                aria-current={index === film.activeIndex ? "page" : undefined}
                ref={index === film.activeIndex ? selectedPageRef : undefined}
                onClick={() => { api.selectPage(index); api.resetStageZoom(); }}
                onKeyDown={(event) => {
                  if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
                  event.preventDefault();
                  api.reorderPage(page.id, Math.max(0, Math.min(film.pages.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1))));
                }}
                onDragStart={(event) => {
                  setDraggedPage({ id: page.id, index });
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", page.id);
                }}
                onDragOver={(event) => {
                  if (!draggedPage || draggedPage.id === page.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setPageDrop({ index, after: event.clientX > event.currentTarget.getBoundingClientRect().left + event.currentTarget.offsetWidth / 2 });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!draggedPage || !pageDrop) return;
                  const boundary = pageDrop.index + Number(pageDrop.after);
                  api.reorderPage(draggedPage.id, boundary > draggedPage.index ? boundary - 1 : boundary);
                  setDraggedPage(null);
                  setPageDrop(null);
                }}
                onDragEnd={() => { setDraggedPage(null); setPageDrop(null); }}
              >
                <PagePreview page={page} assets={film.assets} />
                <span className="page-index">{index + 1}</span>
              </button>)}
            </div>
            <div className="strip-actions">
              <span className="page-count">{film.activeIndex + 1} / {film.pages.length}</span>
              <AppTooltipTrigger label="Duplicate page"><button type="button" className="pill ghost page-action-icon icon-tooltip" aria-label="Duplicate page" onClick={() => { api.duplicatePage(film.activeIndex); api.resetStageZoom(); }}><CopyPlus size={16} aria-hidden="true" /></button></AppTooltipTrigger>
              <ConfirmAction className="pill danger-subtle page-action-icon icon-tooltip" label="Delete page" confirmLabel={`Click again to delete page ${film.activeIndex + 1}`} disabled={film.pages.length <= 1} onConfirm={() => api.removePage(film.activeIndex)} confirmChildren={<Check size={16} aria-hidden="true" />}><Trash2 size={16} aria-hidden="true" /></ConfirmAction>
              <AppTooltipTrigger label="New page"><button type="button" className="pill ghost page-action-icon icon-tooltip" aria-label="New page" onClick={() => { api.addPage(); api.resetStageZoom(); }}><Plus size={17} aria-hidden="true" /></button></AppTooltipTrigger>
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
      <AppTooltip />
    </div>
  );
}
