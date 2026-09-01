"use client";

import { useEffect, useRef } from "react";
import { paintPixelGrid } from "@/lib/draw";
import { measureText, rasterizeTextRun } from "@/lib/pixel-font";
import { emptyPixels, type TextFont, type TextSize } from "@/lib/types";

const SAMPLE = "Aa";

export function TextSizePreview({
  textSize,
  textFont = "inter",
  color,
}: {
  textSize: TextSize;
  textFont?: TextFont;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = measureText(SAMPLE, textFont, textSize);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;
    const pixels = emptyPixels(width, height);
    const stamped = rasterizeTextRun(pixels, { width, height }, {
      x: 0,
      y: 0,
      body: SAMPLE,
      color,
      font: textFont,
      size: textSize,
    });
    paintPixelGrid(ctx, stamped, width, height);
  }, [color, height, textFont, textSize, width]);

  return (
    <div className="text-size-preview" aria-label="Text size preview">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        aria-hidden="true"
      />
    </div>
  );
}
