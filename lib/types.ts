/** Unpainted cell. Renders transparent so the editor checker (or Present paper) shows through. */
export const EMPTY = "";
export const TRANSPARENT = EMPTY;
/** Opaque painted white — distinct from EMPTY so white strokes cover the checker. */
export const PAPER = "#ffffff";
export const MIN_WIDTH = 48;
export const MAX_WIDTH = 256;
export const DEFAULT_WIDTH = 128;
export const DEFAULT_HEIGHT = 72;
export const MAX_ASSETS = 100;
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
  "select",
  "line",
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

/** Stage zoom relative to fit-in-viewport size (0.5×–4×). */
export const MIN_STAGE_ZOOM = 0.5;
export const MAX_STAGE_ZOOM = 4;
export const DEFAULT_STAGE_ZOOM = 1;
export const STAGE_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
export type StageZoom = number;

export const SHAPE_SCALES = ["s", "m", "l"] as const;
export type ShapeScale = (typeof SHAPE_SCALES)[number];

/**
 * Board layout — each page is an artboard node on the pannable/zoomable board.
 * Node width is fixed (density-independent) so artboards read as uniform slides;
 * `boardX`/`boardY` mark the node top-left in board coordinates (px at zoom 1).
 */
export const BOARD_NODE_WIDTH = 320;
export const BOARD_NODE_HEADER = 26;
export const BOARD_NODE_CANVAS_HEIGHT = Math.round((BOARD_NODE_WIDTH * 9) / 16);
export const BOARD_NODE_HEIGHT = BOARD_NODE_HEADER + BOARD_NODE_CANVAS_HEIGHT;
export const BOARD_NODE_GAP = 72;

export function defaultBoardPosition(index: number): { x: number; y: number } {
  return { x: index * (BOARD_NODE_WIDTH + BOARD_NODE_GAP), y: 0 };
}

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

export const DEFAULT_PALETTE_ID = "default";
export const DEFAULT_PALETTE_NAME = "Default";
export const MAX_PALETTE_NAME = 32;

export interface PaletteProfile {
  id: string;
  name: string;
  swatches: string[];
  lastColor?: string;
}

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

/**
 * An asset placed on a page as a movable overlay — it is NOT baked into
 * `page.pixels`. Placements composite over the background buffer back-to-front
 * (array order), so overlapping stamps can be rearranged and pixels underneath
 * are preserved. width/height are the rendered size (native or scaled).
 */
export interface Placement {
  flipX?: boolean;
  flipY?: boolean;
  id: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface PageLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  pixels: string[];
  placements: Placement[];
  texts: TextMark[];
}

export interface Page {
  id: string;
  width: number;
  height: number;
  /** Background buffer painted by draw_pixels / pencil / fill. */
  pixels: string[];
  texts: TextMark[];
  /** Movable asset overlays composited over `pixels`, back-to-front. */
  placements: Placement[];
  /** Layers ordered back-to-front; legacy buffers mirror the active layer. */
  layers?: PageLayer[];
  activeLayerId?: string;
  /** Node position on the story board (px at zoom 1, node top-left). */
  boardX: number;
  boardY: number;
  /** Directed story link: the page read after this one, if any. */
  nextPageId?: string | null;
}

export function pageLayers(page: Pick<Page, "id" | "pixels" | "placements" | "texts" | "layers">): PageLayer[] {
  return page.layers?.length ? page.layers : [{
    id: page.id + "-base", name: "Background", visible: true, locked: false,
    pixels: page.pixels, placements: page.placements ?? [], texts: page.texts ?? [],
  }];
}

export function activePageLayer(page: Page): PageLayer {
  const layers = pageLayers(page);
  return layers.find((layer) => layer.id === page.activeLayerId) ?? layers[0];
}

export interface Film {
  brief: string;
  pages: Page[];
  activeIndex: number;
  /** Swatches of the active profile — kept in sync with `palettes`. */
  palette: string[];
  /** Active theme name; omitted when Default is selected. */
  paletteName?: string;
  palettes: PaletteProfile[];
  activePaletteId: string;
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
  stageZoom: StageZoom;
  selectedAssetId: string | null;
  workshopOpen: boolean;
  workshopDraft: WorkshopDraft | null;
  floating: FloatingPixels | null;
  selectedId: string | null;
  selectedKind: MarkKind | null;
  selectedPlacementId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  setTool: (tool: DrawTool) => void;
  setColor: (color: string) => void;
  setFrame: (frame: TextFrame) => void;
  setTextFont: (font: TextFont) => void;
  setTextSize: (size: TextSize) => void;
  setShapeFilled: (filled: boolean) => void;
  setBrushSize: (size: BrushSize) => void;
  setStageZoom: (zoom: StageZoom) => void;
  stepStageZoom: (direction: 1 | -1) => void;
  resetStageZoom: () => void;
  selectAsset: (id: string | null) => boolean;
  openWorkshop: (assetId?: string) => boolean;
  closeWorkshop: (save?: boolean) => boolean;
  setWorkshopName: (name: string) => void;
  setWorkshopSize: (size: number) => boolean;
  selectMark: (id: string | null, kind?: MarkKind) => boolean;
  selectPlacement: (id: string | null) => boolean;
  movePlacement: (
    id: string,
    x: number,
    y: number,
    recordUndo?: boolean,
  ) => boolean;
  removePlacement: (id: string) => boolean;
  duplicatePlacement: (id: string) => Placement | null;
  resizePlacement: (id: string, width: number, height: number) => boolean;
  flipPlacement: (id: string, axis: "x" | "y") => boolean;
  reorderPlacement: (id: string, direction: -1 | 1) => boolean;
  movePlacementToLayer: (id: string, layerId: string) => boolean;
  copySelection: () => boolean;
  cutSelection: () => boolean;
  pasteSelection: () => boolean;
  deleteSelection: () => boolean;
  duplicateSelection: () => boolean;
  setBrief: (brief: string) => void;
  setPalette: (colors?: string[], name?: string) => boolean;
  selectPalette: (id: string) => boolean;
  addPaletteProfile: (name?: string) => PaletteProfile | null;
  renamePalette: (id: string, name: string) => boolean;
  addSwatch: (color: string) => boolean;
  resetPalette: () => void;
  addLayer: () => PageLayer | null;
  removeLayer: (id: string) => boolean;
  duplicateLayer: (id: string) => PageLayer | null;
  mergeLayerDown: (id: string) => boolean;
  selectLayer: (id: string) => boolean;
  updateLayer: (id: string, patch: { name?: string; visible?: boolean; locked?: boolean }) => boolean;
  moveLayer: (id: string, direction: -1 | 1) => boolean;
  flattenLayer: () => boolean;
  setDensity: (width: number) => void;
  resizeCanvas: (width: number, mode: "scale" | "canvas") => boolean;
  importProject: (input: unknown) => boolean;
  addPage: (input?: { story?: string; draw?: string }) => Page;
  selectPage: (index: number) => boolean;
  removePage: (index: number) => boolean;
  reorderPage: (id: string, index: number) => boolean;
  movePage: (id: string, x: number, y: number) => boolean;
  linkPages: (fromId: string, toId: string | null) => boolean;
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
    recordUndo?: boolean;
  }) => Placement | null;
  setText: (id: string, body: string) => boolean;
  moveText: (id: string, x: number, y: number) => boolean;
  removeText: (id: string) => boolean;
  paint: (x: number, y: number, recordUndo?: boolean) => void;
  paintLine: (x0: number, y0: number, x1: number, y1: number, recordUndo?: boolean) => void;
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
  redo: () => boolean;
  active: Page | null;
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}

export function defaultPalette(): string[] {
  return [...PALETTE];
}

export function defaultPaletteProfile(): PaletteProfile {
  return {
    id: DEFAULT_PALETTE_ID,
    name: DEFAULT_PALETTE_NAME,
    swatches: defaultPalette(),
  };
}

export function isDefaultPaletteId(id: string): boolean {
  return id === DEFAULT_PALETTE_ID;
}

export function isReservedPaletteName(value: string): boolean {
  return value.trim().toLowerCase() === DEFAULT_PALETTE_NAME.toLowerCase();
}

export function isBuiltInPalette(swatches: string[]): boolean {
  if (swatches.length !== PALETTE.length) {
    return false;
  }
  return swatches.every((hex, index) => hex === PALETTE[index]);
}

export function nextThemeName(profiles: PaletteProfile[]): string {
  const used = new Set(profiles.map((profile) => profile.name.toLowerCase()));
  let n = 1;
  while (used.has(`theme ${n}`)) {
    n += 1;
  }
  return `Theme ${n}`;
}

export function findPaletteByName(
  profiles: PaletteProfile[],
  name: string,
): PaletteProfile | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return undefined;
  }
  if (isReservedPaletteName(needle)) {
    return profiles.find((profile) => isDefaultPaletteId(profile.id));
  }
  return profiles.find(
    (profile) =>
      !isDefaultPaletteId(profile.id) &&
      profile.name.toLowerCase() === needle,
  );
}

export function isPaletteNameTaken(
  profiles: PaletteProfile[],
  name: string,
  exceptId?: string,
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  return profiles.some(
    (profile) =>
      profile.id !== exceptId && profile.name.toLowerCase() === needle,
  );
}

/** Custom profile name that is non-empty, not Default, and not already used. */
export function usablePaletteName(
  value: unknown,
  profiles: PaletteProfile[],
  exceptId?: string,
): string | undefined {
  const name = normalizePaletteName(value);
  if (!name || isReservedPaletteName(name)) {
    return undefined;
  }
  if (isPaletteNameTaken(profiles, name, exceptId)) {
    return undefined;
  }
  return name;
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
  }
  if (next.length === 0) {
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

export function normalizePaletteProfile(input: unknown): PaletteProfile | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const raw = input as Partial<PaletteProfile>;
  const swatches = normalizePalette(raw.swatches);
  if (!swatches) {
    return null;
  }
  const name = normalizePaletteName(raw.name);
  const id =
    typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : null;
  if (!id || !name) {
    return null;
  }
  const lastColor = parseHex(raw.lastColor);
  const profile: PaletteProfile = {
    id,
    name: isDefaultPaletteId(id) ? DEFAULT_PALETTE_NAME : name,
    swatches: isDefaultPaletteId(id) && swatches.length === 0
      ? defaultPalette()
      : swatches,
  };
  if (lastColor && profile.swatches.includes(lastColor)) {
    profile.lastColor = lastColor;
  }
  return profile;
}

export function ensurePaletteProfiles(
  profiles: PaletteProfile[],
): PaletteProfile[] {
  const seen = new Set<string>();
  const next: PaletteProfile[] = [];
  for (const profile of profiles) {
    if (seen.has(profile.id)) {
      continue;
    }
    seen.add(profile.id);
    next.push(
      isDefaultPaletteId(profile.id)
        ? { ...profile, name: DEFAULT_PALETTE_NAME }
        : profile,
    );
  }
  const hasDefault = next.some((profile) => isDefaultPaletteId(profile.id));
  if (!hasDefault) {
    next.unshift(defaultPaletteProfile());
  }
  const def = next.find((profile) => isDefaultPaletteId(profile.id));
  const rest = next.filter((profile) => !isDefaultPaletteId(profile.id));
  return def ? [def, ...rest] : [defaultPaletteProfile(), ...rest];
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

export function normalizeStageZoom(value: unknown): StageZoom {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return DEFAULT_STAGE_ZOOM;
  }
  return Math.min(
    MAX_STAGE_ZOOM,
    Math.max(MIN_STAGE_ZOOM, Math.round(n * 100) / 100),
  );
}

export function stageZoomLabel(zoom: StageZoom): string {
  return `${Math.round(normalizeStageZoom(zoom) * 100)}%`;
}

export function stepStageZoomValue(
  current: StageZoom,
  direction: 1 | -1,
): StageZoom {
  const normalized = normalizeStageZoom(current);
  if (direction > 0) {
    for (const step of STAGE_ZOOM_STEPS) {
      if (step > normalized + 0.001) {
        return step;
      }
    }
    return STAGE_ZOOM_STEPS[STAGE_ZOOM_STEPS.length - 1];
  }
  for (let index = STAGE_ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    const step = STAGE_ZOOM_STEPS[index];
    if (step < normalized - 0.001) {
      return step;
    }
  }
  return STAGE_ZOOM_STEPS[0];
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
  return pageLayers(page).every((layer) =>
    layer.pixels.every((pixel) => !isPaintedPixel(pixel)) &&
    layer.texts.every((mark) => !mark.body.trim()) && layer.placements.length === 0);
}

/**
 * Resolve the story reading order by following `nextPageId` pointers from each
 * head (a page no other page links to). Cycles are broken by a visited guard,
 * and any pages left unvisited (disconnected islands) are appended in array
 * order so no page is ever dropped. Falls back to array order when there are
 * no links at all.
 */
export function readingOrder(pages: Page[]): Page[] {
  const byId = new Map(pages.map((page) => [page.id, page] as const));
  const targeted = new Set<string>();
  for (const page of pages) {
    if (page.nextPageId && byId.has(page.nextPageId)) {
      targeted.add(page.nextPageId);
    }
  }
  const order: Page[] = [];
  const visited = new Set<string>();
  const walk = (start: Page) => {
    let current: Page | undefined = start;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      order.push(current);
      current = current.nextPageId ? byId.get(current.nextPageId) : undefined;
    }
  };
  for (const page of pages) {
    if (!targeted.has(page.id)) {
      walk(page);
    }
  }
  for (const page of pages) {
    if (!visited.has(page.id)) {
      walk(page);
    }
  }
  return order;
}
