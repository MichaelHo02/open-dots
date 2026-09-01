import {
  DEFAULT_ASSET_HEIGHT,
  DEFAULT_ASSET_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  MAX_ASSET_SIDE,
  MAX_WIDTH,
  MIN_WIDTH,
  MAX_ASSETS,
  MAX_DRAW_PIXELS,
  SHAPE_SCALES,
  TEXT_FONTS,
  TEXT_FRAMES,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  clampUnit,
  isEmptyPage,
  normalizeFont,
  normalizeFrame,
  normalizeScale,
  normalizeTextSize,
  pageSize,
  type FilmApi,
} from "./types";
import {
  asBoolean,
  asHexGrid,
  asInteger,
  asNumber,
  asPixelRows,
  asString,
  asDots,
  emptyPixelGrid,
  pixelsToRows,
  solidPixelGrid,
  toolError,
  toolResult,
} from "./tool-result";
import { ensureWebMCPPolyfill, type WebMCPTool } from "./webmcp-polyfill";
import { shapeScalePixels } from "./draw";

type ApiRef = { current: FilmApi };

function asUnit(value: unknown, span: number): number | undefined {
  const n = asNumber(value);
  if (n === undefined) {
    return undefined;
  }
  if (n > 1) {
    return clampUnit(n / Math.max(1, span));
  }
  return clampUnit(n);
}

function activeSize(api: FilmApi) {
  const page = api.active;
  if (!page) {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
  return pageSize(page);
}

function asPixel(value: unknown, span: number): number | undefined {
  const n = asNumber(value);
  if (n === undefined) {
    return undefined;
  }
  if (n > 1) {
    return Math.round(n);
  }
  return Math.round(clampUnit(n) * Math.max(1, span));
}

function assetSummary(api: FilmApi) {
  return api.film.assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    width: asset.width,
    height: asset.height,
  }));
}

const ASSET_WORKFLOW =
  `Lego-style workflow for complex scenes: decompose a reference into small reusable assets (floor tile, furniture, character sprites ≤${MAX_ASSET_SIDE}×${MAX_ASSET_SIDE}), add_asset each one, then stamp_assets to compose the page. Do not paint entire pages pixel-by-pixel — a 128×72 canvas has 9,216 cells; draw_pixels caps at ${MAX_DRAW_PIXELS} per call.`;

const QUALITY_ASSET_WORKFLOW =
  `High-quality sprite workflow: (1) set_palette for a cohesive theme; (2) add_asset with template \"empty\" at 8×8–48×48 (32×32 is a good default); (3) draw_asset_pixels in regional chunks — a full 32×32 = 1,024 pixels, well under the ${MAX_DRAW_PIXELS} cap; (4) get_asset to preview rows and fix mistakes; (5) clear_rect on the asset to erase a region before redraw; (6) duplicate_asset for color variants; (7) stamp_assets back-to-front (floor → furniture → characters). Never one-shot a complex sprite in add_asset — iterate with draw_asset_pixels.`;

function applyPixelOffset(
  dots: Array<{ x: number; y: number; color: string }>,
  offsetX: number,
  offsetY: number,
): Array<{ x: number; y: number; color: string }> {
  if (offsetX === 0 && offsetY === 0) {
    return dots;
  }
  return dots.map((dot) => ({
    ...dot,
    x: dot.x + offsetX,
    y: dot.y + offsetY,
  }));
}

function drawPixelsLimitError(count: number) {
  const cells = DEFAULT_WIDTH * DEFAULT_HEIGHT;
  return `At most ${MAX_DRAW_PIXELS} pixels per draw_pixels call (got ${count}). For sprites or scenes, use add_asset with pixels or rows (each side ≤${MAX_ASSET_SIDE}) then stamp_assets. A default ${DEFAULT_WIDTH}×${DEFAULT_HEIGHT} page has ${cells.toLocaleString()} cells — page-wide painting is intentionally impractical.`;
}

type StampInput = {
  id: string;
  x: number;
  y: number;
  scale?: number;
  width?: number;
  height?: number;
};

function parseStampList(
  value: unknown,
): StampInput[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const stamps: StampInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return undefined;
    }
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const x = asInteger(row.x);
    const y = asInteger(row.y);
    if (!id || x === undefined || y === undefined) {
      return undefined;
    }
    stamps.push({
      id,
      x,
      y,
      scale: asNumber(row.scale),
      width: asInteger(row.width),
      height: asInteger(row.height),
    });
  }
  return stamps;
}

function resolveAssetPixels(input: Record<string, unknown>): {
  width: number;
  height: number;
  pixels: string[];
} | null {
  const width = asInteger(input.width);
  const height = asInteger(input.height);
  const template = asString(input.template);
  const fill = asString(input.fill);

  if (template === "empty") {
    if (width === undefined || height === undefined) {
      return null;
    }
    if (width < 1 || height < 1 || width > MAX_ASSET_SIDE || height > MAX_ASSET_SIDE) {
      return null;
    }
    return { width, height, pixels: emptyPixelGrid(width, height) };
  }

  if (fill) {
    if (width === undefined || height === undefined) {
      return null;
    }
    if (width < 1 || height < 1 || width > MAX_ASSET_SIDE || height > MAX_ASSET_SIDE) {
      return null;
    }
    return { width, height, pixels: solidPixelGrid(width, height, fill) };
  }

  if (width !== undefined && height !== undefined && input.rows !== undefined) {
    const pixels = asPixelRows(input.rows, width, height);
    if (!pixels) {
      return null;
    }
    return { width, height, pixels };
  }

  const flat = asHexGrid(input.pixels);
  if (flat && width !== undefined && height !== undefined) {
    if (flat.length !== width * height) {
      return null;
    }
    if (width < 1 || height < 1 || width > MAX_ASSET_SIDE || height > MAX_ASSET_SIDE) {
      return null;
    }
    return { width, height, pixels: flat };
  }

  return null;
}

function summarize(api: FilmApi) {
  const { film } = api;
  return {
    size: activeSize(api),
    brief: film.brief,
    palette: film.palette,
    paletteName: film.paletteName ?? null,
    color: api.color,
    activeIndex: film.activeIndex,
    pageCount: film.pages.length,
    assets: assetSummary(api),
    pages: film.pages.map((page, index) => ({
      index,
      id: page.id,
      size: pageSize(page),
      texts: page.texts.map((mark) => ({
        id: mark.id,
        x: mark.x,
        y: mark.y,
        body: mark.body,
        color: mark.color,
        font: mark.font,
        size: mark.size,
      })),
      empty: isEmptyPage(page),
      active: index === film.activeIndex,
    })),
  };
}

export function buildFilmTools(apiRef: ApiRef): WebMCPTool[] {
  const tools: WebMCPTool[] = [
    {
      name: "get_film",
      description:
        `Read the book: each page’s density, text marks, asset library (id, name, size — not pixel grids), Color swatches, and active page. ${ASSET_WORKFLOW} ${QUALITY_ASSET_WORKFLOW}`,
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => toolResult(summarize(apiRef.current)),
    },
    {
      name: "set_canvas",
      description:
        `Set how many pixels fit on the active page. Width is ${MIN_WIDTH}–${MAX_WIDTH}; height follows 16:9. Other pages keep their own density. Existing art on this page is cropped or padded.`,
      inputSchema: {
        type: "object",
        properties: {
          width: {
            type: "integer",
            description: `Pixels across the canvas, ${MIN_WIDTH}–${MAX_WIDTH}. Height follows 16:9.`,
          },
        },
        required: ["width"],
      },
      execute: async (input) => {
        const width = asInteger(input.width);
        if (width === undefined) {
          return toolError("width is required");
        }
        apiRef.current.setDensity(width);
        return toolResult(summarize(apiRef.current));
      },
    },
    {
      name: "set_brief",
      description:
        "Optional. Store a short note for the book. Story text belongs on the page — use place_text for words and place_shape to stamp a pixel decoration, not a caption under the art.",
      inputSchema: {
        type: "object",
        properties: {
          brief: {
            type: "string",
            description: "The story or sequence the film should tell",
          },
        },
        required: ["brief"],
      },
      execute: async (input) => {
        const brief = asString(input.brief);
        if (brief === undefined) {
          return toolError("brief is required");
        }
        apiRef.current.setBrief(brief);
        return toolResult({ brief });
      },
    },
    {
      name: "set_palette",
      description:
        "Replace the Color sidebar swatches so the human can reuse a theme instead of picking hex by hex. When the user describes a mood or story (ocean at night, birthday, bedtime), choose 6–10 harmonious #rrggbb colors from DESIGN.md-friendly brights (lime #dceeb1, lilac #c5b0f4, cream #f4ecd6, pink #efd4d4, mint #c8e6cd, coral #f3c9b6, navy #1f1d3d, magenta #ff3d8b) plus ink #000000 and paper #ffffff, then call this. Do not invent a story form on the page. Clamps to 4–16 valid hexes. If the current draw color is not in the new list, it snaps to the first swatch.",
      inputSchema: {
        type: "object",
        properties: {
          colors: {
            type: "array",
            items: { type: "string", description: "#rrggbb" },
            minItems: 4,
            maxItems: 16,
            description: "4–16 #rrggbb swatches that replace the Color row",
          },
          name: {
            type: "string",
            description:
              "Optional short theme label shown in the inspector, e.g. Bedtime",
          },
        },
        required: ["colors"],
      },
      execute: async (input) => {
        const colors = Array.isArray(input.colors)
          ? input.colors.filter((item): item is string => typeof item === "string")
          : undefined;
        if (!colors) {
          return toolError("colors must be an array of #rrggbb strings");
        }
        const name = asString(input.name);
        const ok = apiRef.current.setPalette(colors, name);
        if (!ok) {
          return toolError("Need 4–16 valid #rrggbb colors");
        }
        const { film } = apiRef.current;
        return toolResult({
          palette: film.palette,
          paletteName: film.paletteName ?? null,
          color: apiRef.current.color,
        });
      },
    },
    {
      name: "add_swatch",
      description:
        "Add one #rrggbb color to the current Color swatches (max 16). Prefer set_palette to design a whole mood/theme.",
      inputSchema: {
        type: "object",
        properties: {
          color: { type: "string", description: "#rrggbb" },
        },
        required: ["color"],
      },
      execute: async (input) => {
        const color = asString(input.color);
        if (!color) {
          return toolError("color is required");
        }
        const ok = apiRef.current.addSwatch(color);
        if (!ok) {
          return toolError(
            "Need a valid #rrggbb color, and the palette can hold at most 16 swatches",
          );
        }
        return toolResult({
          palette: apiRef.current.film.palette,
          color: apiRef.current.color,
        });
      },
    },
    {
      name: "reset_palette",
      description:
        "Reset the Color swatches to the default Open Dots palette (ink, paper, and DESIGN.md brights) and clear any theme name.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        apiRef.current.resetPalette();
        const { film } = apiRef.current;
        return toolResult({
          palette: film.palette,
          paletteName: film.paletteName ?? null,
          color: apiRef.current.color,
        });
      },
    },
    {
      name: "add_page",
      description:
        `Append a new page and select it. For complex art, compose with add_asset + stamp_assets. Optional story places a line of text via place_text. Optional draw runs a simple procedural slide (night, rain, city) — not for dense reference art.`,
      inputSchema: {
        type: "object",
        properties: {
          story: {
            type: "string",
            description: "Optional story line placed on the page",
          },
          draw: {
            type: "string",
            description: "If set, paint this scene onto the new page",
          },
        },
      },
      execute: async (input) => {
        const page = apiRef.current.addPage({
          story: asString(input.story) ?? asString(input.caption),
          draw: asString(input.draw),
        });
        return toolResult({
          id: page.id,
          index: apiRef.current.film.activeIndex,
          texts: page.texts,
          empty: isEmptyPage(page),
        });
      },
    },
    {
      name: "select_page",
      description: "Put a page on the canvas by 0-based index.",
      inputSchema: {
        type: "object",
        properties: {
          index: { type: "integer", description: "Page index" },
        },
        required: ["index"],
      },
      execute: async (input) => {
        const index = asInteger(input.index);
        if (index === undefined) {
          return toolError("index is required");
        }
        const ok = apiRef.current.selectPage(index);
        if (!ok) {
          return toolError("Page index out of range");
        }
        return toolResult({ index });
      },
    },
    {
      name: "remove_page",
      description: "Delete a page by index. The film must keep at least one page.",
      inputSchema: {
        type: "object",
        properties: { index: { type: "integer" } },
        required: ["index"],
      },
      execute: async (input) => {
        const index = asInteger(input.index);
        if (index === undefined) {
          return toolError("index is required");
        }
        const ok = apiRef.current.removePage(index);
        if (!ok) {
          return toolError("Cannot remove the last page or an invalid index");
        }
        return toolResult(summarize(apiRef.current));
      },
    },
    {
      name: "place_text",
      description:
        "Rasterize story words into page pixels at x,y (0–1 or pixel coords). font defaults to inter; size is glyph scale 1–8 (default 2). Use place_shape for decorations, not captions.",
      inputSchema: {
        type: "object",
        properties: {
          body: { type: "string", description: "The words on the page" },
          x: { type: "number", description: "Horizontal position, 0–1 or pixels" },
          y: { type: "number", description: "Vertical position, 0–1 or pixels" },
          color: { type: "string", description: "#rrggbb" },
          font: {
            type: "string",
            enum: [...TEXT_FONTS],
            description: "inter (default) or geist-mono",
          },
          size: {
            type: "integer",
            minimum: MIN_TEXT_SIZE,
            maximum: MAX_TEXT_SIZE,
            description: "Glyph scale 1–8 (legacy s/m/l also accepted)",
          },
        },
        required: ["body"],
      },
      execute: async (input) => {
        const body = asString(input.body);
        if (body === undefined) {
          return toolError("body is required");
        }
        const api = apiRef.current;
        const size = activeSize(api);
        const mark = api.addText({
          x: asUnit(input.x, size.width) ?? 0.08,
          y: asUnit(input.y, size.height) ?? 0.78,
          body,
          color: asString(input.color),
          font:
            input.font !== undefined ? normalizeFont(input.font) : undefined,
          size:
            input.size !== undefined ? normalizeTextSize(input.size) : undefined,
        });
        if (!mark) {
          return toolError("No active page");
        }
        return toolResult(mark);
      },
    },
    {
      name: "place_shape",
      description:
        "Rasterize a pixel shape onto the active page: circle, rectangle, square, heart, or star. Uses the current Color and Fill unless overridden. x, y, width, and height are pixels (or 0–1 for x/y). Square stays 1:1. These become pixels, not overlays.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [...TEXT_FRAMES],
            description: "circle, rectangle, square, heart, or star",
          },
          x: { type: "number", description: "Left edge, 0–1 or pixels" },
          y: { type: "number", description: "Top edge, 0–1 or pixels" },
          width: { type: "integer", description: "Width in pixels" },
          height: { type: "integer", description: "Height in pixels" },
          color: { type: "string", description: "#rrggbb" },
          scale: {
            type: "string",
            enum: [...SHAPE_SCALES],
            description: "Fallback size if width/height omitted: s, m, or l",
          },
          filled: {
            type: "boolean",
            description: "true for a solid fill, false for a stroke outline",
          },
        },
      },
      execute: async (input) => {
        const api = apiRef.current;
        const size = activeSize(api);
        const scale = normalizeScale(input.scale);
        const fallback = shapeScalePixels(scale, size);
        const width = asInteger(input.width) ?? fallback;
        const height =
          asInteger(input.height) ??
          (normalizeFrame(input.kind) === "rectangle"
            ? Math.max(2, Math.round(fallback * 1.6))
            : fallback);
        const x0 = asPixel(input.x, size.width) ?? Math.round(size.width * 0.5 - width / 2);
        const y0 = asPixel(input.y, size.height) ?? Math.round(size.height * 0.4 - height / 2);
        const stamp = api.stampShape({
          x0,
          y0,
          x1: x0 + Math.max(1, width) - 1,
          y1: y0 + Math.max(1, height) - 1,
          color: asString(input.color),
          kind:
            input.kind !== undefined ? normalizeFrame(input.kind) : undefined,
          filled: asBoolean(input.filled),
          keepFloating: false,
        });
        if (!stamp) {
          return toolError("No active page");
        }
        return toolResult({
          kind: input.kind !== undefined ? normalizeFrame(input.kind) : api.frame,
          x: stamp.x,
          y: stamp.y,
          width: stamp.width,
          height: stamp.height,
        });
      },
    },
    {
      name: "list_assets",
      description:
        `List the film asset library (max ${MAX_ASSETS} assets, each side ≤${MAX_ASSET_SIDE}px). Returns id, name, and size — not pixel grids. Use get_asset to read pixels for inspection. After add_asset, call list_assets for ids before stamp_assets. ${QUALITY_ASSET_WORKFLOW}`,
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => toolResult({ assets: assetSummary(apiRef.current) }),
    },
    {
      name: "get_asset",
      description:
        `Read one asset’s full pixel buffer for inspection and iterative fixes. Returns id, name, width, height, rows (comma-separated #rrggbb per row; \"\" = transparent), and pixels (row-major flat array). Use after draw_asset_pixels to verify shading and outlines before stamp_assets. ${QUALITY_ASSET_WORKFLOW}`,
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Asset id from add_asset or list_assets" },
        },
        required: ["id"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        if (!id) {
          return toolError("id is required");
        }
        const asset = apiRef.current.getAsset(id);
        if (!asset) {
          return toolError(`Asset not found: ${id}`);
        }
        return toolResult({
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
          rows: pixelsToRows(asset.pixels, asset.width, asset.height),
          pixels: asset.pixels,
        });
      },
    },
    {
      name: "draw_asset_pixels",
      description:
        `Paint up to ${MAX_DRAW_PIXELS} pixels into an existing asset buffer (regional edits). Each {x,y,color} is relative to the asset top-left (0,0). Optional offsetX/offsetY shift all coords — tile a 16×16 motif at (16,0) with offsetX:16. A full 64×64 asset = 4,096 pixels (fits in one call). Empty string color erases to transparent. Workflow: add_asset template empty → draw_asset_pixels in chunks → get_asset to verify → stamp_assets. ${QUALITY_ASSET_WORKFLOW}`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Asset id to paint into" },
          pixels: {
            type: "array",
            maxItems: MAX_DRAW_PIXELS,
            items: {
              type: "object",
              properties: {
                x: { type: "integer", description: "Column within asset (0 = left)" },
                y: { type: "integer", description: "Row within asset (0 = top)" },
                color: {
                  type: "string",
                  description: "#rrggbb or \"\" to erase",
                },
              },
              required: ["x", "y", "color"],
            },
          },
          offsetX: {
            type: "integer",
            description: "Added to every x (default 0) — use to tile regions",
          },
          offsetY: {
            type: "integer",
            description: "Added to every y (default 0)",
          },
        },
        required: ["id", "pixels"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        if (!id) {
          return toolError("id is required");
        }
        const dots = asDots(input.pixels);
        if (!dots?.length) {
          return toolError("pixels must be a non-empty array of {x,y,color}");
        }
        if (dots.length > MAX_DRAW_PIXELS) {
          return toolError(drawPixelsLimitError(dots.length));
        }
        const asset = apiRef.current.getAsset(id);
        if (!asset) {
          return toolError(`Asset not found: ${id}`);
        }
        const offsetX = asInteger(input.offsetX) ?? 0;
        const offsetY = asInteger(input.offsetY) ?? 0;
        const adjusted = applyPixelOffset(dots, offsetX, offsetY);
        const painted = apiRef.current.drawAssetPixels(id, adjusted);
        return toolResult({
          id,
          painted,
          width: asset.width,
          height: asset.height,
        });
      },
    },
    {
      name: "duplicate_asset",
      description:
        `Fork an existing asset for variants (e.g. alternate outfit, mirrored pose). Optional name; defaults to \"<original> copy\". Returns new id, name, width, height. Refine the copy with draw_asset_pixels. Library max ${MAX_ASSETS} assets.`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Source asset id" },
          name: {
            type: "string",
            description: "Label for the copy; defaults to \"<original> copy\"",
          },
        },
        required: ["id"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        if (!id) {
          return toolError("id is required");
        }
        const asset = apiRef.current.duplicateAsset(
          id,
          asString(input.name),
        );
        if (!asset) {
          return toolError(
            `Cannot duplicate: asset not found, library full (max ${MAX_ASSETS}), or invalid name`,
          );
        }
        return toolResult({
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
          sourceId: id,
        });
      },
    },
    {
      name: "add_asset",
      description:
        `Save a reusable pixel sprite to the film library (≤${MAX_ASSET_SIDE}×${MAX_ASSET_SIDE}px). For quality art, start with template \"empty\" + width + height (e.g. 32×32), then refine with draw_asset_pixels in chunks — do not try to one-shot complex sprites here. Options: (1) template \"empty\" + width + height — blank transparent canvas (preferred start); (2) draw_asset_pixels after empty create — iterate regions; (3) pixels (row-major #rrggbb flat array, \"\" transparent) + width + height for simple fills; (4) rows (comma-separated #rrggbb per row) + width + height; (5) fill (#rrggbb) + width + height for a solid block; (6) copy a page rect with x, y, width, height (optional pageIndex). Default blank size is ${DEFAULT_ASSET_WIDTH}×${DEFAULT_ASSET_HEIGHT}. Call get_asset to verify before stamping. ${QUALITY_ASSET_WORKFLOW}`,
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Label shown in the Assets list" },
          width: {
            type: "integer",
            description: `Width in pixels, 1–${MAX_ASSET_SIDE}`,
          },
          height: {
            type: "integer",
            description: `Height in pixels, 1–${MAX_ASSET_SIDE}`,
          },
          pixels: {
            type: "array",
            items: { type: "string" },
            description: "Row-major #rrggbb colors; empty string is transparent",
          },
          rows: {
            type: "array",
            items: { type: "string" },
            description:
              "Alternative to pixels: one comma-separated #rrggbb row per line; must match width×height",
          },
          template: {
            type: "string",
            enum: ["empty"],
            description: "With width+height, create a transparent blank asset",
          },
          fill: {
            type: "string",
            description: "With width+height, fill the asset with one #rrggbb color",
          },
          x: { type: "integer", description: "Page rect left, if copying from a page" },
          y: { type: "integer", description: "Page rect top, if copying from a page" },
          pageIndex: {
            type: "integer",
            description: "Page to copy from; defaults to the active page",
          },
        },
        required: ["name"],
      },
      execute: async (input) => {
        const name = asString(input.name);
        if (!name?.trim()) {
          return toolError("name is required");
        }
        const resolved = resolveAssetPixels(input);
        const asset = resolved
          ? apiRef.current.addAsset({
              name,
              width: resolved.width,
              height: resolved.height,
              pixels: resolved.pixels,
            })
          : apiRef.current.addAsset({
              name,
              width: asInteger(input.width),
              height: asInteger(input.height),
              pixels: asHexGrid(input.pixels),
              x: asInteger(input.x),
              y: asInteger(input.y),
              pageIndex: asInteger(input.pageIndex),
            });
        if (!asset) {
          return toolError(
            `Need a valid asset: pixels/rows/fill/template+width+height (each side 1–${MAX_ASSET_SIDE}), or a page rect (x,y,width,height). pixels.length must equal width×height.`,
          );
        }
        return toolResult({
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
        });
      },
    },
    {
      name: "stamp_asset",
      description:
        `Stamp one saved asset onto the active page at pixel x,y (top-left). scale=1 is native 1:1 (recommended for pixel-crisp art); scale 2 doubles both dimensions with nearest-neighbor. Optional width/height override scale. For many placements, prefer stamp_assets. Layer order: stamp background tiles and furniture first, characters last. Verify sprites with get_asset before stamping. ${ASSET_WORKFLOW}`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Asset id from add_asset or list_assets" },
          x: { type: "integer", description: "Left edge in page pixels" },
          y: { type: "integer", description: "Top edge in page pixels" },
          scale: {
            type: "number",
            description: "Uniform scale; 1 is native size, 2 doubles width and height",
          },
          width: { type: "integer", description: "Destination width in pixels (overrides scale)" },
          height: { type: "integer", description: "Destination height in pixels (overrides scale)" },
        },
        required: ["id", "x", "y"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        const x = asInteger(input.x);
        const y = asInteger(input.y);
        if (!id || x === undefined || y === undefined) {
          return toolError("id, x, and y are required");
        }
        const stamp = apiRef.current.stampAsset({
          id,
          x,
          y,
          scale: asNumber(input.scale),
          width: asInteger(input.width),
          height: asInteger(input.height),
          keepFloating: false,
        });
        if (!stamp) {
          return toolError("Asset not found or no active page");
        }
        return toolResult({
          id,
          x: stamp.x,
          y: stamp.y,
          width: stamp.width,
          height: stamp.height,
        });
      },
    },
    {
      name: "stamp_assets",
      description:
        `Stamp many assets onto the active page in one call (max ${MAX_ASSETS} stamps). Each item needs id, x, y; optional scale (default 1 = native 1:1) or width/height per stamp. Order matters — later stamps paint over earlier ones. Compose back-to-front: sky/background → floor tiles → walls/furniture → props → characters. Use get_asset to verify each sprite before stamping. On failure, reports which stamp index failed and why. ${QUALITY_ASSET_WORKFLOW}`,
      inputSchema: {
        type: "object",
        properties: {
          stamps: {
            type: "array",
            maxItems: MAX_ASSETS,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                x: { type: "integer" },
                y: { type: "integer" },
                scale: { type: "number" },
                width: { type: "integer" },
                height: { type: "integer" },
              },
              required: ["id", "x", "y"],
            },
            description: "Stamps applied in array order (back-to-front)",
          },
        },
        required: ["stamps"],
      },
      execute: async (input) => {
        const stamps = parseStampList(input.stamps);
        if (!stamps?.length) {
          return toolError(
            "stamps must be a non-empty array of {id, x, y} with integer x and y",
          );
        }
        if (stamps.length > MAX_ASSETS) {
          return toolError(`At most ${MAX_ASSETS} stamps per call (got ${stamps.length})`);
        }
        const api = apiRef.current;
        if (!api.active) {
          return toolError("No active page — call add_page or select_page first");
        }
        const placed: Array<{
          index: number;
          id: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }> = [];
        for (let index = 0; index < stamps.length; index += 1) {
          const stamp = stamps[index]!;
          if (!api.getAsset(stamp.id)) {
            return toolError(
              `Stamp ${index}: asset not found "${stamp.id}". Call list_assets for valid ids.`,
            );
          }
          const result = api.stampAsset({
            id: stamp.id,
            x: stamp.x,
            y: stamp.y,
            scale: stamp.scale,
            width: stamp.width,
            height: stamp.height,
            keepFloating: false,
          });
          if (!result) {
            return toolError(
              `Stamp ${index}: failed to place "${stamp.id}" at (${stamp.x},${stamp.y}) — asset missing or no active page`,
            );
          }
          placed.push({
            index,
            id: stamp.id,
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height,
          });
        }
        return toolResult({ stamped: placed.length, stamps: placed });
      },
    },
    {
      name: "remove_asset",
      description: "Remove an asset from the film library by id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        if (!id) {
          return toolError("id is required");
        }
        const ok = apiRef.current.removeAsset(id);
        if (!ok) {
          return toolError("Asset not found");
        }
        return toolResult({ id, removed: true });
      },
    },
    {
      name: "draw_pixels",
      description:
        `Paint up to ${MAX_DRAW_PIXELS} pixels on the active page for tiny touch-ups or tiled regional fills. Each {x,y,color} is page coords; optional offsetX/offsetY shift all coords — tile 32×32 chunks across a page (e.g. offsetX:32 for the next column). For sprites and scenes, build assets with add_asset + draw_asset_pixels, then stamp_assets — not page-wide pixel arrays.`,
      inputSchema: {
        type: "object",
        properties: {
          pixels: {
            type: "array",
            maxItems: MAX_DRAW_PIXELS,
            items: {
              type: "object",
              properties: {
                x: { type: "integer", description: "Page column (0 = left)" },
                y: { type: "integer", description: "Page row (0 = top)" },
                color: {
                  type: "string",
                  description: "#rrggbb or \"\" to erase",
                },
              },
              required: ["x", "y", "color"],
            },
          },
          offsetX: {
            type: "integer",
            description: "Added to every x (default 0) — use to tile 32×32 regions",
          },
          offsetY: {
            type: "integer",
            description: "Added to every y (default 0)",
          },
        },
        required: ["pixels"],
      },
      execute: async (input) => {
        const dots = asDots(input.pixels);
        if (!dots?.length) {
          return toolError("pixels must be a non-empty array of {x,y,color}");
        }
        if (dots.length > MAX_DRAW_PIXELS) {
          return toolError(drawPixelsLimitError(dots.length));
        }
        const offsetX = asInteger(input.offsetX) ?? 0;
        const offsetY = asInteger(input.offsetY) ?? 0;
        const adjusted = applyPixelOffset(dots, offsetX, offsetY);
        const painted = apiRef.current.drawPixels(adjusted);
        return toolResult({ painted, offsetX, offsetY });
      },
    },
    {
      name: "clear_rect",
      description:
        `Erase a rectangular region to transparent (page) or transparent (asset). Use before redraw to fix mistakes without recreating the whole buffer. target \"page\" clears on the active page; target \"asset\" requires assetId. Coords are top-left x,y plus width×height in pixels.`,
      inputSchema: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["page", "asset"],
            description: "Whether to clear on the active page or an asset buffer",
          },
          assetId: {
            type: "string",
            description: "Required when target is asset",
          },
          x: { type: "integer", description: "Left edge" },
          y: { type: "integer", description: "Top edge" },
          width: { type: "integer", description: "Region width in pixels" },
          height: { type: "integer", description: "Region height in pixels" },
        },
        required: ["target", "x", "y", "width", "height"],
      },
      execute: async (input) => {
        const target = asString(input.target);
        const x = asInteger(input.x);
        const y = asInteger(input.y);
        const width = asInteger(input.width);
        const height = asInteger(input.height);
        if (!target || (target !== "page" && target !== "asset")) {
          return toolError('target must be "page" or "asset"');
        }
        if (x === undefined || y === undefined || width === undefined || height === undefined) {
          return toolError("x, y, width, and height are required integers");
        }
        if (width < 1 || height < 1) {
          return toolError("width and height must be at least 1");
        }
        const assetId = asString(input.assetId);
        if (target === "asset" && !assetId) {
          return toolError("assetId is required when target is asset");
        }
        const ok = apiRef.current.clearRect({
          target,
          assetId,
          x,
          y,
          width,
          height,
        });
        if (!ok) {
          if (target === "page") {
            return toolError("No active page");
          }
          return toolError(`Asset not found: ${assetId}`);
        }
        return toolResult({ target, assetId: assetId ?? null, x, y, width, height, cleared: true });
      },
    },
    {
      name: "clear_page",
      description: "Erase the active page to a blank white canvas.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        apiRef.current.clearPage();
        return toolResult({ empty: true });
      },
    },
  ];
  return tools;
}

export async function registerFilmTools(
  apiRef: ApiRef,
  signal: AbortSignal,
): Promise<{ native: boolean; count: number }> {
  const context = ensureWebMCPPolyfill();
  const native = !("isPolyfill" in context && context.isPolyfill);
  const tools = buildFilmTools(apiRef);

  for (const tool of tools) {
    if (signal.aborted) {
      break;
    }
    await document.modelContext?.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        execute: async (input: Record<string, unknown>) => tool.execute(input),
      },
      { signal },
    );
  }

  return { native, count: tools.length };
}
