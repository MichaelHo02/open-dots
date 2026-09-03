"use client";

import { useEffect, useRef } from "react";
import { paintPixelGrid, compositedPagePixels } from "@/lib/draw";
import { type Page, type Asset } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/dotmatrix-hooks";

export function PagePreview({
  page,
  assets = [],
  className = "",
  animated = false,
}: {
  page: Page;
  assets?: Asset[];
  className?: string;
  animated?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();
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
    const started = Date.now();
    const draw = () => {
      const elapsed = Date.now() - started;
      const visibleAssets = animated && !reducedMotion ? assets.map(asset => asset.frames?.length
        ? { ...asset, pixels: asset.frames[Math.floor(elapsed / (asset.frameDuration ?? 400)) % asset.frames.length] } : asset) : assets;
      paintPixelGrid(ctx, compositedPagePixels(page, visibleAssets), width, height);
    };
    draw();
    if (!animated || reducedMotion || !assets.some(asset => (asset.frames?.length ?? 0) > 1)) return;
    const timer = window.setInterval(draw, 100);
    return () => window.clearInterval(timer);
  }, [animated, assets, height, page, reducedMotion, width]);

  return (
    <span className={`thumb-art ${className}`.trim()}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    </span>
  );
}

export function AssetThumb({ asset, animated = false }: { asset: Asset; animated?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    canvas.width = asset.width;
    canvas.height = asset.height;
    ctx.imageSmoothingEnabled = false;
    const frames = animated && asset.frames?.length ? asset.frames : [asset.pixels];
    const draw = () => { paintPixelGrid(ctx, frames[frameRef.current % frames.length], asset.width, asset.height); frameRef.current += 1; };
    draw();
    if (frames.length <= 1) return;
    const timer = window.setInterval(draw, asset.frameDuration ?? 400);
    return () => window.clearInterval(timer);
  }, [animated, asset]);

  return (
    <canvas
      className="asset-thumb"
      ref={canvasRef}
      width={asset.width}
      height={asset.height}
      aria-hidden="true"
    />
  );
}
