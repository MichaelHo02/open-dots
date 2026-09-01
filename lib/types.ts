/** Unpainted cell. Renders transparent so the editor checker (or Present paper) shows through. */
export const EMPTY = "";
export const TRANSPARENT = EMPTY;
/** Opaque painted white — distinct from EMPTY so white strokes cover the checker. */
export const PAPER = "#ffffff";
export const MIN_WIDTH = 48;
export const MAX_WIDTH = 256;
export const DEFAULT_WIDTH = 128;
export const DEFAULT_HEIGHT = 72;
export const MAX_ASSETS = 48;
export const MAX_ASSET_NAME = 32;
export const MAX_ASSET_SIDE = 96;
/** Max pixels per draw_pixels call — full pages need add_asset + stamp_assets. */
export const MAX_DRAW_PIXELS = 4096;
export const ASSET_SIZE_PRESETS = [16, 24, 32, 48, 64, 96] as const;
export type AssetSizePreset = (typeof ASSET_SIZE_PRESETS)[number];
export const DEFAULT_ASSET_WIDTH = 32;
export const DEFAULT_ASSET_HEIGHT = 32;

export const DRAW_TOOLS = [
  "pencil",
  "eraser",
  "fill",
  "text",
  "shape",
  "move",
] as const;
export type DrawTool = (typeof DRAW_TOOLS)[number];

export const TEXT_FRAMES = [
  "circle",
  "rectangle",
  "square",
  "heart",
  "star",
] as const;
export type TextFrame = (typeof TEXT_FRAMES)[number];
export const SHAPE_KINDS = TEXT_FRAMES;
export type ShapeKind = TextFrame;

export const TEXT_FONTS = ["inter", "geist-mono"] as const;
export type TextFont = (typeof TEXT_FONTS)[number];
export const DEFAULT_TEXT_FONT: TextFont = "inter";

/** Glyph scale factor (1×–8×); height ≈ 7px × scale on the pixel grid. */
export const MIN_TEXT_SIZE = 1;
export const MAX_TEXT_SIZE = 8;
export const DEFAULT_TEXT_SIZE = 2;
export type TextSize = number;

/** Square brush stamp size (1×1–24×24); separate from page density. */
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 24;
export const DEFAULT_BRUSH_SIZE = 1;
export type BrushSize = number;

export const SHAPE_SCALES = ["s", "m", "l"] as const;
export type ShapeScale = (typeof SHAPE_SCALES)[number];

export const PALETTE = [
  "#000000",
  "#ffffff",
  "#dceeb1",
  "#c5b0f4",
  "#f4ecd6",
  "#efd4d4",
  "#c8e6cd",
  "#f3c9b6",
  "#1f1d3d",
  "#ff3d8b",
] as const;

export const MIN_PALETTE = 4;
export const MAX_PALETTE = 16;
export const MAX_PALETTE_NAME = 32;

export interface Size {
  width: number;
  height: number;
}

/** Editable text run — rendered only via rasterized `page.pixels`. x/y are pixel coords. */
export interface TextMark {
  id: string;
  x: number;
  y: number;
  body: string;
  color: string;
  font: TextFont;
  size: TextSize;
}

export interface PixelStamp {
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: string[];
}

export interface FloatingPixels extends PixelStamp {
  under: string[];
}

export interface Asset {
  id: string;
  name: string;
  width: number;
  height: number;
  pixels: string[];
}

export interface WorkshopDraft {
  id: string | null;
  name: string;
  width: number;
  height: number;
  pixels: string[];
}

export interface Page {
  id: string;
  width: number;
  height: number;
  pixels: string[];
  texts: TextMark[];
}

export interface Film {
  brief: string;
  pages: Page[];
  activeIndex: number;
  palette: string[];
  paletteName?: string;
  assets: Asset[];
}

export type MarkKind = "text";

export interface FilmApi {
  film: Film;
  tool: DrawTool;
  color: string;
  frame: TextFrame;
  textFont: TextFont;
  textSize: TextSize;
  shapeFilled: boolean;
  brushSize: BrushSize;
  selectedAssetId: string | null;
  workshopOpen: boolean;
  workshopDraft: WorkshopDraft | null;
  floating: FloatingPixels | null;
  selectedId: string | null;
  selectedKind: MarkKind | null;
  setTool: (tool: DrawTool) => void;
  setColor: (color: string) => void;
  setFrame: (frame: TextFrame) => void;
  setTextFont: (font: TextFont) => void;
  setTextSize: (size: TextSize) => void;
  setShapeFilled: (filled: boolean) => void;
  setBrushSize: (size: BrushSize) => void;
  selectAsset: (id: string | null) => boolean;
  openWorkshop: (assetId?: string) => boolean;
  closeWorkshop: (save?: boolean) => boolean;
  setWorkshopName: (name: string) => void;
  setWorkshopSize: (size: number) => boolean;
  selectMark: (id: string | null, kind?: MarkKind) => boolean;
  setBrief: (brief: string) => void;
  setPalette: (colors: string[], name?: string) => boolean;
  addSwatch: (color: string) => boolean;
  resetPalette: () => void;
  setDensity: (width: number) => void;
  addPage: (input?: { story?: string; draw?: string }) => Page;
  selectPage: (index: number) => boolean;
  removePage: (index: number) => boolean;
  addText: (input: {
    x: number;
    y: number;
    body?: string;
    color?: string;
    font?: TextFont;
    size?: TextSize;
  }) => TextMark | null;
  stampShape: (input: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    color?: string;
    kind?: ShapeKind;
    filled?: boolean;
    keepFloating?: boolean;
  }) => PixelStamp | null;
  liftMarquee: (x: number, y: number, width: number, height: number) => boolean;
  moveFloating: (x: number, y: number, recordUndo?: boolean) => boolean;
  anchorFloating: () => void;
  addAsset: (input: {
    name: string;
    width?: number;
    height?: number;
    pixels?: string[];
    x?: number;
    y?: number;
    pageIndex?: number;
  }) => Asset | null;
  addAssetFromFloating: (name: string) => Asset | null;
  removeAsset: (id: string) => boolean;
  stampAsset: (input: {
    id: string;
    x: number;
    y: number;
    scale?: number;
    width?: number;
    height?: number;
    keepFloating?: boolean;
  }) => PixelStamp | null;
  setText: (id: string, body: string) => boolean;
  moveText: (id: string, x: number, y: number) => boolean;
  removeText: (id: string) => boolean;
  paint: (x: number, y: number, recordUndo?: boolean) => void;
  getAsset: (id: string) => Asset | null;
  drawAssetPixels: (
    id: string,
    dots: Array<{ x: number; y: number; color: string }>,
  ) => number;
  duplicateAsset: (id: string, name?: string) => Asset | null;
  clearRect: (input: {
    target: "page" | "asset";
    assetId?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => boolean;
  drawPixels: (dots: Array<{ x: number; y: number; color: string }>) => number;
  rect: (
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) => void;
  line: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
  ) => void;
  fill: (x: number, y: number, color?: string) => void;
  clearPage: () => void;
  drawScene: (prompt: string) => void;
  undo: () => boolean;
  active: Page | null;
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}

export function defaultPalette(): string[] {
  return [...PALETTE];
}

export function parseHex(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
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
  return null;
}

function isEmptyToken(value: unknown): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  const token = value.trim().toLowerCase();
  return (
    token === EMPTY ||
    token === "transparent" ||
    token === "empty" ||
    token === "#00000000"
  );
}

/** Legacy books stored paper as EMPTY (`#ffffff`). New `#ffffff` is painted white. */
export function normalizeStoredPixel(
  value: unknown,
  paperAsEmpty = false,
): string {
  if (isEmptyToken(value)) {
    return EMPTY;
  }
  const hex = parseHex(value);
  if (!hex) {
    return EMPTY;
  }
  if (paperAsEmpty && hex === PAPER) {
    return EMPTY;
  }
  return hex;
}

export function normalizePalette(input: unknown): string[] | null {
  if (!Array.isArray(input)) {
    return null;
  }
  const next: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const hex = parseHex(item);
    if (!hex || seen.has(hex)) {
      continue;
    }
    seen.add(hex);
    next.push(hex);
    if (next.length >= MAX_PALETTE) {
      break;
    }
  }
  if (next.length < MIN_PALETTE) {
    return null;
  }
  return next;
}

export function normalizePaletteName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const next = value.trim().slice(0, MAX_PALETTE_NAME);
  return next || undefined;
}

export function isTextFrame(value: unknown): value is TextFrame {
  return TEXT_FRAMES.some((frame) => frame === value);
}

export function isShapeKind(value: unknown): value is ShapeKind {
  return isTextFrame(value);
}

export function isTextFont(value: unknown): value is TextFont {
  return TEXT_FONTS.some((font) => font === value);
}

export function isTextSize(value: unknown): value is TextSize {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_TEXT_SIZE &&
    value <= MAX_TEXT_SIZE
  );
}

export function isShapeScale(value: unknown): value is ShapeScale {
  return SHAPE_SCALES.some((scale) => scale === value);
}

export function normalizeFont(value: unknown): TextFont {
  if (isTextFont(value)) {
    return value;
  }
  switch (value) {
    case "mono":
    case "geist":
      return "geist-mono";
    case "sans":
      return "inter";
    default:
      return "inter";
  }
}

export function normalizeTextSize(value: unknown): TextSize {
  if (isTextSize(value)) {
    return value;
  }
  switch (value) {
    case "s":
    case "small":
    case "sm":
      return 1;
    case "m":
    case "medium":
    case "md":
      return DEFAULT_TEXT_SIZE;
    case "l":
    case "large":
    case "lg":
      return 3;
    default: {
      const n =
        typeof value === "number" ? Math.round(value) : Number(value);
      if (Number.isFinite(n)) {
        return Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, n));
      }
      return DEFAULT_TEXT_SIZE;
    }
  }
}

/** @deprecated Use normalizeTextSize — kept for imports that mean text scale. */
export function normalizeSize(value: unknown): TextSize {
  return normalizeTextSize(value);
}

export function normalizeScale(value: unknown): ShapeScale {
  if (isShapeScale(value)) {
    return value;
  }
  switch (value) {
    case "small":
    case "sm":
      return "s";
    case "large":
    case "lg":
      return "l";
    case "medium":
    case "md":
      return "m";
    default:
      return "m";
  }
}

export function fontLabel(font: TextFont): string {
  switch (font) {
    case "inter":
      return "Inter";
    case "geist-mono":
      return "Geist Mono";
    default:
      return assertNever(font, "Unknown font");
  }
}

export function textSizeLabel(size: TextSize): string {
  return `${normalizeTextSize(size)}×`;
}

export function isBrushSize(value: unknown): value is BrushSize {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_BRUSH_SIZE &&
    value <= MAX_BRUSH_SIZE
  );
}

export function normalizeBrushSize(value: unknown): BrushSize {
  if (isBrushSize(value)) {
    return Math.round(value);
  }
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  if (Number.isFinite(n)) {
    return Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, n));
  }
  return DEFAULT_BRUSH_SIZE;
}

export function brushSizeLabel(size: BrushSize): string {
  return `${normalizeBrushSize(size)}×${normalizeBrushSize(size)}`;
}

export function textSizePx(size: TextSize): number {
  return 7 * normalizeTextSize(size);
}

export function normalizeFrame(value: unknown): TextFrame {
  if (isTextFrame(value)) {
    return value;
  }
  switch (value) {
    case "speech":
    case "thought":
      return "circle";
    case "shout":
      return "star";
    case "caption":
      return "rectangle";
    case "plain":
      return "square";
    default:
      return "circle";
  }
}

export function frameLabel(frame: TextFrame): string {
  switch (frame) {
    case "circle":
      return "Circle";
    case "rectangle":
      return "Rectangle";
    case "square":
      return "Square";
    case "heart":
      return "Heart";
    case "star":
      return "Star";
    default:
      return assertNever(frame, "Unknown frame");
  }
}

export function frameHint(frame: TextFrame): string {
  switch (frame) {
    case "circle":
      return "Drag on the page to size a circle";
    case "rectangle":
      return "Drag on the page to size a rectangle";
    case "square":
      return "Drag on the page to size a square";
    case "heart":
      return "Drag on the page to size a heart";
    case "star":
      return "Drag on the page to size a star";
    default:
      return assertNever(frame, "Unknown frame");
  }
}

export function framePlaceholder(frame: TextFrame): string {
  switch (frame) {
    case "circle":
      return "Hello…";
    case "rectangle":
      return "Once upon…";
    case "square":
      return "Hi…";
    case "heart":
      return "Love…";
    case "star":
      return "Wow!";
    default:
      return assertNever(frame, "Unknown frame");
  }
}

export const TEXT_PLACEHOLDER = "Once upon…";

export function pageSize(page: Pick<Page, "width" | "height">): Size {
  return { width: page.width, height: page.height };
}

export function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function clampWidth(value: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value)));
}

export function landscapeSize(width: number): Size {
  const nextW = clampWidth(width);
  return {
    width: nextW,
    height: Math.max(8, Math.round((nextW * 9) / 16)),
  };
}

export function emptyPixels(width: number, height: number): string[] {
  return Array.from({ length: width * height }, () => EMPTY);
}

export function resizePixels(
  pixels: string[],
  from: Size,
  to: Size,
): string[] {
  const next = emptyPixels(to.width, to.height);
  const copyW = Math.min(from.width, to.width);
  const copyH = Math.min(from.height, to.height);
  for (let y = 0; y < copyH; y += 1) {
    for (let x = 0; x < copyW; x += 1) {
      next[y * to.width + x] = pixels[y * from.width + x] ?? EMPTY;
    }
  }
  return next;
}

export function isPaintedPixel(color: string): boolean {
  return !isEmptyToken(color);
}

export function isEmptyPage(page: Page): boolean {
  const blankPixels = page.pixels.every((pixel) => !isPaintedPixel(pixel));
  const blankText = (page.texts ?? []).every((mark) => !mark.body.trim());
  return blankPixels && blankText;
}
