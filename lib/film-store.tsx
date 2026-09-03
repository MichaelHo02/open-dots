"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  blitStamp,
  clonePixels,
  compositedPagePixels,
  compositePage,
  drawLine,
  extractStamp,
  fillRect,
  floodFill,
  hexColor,
  inBounds,
  paintBrush,
  paintScene,
  placementStamp,
  rasterizeShape,
  restoreUnder,
  sampleUnder,
  scaleStamp,
  setPixels,
  shapeScalePixels,
} from "./draw";
import { createId } from "./id";
import {
  normalizeTextCoord,
  rasterizeTextRun,
  syncTextRuns,
  toPixelMark,
} from "./pixel-font";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  EMPTY,
  MAX_ASSET_NAME,
  MAX_ASSET_SIDE,
  MAX_ASSETS,
  MAX_WIDTH,
  MIN_WIDTH,
  assertNever,
  clampUnit,
  defaultBoardPosition,
  DEFAULT_PALETTE_ID,
  defaultPalette,
  defaultPaletteProfile,
  emptyPixels,
  ensurePaletteProfiles,
  findPaletteByName,
  isDefaultPaletteId,
  isReservedPaletteName,
  landscapeSize,
  nextThemeName,
  normalizeFont,
  normalizeFrame,
  normalizeBrushSize,
  normalizePalette,
  normalizePaletteName,
  normalizePaletteProfile,
  usablePaletteName,
  normalizeScale,
  normalizeStageZoom,
  stepStageZoomValue,
  DEFAULT_STAGE_ZOOM,
  DEFAULT_TEXT_FONT,
  DEFAULT_TEXT_SIZE,
  DEFAULT_BRUSH_SIZE,
  normalizeTextSize,
  normalizeStoredPixel,
  pageSize,
  pageLayers,
  activePageLayer,
  parseHex,
  resizePixels,
  type BrushSize,
  type DrawTool,
  type Film,
  type FilmApi,
  type FloatingPixels,
  type MarkKind,
  type Page,
  type PageLayer,
  type PaletteProfile,
  type PixelStamp,
  type Placement,
  type ShapeKind,
  type Size,
  type StageZoom,
  type TextFont,
  type TextFrame,
  type TextMark,
  type TextSize,
  type Asset,
  type WorkshopDraft,
  DEFAULT_ASSET_HEIGHT,
  DEFAULT_ASSET_WIDTH,
} from "./types";

const STORAGE_KEY = "pixel-film-studio:v15";
/** v12–v14 share pixel semantics; v15 only adds board positions + story links. */
const COMPAT_KEYS = [
  "pixel-film-studio:v14",
  "pixel-film-studio:v13",
  "pixel-film-studio:v12",
];
const LEGACY_KEYS = [
  "pixel-film-studio:v11",
  "pixel-film-studio:v10",
  "pixel-film-studio:v9",
  "pixel-film-studio:v8",
  "pixel-film-studio:v7",
  "pixel-film-studio:v6",
  "pixel-film-studio:v5",
  "pixel-film-studio:v4",
  "pixel-film-studio:v3",
];
const UNDO_LIMIT = 40;
const FilmContext = createContext<FilmApi | null>(null);

type PageUndo = Pick<Page, "width" | "height" | "pixels" | "placements" | "texts" | "layers" | "activeLayerId">;

function clonePlacements(placements: Placement[] | undefined): Placement[] {
  return (placements ?? []).map((placement) => ({ ...placement }));
}

function withLayers(page: Page, layers: PageLayer[], activeId = page.activeLayerId): Page {
  const active = layers.find((layer) => layer.id === activeId) ?? layers[0];
  return { ...page, layers, activeLayerId: active.id,
    pixels: active.pixels, placements: active.placements, texts: active.texts };
}

function editablePage(): Page | null {
  const page = activePage();
  if (!page) return null;
  const layer = activePageLayer(page);
  return layer.visible && !layer.locked ? page : null;
}

function clearLayerSelection() {
  selectedAssetId = null;
  clearSelection();
  clearPlacementSelection();
  dropFloating();
}

function commitLayers(page: Page, layers: PageLayer[], activeId = page.activeLayerId) {
  const film = getSnapshot();
  clearLayerSelection();
  commit({ ...film, pages: film.pages.map((item) => item.id === page.id ? withLayers(page, layers, activeId) : item) });
}

function clampPlacementOrigin(placement: Placement, size: Size): Placement {
  return {
    ...placement,
    x: Math.max(0, Math.min(placement.x, size.width - placement.width)),
    y: Math.max(0, Math.min(placement.y, size.height - placement.height)),
  };
}

function blankPage(size: Size): Page {
  return {
    id: createId("page"),
    width: size.width,
    height: size.height,
    pixels: emptyPixels(size.width, size.height),
    texts: [],
    placements: [],
    boardX: 0,
    boardY: 0,
    nextPageId: null,
  };
}

const SEED: Film = {
  brief: "",
  pages: [
    {
      id: "page_0",
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      pixels: emptyPixels(DEFAULT_WIDTH, DEFAULT_HEIGHT),
      texts: [],
      placements: [],
      boardX: 0,
      boardY: 0,
      nextPageId: null,
    },
  ],
  activeIndex: 0,
  palette: defaultPalette(),
  palettes: [defaultPaletteProfile()],
  activePaletteId: DEFAULT_PALETTE_ID,
  assets: [],
};

let memory = SEED;
let clientReady = false;
let tool: DrawTool = "pencil";
let color = "#000000";
let frame: TextFrame = "circle";
let textFont: TextFont = DEFAULT_TEXT_FONT;
let textSize: TextSize = DEFAULT_TEXT_SIZE;
let shapeFilled = false;
let brushSize: BrushSize = DEFAULT_BRUSH_SIZE;
let stageZoom: StageZoom = DEFAULT_STAGE_ZOOM;
let selectedAssetId: string | null = null;
let selectedPlacementId: string | null = null;
let workshopOpen = false;
let workshopDraft: WorkshopDraft | null = null;
let workshopRevision = 0;
let selectedId: string | null = null;
let selectedKind: MarkKind | null = null;
let floating: FloatingPixels | null = null;
const undos: PageUndo[] = [];
const redos: PageUndo[] = [];
const workshopUndos: WorkshopDraft[] = [];
const workshopRedos: WorkshopDraft[] = [];
let clipboard: PixelStamp | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function touchWorkshopDraft() {
  workshopRevision += 1;
  emit();
}

function persist(film: Film) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(film));
  } catch {
    // Private mode — keep memory only.
  }
}

function guessPixelSize(pixels: string[], width?: number, height?: number): Size {
  if (width && height && pixels.length === width * height) {
    return { width, height };
  }
  const root = Math.round(Math.sqrt(pixels.length));
  if (root * root === pixels.length && root >= 8) {
    return { width: root, height: root };
  }
  return landscapeSize(width ?? DEFAULT_WIDTH);
}

type LegacyMark = Partial<TextMark> & {
  frame?: unknown;
  kind?: unknown;
  scale?: unknown;
  filled?: unknown;
  color?: string;
  x?: number;
  y?: number;
  id?: string;
};

function normalizeTextMark(mark: LegacyMark): TextMark {
  return {
    id: mark.id || createId("text"),
    x: typeof mark.x === "number" ? mark.x : 0.08,
    y: typeof mark.y === "number" ? mark.y : 0.78,
    body: mark.body ?? "",
    color: mark.color || "#000000",
    font: normalizeFont(mark.font),
    size: normalizeTextSize(mark.size),
  };
}

function migrateMarks(page: {
  texts?: LegacyMark[];
  shapes?: LegacyMark[];
  story?: string;
  caption?: string;
}): { texts: TextMark[]; shapes: LegacyMark[] } {
  const hasShapeArray = Array.isArray(page.shapes);
  const shapes = hasShapeArray ? [...(page.shapes ?? [])] : [];
  const texts: TextMark[] = [];

  for (const mark of page.texts ?? []) {
    const framed = !hasShapeArray && mark.frame != null;
    if (framed) {
      if (mark.body?.trim()) {
        texts.push(normalizeTextMark(mark));
      } else {
        shapes.push(mark);
      }
      continue;
    }
    texts.push(normalizeTextMark(mark));
  }

  if (!page.texts?.length) {
    const leftover = page.story ?? page.caption;
    if (leftover?.trim()) {
      texts.push(
        normalizeTextMark({
          body: leftover,
          x: 0.08,
          y: 0.78,
        }),
      );
    }
  }

  return { texts, shapes };
}

function bakeLegacyShape(pixels: string[], size: Size, mark: LegacyMark): string[] {
  const kind = normalizeFrame(mark.kind ?? mark.frame);
  const scale = normalizeScale(mark.scale);
  const dim = shapeScalePixels(scale, size);
  const width = kind === "rectangle" ? Math.max(2, Math.round(dim * 1.6)) : dim;
  const height = dim;
  const x0 = Math.round((typeof mark.x === "number" ? mark.x : 0.5) * size.width);
  const y0 = Math.round((typeof mark.y === "number" ? mark.y : 0.4) * size.height);
  const stamp = rasterizeShape(
    kind,
    x0,
    y0,
    x0 + width - 1,
    y0 + height - 1,
    mark.color || "#000000",
    Boolean(mark.filled),
  );
  return blitStamp(pixels, size, stamp);
}

function normalizeAsset(
  raw: Partial<Asset>,
  paperAsEmpty = false,
): Asset | null {
  const width = Math.round(raw.width ?? 0);
  const height = Math.round(raw.height ?? 0);
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_ASSET_SIDE ||
    height > MAX_ASSET_SIDE
  ) {
    return null;
  }
  const source = Array.isArray(raw.pixels) ? raw.pixels : [];
  if (source.length !== width * height) {
    return null;
  }
  const pixels = source.map((item) =>
    normalizeStoredPixel(item, paperAsEmpty),
  );
  const frames = Array.isArray(raw.frames) ? raw.frames
    .filter(frame => Array.isArray(frame) && frame.length === width * height)
    .map(frame => frame.map(item => normalizeStoredPixel(item, paperAsEmpty))) : [];
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, MAX_ASSET_NAME)
      : "Asset";
  return {
    id: raw.id || createId("asset"),
    name,
    width,
    height,
    pixels: frames[0] ?? pixels,
    frames: frames.length > 1 ? frames : undefined,
    frameDuration: Math.max(100, Math.min(2000, Math.round(raw.frameDuration ?? 400))),
  };
}

function normalizePlacements(raw: unknown): Placement[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const placements: Placement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Partial<Placement>;
    const assetId = typeof row.assetId === "string" ? row.assetId : null;
    const x = Math.round(Number(row.x));
    const y = Math.round(Number(row.y));
    const width = Math.round(Number(row.width));
    const height = Math.round(Number(row.height));
    if (
      !assetId ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 1 ||
      height < 1 ||
      width > MAX_WIDTH ||
      height > MAX_WIDTH
    ) {
      continue;
    }
    placements.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id : createId("place"),
      assetId,
      x,
      y,
      width,
      height,
      ...(row.flipX === true ? { flipX: true } : {}),
      ...(row.flipY === true ? { flipY: true } : {}),
    });
  }
  return placements;
}

function migratePage(
  page: Partial<Page> & {
    story?: string;
    caption?: string;
    texts?: LegacyMark[];
    shapes?: LegacyMark[];
  },
  fallback: Size,
  paperAsEmpty = false,
): Page {
  const pixels = (page.pixels ?? []).map((item) =>
    normalizeStoredPixel(item, paperAsEmpty),
  );
  const fromStored = page.width ? landscapeSize(page.width) : null;
  let size: Size;
  if (fromStored && pixels.length === fromStored.width * fromStored.height) {
    size = fromStored;
  } else if (pixels.length === fallback.width * fallback.height) {
    size = fallback;
  } else if (pixels.length > 0) {
    size = landscapeSize(
      guessPixelSize(
        pixels,
        page.width ?? fallback.width,
        page.height ?? fallback.height,
      ).width,
    );
  } else {
    size = fallback;
  }
  let nextPixels = pixels;
  if (pixels.length !== size.width * size.height) {
    nextPixels = pixels.length
      ? resizePixels(
          pixels,
          guessPixelSize(
            pixels,
            page.width ?? fallback.width,
            page.height ?? fallback.height,
          ),
          size,
        )
      : emptyPixels(size.width, size.height);
  }
  const marks = migrateMarks(page);
  for (const mark of marks.shapes) {
    nextPixels = bakeLegacyShape(nextPixels, size, mark);
  }
  for (const mark of marks.texts) {
    if (!mark.body.trim()) {
      continue;
    }
    const pixelMark = toPixelMark(mark, size);
    nextPixels = rasterizeTextRun(nextPixels, size, pixelMark);
  }
  const boardX = Number(page.boardX);
  const boardY = Number(page.boardY);
  const nextPageId =
    typeof page.nextPageId === "string" && page.nextPageId.trim()
      ? page.nextPageId
      : null;
  const migrated: Page = {
    id: page.id || createId("page"),
    width: size.width,
    height: size.height,
    texts: [],
    pixels: nextPixels,
    placements: normalizePlacements(page.placements),
    boardX: Number.isFinite(boardX) ? boardX : Number.NaN,
    boardY: Number.isFinite(boardY) ? boardY : Number.NaN,
    nextPageId,
  };
  if (!Array.isArray(page.layers) || !page.layers.length) return migrated;
  const ids = new Set<string>();
  const layers = page.layers.filter((layer) => layer && typeof layer === "object").map((layer, index): PageLayer => {
    let id = typeof layer.id === "string" && layer.id.trim() ? layer.id : createId("layer");
    if (ids.has(id)) id = createId("layer");
    ids.add(id);
    const pixels = Array.from({ length: size.width * size.height }, (_, i) =>
      normalizeStoredPixel(Array.isArray(layer.pixels) ? layer.pixels[i] : EMPTY, paperAsEmpty));
    return { id, name: typeof layer.name === "string" && layer.name.trim() ? layer.name.trim().slice(0, 80) : `Layer ${index + 1}`,
      visible: layer.visible !== false, locked: layer.locked === true,
      opacity: Math.max(0, Math.min(1, Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1)), pixels,
      placements: normalizePlacements(layer.placements),
      texts: Array.isArray(layer.texts) ? layer.texts.filter((mark) => mark && typeof mark.body === "string").map(normalizeTextMark) : [] };
  });
  return layers.length ? withLayers(migrated, layers, page.activeLayerId) : migrated;
}

/**
 * Give every page a board position (laying out any without stored coords in a
 * left-to-right row) and drop story links that point at a missing page or the
 * page itself. Runs once after migration so old books open cleanly on the board.
 */
function sanitizeBoard(pages: Page[]): Page[] {
  const ids = new Set(pages.map((page) => page.id));
  return pages.map((page, index) => {
    const fallback = defaultBoardPosition(index);
    const boardX = Number.isFinite(page.boardX) ? page.boardX : fallback.x;
    const boardY = Number.isFinite(page.boardY) ? page.boardY : fallback.y;
    const nextPageId =
      page.nextPageId &&
      page.nextPageId !== page.id &&
      ids.has(page.nextPageId)
        ? page.nextPageId
        : null;
    return { ...page, boardX, boardY, nextPageId };
  });
}

function withActivePalette(
  film: Film,
  profile: PaletteProfile,
  palettes = film.palettes,
): Film {
  const nextPalettes = palettes.some((item) => item.id === profile.id)
    ? palettes.map((item) => (item.id === profile.id ? profile : item))
    : [...palettes, profile];
  const ordered = ensurePaletteProfiles(nextPalettes);
  return {
    ...film,
    palettes: ordered,
    activePaletteId: profile.id,
    palette: profile.swatches,
    paletteName: isDefaultPaletteId(profile.id) ? undefined : profile.name,
  };
}

function activeProfile(film: Film): PaletteProfile {
  return (
    film.palettes.find((item) => item.id === film.activePaletteId) ??
    film.palettes.find((item) => isDefaultPaletteId(item.id)) ??
    defaultPaletteProfile()
  );
}

function pickColorForProfile(profile: PaletteProfile): string {
  if (profile.lastColor && profile.swatches.includes(profile.lastColor)) {
    return profile.lastColor;
  }
  if (profile.swatches.includes(color)) {
    return color;
  }
  return profile.swatches[0] ?? "#000000";
}

function rememberColorOnActive(hex: string) {
  const film = memory;
  const profile = activeProfile(film);
  if (profile.lastColor === hex || !profile.swatches.includes(hex)) {
    return;
  }
  memory = withActivePalette(film, { ...profile, lastColor: hex });
  if (clientReady) {
    persist(memory);
  }
}

function migratePalettes(parsed: Partial<Film>): Pick<
  Film,
  "palette" | "paletteName" | "palettes" | "activePaletteId"
> {
  const storedPalette = normalizePalette(parsed.palette) ?? defaultPalette();
  const storedName = normalizePaletteName(parsed.paletteName);
  const rawProfiles = Array.isArray(parsed.palettes)
    ? parsed.palettes
        .map((item) => normalizePaletteProfile(item))
        .filter((item): item is PaletteProfile => item !== null)
    : [];

  if (rawProfiles.length > 0) {
    const palettes = ensurePaletteProfiles(rawProfiles);
    const activeId =
      typeof parsed.activePaletteId === "string" &&
      palettes.some((item) => item.id === parsed.activePaletteId)
        ? parsed.activePaletteId
        : DEFAULT_PALETTE_ID;
    const active =
      palettes.find((item) => item.id === activeId) ?? palettes[0];
    return {
      palettes,
      activePaletteId: active.id,
      palette: active.swatches,
      paletteName: isDefaultPaletteId(active.id) ? undefined : active.name,
    };
  }

  const defaultProfile = defaultPaletteProfile();
  if (!storedName) {
    defaultProfile.swatches = storedPalette;
    return {
      palettes: [defaultProfile],
      activePaletteId: DEFAULT_PALETTE_ID,
      palette: storedPalette,
      paletteName: undefined,
    };
  }

  const theme: PaletteProfile = {
    id: createId("palette"),
    name: storedName,
    swatches: storedPalette,
  };
  return {
    palettes: [defaultProfile, theme],
    activePaletteId: theme.id,
    palette: storedPalette,
    paletteName: storedName,
  };
}

function normalizeFilm(
  parsed: Partial<Film> & {
    width?: number;
    height?: number;
    /** @deprecated legacy storage key */
    tiles?: Partial<Asset>[];
  },
  paperAsEmpty = false,
): Film | null {
  if (!parsed.pages?.length) {
    return null;
  }
  const fallback = landscapeSize(
    parsed.width ?? parsed.pages[0]?.width ?? DEFAULT_WIDTH,
  );
  const assets: Asset[] = [];
  for (const item of parsed.assets ?? parsed.tiles ?? []) {
    const asset = normalizeAsset(item, false);
    if (asset) {
      assets.push(asset);
    }
    if (assets.length >= MAX_ASSETS) {
      break;
    }
  }
  const palettes = migratePalettes(parsed);
  return {
    brief: parsed.brief ?? "",
    pages: sanitizeBoard(parsed.pages.map((page) =>
      migratePage(page, fallback, paperAsEmpty),
    )),
    activeIndex: Math.min(
      Math.max(0, parsed.activeIndex ?? 0),
      parsed.pages.length - 1,
    ),
    ...palettes,
    assets,
  };
}

/** Validate project structure before migration can fill defaults or discard malformed content. */
function isProject(input: unknown): input is Film {
  const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const id = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
  const color = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
  const pixels = (value: unknown, count: number) => Array.isArray(value) && value.length === count && value.every((item) => item === EMPTY || color(item));
  const texts = (value: unknown) => Array.isArray(value) && value.every((mark) => object(mark) && id(mark.id) &&
    typeof mark.body === "string" && integer(mark.x) && integer(mark.y) && color(mark.color) &&
    (mark.font === "inter" || mark.font === "geist-mono") && integer(mark.size) && mark.size >= 1 && mark.size <= 8);
  if (!object(input) || typeof input.brief !== "string" || !Array.isArray(input.pages) || !input.pages.length ||
    !Array.isArray(input.assets) || input.assets.length > MAX_ASSETS || !integer(input.activeIndex) || input.activeIndex < 0 || input.activeIndex >= input.pages.length ||
    !Array.isArray(input.palette) || !input.palette.length || !input.palette.every(color)) return false;
  const assetIds = new Set<string>();
  for (const asset of input.assets) {
    if (!object(asset) || !id(asset.id) || assetIds.has(asset.id) || !id(asset.name) || !integer(asset.width) || !integer(asset.height) ||
      asset.width < 1 || asset.height < 1 || asset.width > MAX_ASSET_SIDE || asset.height > MAX_ASSET_SIDE || !pixels(asset.pixels, asset.width * asset.height)) return false;
    assetIds.add(asset.id);
  }
  const placements = (value: unknown): boolean => Array.isArray(value) && value.every((placement) => object(placement) && id(placement.id) &&
    id(placement.assetId) && assetIds.has(placement.assetId) && integer(placement.x) && integer(placement.y) && integer(placement.width) && integer(placement.height) &&
    placement.width >= 1 && placement.height >= 1 && placement.width <= MAX_WIDTH && placement.height <= MAX_WIDTH &&
    (placement.flipX === undefined || typeof placement.flipX === "boolean") && (placement.flipY === undefined || typeof placement.flipY === "boolean"));
  const pageIds = new Set<string>();
  for (const page of input.pages) {
    if (!object(page) || !id(page.id) || pageIds.has(page.id) || !integer(page.width) || page.width < MIN_WIDTH || page.width > MAX_WIDTH ||
      page.height !== landscapeSize(page.width).height || !pixels(page.pixels, page.width * (page.height as number)) || !texts(page.texts) || !placements(page.placements) ||
      (page.boardX !== undefined && (typeof page.boardX !== "number" || !Number.isFinite(page.boardX))) ||
      (page.boardY !== undefined && (typeof page.boardY !== "number" || !Number.isFinite(page.boardY)))) return false;
    pageIds.add(page.id);
    if (page.layers !== undefined) {
      if (!Array.isArray(page.layers) || !page.layers.length) return false;
      const layerIds = new Set<string>(), placementIds = new Set<string>();
      for (const layer of page.layers) {
        if (!object(layer) || !id(layer.id) || layerIds.has(layer.id) || !id(layer.name) || typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean" ||
          !pixels(layer.pixels, page.width * (page.height as number)) || !texts(layer.texts) || !placements(layer.placements)) return false;
        layerIds.add(layer.id);
        for (const placement of layer.placements as Placement[]) {
          if (placementIds.has(placement.id)) return false;
          placementIds.add(placement.id);
        }
      }
      if (!id(page.activeLayerId) || !layerIds.has(page.activeLayerId)) return false;
    } else if (page.activeLayerId !== undefined) return false;
  }
  for (const page of input.pages) {
    if (page.nextPageId != null && (!id(page.nextPageId) || page.nextPageId === page.id || !pageIds.has(page.nextPageId))) return false;
  }
  if (input.palettes !== undefined) {
    if (!Array.isArray(input.palettes) || !input.palettes.length) return false;
    const paletteIds = new Set<string>();
    for (const profile of input.palettes) {
      if (!object(profile) || !id(profile.id) || paletteIds.has(profile.id) || !id(profile.name) || !Array.isArray(profile.swatches) ||
        !profile.swatches.length || !profile.swatches.every(color) || (profile.lastColor !== undefined && !color(profile.lastColor))) return false;
      paletteIds.add(profile.id);
    }
    if (!id(input.activePaletteId) || !paletteIds.has(input.activePaletteId)) return false;
  }
  return true;
}

function readStored(): Film | null {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) {
      return normalizeFilm(JSON.parse(current) as Partial<Film>, false);
    }
    const compat =
      COMPAT_KEYS.map((key) => window.localStorage.getItem(key)).find(
        Boolean,
      ) ?? null;
    if (compat) {
      return normalizeFilm(JSON.parse(compat) as Partial<Film>, false);
    }
    const legacy =
      LEGACY_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ??
      null;
    if (!legacy) {
      return null;
    }
    const parsed = JSON.parse(legacy) as Partial<Film>;
    return normalizeFilm(
      {
        ...parsed,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      },
      true,
    );
  } catch {
    return null;
  }
}

function commit(next: Film) {
  memory = next;
  if (clientReady) {
    persist(next);
  }
  emit();
}

function activePage(film = memory): Page | null {
  return film.pages[film.activeIndex] ?? null;
}

function pageSnapshot(page: Page): PageUndo {
  const layers = pageLayers(page).map((layer) => ({ ...layer,
    pixels: clonePixels(layer.pixels), placements: clonePlacements(layer.placements),
    texts: layer.texts.map((mark) => ({ ...mark })),
  }));
  const snapshot = withLayers(page, layers);
  return { width: page.width, height: page.height, pixels: snapshot.pixels,
    placements: snapshot.placements, texts: snapshot.texts, layers, activeLayerId: snapshot.activeLayerId };
}

function pushUndo() {
  const page = activePage();
  if (!page) return;
  redos.length = 0;
  undos.push(pageSnapshot(page));
  if (undos.length > UNDO_LIMIT) undos.shift();
}

function pushWorkshopUndo() {
  if (!workshopDraft) return;
  workshopRedos.length = 0;
  workshopUndos.push({ ...workshopDraft, pixels: clonePixels(workshopDraft.pixels) });
  if (workshopUndos.length > UNDO_LIMIT) workshopUndos.shift();
}

function restoreHistory(redo = false): boolean {
  if (workshopOpen) {
    if (!workshopDraft) return false;
    const from = redo ? workshopRedos : workshopUndos;
    const to = redo ? workshopUndos : workshopRedos;
    const previous = from.pop();
    if (!previous) return false;
    to.push({ ...workshopDraft, pixels: clonePixels(workshopDraft.pixels) });
    dropFloating();
    workshopDraft = previous;
    touchWorkshopDraft();
    return true;
  }
  const page = activePage();
  if (!page) return false;
  const from = redo ? redos : undos;
  const to = redo ? undos : redos;
  const previous = from.pop();
  if (!previous) return false;
  to.push(pageSnapshot(page));
  commitLayers({ ...page, ...previous }, previous.layers!, previous.activeLayerId);
  return true;
}

type PaintSurface = {
  pixels: string[];
  size: Size;
  commit: (pixels: string[]) => void;
  pushUndoFn: () => void;
};

function getPaintSurface(): PaintSurface | null {
  if (workshopOpen && workshopDraft) {
    const size = {
      width: workshopDraft.width,
      height: workshopDraft.height,
    };
    return {
      pixels: workshopDraft.pixels,
      size,
      commit: (pixels) => {
        workshopRedos.length = 0;
        const frames = [...workshopDraft!.frames];
        frames[workshopDraft!.frameIndex] = pixels;
        workshopDraft = { ...workshopDraft!, pixels, frames };
        touchWorkshopDraft();
      },
      pushUndoFn: pushWorkshopUndo,
    };
  }
  const page = editablePage();
  if (!page) {
    return null;
  }
  return {
    pixels: page.pixels,
    size: pageSize(page),
    commit: patchActive,
    pushUndoFn: pushUndo,
  };
}

function resizeActiveCanvas(width: number, mode: "scale" | "canvas"): boolean {
  const page = editablePage();
  if (!page || !Number.isFinite(width) || (mode !== "scale" && mode !== "canvas")) return false;
  const size = landscapeSize(width);
  const from = pageSize(page);
  if (size.width === from.width && size.height === from.height) return false;
  const ratioX = size.width / from.width, ratioY = size.height / from.height;
  const layers = pageLayers(page);
  if (layers.some((layer) => layer.locked)) return false;
  const resized = layers.map((layer) => ({ ...layer, texts: [],
    pixels: mode === "scale" ? scaleStamp({ ...from, x: 0, y: 0, pixels: layer.pixels }, size.width, size.height).pixels
      : resizePixels(layer.pixels, from, size),
    placements: layer.placements.map((placement) => mode === "scale" ? { ...placement,
      x: Math.round(placement.x * ratioX), y: Math.round(placement.y * ratioY),
      width: Math.max(1, Math.round(placement.width * ratioX)), height: Math.max(1, Math.round(placement.height * ratioY)),
    } : { ...placement }),
  }));
  if (resized.some((layer) => layer.placements.some((placement) => placement.width > MAX_WIDTH || placement.height > MAX_WIDTH))) return false;
  pushUndo();
  commitLayers({ ...page, ...size }, resized);
  return true;
}

function patchTexts(page: Page, nextTexts: TextMark[], recordUndo = true) {
  if (!editablePage()) return;
  if (recordUndo) {
    pushUndo();
  }
  const size = pageSize(page);
  const pixels = syncTextRuns(page.pixels, size, page.texts, nextTexts);
  patchActivePage({ pixels, texts: nextTexts });
}

function patchActivePage(patch: Partial<Pick<Page, "pixels" | "texts" | "width" | "height" | "placements">>) {
  const film = memory;
  const page = editablePage();
  if (!page) return;
  redos.length = 0;
  const active = activePageLayer(page);
  const layers = pageLayers(page).map((layer) => layer.id === active.id ? {
    ...layer, pixels: patch.pixels ?? layer.pixels,
    texts: patch.texts ?? layer.texts, placements: patch.placements ?? layer.placements,
  } : layer);
  commit({ ...film, pages: film.pages.map((item, index) => index === film.activeIndex
    ? withLayers({ ...item, ...patch }, layers) : item) });
}

function patchActive(pixels: string[]) {
  patchActivePage({ pixels });
}

function getSnapshot() {
  return memory;
}

function getServerSnapshot() {
  return SEED;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!clientReady && typeof window !== "undefined") {
    queueMicrotask(() => {
      if (clientReady) {
        return;
      }
      clientReady = true;
      memory = readStored() ?? SEED;
      color = pickColorForProfile(activeProfile(memory));
      emit();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

function liveSize(): Size {
  const page = activePage();
  if (!page) {
    return landscapeSize(DEFAULT_WIDTH);
  }
  return pageSize(page);
}

function clearSelection() {
  selectedId = null;
  selectedKind = null;
}

function clearPlacementSelection() {
  selectedPlacementId = null;
}

function dropFloating() {
  floating = null;
}

function clampStampOrigin(stamp: PixelStamp, size: Size): PixelStamp {
  return {
    ...stamp,
    x: Math.max(0, Math.min(stamp.x, size.width - stamp.width)),
    y: Math.max(0, Math.min(stamp.y, size.height - stamp.height)),
  };
}

function placeStamp(
  stamp: PixelStamp,
  keepFloating: boolean,
): PixelStamp | null {
  const page = editablePage();
  if (!page) {
    return null;
  }
  const size = liveSize();
  const placed = clampStampOrigin(stamp, size);
  pushUndo();
  const under = sampleUnder(page.pixels, size, placed);
  floating = keepFloating ? { ...placed, under } : null;
  patchActive(blitStamp(page.pixels, size, placed));
  return placed;
}

function assetById(id: string): Asset | undefined {
  return getSnapshot().assets.find((item) => item.id === id);
}

function stampFromAsset(
  asset: Asset,
  x: number,
  y: number,
  destWidth?: number,
  destHeight?: number,
): PixelStamp {
  const base: PixelStamp = {
    x,
    y,
    width: asset.width,
    height: asset.height,
    pixels: asset.pixels,
  };
  if (destWidth == null && destHeight == null) {
    return base;
  }
  const targetW = destWidth ?? asset.width;
  const targetH = destHeight ?? asset.height;
  const scale = Math.max(targetW / asset.width, targetH / asset.height);
  const width = Math.max(1, Math.round(asset.width * scale));
  const height = Math.max(1, Math.round(asset.height * scale));
  return scaleStamp(base, width, height);
}

function editPlacement(id: string, edit: (placements: Placement[], index: number) => Placement[] | null): boolean {
  const page = editablePage();
  if (!page) return false;
  const index = page.placements.findIndex((placement) => placement.id === id);
  if (index < 0) return false;
  const placements = edit(page.placements, index);
  if (!placements) return false;
  pushUndo();
  dropFloating();
  patchActivePage({ placements });
  return true;
}

function removePlacement(id: string): boolean {
  const removed = editPlacement(id, (placements) => placements.filter((placement) => placement.id !== id));
  if (removed && selectedPlacementId === id) { clearPlacementSelection(); emit(); }
  return removed;
}

function duplicatePlacement(id: string): Placement | null {
  let copy: Placement | null = null;
  const edited = editPlacement(id, (placements, index) => {
    const original = placements[index];
    copy = clampPlacementOrigin({ ...original, id: createId("place"), x: original.x + 1, y: original.y + 1 }, liveSize());
    const next = [...placements];
    next.splice(index + 1, 0, copy);
    return next;
  });
  if (!edited || !copy) return null;
  selectedPlacementId = (copy as Placement).id;
  selectedAssetId = null;
  emit();
  return copy;
}

function copySelection(): boolean {
  if (floating) {
    clipboard = { ...floating, pixels: clonePixels(floating.pixels) };
    return true;
  }
  const placement = activePage()?.placements.find((item) => item.id === selectedPlacementId);
  const asset = placement && assetById(placement.assetId);
  if (!placement || !asset) return false;
  const stamp = placementStamp(placement, asset);
  clipboard = { ...stamp, pixels: clonePixels(stamp.pixels) };
  return true;
}

function deleteSelection(): boolean {
  if (selectedPlacementId && !workshopOpen) return removePlacement(selectedPlacementId);
  const surface = getPaintSurface();
  if (!surface || !floating) return false;
  surface.pushUndoFn();
  const pixels = restoreUnder(surface.pixels, surface.size, floating, floating.under);
  dropFloating();
  surface.commit(pixels);
  return true;
}

function pasteSelection(): boolean {
  const surface = getPaintSurface();
  if (!surface || !clipboard) return false;
  const stamp = clampStampOrigin({ ...clipboard, x: clipboard.x + 1, y: clipboard.y + 1,
    pixels: clonePixels(clipboard.pixels) }, surface.size);
  surface.pushUndoFn();
  clearSelection();
  clearPlacementSelection();
  selectedAssetId = null;
  floating = { ...stamp, under: sampleUnder(surface.pixels, surface.size, stamp) };
  surface.commit(blitStamp(surface.pixels, surface.size, stamp));
  return true;
}

function createApi(
  _film: Film,
  currentTool: DrawTool,
  currentColor: string,
  currentFrame: TextFrame,
  currentFont: TextFont,
  currentSize: TextSize,
  currentFilled: boolean,
  currentBrushSize: BrushSize,
  _currentAssetId: string | null,
  _currentSelectedId: string | null,
  _currentSelectedKind: MarkKind | null,
  _currentFloating: FloatingPixels | null,
  _currentPlacementId: string | null,
): FilmApi {
  return {
    get film() {
      return getSnapshot();
    },
    get tool() {
      return tool;
    },
    get color() {
      return color;
    },
    get frame() {
      return frame;
    },
    get textFont() {
      return textFont;
    },
    get textSize() {
      return textSize;
    },
    get shapeFilled() {
      return shapeFilled;
    },
    get brushSize() {
      return brushSize;
    },
    get stageZoom() {
      return stageZoom;
    },
    get selectedAssetId() {
      return selectedAssetId;
    },
    get workshopOpen() {
      return workshopOpen;
    },
    get workshopDraft() {
      return workshopDraft;
    },
    get floating() {
      return floating;
    },
    get selectedId() {
      return selectedId;
    },
    get selectedKind() {
      return selectedKind;
    },
    get selectedPlacementId() {
      return selectedPlacementId;
    },
    get active() {
      return activePage();
    },
    get canUndo() { return workshopOpen ? workshopUndos.length > 0 : undos.length > 0; },
    get canRedo() { return workshopOpen ? workshopRedos.length > 0 : redos.length > 0; },
    setTool: (next) => {
      selectedAssetId = null;
      if (next === tool) {
        emit();
        return;
      }
      if (next !== "move" && next !== "select") {
        dropFloating();
      }
      tool = next;
      switch (next) {
        case "text":
          if (selectedKind !== "text") {
            clearSelection();
          }
          clearPlacementSelection();
          selectedAssetId = null;
          break;
        case "shape":
          clearSelection();
          clearPlacementSelection();
          selectedAssetId = null;
          break;
        case "move":
        case "select":
          clearSelection();
          break;
        case "pencil":
        case "eraser":
        case "fill":
        case "line":
          clearSelection();
          clearPlacementSelection();
          break;
        default:
          return assertNever(next, "Unknown tool");
      }
      emit();
    },
    setColor: (next) => {
      color = hexColor(next, currentColor);
      rememberColorOnActive(color);
      const page = activePage();
      if (page && selectedId && selectedKind === "text") {
        patchTexts(
          page,
          page.texts.map((mark) =>
            mark.id === selectedId ? { ...mark, color } : mark,
          ),
        );
        return;
      }
      emit();
    },
    setFrame: (next) => {
      frame = next;
      selectedAssetId = null;
      emit();
    },
    setTextFont: (next) => {
      textFont = next;
      const page = activePage();
      if (page && selectedId && selectedKind === "text") {
        patchTexts(
          page,
          page.texts.map((mark) =>
            mark.id === selectedId ? { ...mark, font: next } : mark,
          ),
        );
        return;
      }
      emit();
    },
    setTextSize: (next) => {
      textSize = normalizeTextSize(next);
      const page = activePage();
      if (page && selectedId && selectedKind === "text") {
        patchTexts(
          page,
          page.texts.map((mark) =>
            mark.id === selectedId ? { ...mark, size: next } : mark,
          ),
        );
        return;
      }
      emit();
    },
    setShapeFilled: (next) => {
      shapeFilled = next;
      emit();
    },
    setBrushSize: (next) => {
      brushSize = normalizeBrushSize(next);
      emit();
    },
    setStageZoom: (next) => {
      const normalized = normalizeStageZoom(next);
      if (normalized === stageZoom) {
        return;
      }
      stageZoom = normalized;
      emit();
    },
    stepStageZoom: (direction) => {
      const next = stepStageZoomValue(stageZoom, direction);
      if (next === stageZoom) {
        return;
      }
      stageZoom = next;
      emit();
    },
    resetStageZoom: () => {
      if (stageZoom === DEFAULT_STAGE_ZOOM) {
        return;
      }
      stageZoom = DEFAULT_STAGE_ZOOM;
      emit();
    },
    selectAsset: (id) => {
      if (!id) {
        selectedAssetId = null;
        emit();
        return true;
      }
      if (!assetById(id)) {
        return false;
      }
      if (selectedAssetId === id) {
        selectedAssetId = null;
        emit();
        return true;
      }
      selectedAssetId = id;
      dropFloating();
      emit();
      return true;
    },
    openWorkshop: (assetId) => {
      const current = getSnapshot();
      dropFloating();
      workshopUndos.length = 0;
      workshopRedos.length = 0;
      if (assetId) {
        const asset = assetById(assetId);
        if (!asset) {
          return false;
        }
        workshopDraft = {
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
          pixels: clonePixels(asset.pixels),
          frames: (asset.frames?.length ? asset.frames : [asset.pixels]).map(clonePixels),
          frameIndex: 0,
          frameDuration: asset.frameDuration ?? 400,
        };
      } else {
        if (current.assets.length >= MAX_ASSETS) {
          return false;
        }
        workshopDraft = {
          id: null,
          name: `Asset ${current.assets.length + 1}`,
          width: DEFAULT_ASSET_WIDTH,
          height: DEFAULT_ASSET_HEIGHT,
          pixels: emptyPixels(DEFAULT_ASSET_WIDTH, DEFAULT_ASSET_HEIGHT),
          frames: [emptyPixels(DEFAULT_ASSET_WIDTH, DEFAULT_ASSET_HEIGHT)],
          frameIndex: 0,
          frameDuration: 400,
        };
      }
      workshopOpen = true;
      selectedAssetId = null;
      touchWorkshopDraft();
      return true;
    },
    closeWorkshop: (save = true) => {
      if (!workshopOpen) {
        return false;
      }
      if (save && workshopDraft) {
        const asset = normalizeAsset(
          {
            id: workshopDraft.id ?? undefined,
            name: workshopDraft.name,
            width: workshopDraft.width,
            height: workshopDraft.height,
            pixels: workshopDraft.pixels,
            frames: workshopDraft.frames,
            frameDuration: workshopDraft.frameDuration,
          },
          false,
        );
        if (asset) {
          const current = getSnapshot();
          if (workshopDraft.id) {
            commit({
              ...current,
              assets: current.assets.map((item) =>
                item.id === workshopDraft!.id ? asset : item,
              ),
            });
            selectedAssetId = asset.id;
          } else if (current.assets.length < MAX_ASSETS) {
            commit({
              ...current,
              assets: [...current.assets, asset],
            });
            selectedAssetId = asset.id;
          }
        }
      }
      workshopOpen = false;
      workshopDraft = null;
      workshopUndos.length = 0;
      workshopRedos.length = 0;
      dropFloating();
      touchWorkshopDraft();
      return true;
    },
    setWorkshopName: (name) => {
      if (!workshopDraft) {
        return;
      }
      const nextName = name.trim().slice(0, MAX_ASSET_NAME) || workshopDraft.name;
      if (nextName === workshopDraft.name) return;
      pushWorkshopUndo();
      workshopDraft = { ...workshopDraft, name: nextName };
      touchWorkshopDraft();
    },
    setWorkshopSize: (size) => {
      if (!workshopDraft) {
        return false;
      }
      const next = Math.max(8, Math.min(MAX_ASSET_SIDE, Math.round(size)));
      if (next === workshopDraft.width && next === workshopDraft.height) {
        return true;
      }
      pushWorkshopUndo();
      workshopDraft = {
        ...workshopDraft,
        width: next,
        height: next,
        frames: workshopDraft.frames.map(frame => resizePixels(frame,
          { width: workshopDraft!.width, height: workshopDraft!.height }, { width: next, height: next })),
        pixels: resizePixels(workshopDraft.pixels,
          { width: workshopDraft.width, height: workshopDraft.height }, { width: next, height: next }),
      };
      dropFloating();
      touchWorkshopDraft();
      return true;
    },
    addWorkshopFrame: () => {
      if (!workshopDraft) return;
      const frame = clonePixels(workshopDraft.pixels);
      const frames = [...workshopDraft.frames];
      frames.splice(workshopDraft.frameIndex + 1, 0, frame);
      workshopDraft = { ...workshopDraft, frames, frameIndex: workshopDraft.frameIndex + 1, pixels: frame };
      touchWorkshopDraft();
    },
    removeWorkshopFrame: () => {
      if (!workshopDraft || workshopDraft.frames.length <= 1) return;
      const frames = workshopDraft.frames.filter((_, index) => index !== workshopDraft!.frameIndex);
      const frameIndex = Math.min(workshopDraft.frameIndex, frames.length - 1);
      workshopDraft = { ...workshopDraft, frames, frameIndex, pixels: clonePixels(frames[frameIndex]) };
      touchWorkshopDraft();
    },
    selectWorkshopFrame: (index) => {
      if (!workshopDraft || !workshopDraft.frames[index]) return;
      workshopDraft = { ...workshopDraft, frameIndex: index, pixels: clonePixels(workshopDraft.frames[index]) };
      touchWorkshopDraft();
    },
    selectMark: (id, kind) => {
      if (!id) {
        clearSelection();
        emit();
        return true;
      }
      const page = activePage();
      if (!page) {
        return false;
      }
      const want = kind ?? (page.texts.some((mark) => mark.id === id) ? "text" : null);
      if (want === "text") {
        const mark = page.texts.find((item) => item.id === id);
        if (!mark) {
          return false;
        }
        selectedId = id;
        selectedKind = "text";
        tool = "text";
        textFont = mark.font;
        textSize = mark.size;
        color = mark.color;
        dropFloating();
        clearPlacementSelection();
        emit();
        return true;
      }
      return false;
    },
    selectPlacement: (id) => {
      if (!id) {
        clearPlacementSelection();
        emit();
        return true;
      }
      const page = activePage();
      if (!page?.placements.some((placement) => placement.id === id)) {
        return false;
      }
      selectedPlacementId = id;
      selectedAssetId = null;
      clearSelection();
      dropFloating();
      emit();
      return true;
    },
    movePlacement: (id, x, y, recordUndo = false) => {
      if (![x, y].every(Number.isFinite)) return false;
      const page = editablePage();
      if (!page) {
        return false;
      }
      const current = page.placements.find((placement) => placement.id === id);
      if (!current) {
        return false;
      }
      const next = clampPlacementOrigin(
        { ...current, x: Math.round(x), y: Math.round(y) },
        liveSize(),
      );
      if (next.x === current.x && next.y === current.y) {
        return false;
      }
      if (recordUndo) {
        pushUndo();
      }
      selectedPlacementId = id;
      patchActivePage({
        placements: page.placements.map((placement) =>
          placement.id === id ? next : placement,
        ),
      });
      return true;
    },
    removePlacement,
    duplicatePlacement,
    resizePlacement: (id, width, height) => {
      if (![width, height].every(Number.isFinite) || width < 1 || height < 1) return false;
      return editPlacement(id, (placements, index) => {
        const current = placements[index];
        const ratio = Math.min(width / current.width, height / current.height);
        const nextWidth = Math.max(1, Math.round(current.width * ratio));
        const nextHeight = Math.max(1, Math.round(current.height * ratio));
        if (nextWidth > MAX_WIDTH || nextHeight > MAX_WIDTH || (nextWidth === current.width && nextHeight === current.height)) return null;
        return placements.map((placement, i) => i === index ? clampPlacementOrigin({ ...placement, width: nextWidth, height: nextHeight }, liveSize()) : placement);
      });
    },
    flipPlacement: (id, axis) => {
      if (axis !== "x" && axis !== "y") return false;
      const key = axis === "x" ? "flipX" : "flipY";
      return editPlacement(id, (placements, index) => placements.map((placement, i) => i === index ? { ...placement, [key]: !placement[key] } : placement));
    },
    reorderPlacement: (id, direction) => {
      if (direction !== -1 && direction !== 1) return false;
      return editPlacement(id, (placements, index) => {
        const target = index + direction;
        if (target < 0 || target >= placements.length) return null;
        const next = [...placements];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    },
    movePlacementToLayer: (id, layerId) => {
      const page = editablePage();
      if (!page || activePageLayer(page).id === layerId) return false;
      const placement = page.placements.find((item) => item.id === id);
      const target = pageLayers(page).find((layer) => layer.id === layerId);
      if (!placement || !target || target.locked || !target.visible) return false;
      pushUndo();
      commitLayers(page, pageLayers(page).map((layer) => layer.id === layerId
        ? { ...layer, placements: [...layer.placements, placement] }
        : { ...layer, placements: layer.placements.filter((item) => item.id !== id) }), layerId);
      selectedPlacementId = id;
      emit();
      return true;
    },
    copySelection,
    deleteSelection,
    pasteSelection,
    cutSelection: () => copySelection() && deleteSelection(),
    duplicateSelection: () => selectedPlacementId && !workshopOpen
      ? Boolean(duplicatePlacement(selectedPlacementId)) : copySelection() && pasteSelection(),
    setBrief: (brief) => {
      commit({ ...getSnapshot(), brief });
    },
    setPalette: (colors, name) => {
      const current = getSnapshot();
      const next = colors ? normalizePalette(colors) : null;
      const label = normalizePaletteName(name);

      if (!next) {
        if (!label) {
          return false;
        }
        const match = findPaletteByName(current.palettes, label);
        if (!match) {
          return false;
        }
        color = pickColorForProfile(match);
        commit(withActivePalette(current, match));
        return true;
      }

      let target: PaletteProfile;
      if (label && !isReservedPaletteName(label)) {
        const existing = findPaletteByName(current.palettes, label);
        target = existing
          ? { ...existing, name: label, swatches: next }
          : {
              id: createId("palette"),
              name: label,
              swatches: next,
            };
      } else {
        const active = activeProfile(current);
        if (!isDefaultPaletteId(active.id)) {
          target = { ...active, swatches: next };
        } else {
          target = {
            id: createId("palette"),
            name: nextThemeName(current.palettes),
            swatches: next,
          };
        }
      }

      if (!next.includes(color)) {
        color = next[0];
      }
      target = { ...target, lastColor: color };
      commit(withActivePalette(current, target));
      return true;
    },
    selectPalette: (id) => {
      const current = getSnapshot();
      const profile = current.palettes.find((item) => item.id === id);
      if (!profile) {
        return false;
      }
      color = pickColorForProfile(profile);
      commit(withActivePalette(current, { ...profile, lastColor: color }));
      return true;
    },
    addPaletteProfile: (name) => {
      const current = getSnapshot();
      const requested = normalizePaletteName(name);
      const label = requested
        ? usablePaletteName(requested, current.palettes)
        : nextThemeName(current.palettes);
      if (!label) {
        return null;
      }
      const source = activeProfile(current);
      const profile: PaletteProfile = {
        id: createId("palette"),
        name: label,
        swatches: [...source.swatches],
        lastColor: source.swatches.includes(color) ? color : source.swatches[0],
      };
      color = pickColorForProfile(profile);
      commit(withActivePalette(current, profile));
      return profile;
    },
    renamePalette: (id, name) => {
      const current = getSnapshot();
      const profile = current.palettes.find((item) => item.id === id);
      if (!profile || isDefaultPaletteId(profile.id)) {
        return false;
      }
      const label = usablePaletteName(name, current.palettes, profile.id);
      if (!label) {
        return false;
      }
      if (label === profile.name) {
        return true;
      }
      commit(withActivePalette(current, { ...profile, name: label }));
      return true;
    },
    addSwatch: (value) => {
      const hex = parseHex(value);
      if (!hex) {
        return false;
      }
      color = hex;
      const current = getSnapshot();
      const active = activeProfile(current);
      const swatches = active.swatches.includes(hex)
        ? active.swatches
        : [...active.swatches, hex];
      commit(
        withActivePalette(current, {
          ...active,
          swatches,
          lastColor: hex,
        }),
      );
      return true;
    },
    resetPalette: () => {
      const current = getSnapshot();
      const restored: PaletteProfile = {
        ...defaultPaletteProfile(),
        lastColor: defaultPalette()[0],
      };
      color = pickColorForProfile(restored);
      const palettes = current.palettes.map((item) =>
        isDefaultPaletteId(item.id) ? restored : item,
      );
      commit(withActivePalette(current, restored, palettes));
    },
    addLayer: () => {
      const page = activePage();
      if (!page) return null;
      const layers = pageLayers(page);
      const layer: PageLayer = { id: createId("layer"), name: `Layer ${layers.length + 1}`,
        visible: true, locked: false, opacity: 1, pixels: emptyPixels(page.width, page.height), placements: [], texts: [] };
      pushUndo();
      commitLayers(page, [...layers, layer], layer.id);
      return layer;
    },
    removeLayer: (id) => {
      const page = activePage();
      if (!page) return false;
      const layers = pageLayers(page);
      const index = layers.findIndex(layer => layer.id === id);
      if (layers.length <= 1 || index < 0 || layers[index].locked) return false;
      const remaining = layers.filter(layer => layer.id !== id);
      const selected = activePageLayer(page).id;
      pushUndo();
      commitLayers(page, remaining, selected === id ? remaining[Math.max(0, index - 1)].id : selected);
      return true;
    },
    duplicateLayer: (id) => {
      const page = activePage();
      if (!page) return null;
      const layers = pageLayers(page);
      const index = layers.findIndex((layer) => layer.id === id);
      if (index < 0) return null;
      const source = layers[index];
      const copy = { ...source, id: createId("layer"), name: `${source.name} copy`.slice(0, 80), locked: false,
        pixels: clonePixels(source.pixels), placements: source.placements.map((placement) => ({ ...placement, id: createId("place") })),
        texts: source.texts.map((mark) => ({ ...mark, id: createId("text") })) };
      const next = [...layers];
      next.splice(index + 1, 0, copy);
      pushUndo();
      commitLayers(page, next, copy.id);
      return copy;
    },
    mergeLayerDown: (id) => {
      const page = activePage();
      if (!page) return false;
      const layers = pageLayers(page);
      const index = layers.findIndex((layer) => layer.id === id);
      if (index < 1) return false;
      const source = layers[index], below = layers[index - 1];
      if (source.locked || below.locked || !source.visible || !below.visible) return false;
      const size = pageSize(page);
      const bottomPixels = compositePage(below.pixels, size, below.placements, assetById);
      const topPixels = compositePage(source.pixels, size, source.placements, assetById);
      const merged = { ...below, pixels: blitStamp(bottomPixels, size, { ...size, x: 0, y: 0, pixels: topPixels }), placements: [], texts: [] };
      const next = layers.filter((_, i) => i !== index).map((layer) => layer.id === below.id ? merged : layer);
      pushUndo();
      commitLayers(page, next, below.id);
      return true;
    },
    selectLayer: (id) => {
      const page = activePage();
      if (!page || !pageLayers(page).some((layer) => layer.id === id)) return false;
      commitLayers(page, pageLayers(page), id);
      return true;
    },
    updateLayer: (id, patch) => {
      const page = activePage();
      const layer = page && pageLayers(page).find((item) => item.id === id);
      if (!page || !layer) return false;
      if (patch.name !== undefined && (typeof patch.name !== "string" || !patch.name.trim())) return false;
      if (patch.visible !== undefined && typeof patch.visible !== "boolean") return false;
      if (patch.locked !== undefined && typeof patch.locked !== "boolean") return false;
      if (patch.opacity !== undefined && (!Number.isFinite(patch.opacity) || patch.opacity < 0 || patch.opacity > 1)) return false;
      const next = { ...layer, name: patch.name?.trim().slice(0, 80) ?? layer.name,
        visible: patch.visible ?? layer.visible, locked: patch.locked ?? layer.locked, opacity: patch.opacity ?? layer.opacity };
      if (next.name === layer.name && next.visible === layer.visible && next.locked === layer.locked && next.opacity === layer.opacity) return false;
      pushUndo();
      commitLayers(page, pageLayers(page).map((item) => item.id === id ? next : item));
      return true;
    },
    moveLayer: (id, direction) => {
      const page = activePage();
      if (!page || (direction !== -1 && direction !== 1)) return false;
      const layers = [...pageLayers(page)];
      const index = layers.findIndex((layer) => layer.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= layers.length) return false;
      pushUndo();
      [layers[index], layers[target]] = [layers[target], layers[index]];
      commitLayers(page, layers);
      return true;
    },
    flattenLayer: () => {
      const page = editablePage();
      if (!page || !page.placements.length) return false;
      const pixels = compositePage(page.pixels, pageSize(page), page.placements, assetById);
      pushUndo();
      clearLayerSelection();
      patchActivePage({ pixels, placements: [] });
      return true;
    },
    setDensity: (width) => { resizeActiveCanvas(width, "scale"); },
    resizeCanvas: resizeActiveCanvas,
    importProject: (input) => {
      if (!isProject(input)) return false;
      const imported = normalizeFilm(input);
      if (!imported) return false;
      undos.length = 0;
      redos.length = 0;
      workshopUndos.length = 0;
      workshopRedos.length = 0;
      workshopOpen = false;
      workshopDraft = null;
      clearLayerSelection();
      clipboard = null;
      color = pickColorForProfile(activeProfile(imported));
      commit(imported);
      touchWorkshopDraft();
      return true;
    },
    addPage: (input = {}) => {
      const current = getSnapshot();
      const size = liveSize();
      const page = blankPage(size);
      if (input.draw?.trim()) {
        page.pixels = paintScene(input.draw.trim(), size);
      }
      if (input.story?.trim()) {
        const storyMark = {
          id: createId("text"),
          x: normalizeTextCoord(0.08, size.width),
          y: normalizeTextCoord(0.78, size.height),
          body: input.story.trim(),
          color: currentColor,
          font: currentFont,
          size: currentSize,
        };
        page.pixels = rasterizeTextRun(page.pixels, size, storyMark);
      }
      const position = defaultBoardPosition(current.pages.length);
      page.boardX = position.x;
      page.boardY = position.y;
      const pages = [...current.pages, page];
      undos.length = 0;
      redos.length = 0;
      clearLayerSelection();
      commit({
        ...current,
        pages,
        activeIndex: pages.length - 1,
      });
      return page;
    },
    duplicatePage: (index) => {
      const current = getSnapshot();
      const source = current.pages[index];
      if (!source) return null;
      const sourceLayers = pageLayers(source);
      const activeIndex = sourceLayers.findIndex(layer => layer.id === source.activeLayerId);
      const layers = sourceLayers.map((layer): PageLayer => ({ ...layer, id: createId("layer"),
        pixels: clonePixels(layer.pixels), placements: layer.placements.map(item => ({ ...item, id: createId("place") })),
        texts: layer.texts.map(item => ({ ...item, id: createId("text") })) }));
      const copy = withLayers({ ...source, id: createId("page"), boardX: source.boardX + 40, boardY: source.boardY + 40,
        pixels: [], placements: [], texts: [] }, layers, layers[Math.max(0, activeIndex)]?.id);
      const pages = [...current.pages];
      pages.splice(index + 1, 0, copy);
      undos.length = 0;
      redos.length = 0;
      clearLayerSelection();
      commit({ ...current, pages, activeIndex: index + 1 });
      return copy;
    },
    selectPage: (index) => {
      const current = getSnapshot();
      if (index < 0 || index >= current.pages.length) {
        return false;
      }
      undos.length = 0;
      redos.length = 0;
      clearSelection();
      clearPlacementSelection();
      dropFloating();
      commit({ ...current, activeIndex: index });
      return true;
    },
    removePage: (index) => {
      const current = getSnapshot();
      if (
        current.pages.length <= 1 ||
        index < 0 ||
        index >= current.pages.length
      ) {
        return false;
      }
      const removed = current.pages[index];
      const pages = current.pages
        .filter((_, i) => i !== index)
        .map((item) =>
          item.nextPageId === removed.id
            ? { ...item, nextPageId: removed.nextPageId ?? null }
            : item,
        );
      undos.length = 0;
      redos.length = 0;
      dropFloating();
      clearPlacementSelection();
      commit({
        ...current,
        pages,
        activeIndex: Math.min(current.activeIndex, pages.length - 1),
      });
      return true;
    },
    reorderPage: (id, index) => {
      const current = getSnapshot();
      const from = current.pages.findIndex((page) => page.id === id);
      if (from < 0 || index < 0 || index >= current.pages.length) return false;
      if (from === index) return true;
      const pages = [...current.pages];
      const [page] = pages.splice(from, 1);
      pages.splice(index, 0, page);
      undos.length = 0;
      redos.length = 0;
      clearSelection();
      clearPlacementSelection();
      dropFloating();
      commit({ ...current, pages, activeIndex: index });
      return true;
    },
    movePage: (id, x, y) => {
      const current = getSnapshot();
      const page = current.pages.find((item) => item.id === id);
      if (!page) {
        return false;
      }
      const nextX = Math.round(x);
      const nextY = Math.round(y);
      if (page.boardX === nextX && page.boardY === nextY) {
        return true;
      }
      commit({
        ...current,
        pages: current.pages.map((item) =>
          item.id === id ? { ...item, boardX: nextX, boardY: nextY } : item,
        ),
      });
      return true;
    },
    linkPages: (fromId, toId) => {
      const current = getSnapshot();
      const from = current.pages.find((item) => item.id === fromId);
      if (!from) {
        return false;
      }
      if (toId !== null) {
        if (toId === fromId || !current.pages.some((item) => item.id === toId)) {
          return false;
        }
      }
      if ((from.nextPageId ?? null) === toId) {
        return true;
      }
      commit({
        ...current,
        pages: current.pages.map((item) =>
          item.id === fromId ? { ...item, nextPageId: toId } : item,
        ),
      });
      return true;
    },
    addText: (input) => {
      const page = editablePage();
      if (!page) {
        return null;
      }
      dropFloating();
      const size = pageSize(page);
      const mark: TextMark = {
        id: createId("text"),
        x: normalizeTextCoord(input.x, size.width),
        y: normalizeTextCoord(input.y, size.height),
        body: input.body ?? "",
        color: hexColor(input.color, currentColor),
        font: input.font ? normalizeFont(input.font) : DEFAULT_TEXT_FONT,
        size: input.size ? normalizeTextSize(input.size) : currentSize,
      };
      selectedId = mark.id;
      selectedKind = "text";
      tool = "text";
      patchTexts(page, [...page.texts, mark]);
      return mark;
    },
    stampShape: (input) => {
      const kind: ShapeKind =
        input.kind != null ? normalizeFrame(input.kind) : currentFrame;
      const stamp = rasterizeShape(
        kind,
        input.x0,
        input.y0,
        input.x1,
        input.y1,
        hexColor(input.color, currentColor),
        input.filled ?? currentFilled,
      );
      return placeStamp(stamp, input.keepFloating ?? true);
    },
    liftMarquee: (x, y, width, height) => {
      const surface = getPaintSurface();
      if (!surface) {
        return false;
      }
      const { pixels, size, commit, pushUndoFn } = surface;
      const box = {
        x: Math.max(0, Math.floor(x)),
        y: Math.max(0, Math.floor(y)),
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      };
      box.width = Math.min(box.width, size.width - box.x);
      box.height = Math.min(box.height, size.height - box.y);
      if (box.width < 1 || box.height < 1) {
        return false;
      }
      pushUndoFn();
      const stamp = extractStamp(pixels, size, box.x, box.y, box.width, box.height);
      const hole = fillRect(
        pixels,
        size,
        box.x,
        box.y,
        box.width,
        box.height,
        EMPTY,
      );
      const under = stamp.pixels.map(() => EMPTY);
      floating = { ...stamp, under };
      selectedAssetId = null;
      clearPlacementSelection();
      commit(blitStamp(hole, size, stamp));
      return true;
    },
    moveFloating: (x, y, recordUndo = false) => {
      const surface = getPaintSurface();
      if (!surface || !floating) {
        return false;
      }
      const { pixels, size, commit, pushUndoFn } = surface;
      const next = clampStampOrigin(
        { ...floating, x: Math.round(x), y: Math.round(y) },
        size,
      );
      if (next.x === floating.x && next.y === floating.y) {
        return false;
      }
      if (recordUndo) {
        pushUndoFn();
      }
      const restored = restoreUnder(pixels, size, floating, floating.under);
      const under = sampleUnder(restored, size, next);
      floating = { ...next, under };
      commit(blitStamp(restored, size, next));
      return true;
    },
    anchorFloating: () => {
      if (!floating) {
        return;
      }
      dropFloating();
      emit();
    },
    addAsset: (input) => {
      const current = getSnapshot();
      if (current.assets.length >= MAX_ASSETS) {
        return null;
      }
      const name = input.name.trim().slice(0, MAX_ASSET_NAME);
      if (!name) {
        return null;
      }
      if (input.pixels && input.width && input.height) {
        const asset = normalizeAsset({
          name,
          width: input.width,
          height: input.height,
          pixels: input.pixels,
        }, false);
        if (!asset) {
          return null;
        }
        commit({ ...current, assets: [...current.assets, asset] });
        return asset;
      }
      const pageIndex = input.pageIndex ?? current.activeIndex;
      const page = current.pages[pageIndex];
      if (!page || input.x == null || input.y == null || !input.width || !input.height) {
        return null;
      }
      const size = pageSize(page);
      const box = {
        x: Math.max(0, Math.floor(input.x)),
        y: Math.max(0, Math.floor(input.y)),
        width: Math.max(1, Math.floor(input.width)),
        height: Math.max(1, Math.floor(input.height)),
      };
      box.width = Math.min(box.width, size.width - box.x, MAX_ASSET_SIDE);
      box.height = Math.min(box.height, size.height - box.y, MAX_ASSET_SIDE);
      if (box.width < 1 || box.height < 1) {
        return null;
      }
      const stamp = extractStamp(
        compositedPagePixels(page, current.assets),
        size,
        box.x,
        box.y,
        box.width,
        box.height,
      );
      const asset = normalizeAsset({
        name,
        width: stamp.width,
        height: stamp.height,
        pixels: stamp.pixels,
      }, false);
      if (!asset) {
        return null;
      }
      commit({ ...current, assets: [...current.assets, asset] });
      return asset;
    },
    addAssetFromFloating: (name) => {
      if (!floating) {
        return null;
      }
      const current = getSnapshot();
      if (current.assets.length >= MAX_ASSETS) {
        return null;
      }
      const asset = normalizeAsset({
        name,
        width: floating.width,
        height: floating.height,
        pixels: floating.pixels,
      }, false);
      if (!asset) {
        return null;
      }
      commit({ ...current, assets: [...current.assets, asset] });
      return asset;
    },
    removeAsset: (id) => {
      const current = getSnapshot();
      if (!current.assets.some((item) => item.id === id)) {
        return false;
      }
      if (selectedAssetId === id) {
        selectedAssetId = null;
      }
      const page = activePage();
      if (
        selectedPlacementId &&
        page?.placements.some(
          (placement) =>
            placement.id === selectedPlacementId && placement.assetId === id,
        )
      ) {
        clearPlacementSelection();
      }
      commit({
        ...current,
        assets: current.assets.filter((item) => item.id !== id),
        pages: current.pages.map((item) => withLayers(item, pageLayers(item).map((layer) => ({
          ...layer, placements: layer.placements.filter((placement) => placement.assetId !== id),
        })))),
      });
      return true;
    },
    getAsset: (id) => assetById(id) ?? null,
    drawAssetPixels: (id, dots, frameIndex = 0, frameDuration) => {
      const current = getSnapshot();
      const asset = assetById(id);
      if (!asset || frameIndex < 0 || frameIndex > (asset.frames?.length ?? 1)) {
        return 0;
      }
      const size = { width: asset.width, height: asset.height };
      const frames = (asset.frames?.length ? asset.frames : [asset.pixels]).map(clonePixels);
      if (frameIndex === frames.length) frames.push(clonePixels(frames.at(-1)!));
      frames[frameIndex] = setPixels(frames[frameIndex]!, size, dots);
      const painted = dots.filter((dot) => inBounds(dot.x, dot.y, size)).length;
      commit({
        ...current,
        assets: current.assets.map((item) =>
          item.id === id ? {
            ...item,
            pixels: frames[0]!,
            frames: frames.length > 1 ? frames : undefined,
            frameDuration: frameDuration === undefined
              ? item.frameDuration
              : Math.max(100, Math.min(2000, Math.round(frameDuration))),
          } : item,
        ),
      });
      return painted;
    },
    duplicateAsset: (id, name) => {
      const current = getSnapshot();
      if (current.assets.length >= MAX_ASSETS) {
        return null;
      }
      const source = assetById(id);
      if (!source) {
        return null;
      }
      const label = (name?.trim() || `${source.name} copy`).slice(
        0,
        MAX_ASSET_NAME,
      );
      const asset = normalizeAsset(
        {
          name: label,
          width: source.width,
          height: source.height,
          pixels: clonePixels(source.pixels),
        },
        false,
      );
      if (!asset) {
        return null;
      }
      commit({ ...current, assets: [...current.assets, asset] });
      return asset;
    },
    clearRect: (input) => {
      const x = Math.floor(input.x);
      const y = Math.floor(input.y);
      const width = Math.max(1, Math.floor(input.width));
      const height = Math.max(1, Math.floor(input.height));
      if (input.target === "page") {
        const page = editablePage();
        if (!page) {
          return false;
        }
        dropFloating();
        pushUndo();
        patchActive(fillRect(page.pixels, liveSize(), x, y, width, height, EMPTY));
        return true;
      }
      if (input.target === "asset") {
        const assetId = input.assetId;
        if (!assetId) {
          return false;
        }
        const current = getSnapshot();
        const asset = assetById(assetId);
        if (!asset) {
          return false;
        }
        const size = { width: asset.width, height: asset.height };
        const next = fillRect(asset.pixels, size, x, y, width, height, EMPTY);
        commit({
          ...current,
          assets: current.assets.map((item) =>
            item.id === assetId ? { ...item, pixels: next } : item,
          ),
        });
        return true;
      }
      return false;
    },
    stampAsset: (input) => {
      const asset = assetById(input.id);
      if (!asset) {
        return null;
      }
      const page = editablePage();
      if (!page) {
        return null;
      }
      let width = input.width;
      let height = input.height;
      if (input.scale != null && Number.isFinite(input.scale)) {
        const scale = Math.max(0.25, input.scale);
        width = Math.max(1, Math.round(asset.width * scale));
        height = Math.max(1, Math.round(asset.height * scale));
      }
      if (![input.x, input.y, width ?? asset.width, height ?? asset.height].every(Number.isFinite)) {
        return null;
      }
      if ((width ?? asset.width) <= 0 || (height ?? asset.height) <= 0) return null;
      const ratio = Math.max((width ?? asset.width) / asset.width, (height ?? asset.height) / asset.height);
      if (ratio <= 0 || asset.width * ratio > MAX_WIDTH || asset.height * ratio > MAX_WIDTH) {
        return null;
      }
      const stamp = stampFromAsset(asset, input.x, input.y, width, height);
      const placed = clampStampOrigin(stamp, liveSize());
      const placement: Placement = {
        id: createId("place"),
        assetId: asset.id,
        x: placed.x,
        y: placed.y,
        width: placed.width,
        height: placed.height,
      };
      dropFloating();
      if (input.recordUndo ?? true) {
        pushUndo();
      }
      patchActivePage({
        placements: [...(page.placements ?? []), placement],
      });
      if (input.keepFloating ?? true) {
        selectedPlacementId = placement.id;
        clearSelection();
        emit();
      }
      return placement;
    },
    setText: (id, body) => {
      const page = editablePage();
      if (!page?.texts.some((mark) => mark.id === id)) {
        return false;
      }
      patchTexts(
        page,
        page.texts.map((mark) => (mark.id === id ? { ...mark, body } : mark)),
      );
      return true;
    },
    moveText: (id, x, y) => {
      const page = editablePage();
      if (!page?.texts.some((mark) => mark.id === id)) {
        return false;
      }
      const size = pageSize(page);
      patchTexts(
        page,
        page.texts.map((mark) =>
          mark.id === id
            ? {
                ...mark,
                x: normalizeTextCoord(x, size.width),
                y: normalizeTextCoord(y, size.height),
              }
            : mark,
        ),
      );
      return true;
    },
    removeText: (id) => {
      const page = editablePage();
      if (!page?.texts.some((mark) => mark.id === id)) {
        return false;
      }
      if (selectedId === id) {
        clearSelection();
      }
      patchTexts(
        page,
        page.texts.filter((mark) => mark.id !== id),
      );
      return true;
    },
    paint: (x, y, recordUndo = true) => {
      switch (currentTool) {
        case "text":
        case "shape":
        case "move":
        case "select":
        case "line":
          return;
        case "pencil":
        case "eraser":
        case "fill":
          break;
        default:
          return assertNever(currentTool, "Unknown tool");
      }
      const surface = getPaintSurface();
      if (!surface) {
        return;
      }
      const { pixels, size, commit, pushUndoFn } = surface;
      if (!inBounds(x, y, size)) {
        return;
      }
      dropFloating();
      if (recordUndo) {
        pushUndoFn();
      }
      switch (currentTool) {
        case "fill":
          commit(floodFill(pixels, size, x, y, currentColor));
          return;
        case "eraser":
          commit(
            paintBrush(pixels, size, x, y, currentBrushSize, EMPTY),
          );
          return;
        case "pencil":
          commit(
            paintBrush(pixels, size, x, y, currentBrushSize, currentColor),
          );
          return;
        default:
          return assertNever(currentTool, "Unknown tool");
      }
    },
    paintLine: (x0, y0, x1, y1, recordUndo = true) => {
      const surface = getPaintSurface();
      if (!surface || ![x0, y0, x1, y1].every(Number.isFinite)) return;
      const { size } = surface;
      x0 = Math.max(0, Math.min(size.width - 1, Math.round(x0)));
      x1 = Math.max(0, Math.min(size.width - 1, Math.round(x1)));
      y0 = Math.max(0, Math.min(size.height - 1, Math.round(y0)));
      y1 = Math.max(0, Math.min(size.height - 1, Math.round(y1)));
      if (recordUndo) surface.pushUndoFn();
      dropFloating();
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      let pixels = surface.pixels;
      for (let i = 0; i <= steps; i += 1) {
        const fraction = steps ? i / steps : 0;
        pixels = paintBrush(pixels, size, Math.round(x0 + (x1 - x0) * fraction), Math.round(y0 + (y1 - y0) * fraction), brushSize, tool === "eraser" ? EMPTY : color);
      }
      surface.commit(pixels);
    },
    drawPixels: (dots) => {
      const page = editablePage();
      if (!page) {
        return 0;
      }
      const size = liveSize();
      dropFloating();
      pushUndo();
      const next = setPixels(page.pixels, size, dots);
      patchActive(next);
      return dots.filter((dot) => inBounds(dot.x, dot.y, size)).length;
    },
    rect: (x, y, width, height, paint) => {
      const page = editablePage();
      if (!page) {
        return;
      }
      dropFloating();
      pushUndo();
      patchActive(fillRect(page.pixels, liveSize(), x, y, width, height, paint));
    },
    line: (x0, y0, x1, y1, paint) => {
      const page = editablePage();
      if (!page) {
        return;
      }
      dropFloating();
      pushUndo();
      patchActive(drawLine(page.pixels, liveSize(), x0, y0, x1, y1, paint));
    },
    fill: (x, y, paint) => {
      const page = editablePage();
      if (!page) {
        return;
      }
      dropFloating();
      pushUndo();
      patchActive(floodFill(page.pixels, liveSize(), x, y, paint ?? currentColor));
    },
    clearPage: () => {
      if (workshopOpen && workshopDraft) {
        dropFloating();
        pushWorkshopUndo();
        workshopDraft = {
          ...workshopDraft,
          pixels: emptyPixels(workshopDraft.width, workshopDraft.height),
          frames: workshopDraft.frames.map((frame, index) => index === workshopDraft!.frameIndex
            ? emptyPixels(workshopDraft!.width, workshopDraft!.height) : frame),
        };
        touchWorkshopDraft();
        return;
      }
      const page = editablePage();
      if (!page) {
        return;
      }
      const size = liveSize();
      dropFloating();
      clearPlacementSelection();
      pushUndo();
      patchActivePage({
        pixels: emptyPixels(size.width, size.height),
        texts: [],
        placements: [],
      });
    },
    drawScene: (prompt) => {
      const page = editablePage();
      if (!page) {
        return;
      }
      dropFloating();
      pushUndo();
      patchActive(paintScene(prompt, liveSize()));
    },
    undo: () => restoreHistory(),
    redo: () => restoreHistory(true),
  };
}

export function FilmProvider({ children }: { children: ReactNode }) {
  const film = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const currentTool = useSyncExternalStore(
    subscribe,
    () => tool,
    () => "pencil" as DrawTool,
  );
  const currentColor = useSyncExternalStore(
    subscribe,
    () => color,
    () => "#000000",
  );
  const currentFrame = useSyncExternalStore(
    subscribe,
    () => frame,
    () => "circle" as TextFrame,
  );
  const currentFont = useSyncExternalStore(
    subscribe,
    () => textFont,
    () => "inter" as TextFont,
  );
  const currentSize = useSyncExternalStore(
    subscribe,
    () => textSize,
    () => DEFAULT_TEXT_SIZE,
  );
  const currentFilled = useSyncExternalStore(
    subscribe,
    () => shapeFilled,
    () => false,
  );
  const currentBrushSize = useSyncExternalStore(
    subscribe,
    () => brushSize,
    () => DEFAULT_BRUSH_SIZE as BrushSize,
  );
  const currentStageZoom = useSyncExternalStore(
    subscribe,
    () => stageZoom,
    () => DEFAULT_STAGE_ZOOM,
  );
  const currentAssetId = useSyncExternalStore(
    subscribe,
    () => selectedAssetId,
    () => null,
  );
  const currentWorkshopOpen = useSyncExternalStore(
    subscribe,
    () => workshopOpen,
    () => false,
  );
  const currentWorkshopDraft = useSyncExternalStore(
    subscribe,
    () => workshopDraft,
    () => null,
  );
  const currentSelectedId = useSyncExternalStore(
    subscribe,
    () => selectedId,
    () => null,
  );
  const currentSelectedKind = useSyncExternalStore(
    subscribe,
    () => selectedKind,
    () => null,
  );
  const currentFloating = useSyncExternalStore(
    subscribe,
    () => floating,
    () => null,
  );
  const currentPlacementId = useSyncExternalStore(
    subscribe,
    () => selectedPlacementId,
    () => null,
  );
  const api = useMemo(
    () =>
      createApi(
        film,
        currentTool,
        currentColor,
        currentFrame,
        currentFont,
        currentSize,
        currentFilled,
        currentBrushSize,
        currentAssetId,
        currentSelectedId,
        currentSelectedKind,
        currentFloating,
        currentPlacementId,
      ),
    [
      currentBrushSize,
      currentStageZoom,
      currentColor,
      currentFilled,
      currentFloating,
      currentFont,
      currentFrame,
      currentSelectedId,
      currentSelectedKind,
      currentPlacementId,
      currentSize,
      currentAssetId,
      currentWorkshopDraft,
      currentWorkshopOpen,
      currentTool,
      film,
    ],
  );
  return <FilmContext.Provider value={api}>{children}</FilmContext.Provider>;
}

export function useFilm() {
  const value = useContext(FilmContext);
  if (!value) {
    throw new Error("useFilm must be used inside FilmProvider");
  }
  return value;
}

export function useWorkshopDraft(): WorkshopDraft | null {
  return useSyncExternalStore(
    subscribe,
    () => workshopDraft,
    () => null,
  );
}

export function useWorkshopRevision(): number {
  return useSyncExternalStore(
    subscribe,
    () => workshopRevision,
    () => 0,
  );
}
