import {
  activePageLayer,
  pageLayers,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  MAX_ASSET_SIDE,
  MAX_WIDTH,
  MIN_WIDTH,
  MAX_ASSETS,
  MAX_DRAW_PIXELS,
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  clampUnit,
  isEmptyPage,
  normalizeTextSize,
  pageSize,
  type FilmApi,
  type Page,
  type Asset,
  type Placement,
  type Size,
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
  toolResultWithImage,
} from "./tool-result";
import {
  buildPixelArtGuide,
  normalizeGuideTopic,
  type PixelArtGuideTopic,
} from "./pixel-art-guide";
import {
  assetRevision,
  buildNextRequired,
  emptyAssetNextRequired,
  assetHasPaintedPixels,
  getAgentChecklist,
  guideNextRequired,
  inferPassHint,
  inferSceneHint,
  markAssetInspected,
  pageSceneHintContext,
  markAssetEdited,
  markGuideLoaded,
  markPageEdited,
  markPageInspected,
  pageRevision,
  recordStampedAssets,
  reviewAsset,
  reviewPage,
  type PassHint,
} from "./agent-session";
import {
  computePixelStats,
  extractPixelRegion,
  pixelsToPngBase64,
} from "./rasterize";
import {
  ensureWebMCPPolyfill,
  withToolAnnotations,
  type WebMCPTool,
} from "./webmcp-polyfill";
import { compositedPagePixels, drawLine, fillRect, floodFill, setPixels } from "./draw";
import { indexedRowsToPixels } from "./image-asset-import";

type ApiRef = { current: FilmApi };

const ASSET_PASSES = ["outline", "fill", "shadow", "highlight", "cleanup"] as const;
type AssetPass = (typeof ASSET_PASSES)[number];

function asAssetPass(value: unknown): AssetPass | undefined {
  return typeof value === "string" && (ASSET_PASSES as readonly string[]).includes(value)
    ? value as AssetPass
    : undefined;
}

async function loadGuideImage(): Promise<string | null> {
  try {
    const response = await fetch("/agent-guides/storybook-rpg-quality-reference.png");
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

/** Stable ref object — execute closures always read the latest editor API. */
const sharedApiRef: ApiRef = { current: null! };

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

function resolvePage(api: FilmApi, pageIndex?: number): Page | null {
  if (pageIndex === undefined) {
    return api.active;
  }
  return api.film.pages[pageIndex] ?? null;
}

function parseImageScale(value: unknown): number {
  const scale = asInteger(value);
  if (scale === undefined) {
    return 1;
  }
  return Math.max(1, Math.min(8, scale));
}

function assetSummary(api: FilmApi) {
  return api.film.assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    width: asset.width,
    height: asset.height,
    frameCount: asset.frames?.length ?? 1,
    frameDuration: asset.frameDuration ?? 400,
  }));
}

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

/** Cap on structural ops per call — each op expands server-side into many pixels. */
const MAX_SHAPE_OPS = 512;

type RectOp = { x: number; y: number; width: number; height: number; color: string };
type LineOp = { x0: number; y0: number; x1: number; y1: number; color: string };
type FillOp = { x: number; y: number; color: string };
type MirrorMode = "left-right" | "top-bottom" | "both";
type RepeatSpec = { columns: number; rows: number; stepX: number; stepY: number };

/** Structural ops shared by asset and page painters — the bulk advantage over per-pixel tools. */
interface BufferOps {
  rects: RectOp[];
  lines: LineOp[];
  fills: FillOp[];
  dots: Array<{ x: number; y: number; color: string }>;
}

function asOpColor(value: unknown): string | undefined {
  // "" is a valid erase color; only reject non-strings.
  return typeof value === "string" ? value : undefined;
}

function parseRectOps(value: unknown, offsetX: number, offsetY: number): RectOp[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ops: RectOp[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const x = asInteger(row.x);
    const y = asInteger(row.y);
    const width = asInteger(row.width);
    const height = asInteger(row.height);
    const color = asOpColor(row.color);
    if (x === undefined || y === undefined || width === undefined || height === undefined || color === undefined) {
      continue;
    }
    if (width < 1 || height < 1) {
      continue;
    }
    ops.push({ x: x + offsetX, y: y + offsetY, width, height, color });
  }
  return ops;
}

function parseLineOps(value: unknown, offsetX: number, offsetY: number): LineOp[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ops: LineOp[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const x0 = asInteger(row.x0);
    const y0 = asInteger(row.y0);
    const x1 = asInteger(row.x1);
    const y1 = asInteger(row.y1);
    const color = asOpColor(row.color);
    if (x0 === undefined || y0 === undefined || x1 === undefined || y1 === undefined || color === undefined) {
      continue;
    }
    ops.push({ x0: x0 + offsetX, y0: y0 + offsetY, x1: x1 + offsetX, y1: y1 + offsetY, color });
  }
  return ops;
}

function parseFillOps(value: unknown, offsetX: number, offsetY: number): FillOp[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ops: FillOp[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const x = asInteger(row.x);
    const y = asInteger(row.y);
    const color = asOpColor(row.color);
    if (x === undefined || y === undefined || color === undefined) {
      continue;
    }
    ops.push({ x: x + offsetX, y: y + offsetY, color });
  }
  return ops;
}

function collectBufferOps(
  input: Record<string, unknown>,
  offsetX: number,
  offsetY: number,
): BufferOps {
  const dots = asDots(input.pixels) ?? [];
  return {
    rects: parseRectOps(input.rects, offsetX, offsetY),
    lines: parseLineOps(input.lines, offsetX, offsetY),
    fills: parseFillOps(input.fills, offsetX, offsetY),
    dots: applyPixelOffset(dots, offsetX, offsetY),
  };
}

function bufferOpCount(ops: BufferOps): number {
  return ops.rects.length + ops.lines.length + ops.fills.length + ops.dots.length;
}

/** Apply ops in a fixed, predictable order: rects → lines → fills → pixels (pixels win for detail). */
function applyBufferOps(base: string[], size: Size, ops: BufferOps): string[] {
  let next = base;
  for (const rect of ops.rects) {
    next = fillRect(next, size, rect.x, rect.y, rect.width, rect.height, rect.color);
  }
  for (const line of ops.lines) {
    next = drawLine(next, size, line.x0, line.y0, line.x1, line.y1, line.color);
  }
  for (const fill of ops.fills) {
    next = floodFill(next, size, fill.x, fill.y, fill.color);
  }
  if (ops.dots.length > 0) {
    next = setPixels(next, size, ops.dots);
  }
  return next;
}

function offsetBufferOps(ops: BufferOps, x: number, y: number): BufferOps {
  return {
    rects: ops.rects.map((op) => ({ ...op, x: op.x + x, y: op.y + y })),
    lines: ops.lines.map((op) => ({
      ...op,
      x0: op.x0 + x,
      y0: op.y0 + y,
      x1: op.x1 + x,
      y1: op.y1 + y,
    })),
    fills: ops.fills.map((op) => ({ ...op, x: op.x + x, y: op.y + y })),
    dots: ops.dots.map((op) => ({ ...op, x: op.x + x, y: op.y + y })),
  };
}

function mergeBufferOps(parts: BufferOps[]): BufferOps {
  return {
    rects: parts.flatMap((part) => part.rects),
    lines: parts.flatMap((part) => part.lines),
    fills: parts.flatMap((part) => part.fills),
    dots: parts.flatMap((part) => part.dots),
  };
}

function repeatBufferOps(ops: BufferOps, repeat?: RepeatSpec): BufferOps {
  if (!repeat) return ops;
  const copies: BufferOps[] = [];
  for (let row = 0; row < repeat.rows; row += 1) {
    for (let column = 0; column < repeat.columns; column += 1) {
      copies.push(offsetBufferOps(ops, column * repeat.stepX, row * repeat.stepY));
    }
  }
  return mergeBufferOps(copies);
}

function mirrorBufferOps(ops: BufferOps, size: Size, mirror?: MirrorMode): BufferOps {
  if (!mirror) return ops;
  const flip = (part: BufferOps, leftRight: boolean, topBottom: boolean): BufferOps => ({
    rects: part.rects.map((op) => ({
      ...op,
      x: leftRight ? size.width - op.x - op.width : op.x,
      y: topBottom ? size.height - op.y - op.height : op.y,
    })),
    lines: part.lines.map((op) => ({
      ...op,
      x0: leftRight ? size.width - 1 - op.x0 : op.x0,
      x1: leftRight ? size.width - 1 - op.x1 : op.x1,
      y0: topBottom ? size.height - 1 - op.y0 : op.y0,
      y1: topBottom ? size.height - 1 - op.y1 : op.y1,
    })),
    fills: part.fills.map((op) => ({
      ...op,
      x: leftRight ? size.width - 1 - op.x : op.x,
      y: topBottom ? size.height - 1 - op.y : op.y,
    })),
    dots: part.dots.map((op) => ({
      ...op,
      x: leftRight ? size.width - 1 - op.x : op.x,
      y: topBottom ? size.height - 1 - op.y : op.y,
    })),
  });
  const copies = [ops];
  if (mirror === "left-right" || mirror === "both") copies.push(flip(ops, true, false));
  if (mirror === "top-bottom" || mirror === "both") copies.push(flip(ops, false, true));
  if (mirror === "both") copies.push(flip(ops, true, true));
  return mergeBufferOps(copies);
}

function parseRepeat(value: unknown): RepeatSpec | string | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") return "repeat must be an object";
  const input = value as Record<string, unknown>;
  const columns = asInteger(input.columns);
  const rows = asInteger(input.rows);
  const stepX = asInteger(input.stepX);
  const stepY = asInteger(input.stepY);
  if (columns === undefined || rows === undefined || stepX === undefined || stepY === undefined) {
    return "repeat requires integer columns, rows, stepX, and stepY";
  }
  if (columns < 1 || columns > 16 || rows < 1 || rows > 16) {
    return "repeat columns and rows must each be between 1 and 16";
  }
  return { columns, rows, stepX, stepY };
}

/** Changed cells between two equal-length buffers, as {x,y,color} dots ("" = erase). */
function diffToDots(
  before: string[],
  after: string[],
  width: number,
): Array<{ x: number; y: number; color: string }> {
  const dots: Array<{ x: number; y: number; color: string }> = [];
  for (let i = 0; i < after.length; i += 1) {
    if (before[i] !== after[i]) {
      dots.push({ x: i % width, y: Math.floor(i / width), color: after[i] ?? "" });
    }
  }
  return dots;
}

/** JSON Schema fragments reused by the two painters for rects/lines/fills. */
const RECT_OPS_SCHEMA = {
  type: "array",
  maxItems: MAX_SHAPE_OPS,
  description:
    "Filled rectangles: each {x,y,width,height,color} paints a solid block. One rect can cover any region; color \"\" erases the block.",
  items: {
    type: "object",
    properties: {
      x: { type: "integer" },
      y: { type: "integer" },
      width: { type: "integer" },
      height: { type: "integer" },
      color: { type: "string", description: "#rrggbb or \"\" to erase" },
    },
    required: ["x", "y", "width", "height", "color"],
  },
} as const;

const LINE_OPS_SCHEMA = {
  type: "array",
  maxItems: MAX_SHAPE_OPS,
  description:
    "Straight lines: each {x0,y0,x1,y1,color} draws an edge or outline. Use for silhouettes, seams, and furniture edges. color \"\" erases.",
  items: {
    type: "object",
    properties: {
      x0: { type: "integer" },
      y0: { type: "integer" },
      x1: { type: "integer" },
      y1: { type: "integer" },
      color: { type: "string", description: "#rrggbb or \"\" to erase" },
    },
    required: ["x0", "y0", "x1", "y1", "color"],
  },
} as const;

const FILL_OPS_SCHEMA = {
  type: "array",
  maxItems: MAX_SHAPE_OPS,
  description:
    "Flood fills: each {x,y,color} bucket-fills the contiguous region touching x,y. Outline first (lines/rects), then flood the enclosed area. color \"\" erases.",
  items: {
    type: "object",
    properties: {
      x: { type: "integer" },
      y: { type: "integer" },
      color: { type: "string", description: "#rrggbb or \"\" to erase" },
    },
    required: ["x", "y", "color"],
  },
} as const;

function drawPixelsLimitError(count: number) {
  const cells = DEFAULT_WIDTH * DEFAULT_HEIGHT;
  return `At most ${MAX_DRAW_PIXELS} pixels per paint_page call (got ${count}). For sprites or scenes, use add_asset with pixels or rows (each side ≤${MAX_ASSET_SIDE}) then stamp_assets. A default ${DEFAULT_WIDTH}×${DEFAULT_HEIGHT} page has ${cells.toLocaleString()} cells — page-wide painting is intentionally impractical.`;
}

type StampInput = {
  id: string;
  placementId?: string;
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
      placementId: asString(row.placementId),
      x,
      y,
      scale: asNumber(row.scale),
      width: asInteger(row.width),
      height: asInteger(row.height),
    });
  }
  return stamps;
}

type TranslateRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
};

function parseTranslateRegion(value: unknown, size: Size): TranslateRegion | string | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") return "translateRegion must be an object";
  const input = value as Record<string, unknown>;
  const x = asInteger(input.x);
  const y = asInteger(input.y);
  const width = asInteger(input.width);
  const height = asInteger(input.height);
  const dx = asInteger(input.dx);
  const dy = asInteger(input.dy);
  if ([x, y, width, height, dx, dy].some((item) => item === undefined)) {
    return "translateRegion requires integer x, y, width, height, dx, and dy";
  }
  const region = { x: x!, y: y!, width: width!, height: height!, dx: dx!, dy: dy! };
  if (region.width < 1 || region.height < 1 || region.width * region.height > MAX_DRAW_PIXELS) {
    return `translateRegion area must be between 1 and ${MAX_DRAW_PIXELS} pixels`;
  }
  if (region.dx === 0 && region.dy === 0) return "translateRegion dx or dy must be non-zero";
  if (Math.abs(region.dx) > 16 || Math.abs(region.dy) > 16) {
    return "translateRegion dx and dy must each be between -16 and 16";
  }
  if (
    region.x < 0 || region.y < 0 ||
    region.x + region.width > size.width || region.y + region.height > size.height ||
    region.x + region.dx < 0 || region.y + region.dy < 0 ||
    region.x + region.dx + region.width > size.width ||
    region.y + region.dy + region.height > size.height
  ) {
    return "translateRegion source and destination must stay inside the asset";
  }
  return region;
}

function translatePaintedRegion(base: string[], size: Size, region?: TranslateRegion): string[] {
  if (!region) return base;
  const next = base.slice();
  const painted: Array<{ x: number; y: number; color: string }> = [];
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const color = base[y * size.width + x] ?? "";
      if (!color) continue;
      painted.push({ x, y, color });
      next[y * size.width + x] = "";
    }
  }
  for (const pixel of painted) {
    next[(pixel.y + region.dy) * size.width + pixel.x + region.dx] = pixel.color;
  }
  return next;
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

  if (input.indexedRows !== undefined || input.bitmapPalette !== undefined) {
    const bitmap = indexedRowsToPixels(input.indexedRows, input.bitmapPalette, MAX_ASSET_SIDE);
    if (!bitmap) return null;
    if ((width !== undefined && width !== bitmap.width) || (height !== undefined && height !== bitmap.height)) return null;
    return bitmap;
  }

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

function editorState(api: FilmApi) {
  return {
    tool: api.tool,
    color: api.color,
    brushSize: api.brushSize,
    frame: api.frame,
    shapeFilled: api.shapeFilled,
    textFont: api.textFont,
    textSize: api.textSize,
    selectedAssetId: api.selectedAssetId,
    selectedPlacementId: api.selectedPlacementId,
    workshopOpen: api.workshopOpen,
    workshopDraft: api.workshopDraft
      ? {
          id: api.workshopDraft.id,
          name: api.workshopDraft.name,
          width: api.workshopDraft.width,
          height: api.workshopDraft.height,
        }
      : null,
  };
}

function assetMutationFeedback(
  asset: Asset,
  summary: Record<string, unknown>,
  options?: { dots?: Array<{ x: number; y: number; color: string }>; pass?: AssetPass },
) {
  markAssetEdited(asset.id);
  const stats = computePixelStats(asset.pixels, asset.width, asset.height);
  const passHint: PassHint = inferPassHint(stats, options?.dots);
  const png = pixelsToPngBase64(asset.pixels, asset.width, asset.height);
  if (!png) {
    return toolError("Could not rasterize asset image (canvas unavailable)");
  }
  return toolResultWithImage(
    {
      ...summary,
      assetId: asset.id,
      revision: assetRevision(asset.id),
      completedPass: options?.pass,
      passHint,
      nextRequired: buildNextRequired(passHint),
    },
    { data: png, mimeType: "image/png" },
  );
}

export type WebmcpPhase = "registering" | "ready";

export type WebmcpStatus = {
  phase: WebmcpPhase;
  ready: boolean;
  native: boolean;
  toolCount: number;
  expectedToolCount: number;
  /** Stable for one editor registration lifetime. */
  generation: number;
};

const WEBMCP_WINDOW_KEY = "__openDotsWebmcp";

type WindowRegistration = {
  apiRef: ApiRef;
  controller: AbortController;
  generation: number;
  native: boolean;
  count: number;
};

function getWindowRegistration(): WindowRegistration | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (
    (window as unknown as Record<string, WindowRegistration | undefined>)[
      WEBMCP_WINDOW_KEY
    ] ?? null
  );
}

function setWindowRegistration(state: WindowRegistration): void {
  if (typeof window === "undefined") {
    return;
  }
  (window as unknown as Record<string, WindowRegistration>)[WEBMCP_WINDOW_KEY] =
    state;
}

function clearWindowRegistration(controller: AbortController): void {
  if (typeof window === "undefined") {
    return;
  }
  const target = window as unknown as Record<string, WindowRegistration | undefined>;
  if (target[WEBMCP_WINDOW_KEY]?.controller === controller) {
    delete target[WEBMCP_WINDOW_KEY];
  }
}

const WEBMCP_REFRESH_HINT =
  "After a page refresh or navigation, re-fetch live WebMCP tools and wait until webmcp.ready is true before mutating. In-flight calls that used a pre-refresh snapshot are invalid. Storybook data (assets, pages) persists in localStorage — call get_storybook to recover asset ids.";

let webmcpStatus: WebmcpStatus = {
  phase: "registering",
  ready: false,
  native: false,
  toolCount: 0,
  expectedToolCount: 0,
  generation: 0,
};

type RegistrationResult = { native: boolean; count: number };
type PendingRegistration = {
  controller: AbortController;
  promise: Promise<RegistrationResult>;
};

let registrationPending: PendingRegistration | null = null;

const winBoot = getWindowRegistration();
if (winBoot?.controller && !winBoot.controller.signal.aborted) {
  webmcpStatus = {
    phase: "ready",
    ready: true,
    native: winBoot.native,
    toolCount: winBoot.count,
    expectedToolCount: winBoot.count,
    generation: winBoot.generation,
  };
}

export function getWebmcpStatus(): WebmcpStatus {
  return { ...webmcpStatus };
}

function summarize(api: FilmApi) {
  const { film } = api;
  const agentChecklist = getAgentChecklist();
  const guideNudge = guideNextRequired();
  const webmcp = getWebmcpStatus();
  const nextRequired = !webmcp.ready
    ? "WebMCP tools are still registering after load. Re-fetch live tools and retry get_storybook until webmcp.ready is true before add_asset or other mutations."
    : guideNudge;
  return {
    size: activeSize(api),
    brief: film.brief,
    palette: film.palette,
    paletteName: film.paletteName ?? null,
    activePaletteId: film.activePaletteId,
    palettes: film.palettes.map((profile) => ({
      id: profile.id,
      name: profile.name,
      swatches: profile.swatches,
      active: profile.id === film.activePaletteId,
    })),
    color: api.color,
    editor: {
      ...editorState(api),
      agentSession: agentChecklist,
    },
    agentChecklist,
    webmcp: {
      ...webmcp,
      hint: WEBMCP_REFRESH_HINT,
      registering: webmcp.phase === "registering",
    },
    ...(nextRequired ? { nextRequired } : {}),
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
      activeLayerId: activePageLayer(page).id,
      layers: pageLayers(page).map(layer => ({ id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked, placementIds: layer.placements.map(item => item.id) })),
      placementCount: pageLayers(page).reduce((count, layer) => count + layer.placements.length, 0),
      placements: pageLayers(page).flatMap(layer => layer.placements.map(placement => ({ ...placement, layerId: layer.id }))).map((placement) => ({
        id: placement.id,
        assetId: placement.assetId,
        layerId: placement.layerId,
        flipX: placement.flipX ?? false,
        flipY: placement.flipY ?? false,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
      })),
      active: index === film.activeIndex,
    })),
  };
}

export function buildFilmTools(): WebMCPTool[] {
  const apiRef = sharedApiRef;
  const tools: WebMCPTool[] = [
    {
      name: "get_pixel_art_guide",
      description:
        "Load the pixel-art playbook and attached top-down storybook-RPG quality reference — call this first each session before drawing. Pass topic storybook-rpg, workflow, shading, composition, or tools; omit for the full playbook.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            enum: ["workflow", "shading", "composition", "storybook-rpg", "tools", "full"],
            description: "Section to return; omit for full playbook",
          },
        },
      },
      execute: async (input) => {
        const topic: PixelArtGuideTopic = normalizeGuideTopic(input.topic);
        markGuideLoaded();
        const guide = buildPixelArtGuide(topic);
        if (topic === "tools") return toolResult(guide);
        const image = await loadGuideImage();
        return image
          ? toolResultWithImage(
              { ...guide, visualReference: "Attached top-down storybook-RPG quality target. Inspect it before drawing." },
              { data: image, mimeType: "image/png" },
            )
          : toolResult({ ...guide, visualReference: "Preview unavailable; continue with the written quality bar." });
      },
    },
    {
      name: "get_storybook",
      description:
        "Read the book: pages with named layers, activeLayerId and overlay placements, reusable named color profiles (palettes + activePaletteId), assets including animation frame count/timing, the active page, and webmcp.ready. After a refresh, re-fetch live tools, wait until webmcp.ready is true, then call this to recover asset ids before mutating. Call get_pixel_art_guide first; use get_asset_image and get_page_image to inspect pixels.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => toolResult(summarize(apiRef.current)),
    },
    {
      name: "set_palette",
      description:
        "Create, update, or select a reusable named color profile. Make profiles for material or asset families (for example Milo, sheep wool, bedroom wood, moonlight); profiles are not bound to assets, so select or reuse whichever profile fits the next asset. Pass any number of #rrggbb swatches — there is no count cap, and Default is never overwritten. Prefer cohesive base, reflected-light, shadow, and highlight ramps over maximizing unique colors. Extra #rrggbb colors can also be used inline in draw ops without adding them to a profile.",
      inputSchema: {
        type: "object",
        properties: {
          colors: {
            type: "array",
            items: { type: "string", description: "#rrggbb" },
            minItems: 1,
            description:
              "Any number of #rrggbb swatches for a named theme profile. Omit to select an existing profile by name.",
          },
          name: {
            type: "string",
            description:
              "Theme label (e.g. Bedtime). Creates or updates that profile. Omit to update the current non-Default theme or create Theme N. Pass name without colors to select.",
          },
        },
      },
      execute: async (input) => {
        const colors = Array.isArray(input.colors)
          ? input.colors.filter((item): item is string => typeof item === "string")
          : undefined;
        const name = asString(input.name);
        if (!colors && !name) {
          return toolError(
            "Provide colors to create/update a named theme, or name to select an existing profile",
          );
        }
        const ok = apiRef.current.setPalette(colors, name);
        if (!ok) {
          return toolError(
            colors
              ? "Need at least one valid #rrggbb color"
              : `No color profile named "${name}"`,
          );
        }
        const { film } = apiRef.current;
        return toolResult({
          palette: film.palette,
          paletteName: film.paletteName ?? null,
          activePaletteId: film.activePaletteId,
          palettes: film.palettes.map((profile) => ({
            id: profile.id,
            name: profile.name,
            swatches: profile.swatches,
            active: profile.id === film.activePaletteId,
          })),
          color: apiRef.current.color,
        });
      },
    },
    {
      name: "add_page",
      description:
        `Append a new landscape page and select it. Optional width sets pixel density (${MIN_WIDTH}–${MAX_WIDTH}; height follows 16:9; default ${DEFAULT_WIDTH}); use 160–224 for rich scenes. Compose complex art with add_asset + stamp_assets rather than painting the whole page. Optional story rasterizes one line of words — do not add a story form or caption box on the page.`,
      inputSchema: {
        type: "object",
        properties: {
          width: {
            type: "integer",
            description: `Optional page density in pixels across, ${MIN_WIDTH}–${MAX_WIDTH}. Height follows 16:9. Default ${DEFAULT_WIDTH}.`,
          },
          story: {
            type: "string",
            description:
              "Optional line of words rasterized onto the page. Do not add a form or caption box.",
          },
        },
      },
      execute: async (input) => {
        const api = apiRef.current;
        const page = api.addPage({
          story: asString(input.story),
        });
        const width = asInteger(input.width);
        if (width !== undefined) {
          api.setDensity(width);
        }
        const active = api.active ?? page;
        markPageEdited(active.id);
        return toolResult({
          id: active.id,
          index: api.film.activeIndex,
          size: pageSize(active),
          texts: active.texts,
          empty: isEmptyPage(active),
        });
      },
    },
    {
      name: "select_page",
      description:
        "Select which page is on the canvas by 0-based index. Use after add_page or when editing a different page. Call get_storybook if you need current indexes.",
      inputSchema: {
        type: "object",
        properties: {
          index: { type: "integer", description: "0-based page index from get_storybook" },
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
      name: "place_text",
      description:
        "Rasterize words into a topmost reusable Story layer at x,y (0–1 fractions or pixel coords), so animated assets cannot cover the text. Uses Inter glyphs at size 1–8 (default 2).",
      inputSchema: {
        type: "object",
        properties: {
          body: { type: "string", description: "The words on the page" },
          x: { type: "number", description: "Horizontal position, 0–1 or pixels" },
          y: { type: "number", description: "Vertical position, 0–1 or pixels" },
          color: { type: "string", description: "#rrggbb" },
          size: {
            type: "integer",
            minimum: MIN_TEXT_SIZE,
            maximum: MAX_TEXT_SIZE,
            description: "Glyph scale 1–8 (default 2)",
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
        const page = api.active;
        if (!page) return toolError("No active page");
        let layers = pageLayers(page);
        let storyLayer = layers.find((layer) => layer.name === "Story");
        if (!storyLayer) {
          const added = api.addLayer();
          if (!added) return toolError("Could not create Story layer");
          storyLayer = added;
          api.updateLayer(added.id, { name: "Story" });
        } else {
          if (storyLayer.locked) return toolError("Story layer is locked");
          api.selectLayer(storyLayer.id);
        }
        layers = pageLayers(api.active!);
        for (let index = layers.findIndex((layer) => layer.id === storyLayer.id); index < layers.length - 1; index += 1) {
          api.moveLayer(storyLayer.id, 1);
        }
        const size = activeSize(api);
        const mark = api.addText({
          x: asUnit(input.x, size.width) ?? 0.08,
          y: asUnit(input.y, size.height) ?? 0.78,
          body,
          color: asString(input.color),
          size:
            input.size !== undefined ? normalizeTextSize(input.size) : undefined,
        });
        if (!mark) {
          return toolError("No active page");
        }
        markPageEdited(page.id);
        return toolResult(mark);
      },
    },
    {
      name: "get_asset_image",
      description:
        "Rasterize one asset animation frame to PNG so you can compare it to a reference. Pass frameIndex to inspect a specific frame and scale 1–8 to enlarge it. Returns frame metadata, stats, the image, and optional comma-separated rows. Call after each draw pass and each animation frame before stamping.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Asset id from add_asset or get_storybook.assets" },
          frameIndex: {
            type: "integer",
            minimum: 0,
            description: "Animation frame to inspect (default 0)",
          },
          scale: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "Nearest-neighbor upscale for inspection (default 1 = native 1:1)",
          },
          includeRows: {
            type: "boolean",
            description: "Include comma-separated rows in text summary (default true)",
          },
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
        const parsedFrameIndex = asInteger(input.frameIndex);
        const frameIndex = parsedFrameIndex ?? 0;
        const frameCount = asset.frames?.length ?? 1;
        if ((input.frameIndex !== undefined && parsedFrameIndex === undefined) || frameIndex < 0 || frameIndex >= frameCount) {
          return toolError(`frameIndex must be between 0 and ${frameCount - 1}`);
        }
        const framePixels = asset.frames?.[frameIndex] ?? asset.pixels;
        const scale = parseImageScale(input.scale);
        const png = pixelsToPngBase64(framePixels, asset.width, asset.height, scale);
        if (!png) {
          return toolError("Could not rasterize asset image (canvas unavailable)");
        }
        const includeRows = input.includeRows === undefined ? true : asBoolean(input.includeRows);
        const revision = markAssetInspected(asset.id);
        const stats = computePixelStats(framePixels, asset.width, asset.height);
        const summary = {
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
          frameIndex,
          frameCount,
          frameDuration: asset.frameDuration ?? 400,
          revision,
          imageScale: scale,
          renderedWidth: asset.width * scale,
          renderedHeight: asset.height * scale,
          stats: {
            paintedCount: stats.paintedCount,
            coverage: stats.coverage,
            bounds: stats.bounds,
            colorCount: stats.colorCount,
          },
          rows:
            includeRows === false
              ? undefined
              : pixelsToRows(framePixels, asset.width, asset.height),
          inspected: true,
          nextRequired:
            "Compare the PNG to the visual reference. Submit review_asset with this revision; revise first if silhouettes, ramps, clusters, or lighting are weak.",
          hint: "Compare the attached PNG at native scale (use scale 4–8 to peep). Text fallback: rows in the response.",
        };
        return toolResultWithImage(summary, { data: png, mimeType: "image/png" });
      },
    },
    {
      name: "review_asset",
      description:
        "Record an actual vision judgment for the latest inspected asset revision. Use revise when silhouettes, material ramps, clustered pixels, or lighting need work; only approved revisions may be stamped.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Asset id from get_asset_image" },
          revision: { type: "integer", minimum: 0, description: "Revision returned by get_asset_image" },
          verdict: { type: "string", enum: ["revise", "approved"] },
          observations: {
            type: "string",
            description: "Concrete visual observations about silhouette, shading ramps, pixel clusters, lighting, and needed fixes",
          },
        },
        required: ["id", "revision", "verdict", "observations"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        const revision = asInteger(input.revision);
        const verdict = asString(input.verdict);
        const observations = asString(input.observations)?.trim();
        if (!id || revision === undefined || (verdict !== "revise" && verdict !== "approved") || !observations) {
          return toolError("id, revision, verdict, and concrete observations are required");
        }
        if (!apiRef.current.getAsset(id)) return toolError(`Asset not found: ${id}`);
        const error = reviewAsset({ assetId: id, revision, verdict, observations });
        if (error) return toolError(error);
        return toolResult({ id, revision, verdict, observations, approved: verdict === "approved" });
      },
    },
    {
      name: "paint_asset",
      description:
        `Paint one declared asset pass: outline, fill, shadow, highlight, or cleanup. Mix rects, lines, fills, and pixels; mirror/repeat drafts or translate one painted region on a copied frame for animation. Color \"\" erases. Each call returns the new revision PNG; inspect it and submit review_asset before stamping.`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Asset id to paint into" },
          pass: {
            type: "string",
            enum: ASSET_PASSES,
            description: "The visual construction pass being applied",
          },
          frameIndex: {
            type: "integer",
            minimum: 0,
            description: "Frame to paint (default 0). Use the current frameCount to append one copied frame.",
          },
          frameDuration: {
            type: "integer",
            minimum: 100,
            maximum: 2000,
            description: "Milliseconds per frame, shared by the asset (default 400)",
          },
          rects: RECT_OPS_SCHEMA,
          lines: LINE_OPS_SCHEMA,
          fills: FILL_OPS_SCHEMA,
          pixels: {
            type: "array",
            maxItems: MAX_DRAW_PIXELS,
            description: "Fine-detail pixels (applied last). For blocks/bands prefer rects.",
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
          mirror: {
            type: "string",
            enum: ["left-right", "top-bottom", "both"],
            description: "Duplicate supplied operations across the asset axes while keeping the originals",
          },
          repeat: {
            type: "object",
            description: "Repeat supplied operations as a grid, including the original at row 0, column 0",
            properties: {
              columns: { type: "integer", minimum: 1, maximum: 16 },
              rows: { type: "integer", minimum: 1, maximum: 16 },
              stepX: { type: "integer", description: "Horizontal pixels between copies" },
              stepY: { type: "integer", description: "Vertical pixels between copies" },
            },
            required: ["columns", "rows", "stepX", "stepY"],
          },
          translateRegion: {
            type: "object",
            description: "Move painted pixels in one bounded region on this frame; useful after appending a copied frame for a 1–2px blink, breath, limb, or hair motion.",
            properties: {
              x: { type: "integer" },
              y: { type: "integer" },
              width: { type: "integer", minimum: 1 },
              height: { type: "integer", minimum: 1 },
              dx: { type: "integer", minimum: -16, maximum: 16 },
              dy: { type: "integer", minimum: -16, maximum: 16 },
            },
            required: ["x", "y", "width", "height", "dx", "dy"],
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
        required: ["id", "pass"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        if (!id) {
          return toolError("id is required");
        }
        const pass = asAssetPass(input.pass);
        if (!pass) return toolError(`pass must be one of ${ASSET_PASSES.join(", ")}`);
        const asset = apiRef.current.getAsset(id);
        if (!asset) {
          return toolError(`Asset not found: ${id}`);
        }
        const offsetX = asInteger(input.offsetX) ?? 0;
        const offsetY = asInteger(input.offsetY) ?? 0;
        const parsedFrameIndex = asInteger(input.frameIndex);
        const frameIndex = parsedFrameIndex ?? 0;
        const frameCount = asset.frames?.length ?? 1;
        if ((input.frameIndex !== undefined && parsedFrameIndex === undefined) || frameIndex < 0 || frameIndex > frameCount) {
          return toolError(`frameIndex must be between 0 and ${frameCount}; use ${frameCount} to append one frame.`);
        }
        const frameDuration = asInteger(input.frameDuration);
        if (input.frameDuration !== undefined && (frameDuration === undefined || frameDuration < 100 || frameDuration > 2000)) {
          return toolError("frameDuration must be an integer between 100 and 2000 milliseconds");
        }
        const mirror = asString(input.mirror);
        if (input.mirror !== undefined && mirror !== "left-right" && mirror !== "top-bottom" && mirror !== "both") {
          return toolError("mirror must be left-right, top-bottom, or both");
        }
        const repeat = parseRepeat(input.repeat);
        if (typeof repeat === "string") return toolError(repeat);
        const size: Size = { width: asset.width, height: asset.height };
        const translateRegion = parseTranslateRegion(input.translateRegion, size);
        if (typeof translateRegion === "string") return toolError(translateRegion);
        let ops = collectBufferOps(input, offsetX, offsetY);
        ops = repeatBufferOps(ops, repeat);
        ops = mirrorBufferOps(ops, size, mirror as MirrorMode | undefined);
        const structuralOps = ops.rects.length + ops.lines.length + ops.fills.length;
        if (structuralOps > MAX_SHAPE_OPS) {
          return toolError(`Algorithmic expansion creates ${structuralOps} structural operations; maximum is ${MAX_SHAPE_OPS}`);
        }
        if (ops.dots.length > MAX_DRAW_PIXELS) {
          return toolError(`Algorithmic expansion creates ${ops.dots.length} detail pixels; maximum is ${MAX_DRAW_PIXELS}`);
        }
        if (bufferOpCount(ops) === 0 && frameDuration === undefined && !translateRegion) {
          return toolError(
            "Provide pixels, rects, lines, fills, translateRegion, or frameDuration. color \"\" erases.",
          );
        }
        const source = asset.frames?.[frameIndex] ?? asset.frames?.at(-1) ?? asset.pixels;
        const next = applyBufferOps(translatePaintedRegion(source, size, translateRegion), size, ops);
        const changed = diffToDots(source, next, asset.width);
        const painted = apiRef.current.drawAssetPixels(id, changed, frameIndex, frameDuration);
        const updated = apiRef.current.getAsset(id);
        if (!updated) {
          return toolError(`Asset not found: ${id}`);
        }
        return assetMutationFeedback(
          { ...updated, pixels: updated.frames?.[frameIndex] ?? updated.pixels },
          {
            painted,
            width: updated.width,
            height: updated.height,
            frameIndex,
            frameCount: updated.frames?.length ?? 1,
            frameDuration: updated.frameDuration ?? 400,
            ...((mirror || repeat || translateRegion) ? {
              algorithmic: { mirror: mirror ?? null, repeat: repeat ?? null, translateRegion: translateRegion ?? null },
            } : {}),
          },
          { dots: changed, pass },
        );
      },
    },
    {
      name: "add_asset",
      description:
        `Save a reusable sprite to the library (each side 1–${MAX_ASSET_SIDE}px; library ≤${MAX_ASSETS}). For a direct bitmap, pass bitmapPalette plus indexedRows: comma-separated zero-based palette indexes with \".\" for transparency; size is inferred. Otherwise start with template \"empty\" then paint, or pass hex rows, flat pixels, a solid fill, or a page rect. If Codex generated an image file, use the visible Import image control instead. Painted assets return an inline PNG — compare before the next pass.`,
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
            description: "Comma-separated #rrggbb per row (+ width + height)",
          },
          bitmapPalette: {
            type: "array",
            items: { type: "string", description: "#rrggbb" },
            description: "Colors referenced by zero-based indexes in indexedRows",
          },
          indexedRows: {
            type: "array",
            maxItems: MAX_ASSET_SIDE,
            items: { type: "string" },
            description: "Direct bitmap rows such as \".,0,1,0,.\"; indexes reference bitmapPalette and . is transparent. Width and height are inferred.",
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
            `Need a valid asset: bitmapPalette+indexedRows, pixels/rows/fill/template+width+height (each side 1–${MAX_ASSET_SIDE}), or a page rect. Indexed rows use comma-separated zero-based palette indexes and \".\" for transparency; all rows must have equal width.`,
          );
        }
        const isEmptyTemplate =
          asString(input.template) === "empty" && !assetHasPaintedPixels(asset);
        if (isEmptyTemplate) {
          markAssetEdited(asset.id);
          return toolResult({
            id: asset.id,
            name: asset.name,
            width: asset.width,
            height: asset.height,
            template: "empty",
            passHint: "outline",
            nextRequired: emptyAssetNextRequired(),
          });
        }
        return assetMutationFeedback(asset, {
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
        });
      },
    },
    {
      name: "stamp_assets",
      description:
        `Add or update movable overlay placements on the selected layer of the active page (max ${MAX_ASSETS} per call). Each item needs asset id, x, y; pass placementId from get_storybook/get_page_image to reposition or resize an existing stamp after visual review. Optional scale or width/height stays proportional. Array order for new stamps is back-to-front.`,
      inputSchema: {
        type: "object",
        properties: {
          stamps: {
            type: "array",
            maxItems: MAX_ASSETS,
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Asset id from add_asset or get_storybook" },
                placementId: { type: "string", description: "Existing placement id to move/resize instead of adding a duplicate" },
                x: { type: "integer", description: "Page column of the stamp top-left (0 = left)" },
                y: { type: "integer", description: "Page row of the stamp top-left (0 = top)" },
                scale: {
                  type: "number",
                  description: "Uniform scale; default 1 is native size",
                },
                width: { type: "integer", description: "Optional stamp width in page pixels" },
                height: { type: "integer", description: "Optional stamp height in page pixels" },
              },
              required: ["id", "x", "y"],
            },
            description: "New stamps apply in array order (back-to-front); placementId updates an existing stamp in place",
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
        const missing = stamps.find((stamp) => !api.getAsset(stamp.id));
        if (missing) return toolError(`Asset not found: ${missing.id}. Call get_storybook for valid ids.`);
        const unreviewed = recordStampedAssets([...new Set(stamps.map((stamp) => stamp.id))]);
        if (unreviewed.length) {
          return toolError(
            `Assets need an approved review_asset verdict for their latest revision before stamping: ${unreviewed.join(", ")}`,
          );
        }
        const placed: Array<{
          index: number;
          id: string;
          placementId: string;
          assetId: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }> = [];
        let updatedCount = 0;
        for (let index = 0; index < stamps.length; index += 1) {
          const stamp = stamps[index]!;
          if (!api.getAsset(stamp.id)) {
            return toolError(
              `Stamp ${index}: asset not found "${stamp.id}". Call get_storybook for valid ids.`,
            );
          }
          let result: Placement | null = null;
          if (stamp.placementId) {
            const current = api.active.placements.find((placement) => placement.id === stamp.placementId);
            if (!current || current.assetId !== stamp.id) {
              return toolError(`Stamp ${index}: placement not found for asset \"${stamp.id}\": ${stamp.placementId}`);
            }
            const asset = api.getAsset(stamp.id)!;
            if ((stamp.scale !== undefined && stamp.scale <= 0) ||
                (stamp.width !== undefined && stamp.width < 1) ||
                (stamp.height !== undefined && stamp.height < 1)) {
              return toolError(`Stamp ${index}: scale and dimensions must be positive`);
            }
            const resizeScale = stamp.scale ?? (
              stamp.width !== undefined || stamp.height !== undefined
                ? Math.max((stamp.width ?? asset.width) / asset.width, (stamp.height ?? asset.height) / asset.height)
                : undefined
            );
            const requestedWidth = resizeScale === undefined ? undefined : Math.round(asset.width * resizeScale);
            const requestedHeight = resizeScale === undefined ? undefined : Math.round(asset.height * resizeScale);
            api.movePlacement(stamp.placementId, stamp.x, stamp.y, index === 0);
            if (requestedWidth !== undefined || requestedHeight !== undefined) {
              api.resizePlacement(stamp.placementId, requestedWidth ?? current.width, requestedHeight ?? current.height);
            }
            result = api.active.placements.find((placement) => placement.id === stamp.placementId) ?? null;
            updatedCount += 1;
          } else {
            result = api.stampAsset({
              id: stamp.id,
              x: stamp.x,
              y: stamp.y,
              scale: stamp.scale,
              width: stamp.width,
              height: stamp.height,
              keepFloating: false,
              recordUndo: index === 0,
            });
          }
          if (!result) {
            return toolError(
              `Stamp ${index}: failed to place "${stamp.id}" at (${stamp.x},${stamp.y}) — use positive dimensions with each scaled side at most 256 pixels`,
            );
          }
          placed.push({
            index,
            id: stamp.id,
            placementId: result.id,
            assetId: stamp.id,
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height,
          });
        }
        const response: Record<string, unknown> = {
          stamped: placed.length,
          added: placed.length - updatedCount,
          updated: updatedCount,
          stamps: placed,
        };
        markPageEdited(api.active.id);
        response.nextRequired = "Call get_page_image, inspect the composition, then pass placementId back to stamp_assets for any correction before review_page.";
        return toolResult(response);
      },
    },
    {
      name: "paint_page",
      description:
        `Paint into the selected layer of the active page for flat backgrounds and touch-ups. Mix rects, lines, fills, and pixels (≤${MAX_DRAW_PIXELS} detail pixels/call); ops apply rects → lines → fills → pixels. color \"\" erases; a full-page rect with \"\" clears the selected layer. For characters and props, build assets then stamp_assets. Optional offsetX/offsetY tiles a motif across the page.`,
      inputSchema: {
        type: "object",
        properties: {
          rects: RECT_OPS_SCHEMA,
          lines: LINE_OPS_SCHEMA,
          fills: FILL_OPS_SCHEMA,
          pixels: {
            type: "array",
            maxItems: MAX_DRAW_PIXELS,
            description: "Fine-detail page pixels (applied last). For blocks prefer rects.",
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
            description: "Added to every x (default 0) — use to tile motifs",
          },
          offsetY: {
            type: "integer",
            description: "Added to every y (default 0)",
          },
        },
      },
      execute: async (input) => {
        const dots = asDots(input.pixels) ?? [];
        if (dots.length > MAX_DRAW_PIXELS) {
          return toolError(drawPixelsLimitError(dots.length));
        }
        const api = apiRef.current;
        const page = api.active;
        if (!page) {
          return toolError("No active page — call add_page first");
        }
        const offsetX = asInteger(input.offsetX) ?? 0;
        const offsetY = asInteger(input.offsetY) ?? 0;
        const ops = collectBufferOps(input, offsetX, offsetY);
        if (bufferOpCount(ops) === 0) {
          return toolError(
            "Provide at least one of pixels, rects, lines, or fills. Each {x,y,color}; color \"\" erases.",
          );
        }
        const size = activeSize(api);
        const next = applyBufferOps(page.pixels, size, ops);
        const changed = diffToDots(page.pixels, next, size.width);
        const painted = api.drawPixels(changed);
        markPageEdited(page.id);
        return toolResult({
          painted,
          offsetX,
          offsetY,
          hint: "Page paint. For characters/props use assets + stamp_assets. Call get_page_image to compare against your reference.",
        });
      },
    },
    {
      name: "get_page_image",
      description:
        "Rasterize a page to PNG so you can compare it to a reference (composites overlay stamps over page.pixels). Omit x, y, width, height for the full page; pass all four to crop a region. Returns coverage, colorCount, placementCount, and sceneHint for composition problems. Call after every few stamps, then inspect important character/object crops rather than trusting counts alone.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          pageIndex: {
            type: "integer",
            description: "0-based page index; defaults to active page",
          },
          x: {
            type: "integer",
            description: "Optional region left edge in page pixels (requires y, width, height)",
          },
          y: {
            type: "integer",
            description: "Optional region top edge in page pixels",
          },
          width: {
            type: "integer",
            description: "Optional region width in page pixels",
          },
          height: {
            type: "integer",
            description: "Optional region height in page pixels",
          },
          scale: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "Nearest-neighbor upscale (default 1)",
          },
        },
      },
      execute: async (input) => {
        const pageIndex = asInteger(input.pageIndex);
        const page = resolvePage(apiRef.current, pageIndex);
        if (!page) {
          return toolError(
            pageIndex === undefined
              ? "No active page"
              : `Page index out of range: ${pageIndex}`,
          );
        }
        const { width: pageWidth, height: pageHeight } = pageSize(page);
        const regionX = asInteger(input.x);
        const regionY = asInteger(input.y);
        const regionWidth = asInteger(input.width);
        const regionHeight = asInteger(input.height);
        const hasRegion =
          regionX !== undefined ||
          regionY !== undefined ||
          regionWidth !== undefined ||
          regionHeight !== undefined;
        if (
          hasRegion &&
          (regionX === undefined ||
            regionY === undefined ||
            regionWidth === undefined ||
            regionHeight === undefined)
        ) {
          return toolError(
            "Region crop requires all of x, y, width, and height, or omit all four for the full page",
          );
        }
        if (hasRegion && (regionWidth! < 1 || regionHeight! < 1)) {
          return toolError("width and height must be at least 1");
        }
        const scale = parseImageScale(input.scale);
        const assets = apiRef.current.film.assets;
        const display = compositedPagePixels(page, assets);
        const raster = hasRegion
          ? extractPixelRegion(
              display,
              pageWidth,
              pageHeight,
              regionX!,
              regionY!,
              regionWidth!,
              regionHeight!,
            )
          : {
              pixels: display,
              width: pageWidth,
              height: pageHeight,
            };
        const png = pixelsToPngBase64(
          raster.pixels,
          raster.width,
          raster.height,
          scale,
        );
        if (!png) {
          return toolError("Could not rasterize page image (canvas unavailable)");
        }
        const stats = computePixelStats(raster.pixels, raster.width, raster.height);
        const backgroundStats = computePixelStats(
          page.pixels,
          pageWidth,
          pageHeight,
        );
        const placements = pageLayers(page).filter(layer => layer.visible).flatMap(layer => layer.placements);
        const revision = hasRegion ? pageRevision(page.id) : markPageInspected(page.id);
        const summary = {
          pageIndex: pageIndex ?? apiRef.current.film.activeIndex,
          id: page.id,
          revision,
          region: hasRegion
            ? { x: regionX, y: regionY, width: regionWidth, height: regionHeight }
            : null,
          width: raster.width,
          height: raster.height,
          imageScale: scale,
          renderedWidth: raster.width * scale,
          renderedHeight: raster.height * scale,
          empty: hasRegion ? undefined : isEmptyPage(page),
          placementCount: hasRegion ? undefined : placements.length,
          placements: hasRegion
            ? undefined
            : placements.map((placement) => ({
                id: placement.id,
                assetId: placement.assetId,
                x: placement.x,
                y: placement.y,
                width: placement.width,
                height: placement.height,
              })),
          stats: {
            paintedCount: stats.paintedCount,
            coverage: stats.coverage,
            bounds: stats.bounds,
            colorCount: stats.colorCount,
          },
          sceneHint: hasRegion
            ? undefined
            : inferSceneHint(
                stats,
                pageSceneHintContext(page, assets.length, backgroundStats.coverage),
              ),
          nextRequired:
            "Compare this PNG to the attached style target and inspect important crops. Submit review_page with this revision; revise first if perspective, stacking, lighting, or density is weak.",
        };
        return toolResultWithImage(summary, { data: png, mimeType: "image/png" });
      },
    },
    {
      name: "review_page",
      description:
        "Record a vision judgment for the latest inspected page revision. Check top-down perspective, story-text stacking, depth overlap, lighting, density, and focal hierarchy before approving.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Page id from get_page_image" },
          revision: { type: "integer", minimum: 0, description: "Revision returned by get_page_image" },
          verdict: { type: "string", enum: ["revise", "approved"] },
          observations: {
            type: "string",
            description: "Concrete visual observations about perspective, stacking, overlap, lighting, density, and needed fixes",
          },
        },
        required: ["id", "revision", "verdict", "observations"],
      },
      execute: async (input) => {
        const id = asString(input.id);
        const revision = asInteger(input.revision);
        const verdict = asString(input.verdict);
        const observations = asString(input.observations)?.trim();
        if (!id || revision === undefined || (verdict !== "revise" && verdict !== "approved") || !observations) {
          return toolError("id, revision, verdict, and concrete observations are required");
        }
        if (!apiRef.current.film.pages.some((page) => page.id === id)) return toolError(`Page not found: ${id}`);
        const error = reviewPage({ pageId: id, revision, verdict, observations });
        if (error) return toolError(error);
        return toolResult({ id, revision, verdict, observations, approved: verdict === "approved" });
      },
    },
  ];
  return tools.map((tool) => withToolAnnotations(withSafeExecute(tool)));
}

/**
 * Wrap a tool's execute so any unexpected throw is reported back to the agent
 * as a structured `isError` result instead of rejecting the WebMCP call.
 *
 * Chrome's WebMCP eval guidance treats "the error reported back to the agent
 * gracefully" as a first-class failure mode — a tool that throws leaves the
 * model with an opaque rejection it cannot reason about. Every execute here
 * already returns toolError() for validation problems; this backstops the
 * runtime paths (canvas unavailable, null editor API after refresh, etc.).
 */
function withSafeExecute(tool: WebMCPTool): WebMCPTool {
  const run = tool.execute;
  return {
    ...tool,
    execute: async (input: Record<string, unknown>) => {
      try {
        const api = sharedApiRef.current;
        if (["paint_page", "stamp_assets", "place_text"].includes(tool.name) && api?.active && !api.workshopOpen) {
          const layer = activePageLayer(api.active);
          if (layer.locked || !layer.visible) return toolError(`Layer "${layer.name}" is ${layer.locked ? "locked" : "hidden"}. Select an editable layer in the editor first.`);
        }
        return await run(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return toolError(`${tool.name} failed: ${message}`);
      }
    },
  };
}

function isAlreadyRegisteredError(error: unknown): boolean {
  if (!(error instanceof DOMException) || error.name !== "InvalidStateError") {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("already registered") || message.includes("same name");
}

async function registerOneTool(
  tool: WebMCPTool,
  silent: boolean,
  signal: AbortSignal,
): Promise<void> {
  const context = document.modelContext;
  if (!context) {
    throw new Error("document.modelContext is unavailable");
  }
  const annotated = withToolAnnotations(tool);
  try {
    await context.registerTool(
      {
        name: annotated.name,
        description: annotated.description,
        inputSchema: annotated.inputSchema,
        annotations: annotated.annotations,
        execute: async (input: Record<string, unknown>) => annotated.execute(input),
      },
      "isPolyfill" in context && context.isPolyfill
        ? { signal, silent }
        : { signal },
    );
  } catch (error) {
    if (isAlreadyRegisteredError(error)) {
      return;
    }
    throw error;
  }
}

async function registerFilmToolsOnce(
  apiRef: ApiRef,
  controller: AbortController,
): Promise<RegistrationResult> {
  const { signal } = controller;
  signal.throwIfAborted();
  sharedApiRef.current = apiRef.current;
  const context = ensureWebMCPPolyfill();
  const native = !("isPolyfill" in context && context.isPolyfill);
  const tools = buildFilmTools();
  const expectedCount = tools.length;

  const existingWin = getWindowRegistration();
  if (existingWin) {
    existingWin.apiRef = sharedApiRef;
    if (!("getTools" in context) || typeof context.getTools !== "function") {
      webmcpStatus = {
        phase: "ready",
        ready: true,
        native: existingWin.native,
        toolCount: existingWin.count,
        expectedToolCount: expectedCount,
        generation: existingWin.generation,
      };
      return { native: existingWin.native, count: existingWin.count };
    }
    const listed = await context.getTools();
    if (listed.length >= expectedCount) {
      // HMR: refresh handler closures in place — no toolchange events.
      await Promise.all(tools.map((tool) => registerOneTool(tool, true, signal)));
      webmcpStatus = {
        phase: "ready",
        ready: true,
        native: existingWin.native,
        toolCount: listed.length,
        expectedToolCount: expectedCount,
        generation: existingWin.generation,
      };
      return { native: existingWin.native, count: listed.length };
    }
  }

  const generation =
    existingWin?.generation ??
    (typeof performance !== "undefined"
      ? performance.timeOrigin + performance.now()
      : Date.now());

  webmcpStatus = {
    phase: "registering",
    ready: false,
    native,
    toolCount: 0,
    expectedToolCount: expectedCount,
    generation,
  };

  const registerCounted = async (tool: WebMCPTool) => {
    await registerOneTool(tool, true, signal);
    webmcpStatus = {
      ...webmcpStatus,
      toolCount: webmcpStatus.toolCount + 1,
    };
  };

  const getFilm = tools.find((tool) => tool.name === "get_storybook");
  const rest = tools.filter((tool) => tool.name !== "get_storybook");
  if (getFilm) {
    await registerCounted(getFilm);
  }
  await Promise.all(rest.map((tool) => registerCounted(tool)));
  signal.throwIfAborted();

  if ("flushToolChanges" in context && typeof context.flushToolChanges === "function") {
    context.flushToolChanges();
  }

  const count = tools.length;
  webmcpStatus = {
    phase: "ready",
    ready: true,
    native,
    toolCount: count,
    expectedToolCount: count,
    generation,
  };

  setWindowRegistration({
    apiRef: sharedApiRef,
    controller,
    generation,
    native,
    count,
  });

  return { native, count };
}

export function syncWebmcpApiRef(apiRef: ApiRef): void {
  sharedApiRef.current = apiRef.current;
  const win = getWindowRegistration();
  if (win) {
    win.apiRef = sharedApiRef;
  }
}

export async function registerFilmTools(
  apiRef: ApiRef,
): Promise<RegistrationResult> {
  syncWebmcpApiRef(apiRef);

  const active = getWindowRegistration();
  if (active && !active.controller.signal.aborted) {
    return registerFilmToolsOnce(apiRef, active.controller);
  }

  if (registrationPending && !registrationPending.controller.signal.aborted) {
    return registrationPending.promise;
  }

  const controller = new AbortController();
  const promise: Promise<RegistrationResult> = (async () => {
    try {
      return await registerFilmToolsOnce(apiRef, controller);
    } catch (error) {
      if (registrationPending?.controller === controller) {
        webmcpStatus = {
          ...webmcpStatus,
          phase: "registering",
          ready: false,
          toolCount: 0,
        };
      }
      throw error;
    } finally {
      if (registrationPending?.controller === controller) {
        registrationPending = null;
      }
    }
  })();
  registrationPending = { controller, promise };
  return promise;
}

export function unregisterFilmTools(): void {
  const pending = registrationPending;
  const active = getWindowRegistration();
  pending?.controller.abort();
  if (active && active.controller !== pending?.controller) {
    active.controller.abort();
  }
  if (pending) {
    clearWindowRegistration(pending.controller);
  }
  if (active) {
    clearWindowRegistration(active.controller);
  }
  registrationPending = null;
  webmcpStatus = {
    phase: "registering",
    ready: false,
    native: active?.native ?? webmcpStatus.native,
    toolCount: 0,
    expectedToolCount: active?.count ?? webmcpStatus.expectedToolCount,
    generation: active?.generation ?? webmcpStatus.generation,
  };
}
