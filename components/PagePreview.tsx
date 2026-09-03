"use client";

import { useEffect, useRef } from "react";
import { paintPixelGrid, compositedPagePixels } from "@/lib/draw";
import { type Page, type Asset } from "@/lib/types";

export function PagePreview({
  page,
  assets = [],
  className = "",
}: {
  page: Page;
  assets?: Asset[];
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
    paintPixelGrid(
      ctx,
      compositedPagePixels(page, assets),
      width,
      height,
    );
  }, [assets, height, page, width]);

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

export function AssetThumb({ asset }: { asset: Asset }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    canvas.width = asset.width;
    canvas.height = asset.height;
    ctx.imageSmoothingEnabled = false;
    paintPixelGrid(ctx, asset.pixels, asset.width, asset.height);
  }, [asset]);

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
