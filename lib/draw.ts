import {
  EMPTY,
  TRANSPARENT,
  assertNever,
  emptyPixels,
  isPaintedPixel,
  type Asset,
  type Page,
  type PixelStamp,
  type Placement,
  type ShapeKind,
  type ShapeScale,
  type Size,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function inBounds(x: number, y: number, size: Size): boolean {
  return x >= 0 && y >= 0 && x < size.width && y < size.height;
}

export function idx(x: number, y: number, size: Size): number {
  return y * size.width + x;
}

export function hexColor(value: string | undefined, fallback = EMPTY): string {
  if (value === EMPTY || value === TRANSPARENT) {
    return EMPTY;
  }
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function paintPixelGrid(
  ctx: CanvasRenderingContext2D,
  pixels: string[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = pixels[y * width + x];
      if (!isPaintedPixel(color)) {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function clonePixels(pixels: string[]): string[] {
  return pixels.slice();
}

export function setPixel(
  pixels: string[],
  size: Size,
  x: number,
  y: number,
  color: string,
): string[] {
  if (!inBounds(x, y, size)) {
    return pixels;
  }
  const next = clonePixels(pixels);
  next[idx(x, y, size)] = hexColor(color);
  return next;
}

export function paintBrush(
  pixels: string[],
  size: Size,
  x: number,
  y: number,
  brushSize: number,
  color: string,
): string[] {
  const stamp = Math.max(1, Math.round(brushSize));
  const paint = hexColor(color);
  const next = clonePixels(pixels);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  for (let dy = 0; dy < stamp; dy += 1) {
    for (let dx = 0; dx < stamp; dx += 1) {
      const px = x0 + dx;
      const py = y0 + dy;
      if (inBounds(px, py, size)) {
        next[idx(px, py, size)] = paint;
      }
    }
  }
  return next;
}

export function setPixels(
  pixels: string[],
  size: Size,
  dots: Array<{ x: number; y: number; color: string }>,
): string[] {
  const next = clonePixels(pixels);
  for (const dot of dots) {
    if (!inBounds(dot.x, dot.y, size)) {
      continue;
    }
    next[idx(dot.x, dot.y, size)] = hexColor(dot.color);
  }
  return next;
}

export function fillRect(
  pixels: string[],
  size: Size,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): string[] {
  const next = clonePixels(pixels);
  const paint = hexColor(color);
  const x0 = clamp(Math.floor(x), 0, size.width - 1);
  const y0 = clamp(Math.floor(y), 0, size.height - 1);
  const x1 = clamp(Math.floor(x + width - 1), 0, size.width - 1);
  const y1 = clamp(Math.floor(y + height - 1), 0, size.height - 1);
  for (let py = Math.min(y0, y1); py <= Math.max(y0, y1); py += 1) {
    for (let px = Math.min(x0, x1); px <= Math.max(x0, x1); px += 1) {
      next[idx(px, py, size)] = paint;
    }
  }
  return next;
}

export function drawLine(
  pixels: string[],
  size: Size,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): string[] {
  const next = clonePixels(pixels);
  const paint = hexColor(color);
  let x = Math.floor(x0);
  let y = Math.floor(y0);
  const endX = Math.floor(x1);
  const endY = Math.floor(y1);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let err = dx + dy;
  while (true) {
    if (inBounds(x, y, size)) {
      next[idx(x, y, size)] = paint;
    }
    if (x === endX && y === endY) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return next;
}

export function floodFill(
  pixels: string[],
  size: Size,
  x: number,
  y: number,
  color: string,
): string[] {
  if (!inBounds(x, y, size)) {
    return pixels;
  }
  const paint = hexColor(color);
  const target = pixels[idx(x, y, size)];
  if (target === paint) {
    return pixels;
  }
  const next = clonePixels(pixels);
  const stack: Array<[number, number]> = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop() ?? [0, 0];
    if (!inBounds(cx, cy, size) || next[idx(cx, cy, size)] !== target) {
      continue;
    }
    next[idx(cx, cy, size)] = paint;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

export function boundsFromCorners(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  square = false,
): { x: number; y: number; width: number; height: number } {
  const ax = Math.floor(x0);
  const ay = Math.floor(y0);
  const bx = Math.floor(x1);
  const by = Math.floor(y1);
  let x = Math.min(ax, bx);
  let y = Math.min(ay, by);
  let width = Math.abs(bx - ax) + 1;
  let height = Math.abs(by - ay) + 1;
  if (square) {
    const side = Math.max(1, Math.min(width, height));
    x = bx >= ax ? ax : ax - side + 1;
    y = by >= ay ? ay : ay - side + 1;
    width = side;
    height = side;
  }
  return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
}

export function shapeScalePixels(scale: ShapeScale, size: Size): number {
  const base = Math.max(8, Math.round(Math.min(size.width, size.height) * 0.28));
  switch (scale) {
    case "s":
      return Math.max(4, Math.round(base * 0.72));
    case "m":
      return base;
    case "l":
      return Math.round(base * 1.38);
    default:
      return assertNever(scale, "Unknown scale");
  }
}

function maskRect(width: number, height: number): boolean[] {
  return Array.from({ length: width * height }, () => true);
}

function maskEllipse(width: number, height: number): boolean[] {
  const mask = Array.from({ length: width * height }, () => false);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rx = Math.max(0.5, width / 2);
  const ry = Math.max(0.5, height / 2);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const dx = (px - cx) / rx;
      const dy = (py - cy) / ry;
      mask[py * width + px] = dx * dx + dy * dy <= 1;
    }
  }
  return mask;
}

function maskHeart(width: number, height: number): boolean[] {
  const mask = Array.from({ length: width * height }, () => false);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const nx = ((px + 0.5) / width) * 2.4 - 1.2;
      const ny = 1.15 - ((py + 0.5) / height) * 2.35;
      const a = nx * nx + ny * ny - 1;
      mask[py * width + px] = a * a * a - nx * nx * ny * ny * ny <= 0;
    }
  }
  return mask;
}

function pointInPolygon(
  x: number,
  y: number,
  verts: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i, i += 1) {
    const xi = verts[i].x;
    const yi = verts[i].y;
    const xj = verts[j].x;
    const yj = verts[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function maskStar(width: number, height: number): boolean[] {
  const mask = Array.from({ length: width * height }, () => false);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rx = Math.max(0.5, width / 2);
  const ry = Math.max(0.5, height / 2);
  const verts: Array<{ x: number; y: number }> = [];
  const points = 5;
  const inner = 0.4;
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? 1 : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    verts.push({
      x: cx + Math.cos(angle) * rx * r,
      y: cy + Math.sin(angle) * ry * r,
    });
  }
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      mask[py * width + px] = pointInPolygon(px, py, verts);
    }
  }
  return mask;
}

function outlineMask(mask: boolean[], width: number, height: number): boolean[] {
  const next = Array.from({ length: width * height }, () => false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (!mask[i]) {
        continue;
      }
      const edge =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        !mask[i - 1] ||
        !mask[i + 1] ||
        !mask[i - width] ||
        !mask[i + width];
      if (edge) {
        next[i] = true;
      }
    }
  }
  return next;
}

function shapeMask(kind: ShapeKind, width: number, height: number): boolean[] {
  switch (kind) {
    case "rectangle":
    case "square":
      return maskRect(width, height);
    case "circle":
      return maskEllipse(width, height);
    case "heart":
      return maskHeart(width, height);
    case "star":
      return maskStar(width, height);
    default:
      return assertNever(kind, "Unknown shape");
  }
}

export function rasterizeShape(
  kind: ShapeKind,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  filled: boolean,
): PixelStamp {
  const box = boundsFromCorners(x0, y0, x1, y1, kind === "square");
  let mask = shapeMask(kind, box.width, box.height);
  if (!filled) {
    mask = outlineMask(mask, box.width, box.height);
  }
  const paint = hexColor(color);
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    pixels: mask.map((on) => (on ? paint : TRANSPARENT)),
  };
}

export function blitStamp(
  pixels: string[],
  size: Size,
  stamp: PixelStamp,
): string[] {
  const next = clonePixels(pixels);
  for (let ly = 0; ly < stamp.height; ly += 1) {
    for (let lx = 0; lx < stamp.width; lx += 1) {
      const color = stamp.pixels[ly * stamp.width + lx];
      if (!isPaintedPixel(color)) {
        continue;
      }
      const x = stamp.x + lx;
      const y = stamp.y + ly;
      if (inBounds(x, y, size)) {
        next[idx(x, y, size)] = hexColor(color);
      }
    }
  }
  return next;
}

export function extractStamp(
  pixels: string[],
  size: Size,
  x: number,
  y: number,
  width: number,
  height: number,
): PixelStamp {
  const next: string[] = [];
  for (let ly = 0; ly < height; ly += 1) {
    for (let lx = 0; lx < width; lx += 1) {
      const px = x + lx;
      const py = y + ly;
      next.push(inBounds(px, py, size) ? (pixels[idx(px, py, size)] ?? EMPTY) : EMPTY);
    }
  }
  return { x, y, width, height, pixels: next };
}

export function sampleUnder(
  pixels: string[],
  size: Size,
  stamp: PixelStamp,
): string[] {
  const under: string[] = [];
  for (let ly = 0; ly < stamp.height; ly += 1) {
    for (let lx = 0; lx < stamp.width; lx += 1) {
      const color = stamp.pixels[ly * stamp.width + lx];
      if (!isPaintedPixel(color)) {
        under.push(TRANSPARENT);
        continue;
      }
      const x = stamp.x + lx;
      const y = stamp.y + ly;
      under.push(inBounds(x, y, size) ? (pixels[idx(x, y, size)] ?? EMPTY) : EMPTY);
    }
  }
  return under;
}

export function restoreUnder(
  pixels: string[],
  size: Size,
  stamp: PixelStamp,
  under: string[],
): string[] {
  const next = clonePixels(pixels);
  for (let ly = 0; ly < stamp.height; ly += 1) {
    for (let lx = 0; lx < stamp.width; lx += 1) {
      const i = ly * stamp.width + lx;
      if (!isPaintedPixel(stamp.pixels[i])) {
        continue;
      }
      const x = stamp.x + lx;
      const y = stamp.y + ly;
      if (inBounds(x, y, size)) {
        next[idx(x, y, size)] = under[i] ?? EMPTY;
      }
    }
  }
  return next;
}

/** Click = native size at anchor; drag = uniform nearest-neighbor scale (aspect locked). */
export function stampPlacementFromDrag(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  nativeWidth: number,
  nativeHeight: number,
): { x: number; y: number; width: number; height: number; scaled: boolean } {
  const ax = Math.floor(x0);
  const ay = Math.floor(y0);
  const bx = Math.floor(x1);
  const by = Math.floor(y1);
  const rawW = Math.abs(bx - ax) + 1;
  const rawH = Math.abs(by - ay) + 1;
  const dragged = rawW > 1 || rawH > 1;

  if (!dragged) {
    return {
      x: ax,
      y: ay,
      width: nativeWidth,
      height: nativeHeight,
      scaled: false,
    };
  }

  const scale = Math.max(rawW / nativeWidth, rawH / nativeHeight);
  const width = Math.max(1, Math.round(nativeWidth * scale));
  const height = Math.max(1, Math.round(nativeHeight * scale));
  const x = bx >= ax ? ax : ax - width + 1;
  const y = by >= ay ? ay : ay - height + 1;

  return { x, y, width, height, scaled: true };
}

/** Build the rendered pixel stamp for a placement (native or nearest-neighbor scaled). */
export function placementStamp(
  placement: Placement,
  asset: Asset,
): PixelStamp {
  const base: PixelStamp = {
    x: placement.x,
    y: placement.y,
    width: asset.width,
    height: asset.height,
    pixels: asset.pixels,
  };
  if (placement.width === asset.width && placement.height === asset.height) {
    return base;
  }
  return {
    ...scaleStamp(base, placement.width, placement.height),
    x: placement.x,
    y: placement.y,
  };
}

/**
 * Composite a page's background buffer with its asset placements, back-to-front.
 * Transparent asset pixels never punch holes in layers below. Returns a fresh
 * buffer; the page's stored `pixels` (background) is left untouched.
 */
export function compositePage(
  base: string[],
  size: Size,
  placements: Placement[] | undefined,
  resolveAsset: (assetId: string) => Asset | undefined,
): string[] {
  if (!placements || placements.length === 0) {
    return base;
  }
  let next = base;
  for (const placement of placements) {
    const asset = resolveAsset(placement.assetId);
    if (!asset) {
      continue;
    }
    next = blitStamp(next, size, placementStamp(placement, asset));
  }
  return next;
}

/** Composite a page's background with its overlay stamps (assets looked up by id). */
export function compositedPagePixels(
  page: Pick<Page, "pixels" | "width" | "height" | "placements">,
  assets: readonly Asset[],
): string[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return compositePage(
    page.pixels,
    { width: page.width, height: page.height },
    page.placements,
    (id) => byId.get(id),
  );
}

/**
 * Top-most placement whose painted (non-transparent) pixel covers x,y.
 * Transparent cells fall through to stamps underneath or the background.
 */
export function hitPlacementAt(
  placements: Placement[] | undefined,
  x: number,
  y: number,
  resolveAsset: (assetId: string) => Asset | undefined,
): Placement | null {
  if (!placements || placements.length === 0) {
    return null;
  }
  for (let index = placements.length - 1; index >= 0; index -= 1) {
    const placement = placements[index]!;
    if (
      x < placement.x ||
      y < placement.y ||
      x >= placement.x + placement.width ||
      y >= placement.y + placement.height
    ) {
      continue;
    }
    const asset = resolveAsset(placement.assetId);
    if (!asset) {
      continue;
    }
    const stamp = placementStamp(placement, asset);
    const lx = x - stamp.x;
    const ly = y - stamp.y;
    if (lx < 0 || ly < 0 || lx >= stamp.width || ly >= stamp.height) {
      continue;
    }
    const color = stamp.pixels[ly * stamp.width + lx] ?? TRANSPARENT;
    if (isPaintedPixel(color)) {
      return placement;
    }
  }
  return null;
}

export function scaleStamp(
  stamp: PixelStamp,
  destWidth: number,
  destHeight: number,
): PixelStamp {
  const width = Math.max(1, Math.round(destWidth));
  const height = Math.max(1, Math.round(destHeight));
  if (width === stamp.width && height === stamp.height) {
    return stamp;
  }
  const pixels: string[] = [];
  for (let ly = 0; ly < height; ly += 1) {
    for (let lx = 0; lx < width; lx += 1) {
      const sx = Math.min(
        stamp.width - 1,
        Math.floor((lx * stamp.width) / width),
      );
      const sy = Math.min(
        stamp.height - 1,
        Math.floor((ly * stamp.height) / height),
      );
      pixels.push(stamp.pixels[sy * stamp.width + sx] ?? TRANSPARENT);
    }
  }
  return { x: stamp.x, y: stamp.y, width, height, pixels };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const n = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const red = n(ar + (br - ar) * t);
  const green = n(ag + (bg - ag) * t);
  const blue = n(ab + (bb - ab) * t);
  return `#${[red, green, blue].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function paintScene(prompt: string, size: Size): string[] {
  const rng = mulberry32(hashString(prompt));
  const text = prompt.toLowerCase();
  const night = /night|black|noir|dark|dusk|moon/.test(text);
  const rain = /rain|storm|wet/.test(text);
  const interior = /int|room|inside|booth|cabin/.test(text);
  const sea = /sea|ocean|lake|water/.test(text);
  const forest = /forest|tree|woods/.test(text);
  const city = /city|street|market|neon|alley/.test(text);
  const two = /two|pair|both|together|lovers|stand/.test(text);
  const close = /close|face|portrait|cu/.test(text);
  const skyTop = night ? "#07070c" : "#4a7ca8";
  const skyBot = night ? "#1a1622" : "#e8b86d";
  const ground = interior ? "#2a1d18" : sea ? "#0d1c28" : "#141218";
  const accent = /cyan|gel|neon/.test(text)
    ? "#4ad4d4"
    : /red|blood|fire/.test(text)
      ? "#c23b3b"
      : "#e8b86d";
  const pixels = emptyPixels(size.width, size.height);
  const { width: pageW, height: pageH } = size;
  const horizon = Math.max(
    2,
    Math.round(pageH * (interior ? 20 / 27 : sea ? 16 / 27 : 18 / 27)),
  );

  for (let y = 0; y < pageH; y += 1) {
    for (let x = 0; x < pageW; x += 1) {
      pixels[idx(x, y, size)] =
        y < horizon
          ? mix(skyTop, skyBot, y / horizon)
          : mix(ground, accent, ((y - horizon) / Math.max(1, pageH - horizon)) * 0.2);
    }
  }

  if (night && !interior) {
    const stars = Math.round(28 * (pageW * pageH) / (48 * 27));
    for (let i = 0; i < stars; i += 1) {
      const x = Math.floor(rng() * pageW);
      const y = Math.floor(rng() * Math.max(1, horizon - 2));
      pixels[idx(x, y, size)] = mix("#ffffff", skyTop, 0.4);
    }
  }

  if (city || interior) {
    const count = city ? Math.max(3, Math.round(pageW / 6)) : 3;
    const step = Math.max(4, Math.round(pageW / count));
    for (let i = 0; i < count; i += 1) {
      const bx = 2 + i * step + Math.floor(rng() * 2);
      const bw = Math.max(2, Math.round((3 + Math.floor(rng() * 3)) * pageW / 48));
      const bh = Math.max(3, Math.round((6 + Math.floor(rng() * 8)) * pageH / 27));
      for (let x = bx; x < bx + bw && x < pageW; x += 1) {
        for (let y = horizon - bh; y < horizon; y += 1) {
          if (y >= 0) {
            pixels[idx(x, y, size)] = "#121018";
          }
        }
      }
      if (night) {
        pixels[
          idx(
            Math.min(pageW - 1, bx + 1),
            Math.max(0, horizon - 3),
            size,
          )
        ] = rng() > 0.5 ? accent : "#e45aa0";
      }
    }
  }

  if (forest) {
    const trees = Math.max(4, Math.round(pageW / 5));
    const trunkH = Math.max(4, Math.round(8 * pageH / 27));
    for (let i = 0; i < trees; i += 1) {
      const tx = 2 + i * Math.max(4, Math.round(pageW / trees));
      for (let y = horizon - trunkH; y < horizon; y += 1) {
        if (inBounds(tx, y, size)) {
          pixels[idx(tx, y, size)] = "#1d2a18";
        }
      }
      for (let dx = -2; dx <= 2; dx += 1) {
        for (let dy = -3; dy <= 0; dy += 1) {
          if (inBounds(tx + dx, horizon - trunkH + dy, size)) {
            pixels[idx(tx + dx, horizon - trunkH + dy, size)] = "#2f4a28";
          }
        }
      }
    }
  }

  const groundY = pageH - 3;
  const left = Math.round((close ? 21 : 18) * pageW / 48);
  const figure = (x: number, color: string) => {
    const h = Math.max(4, Math.round((close ? 10 : 6) * pageH / 27));
    for (let i = 0; i < h; i += 1) {
      if (inBounds(x, groundY - i, size)) {
        pixels[idx(x, groundY - i, size)] = color;
      }
    }
    if (inBounds(x, groundY - h, size)) {
      pixels[idx(x, groundY - h, size)] = mix(color, "#fff4d6", 0.4);
    }
  };
  if (/person|figure|someone|lin|kael|human|stand|walk|two|pair|face/.test(text) || two) {
    figure(left, mix(accent, "#1a120c", 0.3));
    if (two) {
      figure(left + Math.max(3, Math.round(5 * pageW / 48)), mix("#8ec8ff", "#1a120c", 0.4));
    }
  }

  if (rain) {
    const drops = Math.round(40 * (pageW * pageH) / (48 * 27));
    for (let i = 0; i < drops; i += 1) {
      const x = Math.floor(rng() * pageW);
      const y = Math.floor(rng() * Math.max(1, pageH - 2));
      pixels[idx(x, y, size)] = mix(pixels[idx(x, y, size)], "#9fd7ff", 0.55);
    }
  }

  return pixels;
}
