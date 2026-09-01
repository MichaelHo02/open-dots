"use client";

import { useState } from "react";
import { useFilm } from "@/lib/film-store";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  DRAW_TOOLS,
  MAX_WIDTH,
  MIN_WIDTH,
  PALETTE,
  TEXT_FRAMES,
  assertNever,
  frameHint,
  frameLabel,
  type DrawTool,
} from "@/lib/types";
import { PagePreview } from "./PagePreview";
import { PixelCanvas } from "./PixelCanvas";
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
    case "type":
      return "Type";
    default:
      return assertNever(tool, "Unknown tool");
  }
}

export function FilmApp() {
  const api = useFilm();
  const { film, tool, color, frame, active } = api;
  const density = active ?? film.pages[0];
  const [presenting, setPresenting] = useState(false);

  return (
    <div className="film" data-present={presenting}>
      <header className="top-nav">
        <p className="brand">Pixel Book</p>
        <nav className="tool-list" aria-label="Tools">
          {DRAW_TOOLS.map((item) => (
            <button
              key={item}
              type="button"
              className="pill"
              data-active={tool === item}
              onClick={() => api.setTool(item)}
            >
              {toolLabel(item)}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button type="button" className="pill ghost" onClick={() => api.undo()}>
            Undo
          </button>
          <button
            type="button"
            className="pill ghost"
            onClick={() => api.clearPage()}
          >
            Clear
          </button>
          <button
            type="button"
            className="pill primary"
            onClick={() => setPresenting(true)}
          >
            Present
          </button>
          <WebMCPBridge />
        </div>
      </header>

      <div className="studio">
        <aside className="sidebar screen-only">
          {tool === "type" ? (
            <section className="sidebar-section" aria-label="Bubble">
              <p className="sidebar-label">Bubble</p>
              <p className="sidebar-help">{frameHint(frame)}</p>
              <div className="frame-grid">
                {TEXT_FRAMES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="frame-card"
                    data-active={frame === item}
                    onClick={() => api.setFrame(item)}
                  >
                    <span className={`frame-sample bubble-${item}`}>
                      <span className="bubble-body">Aa</span>
                    </span>
                    {frameLabel(item)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="sidebar-section" aria-label="Color">
            <p className="sidebar-label">Color</p>
            <div className="panel-swatches">
              {PALETTE.map((swatch) => (
                <button
                  key={swatch}
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
          </section>

          <section className="sidebar-section" aria-label="Density">
            <div className="density-row">
              <p className="sidebar-label">Density</p>
              <span className="size">
                {density?.width ?? DEFAULT_WIDTH}×
                {density?.height ?? DEFAULT_HEIGHT}
              </span>
            </div>
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
          </section>
        </aside>

        <div className="workspace">
          <main className="stage-wrap screen-only">
            <article className="leaf">
              <PixelCanvas />
            </article>
          </main>

          <nav className="strip screen-only" aria-label="Pages">
            <button
              type="button"
              className="pill primary"
              onClick={() => api.addPage()}
            >
              + Page
            </button>
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
            {film.pages.length > 1 ? (
              <button
                type="button"
                className="pill ghost"
                onClick={() => api.removePage(film.activeIndex)}
              >
                Delete
              </button>
            ) : null}
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
