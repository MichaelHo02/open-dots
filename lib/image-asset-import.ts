export type RgbaPixels = { data: Uint8ClampedArray; width: number; height: number };

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

export function quantizePixels(image: RgbaPixels, palette: string[]) {
  const colors = palette.filter(color => /^#[0-9a-f]{6}$/i.test(color)).map(color => ({ hex: color.toLowerCase(), rgb: rgb(color) }));
  if (!colors.length) throw new Error("The active color profile has no usable colors.");
  const pixels: string[] = [];
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] < 96) { pixels.push(""); continue; }
    const [r, g, b] = [image.data[index], image.data[index + 1], image.data[index + 2]];
    let best = colors[0], distance = Infinity;
    for (const color of colors) {
      const next = (r - color.rgb[0]) ** 2 + (g - color.rgb[1]) ** 2 + (b - color.rgb[2]) ** 2;
      if (next < distance) { best = color; distance = next; }
    }
    pixels.push(best.hex);
  }
  return pixels;
}
