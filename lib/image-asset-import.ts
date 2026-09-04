export type RgbaPixels = { data: Uint8ClampedArray; width: number; height: number };

export function indexedRowsToPixels(rows: unknown, palette: unknown, maxSide = 96) {
  if (!Array.isArray(rows) || !rows.length || rows.length > maxSide || !Array.isArray(palette) || !palette.length) return null;
  const colors = palette.map(color => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null);
  if (colors.some(color => color === null)) return null;
  const parsed = rows.map(row => typeof row === "string" ? row.split(",").map(cell => cell.trim()) : null);
  const width = parsed[0]?.length ?? 0;
  if (!width || width > maxSide || parsed.some(row => !row || row.length !== width)) return null;
  const pixels: string[] = [];
  for (const row of parsed as string[][]) for (const cell of row) {
    if (cell === ".") { pixels.push(""); continue; }
    if (!/^\d+$/.test(cell) || Number(cell) >= colors.length) return null;
    pixels.push(colors[Number(cell)]!);
  }
  return { width, height: parsed.length, pixels };
}

export function opaqueBounds(image: RgbaPixels) {
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    if (image.data[(y * image.width + x) * 4 + 3] < 32) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function fitAssetSize(width: number, height: number, maxSide = 96) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function rgb(hex: string) {
  const value = hex.slice(1);
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

function oklab([r8, g8, b8]: number[]) {
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(r8), g = linear(g8), b = linear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function quantizePixels(image: RgbaPixels, palette: string[]) {
  const colors = palette.filter(color => /^#[0-9a-f]{6}$/i.test(color)).map(color => ({ hex: color.toLowerCase(), lab: oklab(rgb(color)) }));
  if (!colors.length) throw new Error("The active color profile has no usable colors.");
  const pixels: string[] = [];
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] < 96) { pixels.push(""); continue; }
    const sample = oklab([image.data[index], image.data[index + 1], image.data[index + 2]]);
    let best = colors[0], distance = Infinity;
    for (const color of colors) {
      const next = (sample[0] - color.lab[0]) ** 2 + (sample[1] - color.lab[1]) ** 2 + (sample[2] - color.lab[2]) ** 2;
      if (next < distance) { best = color; distance = next; }
    }
    pixels.push(best.hex);
  }
  return pixels;
}
