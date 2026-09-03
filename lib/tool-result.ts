export type ToolTextContent = { type: "text"; text: string };
export type ToolImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};
export type ToolContent = ToolTextContent | ToolImageContent;

export function toolResult(data: unknown): {
  content: ToolContent[];
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/** Text summary plus a PNG image block for vision-capable agents. */
export function toolResultWithImage(
  data: unknown,
  image: { data: string; mimeType?: string },
): {
  content: ToolContent[];
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
      {
        type: "image",
        data: image.data,
        mimeType: image.mimeType ?? "image/png",
      },
    ],
  };
}

export function toolError(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  return undefined;
}

export function asDots(
  value: unknown,
): Array<{ x: number; y: number; color: string }> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const dots: Array<{ x: number; y: number; color: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as { x?: unknown; y?: unknown; color?: unknown };
    const x = asInteger(row.x);
    const y = asInteger(row.y);
    const color = asString(row.color);
    if (x === undefined || y === undefined || !color) {
      continue;
    }
    dots.push({ x, y, color });
  }
  return dots;
}

export function asHexGrid(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const pixels: string[] = [];
  for (const item of value) {
    if (item === "") {
      pixels.push("");
      continue;
    }
    if (typeof item !== "string") {
      return undefined;
    }
    pixels.push(item);
  }
  return pixels;
}

/** Row-major pixels from an array of comma-separated #rrggbb rows. */
export function asPixelRows(
  value: unknown,
  width: number,
  height: number,
): string[] | undefined {
  if (!Array.isArray(value) || width < 1 || height < 1) {
    return undefined;
  }
  if (value.length !== height) {
    return undefined;
  }
  const pixels: string[] = [];
  for (const row of value) {
    if (typeof row !== "string") {
      return undefined;
    }
    const cells = row.split(",").map((cell) => cell.trim());
    if (cells.length !== width) {
      return undefined;
    }
    for (const cell of cells) {
      pixels.push(cell === "" ? "" : cell);
    }
  }
  return pixels;
}

export function solidPixelGrid(
  width: number,
  height: number,
  color: string,
): string[] {
  return Array.from({ length: width * height }, () => color);
}

export function emptyPixelGrid(width: number, height: number): string[] {
  return Array.from({ length: width * height }, () => "");
}

/** Row-major pixels as comma-separated #rrggbb rows (empty string = transparent). */
export function pixelsToRows(
  pixels: string[],
  width: number,
  height: number,
): string[] {
  const rows: string[] = [];
  for (let y = 0; y < height; y += 1) {
    const cells: string[] = [];
    for (let x = 0; x < width; x += 1) {
      cells.push(pixels[y * width + x] ?? "");
    }
    rows.push(cells.join(","));
  }
  return rows;
}
