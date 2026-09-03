"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { PixelTextInput } from "./PixelTextInput";
import { BrushPreview } from "./BrushPreview";
import {
  boundsFromCorners,
  compositedPagePixels,
  hitPlacementAt,
  paintPixelGrid,
  rasterizeShape,
  scaleStamp,
  stampPlacementFromDrag,
} from "@/lib/draw";
import { useFilm } from "@/lib/film-store";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  assertNever,
  isPaintedPixel,
  type PixelStamp,
} from "@/lib/types";

type Gesture =
  | { type: "paint" }
  | { type: "shape"; x0: number; y0: number; x1: number; y1: number }
  | { type: "marquee"; x0: number; y0: number; x1: number; y1: number }
  | { type: "asset"; x0: number; y0: number; x1: number; y1: number }
  | {
      type: "move";
      originX: number;
      originY: number;
      startX: number;
      startY: number;
      recorded: boolean;
      placementId?: string;
    };

function paintStamp(
  ctx: CanvasRenderingContext2D,
  stamp: PixelStamp,
) {
  for (let ly = 0; ly < stamp.height; ly += 1) {
    for (let lx = 0; lx < stamp.width; lx += 1) {
      const color = stamp.pixels[ly * stamp.width + lx];
      if (!isPaintedPixel(color)) {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(stamp.x + lx, stamp.y + ly, 1, 1);
    }
  }
}

function paintMarquee(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const box = boundsFromCorners(x0, y0, x1, y1);
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  for (let x = 0; x < box.width; x += 1) {
    ctx.fillRect(box.x + x, box.y, 1, 1);
    ctx.fillRect(box.x + x, box.y + box.height - 1, 1, 1);
  }
  for (let y = 0; y < box.height; y += 1) {
    ctx.fillRect(box.x, box.y + y, 1, 1);
    ctx.fillRect(box.x + box.width - 1, box.y + y, 1, 1);
  }
}

export function PixelCanvas() {
  const {
    active,
    paint,
    tool,
    color,
    frame,
    shapeFilled,
    selectedAssetId,
    film,
    floating,
    addText,
    stampShape,
    stampAsset,
    liftMarquee,
    moveFloating,
    movePlacement,
    selectPlacement,
    selectedPlacementId,
    anchorFloating,
    setText,
    removeText,
    selectMark,
    selectedId,
    brushSize,
    workshopOpen,
  } = useFilm();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [brushPixel, setBrushPixel] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<Gesture | null>(null);
  const [overSelection, setOverSelection] = useState(false);
  const [dragging, setDragging] = useState(false);
  const width = active?.width ?? DEFAULT_WIDTH;
  const height = active?.height ?? DEFAULT_HEIGHT;
  const marking = tool === "text";
  const selectedAsset = film.assets.find((item) => item.id === selectedAssetId) ?? null;
  const selectedPlacement =
    active?.placements.find((item) => item.id === selectedPlacementId) ?? null;
  const activeText =
    active?.texts.find((mark) => mark.id === selectedId) ?? null;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const page = active;
    if (!canvas || !ctx || !page) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;
    paintPixelGrid(
      ctx,
      compositedPagePixels(page, film.assets),
      width,
      height,
    );
  }, [active, film.assets, height, width]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const canvas = previewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    if (!preview) {
      return;
    }
    switch (preview.type) {
      case "paint":
      case "move":
        return;
      case "shape": {
        const stamp = rasterizeShape(
          frame,
          preview.x0,
          preview.y0,
          preview.x1,
          preview.y1,
          color,
          shapeFilled,
        );
        paintStamp(ctx, stamp);
        return;
      }
      case "marquee":
        paintMarquee(ctx, preview.x0, preview.y0, preview.x1, preview.y1);
        return;
      case "asset": {
        if (!selectedAsset) {
          return;
        }
        const placement = stampPlacementFromDrag(
          preview.x0,
          preview.y0,
          preview.x1,
          preview.y1,
          selectedAsset.width,
          selectedAsset.height,
        );
        const stamp = placement.scaled
          ? scaleStamp(
              {
                x: placement.x,
                y: placement.y,
                width: selectedAsset.width,
                height: selectedAsset.height,
                pixels: selectedAsset.pixels,
              },
              placement.width,
              placement.height,
            )
          : {
              x: placement.x,
              y: placement.y,
              width: selectedAsset.width,
              height: selectedAsset.height,
              pixels: selectedAsset.pixels,
            };
        paintStamp(ctx, stamp);
        return;
      }
      default:
        return assertNever(preview, "Unknown preview");
    }
  }, [color, frame, height, preview, selectedAsset, shapeFilled, width]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== "Escape") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, input")) {
        return;
      }
      if (floating) {
        event.preventDefault();
        anchorFloating();
        return;
      }
      if (selectedPlacementId) {
        event.preventDefault();
        selectPlacement(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchorFloating, floating, selectPlacement, selectedPlacementId]);

  function pixelFromEvent(event: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return null;
    }
    return { x, y };
  }

  function hitFloating(x: number, y: number) {
    if (!floating) {
      return false;
    }
    return (
      x >= floating.x &&
      y >= floating.y &&
      x < floating.x + floating.width &&
      y < floating.y + floating.height
    );
  }

  function resolveStampAsset(assetId: string) {
    return film.assets.find((item) => item.id === assetId);
  }

  function placementAt(x: number, y: number) {
    return hitPlacementAt(active?.placements, x, y, resolveStampAsset);
  }

  function startPlacementMove(at: { x: number; y: number }) {
    const hit = placementAt(at.x, at.y);
    if (!hit) {
      return false;
    }
    selectPlacement(hit.id);
    gesture.current = {
      type: "move",
      originX: hit.x,
      originY: hit.y,
      startX: at.x,
      startY: at.y,
      recorded: false,
      placementId: hit.id,
    };
    setPreview(null);
    setDragging(true);
    return true;
  }

  function placeText(event: React.PointerEvent) {
    if (!marking || event.button !== 0) {
      return false;
    }
    const at = pixelFromEvent(event);
    if (!at) {
      return false;
    }
    const mark = addText({ x: at.x, y: at.y, color });
    if (mark) {
      event.stopPropagation();
    }
    return Boolean(mark);
  }

  function startFloatingMove(at: { x: number; y: number }) {
    if (!floating || !hitFloating(at.x, at.y)) {
      return false;
    }
    gesture.current = {
      type: "move",
      originX: floating.x,
      originY: floating.y,
      startX: at.x,
      startY: at.y,
      recorded: false,
    };
    setPreview(null);
    setDragging(true);
    return true;
  }

  function beginMarquee(at: { x: number; y: number }) {
    const next: Gesture = {
      type: "marquee",
      x0: at.x,
      y0: at.y,
      x1: at.x,
      y1: at.y,
    };
    gesture.current = next;
    setPreview(next);
  }

  function beginAssetGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const at = pixelFromEvent(event);
    if (!at || event.button !== 0 || !selectedAsset) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (startFloatingMove(at)) {
      return;
    }
    if (startPlacementMove(at)) {
      return;
    }
    if (floating) {
      anchorFloating();
    }
    const next: Gesture = { type: "asset", x0: at.x, y0: at.y, x1: at.x, y1: at.y };
    gesture.current = next;
    setPreview(next);
    setBrushPixel(null);
  }

  function beginShapeGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const at = pixelFromEvent(event);
    if (!at || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (startFloatingMove(at)) {
      return;
    }
    if (floating) {
      anchorFloating();
    }
    const next: Gesture = { type: "shape", x0: at.x, y0: at.y, x1: at.x, y1: at.y };
    gesture.current = next;
    setPreview(next);
    setBrushPixel(null);
  }

  function beginMoveGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const at = pixelFromEvent(event);
    if (!at || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (startFloatingMove(at)) {
      return;
    }
    if (startPlacementMove(at)) {
      return;
    }
    if (floating) {
      anchorFloating();
    }
    beginMarquee(at);
  }

  function finishGesture() {
    const current = gesture.current;
    gesture.current = null;
    setPreview(null);
    setDragging(false);
    if (!current) {
      return;
    }
    switch (current.type) {
      case "paint":
      case "move":
        return;
      case "shape":
        stampShape({
          x0: current.x0,
          y0: current.y0,
          x1: current.x1,
          y1: current.y1,
          keepFloating: true,
        });
        return;
      case "marquee": {
        const box = boundsFromCorners(current.x0, current.y0, current.x1, current.y1);
        liftMarquee(box.x, box.y, box.width, box.height);
        return;
      }
      case "asset": {
        if (!selectedAsset) {
          return;
        }
        const placement = stampPlacementFromDrag(
          current.x0,
          current.y0,
          current.x1,
          current.y1,
          selectedAsset.width,
          selectedAsset.height,
        );
        stampAsset({
          id: selectedAsset.id,
          x: placement.x,
          y: placement.y,
          width: placement.scaled ? placement.width : undefined,
          height: placement.scaled ? placement.height : undefined,
          keepFloating: true,
        });
        return;
      }
      default:
        return assertNever(current, "Unknown gesture");
    }
  }

  return (
    <div
      ref={boardRef}
      className="stage-board"
      data-tool={tool}
      data-marking={marking}
      data-asset-stamp={selectedAsset ? "true" : undefined}
      data-over-selection={overSelection ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      style={
        {
          "--grid-cols": String(width),
          "--grid-rows": String(height),
        } as CSSProperties
      }
      onPointerLeave={() => {
        setBrushPixel(null);
        setOverSelection(false);
      }}
    >
      <canvas
        ref={canvasRef}
        className="stage"
        width={width}
        height={height}
        tabIndex={0}
        aria-label="Pixel canvas"
        onPointerDown={(event) => {
          if (selectedAsset && tool !== "text" && event.button === 0) {
            beginAssetGesture(event);
            event.preventDefault();
            return;
          }
          switch (tool) {
            case "text":
              if (placeText(event)) {
                event.preventDefault();
              }
              return;
            case "shape":
              beginShapeGesture(event);
              event.preventDefault();
              return;
            case "move":
              beginMoveGesture(event);
              event.preventDefault();
              return;
            case "pencil":
            case "eraser":
            case "fill": {
              event.currentTarget.setPointerCapture(event.pointerId);
              gesture.current = { type: "paint" };
              setBrushPixel(null);
              const at = pixelFromEvent(event);
              if (at) {
                paint(at.x, at.y, true);
              }
              return;
            }
            default:
              return assertNever(tool, "Unknown tool");
          }
        }}
        onPointerMove={(event) => {
          const at = pixelFromEvent(event);
          if (
            (tool === "move" || tool === "shape" || selectedAsset) &&
            (floating || selectedPlacement)
          ) {
            setOverSelection(
              Boolean(
                at &&
                  (hitFloating(at.x, at.y) ||
                    placementAt(at.x, at.y)?.id === selectedPlacementId),
              ),
            );
          }
          if (
            (tool === "pencil" || tool === "eraser") &&
            !gesture.current &&
            !selectedAsset &&
            at
          ) {
            setBrushPixel(at);
          } else if (!gesture.current) {
            setBrushPixel(null);
          }
          const current = gesture.current;
          if (!current) {
            return;
          }
          if (!at) {
            return;
          }
          switch (current.type) {
            case "paint":
              paint(at.x, at.y, false);
              return;
            case "shape":
            case "marquee":
            case "asset": {
              const next = { ...current, x1: at.x, y1: at.y };
              gesture.current = next;
              setPreview(next);
              return;
            }
            case "move": {
              const x = current.originX + (at.x - current.startX);
              const y = current.originY + (at.y - current.startY);
              const moved = current.placementId
                ? movePlacement(current.placementId, x, y, !current.recorded)
                : moveFloating(x, y, !current.recorded);
              if (moved && (x !== current.originX || y !== current.originY)) {
                current.recorded = true;
              }
              return;
            }
            default:
              return assertNever(current, "Unknown gesture");
          }
        }}
        onPointerUp={() => {
          finishGesture();
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setPreview(null);
          setDragging(false);
          setBrushPixel(null);
        }}
      />
      <canvas
        ref={previewRef}
        className="stage-preview"
        width={width}
        height={height}
        aria-hidden="true"
      />
      {floating ? (
        <span
          className="pixel-selection"
          aria-hidden="true"
          style={{
            left: `${(floating.x / width) * 100}%`,
            top: `${(floating.y / height) * 100}%`,
            width: `${(floating.width / width) * 100}%`,
            height: `${(floating.height / height) * 100}%`,
          }}
        />
      ) : selectedPlacement ? (
        <span
          className="pixel-selection"
          aria-hidden="true"
          style={{
            left: `${(selectedPlacement.x / width) * 100}%`,
            top: `${(selectedPlacement.y / height) * 100}%`,
            width: `${(selectedPlacement.width / width) * 100}%`,
            height: `${(selectedPlacement.height / height) * 100}%`,
          }}
        />
      ) : null}
      <PixelTextInput
        active={marking && activeText != null}
        value={activeText?.body ?? ""}
        onChange={(body) => {
          if (selectedId) {
            setText(selectedId, body);
          }
        }}
        onCommit={() => {
          if (!selectedId) {
            return;
          }
          if (!activeText?.body.trim()) {
            removeText(selectedId);
            return;
          }
          selectMark(null);
        }}
      />
      <BrushPreview
        tool={tool}
        brushSize={brushSize}
        pixel={brushPixel}
        gridWidth={width}
        gridHeight={height}
        hidden={
          workshopOpen ||
          dragging ||
          preview != null ||
          Boolean(selectedAsset)
        }
      />
    </div>
  );
}
