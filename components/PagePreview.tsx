"use client";

import { useEffect, useRef } from "react";
import { BubbleFrame } from "./BubbleFrame";
import type { Page } from "@/lib/types";

export function PagePreview({
  page,
  className = "",
}: {
  page: Page;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = page;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
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
  }, [height, page.pixels, width]);

  return (
    <span className={`thumb-art ${className}`.trim()}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
      {page.texts.map((mark) => (
        <BubbleFrame key={mark.id} mark={mark} className="thumb-bubble">
          <span className="thumb-line">{mark.body}</span>
        </BubbleFrame>
      ))}
    </span>
  );
}
