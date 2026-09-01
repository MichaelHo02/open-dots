export function toolResult(data: unknown): {
  content: Array<{ type: "text"; text: string }>;
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
