"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleFrame } from "./BubbleFrame";
import { useFilm } from "@/lib/film-store";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  framePlaceholder,
  type TextMark,
} from "@/lib/types";

export function PixelCanvas() {
  const {
    active,
    paint,
    tool,
    frame,
    color,
    addText,
    setText,
    moveText,
    removeText,
  } = useFilm();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const drag = useRef<{
    id: string;
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const width = active?.width ?? DEFAULT_WIDTH;
  const height = active?.height ?? DEFAULT_HEIGHT;
  const typing = tool === "type";
  const activeEdit = typing ? editingId : null;

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
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        ctx.fillStyle = page.pixels[y * width + x] ?? "#ffffff";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [active, height, width]);

  useEffect(() => {
    render();
  }, [render]);

  function pixelFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
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

  function unitFromEvent(event: React.PointerEvent) {
    const board = boardRef.current;
    if (!board) {
      return null;
    }
    const rect = board.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  return (
    <div
      ref={boardRef}
      className="stage-board"
      data-typing={typing}
      onPointerMove={(event) => {
        const current = drag.current;
        const board = boardRef.current;
        if (!current || !board) {
          return;
        }
        const rect = board.getBoundingClientRect();
        const x = current.originX + (event.clientX - current.startX) / rect.width;
        const y = current.originY + (event.clientY - current.startY) / rect.height;
        moveText(current.id, x, y);
      }}
      onPointerUp={() => {
        drawing.current = false;
        drag.current = null;
      }}
      onPointerCancel={() => {
        drawing.current = false;
        drag.current = null;
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
          if (typing) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = tool !== "fill";
          const at = pixelFromEvent(event);
          if (at) {
            paint(at.x, at.y, true);
          }
        }}
        onPointerMove={(event) => {
          if (!drawing.current) {
            return;
          }
          const at = pixelFromEvent(event);
          if (at) {
            paint(at.x, at.y, false);
          }
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <div
        className="stage-copy"
        onPointerDown={(event) => {
          if (!typing || event.target !== event.currentTarget) {
            return;
          }
          const at = unitFromEvent(event);
          if (!at) {
            return;
          }
          const mark = addText({ x: at.x, y: at.y, color, frame });
          if (mark) {
            setEditingId(mark.id);
          }
        }}
      >
        {(active?.texts ?? []).map((mark) => (
          <TextLine
            key={mark.id}
            mark={mark}
            typing={typing}
            editing={activeEdit === mark.id}
            onEdit={() => setEditingId(mark.id)}
            onChange={(body) => setText(mark.id, body)}
            onRemove={() => {
              removeText(mark.id);
              setEditingId(null);
            }}
            onDragStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
              boardRef.current?.setPointerCapture(event.pointerId);
              drag.current = {
                id: mark.id,
                originX: mark.x,
                originY: mark.y,
                startX: event.clientX,
                startY: event.clientY,
              };
              setEditingId(mark.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TextLine({
  mark,
  typing,
  editing,
  onEdit,
  onChange,
  onRemove,
  onDragStart,
}: {
  mark: TextMark;
  typing: boolean;
  editing: boolean;
  onEdit: () => void;
  onChange: (body: string) => void;
  onRemove: () => void;
  onDragStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      fieldRef.current?.focus();
    }
  }, [editing]);

  return (
    <BubbleFrame
      mark={mark}
      className={`stage-line${editing ? " is-editing" : ""}`}
      chrome={
        typing ? (
          <>
            <button
              type="button"
              className="stage-move"
              aria-label="Move bubble"
              onPointerDown={onDragStart}
            >
              Move
            </button>
            <button
              type="button"
              className="stage-remove"
              aria-label="Remove bubble"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRemove}
            >
              ×
            </button>
          </>
        ) : null
      }
    >
      <textarea
        ref={fieldRef}
        rows={Math.max(1, mark.body.split("\n").length)}
        value={mark.body}
        readOnly={!typing}
        placeholder={framePlaceholder(mark.frame)}
        aria-label="Story text on the page"
        onPointerDown={() => {
          if (typing) {
            onEdit();
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (!mark.body.trim()) {
            onRemove();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.blur();
          }
        }}
      />
    </BubbleFrame>
  );
}
