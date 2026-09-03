"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { boundsFromCorners, paintPixelGrid } from "@/lib/draw";
import { useFilm, useWorkshopDraft, useWorkshopRevision } from "@/lib/film-store";
import { assertNever } from "@/lib/types";
import { constrainDiagonal, strokePoints, symmetricPoints, type Symmetry } from "@/lib/stroke";
import { BrushPreview } from "./BrushPreview";

type Gesture =
  | { type: "paint"; x: number; y: number }
  | { type: "marquee"; x0: number; y0: number; x1: number; y1: number }
  | { type: "line"; x0: number; y0: number; x1: number; y1: number }
  | {
      type: "move";
      originX: number;
      originY: number;
      startX: number;
      startY: number;
      recorded: boolean;
    };

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

export function WorkshopCanvas({ symmetry = "none" }: { symmetry?: Symmetry }) {
  const workshopDraft = useWorkshopDraft();
  const workshopRevision = useWorkshopRevision();
  const {
    paint,
    paintLine,
    setColor,
    tool,
    color,
    brushSize,
    floating,
    liftMarquee,
    moveFloating,
    anchorFloating,
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

  const width = workshopDraft?.width ?? 32;
  const height = workshopDraft?.height ?? 32;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !workshopDraft) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;
    paintPixelGrid(ctx, workshopDraft.pixels, width, height);
  }, [height, width, workshopDraft, workshopRevision]);

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
    if (preview.type === "marquee") {
      paintMarquee(ctx, preview.x0, preview.y0, preview.x1, preview.y1);
    } else if (preview.type === "line") {
      ctx.fillStyle = color;
      for (const point of strokePoints(preview.x0, preview.y0, preview.x1, preview.y1)) ctx.fillRect(point.x, point.y, brushSize, brushSize);
    }
  }, [brushSize, color, height, preview, width]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!floating) {
        return;
      }
      if (event.key !== "Enter" && event.key !== "Escape") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, input")) {
        return;
      }
      event.preventDefault();
      anchorFloating();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchorFloating, floating]);

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
    setBrushPixel(null);
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
    if (floating) {
      anchorFloating();
    }
    if (tool === "select") beginMarquee(at);
  }

  function beginLineGesture(event: React.PointerEvent<HTMLCanvasElement>) {
    const at = pixelFromEvent(event);
    if (!at || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { type: "line", x0: at.x, y0: at.y, x1: at.x, y1: at.y };
    setPreview(gesture.current);
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
      case "line":
        paintLine(current.x0, current.y0, current.x1, current.y1);
        return;
      case "marquee": {
        const box = boundsFromCorners(
          current.x0,
          current.y0,
          current.x1,
          current.y1,
        );
        liftMarquee(box.x, box.y, box.width, box.height);
        return;
      }
      default:
        return assertNever(current, "Unknown gesture");
    }
  }

  if (!workshopDraft) {
    return null;
  }

  return (
    <div
      ref={boardRef}
      className="stage-board workshop-board"
      data-tool={tool}
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
        aria-label="Asset pixel canvas"
        onPointerDown={(event) => {
          switch (tool) {
            case "move":
              beginMoveGesture(event);
              event.preventDefault();
              return;
            case "line":
              beginLineGesture(event);
              event.preventDefault();
              return;
            case "eyedropper": {
              const at = pixelFromEvent(event);
              const sampled = at && workshopDraft.pixels[at.y * width + at.x];
              if (sampled) setColor(sampled);
              return;
            }
            case "select":
            case "pencil":
            case "eraser":
            case "fill": {
              event.currentTarget.setPointerCapture(event.pointerId);
              const at = pixelFromEvent(event);
              gesture.current = { type: "paint", x: at?.x ?? 0, y: at?.y ?? 0 };
              setBrushPixel(null);
              if (at) {
                for (const mirrored of symmetricPoints(at, width, height, symmetry)) paint(mirrored.x, mirrored.y, true);
              }
              return;
            }
            case "text":
            case "shape":
              return;
            default:
              return assertNever(tool, "Unknown tool");
          }
        }}
        onPointerMove={(event) => {
          const at = pixelFromEvent(event);
          if (tool === "move" && floating) {
            setOverSelection(Boolean(at && hitFloating(at.x, at.y)));
          }
          if (
            (tool === "pencil" || tool === "eraser") &&
            !gesture.current &&
            at
          ) {
            setBrushPixel(at);
          } else if (!gesture.current) {
            setBrushPixel(null);
          }
          const current = gesture.current;
          if (!current || !at) {
            return;
          }
          switch (current.type) {
            case "paint":
              for (const point of strokePoints(current.x, current.y, at.x, at.y)) {
                for (const mirrored of symmetricPoints(point, width, height, symmetry)) paint(mirrored.x, mirrored.y, false);
              }
              current.x = at.x;
              current.y = at.y;
              return;
            case "marquee": {
              const next = { ...current, x1: at.x, y1: at.y };
              gesture.current = next;
              setPreview(next);
              return;
            }
            case "line": {
              const end = event.shiftKey
                ? constrainDiagonal({ x: current.x0, y: current.y0 }, at)
                : at;
              const next = { ...current, x1: end.x, y1: end.y };
              gesture.current = next;
              setPreview(next);
              return;
            }
            case "move": {
              const x = current.originX + (at.x - current.startX);
              const y = current.originY + (at.y - current.startY);
              const moved = moveFloating(x, y, !current.recorded);
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
      ) : null}
      <BrushPreview
        tool={tool}
        brushSize={brushSize}
        pixel={brushPixel}
        gridWidth={width}
        gridHeight={height}
        hidden={dragging || preview != null}
      />
    </div>
  );
}
