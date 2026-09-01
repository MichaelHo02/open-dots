import { DEFAULT_HEIGHT, DEFAULT_WIDTH, clampUnit, isEmptyPage, isTextFrame, pageSize, type FilmApi } from "./types";
import {
  asInteger,
  asNumber,
  asString,
  asDots,
  toolError,
  toolResult,
} from "./tool-result";
import { ensureWebMCPPolyfill, type WebMCPTool } from "./webmcp-polyfill";

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

function summarize(api: FilmApi) {
  const { film } = api;
  return {
    size: activeSize(api),
    brief: film.brief,
    activeIndex: film.activeIndex,
    pageCount: film.pages.length,
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
        frame: mark.frame,
      })),
      empty: isEmptyPage(page),
      active: index === film.activeIndex,
    })),
  };
}

export function buildFilmTools(apiRef: ApiRef): WebMCPTool[] {
  return [
    {
      name: "get_film",
      description:
        "Read the book: each page’s density, text marks, and which page is on the canvas. Does not return pixel grids.",
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
        "Optional. Store a short note for the book. Story text belongs on the page — use place_text, not a caption under the art.",
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
      name: "add_page",
      description:
        "Append a new page and select it. Omit draw for a blank canvas. Pass draw as a visual beat to paint pixel art. Pass story to place a line of text on the page.",
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
        "Place story text on the active page inside a bubble. x and y are 0–1 (top-left) or pixel coordinates. frame is speech, thought, shout, caption, or plain.",
      inputSchema: {
        type: "object",
        properties: {
          body: { type: "string", description: "The words in the bubble" },
          x: { type: "number", description: "Horizontal position, 0–1 or pixels" },
          y: { type: "number", description: "Vertical position, 0–1 or pixels" },
          color: { type: "string", description: "#rrggbb" },
          frame: {
            type: "string",
            description: "speech | thought | shout | caption | plain",
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
          frame: isTextFrame(input.frame) ? input.frame : undefined,
        });
        if (!mark) {
          return toolError("No active page");
        }
        return toolResult(mark);
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
