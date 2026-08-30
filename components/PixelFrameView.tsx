"use client";

import { useEffect, useRef } from "react";
import type { PixelFrame } from "@/lib/types";

export function PixelFrameView({
  frame,
  scale = 6,
  label,
}: {
  frame: PixelFrame;
  scale?: number;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    canvas.width = frame.width * scale;
    canvas.height = frame.height * scale;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        ctx.fillStyle = frame.pixels[y * frame.width + x] ?? "#000000";
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }, [frame, scale]);

  return (
    <figure className="pixel-frame">
      <canvas
        ref={canvasRef}
        width={frame.width * scale}
        height={frame.height * scale}
        aria-label={label ?? frame.prompt}
      />
      {label ? <figcaption>{label}</figcaption> : null}
    </figure>
  );
}
