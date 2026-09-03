"use client";

import { useRef, useState, type CSSProperties } from "react";
import { AssetWorkshop } from "./AssetWorkshop";
import { ColorAddPopover } from "./ColorAddPopover";
import { PaletteProfileControls } from "./PaletteProfileControls";
import { useFilm } from "@/lib/film-store";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  DRAW_TOOLS,
  MAX_ASSETS,
  MAX_WIDTH,
  MIN_WIDTH,
  TEXT_FRAMES,
  MIN_BRUSH_SIZE,
  MAX_BRUSH_SIZE,
  MIN_TEXT_SIZE,
  MAX_TEXT_SIZE,
  assertNever,
  brushSizeLabel,
  frameHint,
  frameLabel,
  isBuiltInPalette,
  isDefaultPaletteId,
  readingOrder,
  type DrawTool,
} from "@/lib/types";
import { FrameSample } from "./BubbleFrame";
import { ChromeIcon, toolIconName } from "./ChromeIcons";
import { OpenDotsLogo, OpenDotsWordmark } from "./OpenDotsLogo";
import { AssetThumb } from "./PagePreview";
import { BoardStage } from "./BoardStage";
import { TextSizePreview } from "./TextSizePreview";
import { PresentMode } from "./PresentMode";
import { StageZoomControls } from "./StageZoomControls";
import { useStageZoomShortcuts } from "./useStageZoomShortcuts";
import { WebMCPBridge } from "./WebMCPBridge";

function toolLabel(tool: DrawTool): string {
  switch (tool) {
    case "pencil":
      return "Draw";
    case "eraser":
      return "Erase";
    case "fill":
      return "Fill";
    case "text":
      return "Text";
    case "shape":
      return "Shape";
    case "move":
      return "Move";
    default:
      return assertNever(tool, "Unknown tool");
  }
}

function sidebarHint(tool: DrawTool): string {
  switch (tool) {
    case "pencil":
      return "Draw on the page";
    case "eraser":
      return "Erase on the page";
    case "fill":
      return "Tap to fill an area";
    case "move":
      return "Drag to select and move pixels";
    case "text":
    case "shape":
      return "";
    default:
      return assertNever(tool, "Unknown tool");
  }
}

export function FilmApp() {
  const api = useFilm();
  const stageWrapRef = useRef<HTMLElement>(null);
  const {
    film,
    tool,
    color,
    frame,
    textSize,
    textFont,
    shapeFilled,
    brushSize,
    stageZoom,
    selectedAssetId,
    workshopOpen,
    active,
  } = api;
  const density = active ?? film.pages[0];
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const presentPages = readingOrder(film.pages);
  const openPresent = () => {
    const start = presentPages.findIndex((page) => page.id === active?.id);
    setPresentIndex(start < 0 ? 0 : start);
    setPresenting(true);
  };
  useStageZoomShortcuts(stageWrapRef);
  const simpleTool =
    tool === "pencil" ||
    tool === "eraser" ||
    tool === "fill" ||
    tool === "move";
  const hint = sidebarHint(tool);

  return (
    <div
      className="film"
      data-present={presenting}
      data-workshop={workshopOpen ? "true" : undefined}
    >
      <header className="top-nav">
        <div className="brand" aria-label="Open Dots">
          <OpenDotsLogo size={22} />
          <OpenDotsWordmark />
        </div>
        <nav className="tool-list" aria-label="Tools">
          {DRAW_TOOLS.map((item) => (
            <button
              key={item}
              type="button"
              className="pill"
              data-active={tool === item}
              onClick={() => api.setTool(item)}
            >
              <ChromeIcon name={toolIconName(item)} />
              {toolLabel(item)}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button type="button" className="pill ghost" onClick={() => api.undo()}>
            <ChromeIcon name="undo" />
            Undo
          </button>
          <button
            type="button"
            className="pill ghost"
            onClick={() => api.clearPage()}
          >
            <ChromeIcon name="clear" />
            Clear
          </button>
          <button
            type="button"
            className="pill primary"
            onClick={openPresent}
          >
            <ChromeIcon name="present" />
            Present
          </button>
          <WebMCPBridge />
        </div>
      </header>

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
                onClick={() => api.openWorkshop()}
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
                      onClick={() => api.openWorkshop()}
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
                      onDoubleClick={() => api.openWorkshop(asset.id)}
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
                      onClick={() => api.openWorkshop(asset.id)}
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

          {simpleTool && !workshopOpen ? (
            <section className="sidebar-section" aria-label="Tool hint">
              <p className="sidebar-label">{toolLabel(tool)}</p>
              <p className="sidebar-help">{hint}</p>
            </section>
          ) : null}

          {tool === "text" ? (
            <section className="sidebar-section" aria-label="Text size">
              <p className="sidebar-label">Text size</p>
              <div className="number-stepper" role="group" aria-label="Text size scale">
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Decrease text size"
                  disabled={textSize <= MIN_TEXT_SIZE}
                  onClick={() => api.setTextSize(textSize - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  className="stepper-input"
                  min={MIN_TEXT_SIZE}
                  max={MAX_TEXT_SIZE}
                  step={1}
                  value={textSize}
                  aria-label="Text size scale"
                  onChange={(event) =>
                    api.setTextSize(Number(event.target.value))
                  }
                />
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label="Increase text size"
                  disabled={textSize >= MAX_TEXT_SIZE}
                  onClick={() => api.setTextSize(textSize + 1)}
                >
                  +
                </button>
              </div>
              <TextSizePreview
                textSize={textSize}
                textFont={textFont}
                color={color}
              />
            </section>
          ) : null}

          {tool === "shape" ? (
            <>
              <section className="sidebar-section" aria-label="Shape">
                <p className="sidebar-label">Shape</p>
                <p className="sidebar-help">{frameHint(frame)}</p>
                <div className="frame-grid">
                  {TEXT_FRAMES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="frame-card"
                      data-active={frame === item}
                      aria-label={frameLabel(item)}
                      onClick={() => api.setFrame(item)}
                    >
                      <FrameSample frame={item} />
                      {frameLabel(item)}
                    </button>
                  ))}
                </div>
              </section>
              <section className="sidebar-section" aria-label="Fill">
                <p className="sidebar-label">Fill</p>
                <div className="choice-row">
                  <button
                    type="button"
                    className="pill"
                    data-active={shapeFilled}
                    onClick={() => api.setShapeFilled(true)}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    className="pill"
                    data-active={!shapeFilled}
                    onClick={() => api.setShapeFilled(false)}
                  >
                    Stroke
                  </button>
                </div>
              </section>
            </>
          ) : null}

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
                Click to place at native size. Drag to scale proportionally.
                Click the asset again to deselect.
              </p>
              <button
                type="button"
                className="pill ghost"
                onClick={() => api.selectAsset(null)}
              >
                Deselect asset
              </button>
            </section>
          ) : null}
        </aside>

        <div className="workspace">
          <div className="access-bar screen-only" aria-label="Page options">
            {!workshopOpen ? (
              <section className="access-group access-density" aria-label="Density">
                <p className="sidebar-label">Density</p>
                <label className="scale-field panel-scale">
                  <input
                    type="range"
                    min={MIN_WIDTH}
                    max={MAX_WIDTH}
                    step={16}
                    value={density?.width ?? DEFAULT_WIDTH}
                    aria-label="Pixels across this page"
                    onChange={(event) =>
                      api.setDensity(Number(event.target.value))
                    }
                  />
                </label>
                <span className="size">
                  {density?.width ?? DEFAULT_WIDTH}×
                  {density?.height ?? DEFAULT_HEIGHT}
                </span>
              </section>
            ) : null}
            {tool === "pencil" || tool === "eraser" ? (
              <section className="access-group access-brush" aria-label="Brush size">
                <p className="sidebar-label">Size</p>
                <label className="scale-field panel-scale">
                  <input
                    type="range"
                    min={MIN_BRUSH_SIZE}
                    max={MAX_BRUSH_SIZE}
                    step={1}
                    value={brushSize}
                    aria-label="Brush size"
                    onChange={(event) =>
                      api.setBrushSize(Number(event.target.value))
                    }
                  />
                </label>
                <span className="size">{brushSizeLabel(brushSize)}</span>
              </section>
            ) : null}
            <section className="access-group access-zoom" aria-label="Zoom">
              <p className="sidebar-label">Zoom</p>
              <StageZoomControls />
            </section>
          </div>
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
            <BoardStage viewportRef={stageWrapRef} />
          )}
        </div>
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
