"use client";

import { useState } from "react";
import { AssetWorkshop } from "./AssetWorkshop";
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
  type DrawTool,
} from "@/lib/types";
import { FrameSample } from "./BubbleFrame";
import { ChromeIcon, toolIconName } from "./ChromeIcons";
import { OpenDotsLogo, OpenDotsWordmark } from "./OpenDotsLogo";
import { PagePreview, AssetThumb } from "./PagePreview";
import { PixelCanvas } from "./PixelCanvas";
import { TextSizePreview } from "./TextSizePreview";
import { PresentMode } from "./PresentMode";
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
  const {
    film,
    tool,
    color,
    frame,
    textSize,
    textFont,
    shapeFilled,
    brushSize,
    selectedAssetId,
    workshopOpen,
    active,
  } = api;
  const density = active ?? film.pages[0];
  const [presenting, setPresenting] = useState(false);
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
            onClick={() => setPresenting(true)}
          >
            <ChromeIcon name="present" />
            Present
          </button>
          <WebMCPBridge />
        </div>
      </header>

      <div className="studio">
        <aside className="sidebar screen-only">
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
            <section className="access-group" aria-label="Color">
              <p className="sidebar-label">Color</p>
              {film.paletteName ? (
                <span className="size">{film.paletteName}</span>
              ) : null}
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
                <label className="custom-color" title="Pick any color">
                  <span className="custom-color-ring">
                    <span
                      className="custom-color-face"
                      style={{ background: color }}
                    />
                  </span>
                  <input
                    type="color"
                    value={color}
                    aria-label="Pick any color"
                    onChange={(event) => api.setColor(event.target.value)}
                  />
                </label>
              </div>
              {film.paletteName ? (
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
          </div>
          <main
            className="stage-wrap screen-only"
            data-mode={workshopOpen ? "workshop" : "page"}
          >
            {workshopOpen ? (
              <AssetWorkshop />
            ) : (
              <article className="leaf">
                <PixelCanvas />
              </article>
            )}
          </main>

          <nav className="strip screen-only" aria-label="Pages">
            <div className="strip-thumbs">
              {film.pages.map((page, index) => (
                <button
                  key={page.id}
                  type="button"
                  className="thumb"
                  data-active={index === film.activeIndex}
                  aria-label={`Page ${index + 1}`}
                  onClick={() => api.selectPage(index)}
                >
                  <PagePreview page={page} />
                </button>
              ))}
            </div>
            <div className="strip-actions">
              <button
                type="button"
                className="pill primary"
                onClick={() => api.addPage()}
              >
                <ChromeIcon name="page" />
                Page
              </button>
              {film.pages.length > 1 ? (
                <button
                  type="button"
                  className="pill ghost"
                  onClick={() => api.removePage(film.activeIndex)}
                >
                  <ChromeIcon name="delete" />
                  Delete
                </button>
              ) : null}
            </div>
          </nav>
        </div>
      </div>

      {presenting ? (
        <PresentMode
          pages={film.pages}
          index={film.activeIndex}
          onClose={() => setPresenting(false)}
          onSelect={(next) => api.selectPage(next)}
        />
      ) : null}
    </div>
  );
}
