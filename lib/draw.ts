import { EMPTY, emptyPixels, type Size } from "./types";

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
