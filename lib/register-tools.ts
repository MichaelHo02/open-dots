import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  SHAPE_SCALES,
  TEXT_FONTS,
  TEXT_FRAMES,
  TEXT_SIZES,
  clampUnit,
  isEmptyPage,
  normalizeFont,
  normalizeFrame,
  normalizeScale,
  normalizeSize,
  pageSize,
  type FilmApi,
} from "./types";
import {
  asBoolean,
  asHexGrid,
  asInteger,
  asNumber,
  asString,
  asDots,
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

const LEGACY_ASSET_TOOL_ALIASES: Array<[string, string]> = [
  ["list_tiles", "list_assets"],
  ["add_tile", "add_asset"],
  ["stamp_tile", "stamp_asset"],
  ["remove_tile", "remove_asset"],
];

function withLegacyAssetToolAliases(tools: WebMCPTool[]): WebMCPTool[] {
  const aliases = LEGACY_ASSET_TOOL_ALIASES.flatMap(([legacyName, currentName]) => {
    const current = tools.find((tool) => tool.name === currentName);
    if (!current) {
      return [];
    }
    return [
      {
        ...current,
        name: legacyName,
        description: `${current.description} (deprecated — use ${currentName})`,
      },
    ];
  });
  return [...tools, ...aliases];
}

export function buildFilmTools(apiRef: ApiRef): WebMCPTool[] {
  const tools: WebMCPTool[] = [
    {
      name: "get_film",
      description:
        "Read the book: each page’s density, text marks (words, font, size), the asset library (id, name, size — not pixel grids), the Color swatches (palette), optional theme name, and which page is on the canvas. Does not return pixel grids.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => toolResult(summarize(apiRef.current)),
    },
    {
      name: "set_canvas",
      description:
        "Set how many pixels fit on the active page. Width is 48–192; height follows 16:9. Other pages keep their own density. Existing art on this page is cropped or padded.",
      inputSchema: {
        type: "object",
        properties: {
          width: {
            type: "integer",
            description: "Pixels across the canvas, 48–192. Height follows 16:9.",
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
        "Append a new page and select it. Omit draw for a blank canvas. Pass draw as a visual beat to paint pixel art. Pass story to place a line of text on the page (not a shape).",
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
        "Rasterize story words into page pixels at x,y (0–1 or pixel coords). font is inter or geist-mono; size is s, m, or l (1×, 2×, 3× glyph scale). Use place_shape for decorations, not captions.",
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
            description: "inter or geist-mono",
          },
          size: {
            type: "string",
            enum: [...TEXT_SIZES],
            description: "Text size: s, m, or l",
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
            input.size !== undefined ? normalizeSize(input.size) : undefined,
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
      name: "set_text",
      description: "Change the words of a text mark on the active page.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          body: { type: "string" },
        },
        required: ["id", "body"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        const body = asString(input.body);
        if (!id || body === undefined) {
          return toolError("id and body are required");
        }
        const ok = apiRef.current.setText(id, body);
        if (!ok) {
          return toolError("Text mark not found");
        }
        return toolResult({ id, body });
      },
    },
    {
      name: "move_text",
      description: "Move a text mark on the active page. x and y are 0–1 or pixel coordinates.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["id", "x", "y"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        const api = apiRef.current;
        const size = activeSize(api);
        const x = asUnit(input.x, size.width);
        const y = asUnit(input.y, size.height);
        if (!id || x === undefined || y === undefined) {
          return toolError("id, x, and y are required");
        }
        const ok = api.moveText(id, x, y);
        if (!ok) {
          return toolError("Text mark not found");
        }
        return toolResult({ id, x, y });
      },
    },
    {
      name: "remove_text",
      description: "Remove a text mark from the active page.",
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
        const ok = apiRef.current.removeText(id);
        if (!ok) {
          return toolError("Text mark not found");
        }
        return toolResult({ id, removed: true });
      },
    },
    {
      name: "list_assets",
      description:
        "List the film asset library. Returns id, name, and size — not pixel grids.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => toolResult({ assets: assetSummary(apiRef.current) }),
    },
    {
      name: "add_asset",
      description:
        "Save a reusable pixel asset. Pass pixels plus width and height, or copy a rectangle from a page (x, y, width, height, optional pageIndex).",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Label shown in the Assets list" },
          width: { type: "integer" },
          height: { type: "integer" },
          pixels: {
            type: "array",
            items: { type: "string" },
            description: "Row-major #rrggbb colors; empty string is transparent",
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
        const asset = apiRef.current.addAsset({
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
            "Need a labeled asset: pixels+width+height, or a page rect (x,y,width,height)",
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
        "Stamp a saved asset onto the active page at pixel x, y. Optional scale (1 = native size) or width/height for nearest-neighbor resize.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
          scale: { type: "number", description: "Uniform scale; 1 is native size" },
          width: { type: "integer", description: "Destination width in pixels" },
          height: { type: "integer", description: "Destination height in pixels" },
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
      name: "set_pixel",
      description:
        "Paint one pixel on the active page. Origin is top-left. Color is #rrggbb. Call get_film for the current grid size.",
      inputSchema: {
        type: "object",
        properties: {
          x: { type: "integer" },
          y: { type: "integer" },
          color: { type: "string", description: "#rrggbb" },
        },
        required: ["x", "y", "color"],
      },
      execute: async (input) => {
        const x = asInteger(input.x);
        const y = asInteger(input.y);
        const color = asString(input.color);
        if (x === undefined || y === undefined || !color) {
          return toolError("x, y, and color are required");
        }
        apiRef.current.drawPixels([{ x, y, color }]);
        return toolResult({ x, y, color });
      },
    },
    {
      name: "draw_pixels",
      description: "Paint many pixels at once on the active page. Prefer this over repeated set_pixel calls.",
      inputSchema: {
        type: "object",
        properties: {
          pixels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                x: { type: "integer" },
                y: { type: "integer" },
                color: { type: "string" },
              },
              required: ["x", "y", "color"],
            },
          },
        },
        required: ["pixels"],
      },
      execute: async (input) => {
        const dots = asDots(input.pixels);
        if (!dots) {
          return toolError("pixels must be an array of {x,y,color}");
        }
        const painted = apiRef.current.drawPixels(dots.slice(0, 2000));
        return toolResult({ painted });
      },
    },
    {
      name: "fill_rect",
      description: "Fill a rectangle on the active page.",
      inputSchema: {
        type: "object",
        properties: {
          x: { type: "integer" },
          y: { type: "integer" },
          width: { type: "integer" },
          height: { type: "integer" },
          color: { type: "string" },
        },
        required: ["x", "y", "width", "height", "color"],
      },
      execute: async (input) => {
        const x = asInteger(input.x);
        const y = asInteger(input.y);
        const width = asInteger(input.width);
        const height = asInteger(input.height);
        const color = asString(input.color);
        if (
          x === undefined ||
          y === undefined ||
          width === undefined ||
          height === undefined ||
          !color
        ) {
          return toolError("x, y, width, height, and color are required");
        }
        apiRef.current.rect(x, y, width, height, color);
        return toolResult({ x, y, width, height, color });
      },
    },
    {
      name: "draw_line",
      description: "Draw a 1-pixel line on the active page.",
      inputSchema: {
        type: "object",
        properties: {
          x0: { type: "integer" },
          y0: { type: "integer" },
          x1: { type: "integer" },
          y1: { type: "integer" },
          color: { type: "string" },
        },
        required: ["x0", "y0", "x1", "y1", "color"],
      },
      execute: async (input) => {
        const x0 = asInteger(input.x0);
        const y0 = asInteger(input.y0);
        const x1 = asInteger(input.x1);
        const y1 = asInteger(input.y1);
        const color = asString(input.color);
        if (
          x0 === undefined ||
          y0 === undefined ||
          x1 === undefined ||
          y1 === undefined ||
          !color
        ) {
          return toolError("x0, y0, x1, y1, and color are required");
        }
        apiRef.current.line(x0, y0, x1, y1, color);
        return toolResult({ x0, y0, x1, y1, color });
      },
    },
    {
      name: "flood_fill",
      description: "Flood-fill from a pixel on the active page.",
      inputSchema: {
        type: "object",
        properties: {
          x: { type: "integer" },
          y: { type: "integer" },
          color: { type: "string" },
        },
        required: ["x", "y", "color"],
      },
      execute: async (input) => {
        const x = asInteger(input.x);
        const y = asInteger(input.y);
        const color = asString(input.color);
        if (x === undefined || y === undefined || !color) {
          return toolError("x, y, and color are required");
        }
        apiRef.current.fill(x, y, color);
        return toolResult({ x, y, color });
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
    {
      name: "draw_scene",
      description:
        "Paint pixel art onto the active page from a visual description. Use this to turn a story beat into a slide. Keywords: night, rain, city, forest, sea, two figures, closeup, neon.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "What should appear on this slide",
          },
        },
        required: ["prompt"],
      },
      execute: async (input) => {
        const prompt = asString(input.prompt)?.trim();
        if (!prompt) {
          return toolError("prompt is required");
        }
        apiRef.current.drawScene(prompt);
        return toolResult({
          prompt,
          size: activeSize(apiRef.current),
        });
      },
    },
  ];
  return withLegacyAssetToolAliases(tools);
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
