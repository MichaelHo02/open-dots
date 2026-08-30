import type { PixelFrame } from "./types";

export const FRAME_W = 32;
export const FRAME_H = 18;

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

function hex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
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
  return hex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function setPixel(
  pixels: string[],
  x: number,
  y: number,
  color: string,
): void {
  if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) {
    return;
  }
  pixels[y * FRAME_W + x] = color;
}

function glow(
  pixels: string[],
  x: number,
  y: number,
  color: string,
  radius: number,
): void {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > radius) {
        continue;
      }
      const t = 1 - dist / (radius + 1);
      const idx = (y + dy) * FRAME_W + (x + dx);
      if (idx < 0 || idx >= pixels.length) {
        continue;
      }
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= FRAME_W || nextY >= FRAME_H) {
        continue;
      }
      pixels[idx] = mix(pixels[idx], color, t * 0.7);
    }
  }
  setPixel(pixels, x, y, color);
}

function figure(
  pixels: string[],
  x: number,
  groundY: number,
  color: string,
  closeup: boolean,
): void {
  const height = closeup ? 8 : 5;
  for (let i = 0; i < height; i += 1) {
    setPixel(pixels, x, groundY - i, color);
  }
  setPixel(pixels, x, groundY - height, mix(color, "#fff4d6", 0.35));
  setPixel(pixels, x - 1, groundY - height + 2, color);
  setPixel(pixels, x + 1, groundY - height + 2, color);
}

export function paintPixelFrame(
  prompt: string,
  paletteHint = "#e8b86d",
): PixelFrame {
  const seed = hashString(`${prompt}|${paletteHint}`);
  const rng = mulberry32(seed);
  const text = prompt.toLowerCase();
  const night = /night|black|noir|dark|dusk/.test(text);
  const rain = /rain|storm|wet/.test(text);
  const interior = /int\.|interior|room|office|booth/.test(text);
  const rooftop = /roof|skyline|above/.test(text);
  const market = /market|stall|street|alley/.test(text);
  const closeup = /close|cu\b|face|portrait/.test(text);
  const two = /two|pair|both|double|stand-ins|stand ins/.test(text);
  const neon = /neon|gel|cyan|magenta|sign/.test(text);
  const stand = /stand|mark|slate|equal/.test(text);

  const skyTop = night ? hex(6, 7, 14) : hex(48, 78, 112);
  const skyBot = night ? hex(18, 16, 28) : hex(186, 140, 92);
  const ground = interior
    ? hex(42, 28, 22)
    : night
      ? hex(12, 11, 16)
      : hex(38, 36, 32);
  const accent = neon
    ? rng() > 0.5
      ? "#4ad4d4"
      : "#e45aa0"
    : paletteHint || "#e8b86d";
  const warm = mix(accent, "#ffd9a0", 0.4);
  const figureA = mix(accent, "#1a120c", 0.35);
  const figureB = mix("#8ec8ff", "#1a120c", 0.45);

  const pixels = Array.from({ length: FRAME_W * FRAME_H }, () => skyTop);
  const horizon = rooftop ? 11 : interior ? 13 : 12;

  for (let y = 0; y < FRAME_H; y += 1) {
    for (let x = 0; x < FRAME_W; x += 1) {
      if (y < horizon) {
        const t = y / horizon;
        setPixel(pixels, x, y, mix(skyTop, skyBot, t));
      } else {
        const t = (y - horizon) / (FRAME_H - horizon);
        setPixel(pixels, x, y, mix(ground, mix(ground, accent, 0.12), t));
      }
    }
  }

  if (night && !interior) {
    for (let i = 0; i < 18; i += 1) {
      const x = Math.floor(rng() * FRAME_W);
      const y = Math.floor(rng() * (horizon - 2));
      setPixel(pixels, x, y, mix("#ffffff", skyTop, 0.35));
    }
  }

  if (interior) {
    for (let y = 0; y < horizon; y += 1) {
      for (let x = 0; x < FRAME_W; x += 1) {
        setPixel(pixels, x, y, mix("#2a1d18", "#3d2a22", y / horizon));
      }
    }
    for (let x = 4; x < 12; x += 1) {
      for (let y = 3; y < 9; y += 1) {
        setPixel(pixels, x, y, night ? hex(18, 22, 36) : hex(90, 120, 150));
      }
    }
    glow(pixels, 8, 4, warm, 2);
  } else {
    const buildingCount = market ? 6 : 4;
    for (let i = 0; i < buildingCount; i += 1) {
      const bx = 2 + i * 5 + Math.floor(rng() * 2);
      const bw = 3 + Math.floor(rng() * 2);
      const bh = 4 + Math.floor(rng() * 5);
      for (let x = bx; x < bx + bw; x += 1) {
        for (let y = horizon - bh; y < horizon; y += 1) {
          setPixel(pixels, x, y, mix("#141218", accent, 0.08));
        }
      }
      if (night && rng() > 0.4) {
        glow(
          pixels,
          bx + 1,
          horizon - Math.max(2, bh - 2),
          rng() > 0.5 ? accent : warm,
          1,
        );
      }
    }
  }

  if (market) {
    for (let i = 0; i < 3; i += 1) {
      const sx = 3 + i * 9;
      for (let x = sx; x < sx + 6; x += 1) {
        setPixel(pixels, x, horizon - 1, mix(accent, "#2a1810", 0.5));
      }
      glow(pixels, sx + 2, horizon - 2, warm, 1);
    }
  }

  if (stand) {
    const mx = 16;
    const my = FRAME_H - 3;
    setPixel(pixels, mx, my, "#f3e6c4");
    setPixel(pixels, mx - 1, my, "#f3e6c4");
    setPixel(pixels, mx + 1, my, "#f3e6c4");
    setPixel(pixels, mx, my - 1, "#f3e6c4");
  }

  const groundY = FRAME_H - 3;
  const leftX = closeup ? 14 : 11;
  figure(pixels, leftX, groundY, figureA, closeup);
  if (two || /lin|kael/.test(text)) {
    figure(pixels, leftX + (closeup ? 4 : 5), groundY, figureB, closeup);
  }

  if (rain) {
    for (let i = 0; i < 28; i += 1) {
      const x = Math.floor(rng() * FRAME_W);
      const y = Math.floor(rng() * (FRAME_H - 2));
      setPixel(pixels, x, y, mix(pixels[y * FRAME_W + x], "#9fd7ff", 0.55));
      setPixel(
        pixels,
        x,
        Math.min(FRAME_H - 1, y + 1),
        mix(pixels[Math.min(FRAME_H - 1, y + 1) * FRAME_W + x], "#9fd7ff", 0.25),
      );
    }
  }

  glow(pixels, 27, 4, accent, night ? 3 : 2);

  return {
    width: FRAME_W,
    height: FRAME_H,
    pixels,
    prompt: prompt.slice(0, 240),
  };
}

export function frameToDataUrl(frame: PixelFrame, scale = 8): string {
  if (typeof document === "undefined") {
    return "";
  }
  const canvas = document.createElement("canvas");
  canvas.width = frame.width * scale;
  canvas.height = frame.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      ctx.fillStyle = frame.pixels[y * frame.width + x] ?? "#000000";
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas.toDataURL("image/png");
}
