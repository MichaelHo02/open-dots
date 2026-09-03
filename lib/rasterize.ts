import { isPaintedPixel } from "./types";

export interface PixelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface PixelStats {
  width: number;
  height: number;
  paintedCount: number;
  transparentCount: number;
  coverage: number;
  bounds: PixelBounds | null;
  colorHistogram: Record<string, number>;
  colorCount: number;
}

export function computePixelBounds(
  pixels: string[],
  width: number,
  height: number,
): PixelBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = pixels[y * width + x] ?? "";
      if (!isPaintedPixel(color)) {
        continue;
      }
      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function computePixelStats(
  pixels: string[],
  width: number,
  height: number,
): PixelStats {
  const colorHistogram: Record<string, number> = {};
  let paintedCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = pixels[y * width + x] ?? "";
      if (!isPaintedPixel(color)) {
        continue;
      }
      paintedCount += 1;
      colorHistogram[color] = (colorHistogram[color] ?? 0) + 1;
    }
  }

  const totalCells = width * height;
  return {
    width,
    height,
    paintedCount,
    transparentCount: totalCells - paintedCount,
    coverage: totalCells > 0 ? paintedCount / totalCells : 0,
    bounds: computePixelBounds(pixels, width, height),
    colorHistogram,
    colorCount: Object.keys(colorHistogram).length,
  };
}

function upscalePixels(
  pixels: string[],
  width: number,
  height: number,
  scale: number,
): { pixels: string[]; width: number; height: number } {
  const factor = Math.max(1, Math.floor(scale));
  if (factor === 1) {
    return { pixels, width, height };
  }
  const outW = width * factor;
  const outH = height * factor;
  const next: string[] = [];
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const sx = Math.min(width - 1, Math.floor(x / factor));
      const sy = Math.min(height - 1, Math.floor(y / factor));
      next.push(pixels[sy * width + sx] ?? "");
    }
  }
  return { pixels: next, width: outW, height: outH };
}

export function extractPixelRegion(
  pixels: string[],
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
): { pixels: string[]; width: number; height: number } {
  const region: string[] = [];
  for (let ly = 0; ly < height; ly += 1) {
    for (let lx = 0; lx < width; lx += 1) {
      const px = x + lx;
      const py = y + ly;
      if (px < 0 || py < 0 || px >= sourceWidth || py >= sourceHeight) {
        region.push("");
        continue;
      }
      region.push(pixels[py * sourceWidth + px] ?? "");
    }
  }
  return { pixels: region, width, height };
}

/** Rasterize a pixel grid to PNG base64 (no data-URL prefix). Returns null if canvas is unavailable. */
export function pixelsToPngBase64(
  pixels: string[],
  width: number,
  height: number,
  scale = 1,
): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const scaled = upscalePixels(pixels, width, height, scale);
  const canvas = document.createElement("canvas");
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const imageData = ctx.createImageData(scaled.width, scaled.height);
  for (let y = 0; y < scaled.height; y += 1) {
    for (let x = 0; x < scaled.width; x += 1) {
      const color = scaled.pixels[y * scaled.width + x] ?? "";
      const offset = (y * scaled.width + x) * 4;
      if (!isPaintedPixel(color)) {
        imageData.data[offset] = 0;
        imageData.data[offset + 1] = 0;
        imageData.data[offset + 2] = 0;
        imageData.data[offset + 3] = 0;
        continue;
      }
      const hex = color.startsWith("#") ? color.slice(1) : color;
      const value = Number.parseInt(hex, 16);
      imageData.data[offset] = (value >> 16) & 255;
      imageData.data[offset + 1] = (value >> 8) & 255;
      imageData.data[offset + 2] = value & 255;
      imageData.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");
  const prefix = "data:image/png;base64,";
  return dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : dataUrl;
}
