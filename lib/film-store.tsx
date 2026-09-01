"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  clonePixels,
  drawLine,
  fillRect,
  floodFill,
  hexColor,
  inBounds,
  paintScene,
  setPixel,
  setPixels,
} from "./draw";
import { createId } from "./id";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  EMPTY,
  clampUnit,
  emptyPixels,
  isTextFrame,
  landscapeSize,
  pageSize,
  resizePixels,
  type DrawTool,
  type Film,
  type FilmApi,
  type Page,
  type Size,
  type TextFrame,
  type TextMark,
} from "./types";

const STORAGE_KEY = "pixel-film-studio:v8";
const LEGACY_KEYS = [
  "pixel-film-studio:v7",
  "pixel-film-studio:v6",
  "pixel-film-studio:v5",
  "pixel-film-studio:v4",
  "pixel-film-studio:v3",
];
const UNDO_LIMIT = 40;
const FilmContext = createContext<FilmApi | null>(null);

function blankPage(size: Size): Page {
  return {
    id: createId("page"),
    width: size.width,
    height: size.height,
    pixels: emptyPixels(size.width, size.height),
    texts: [],
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
    },
  ],
  activeIndex: 0,
};

let memory = SEED;
let clientReady = false;
let tool: DrawTool = "pencil";
let color = "#000000";
let frame: TextFrame = "speech";
const undos: string[][] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function persist(film: Film) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(film));
  } catch {
    // Private mode — keep memory only.
  }
}

function guessPixelSize(pixels: string[], width?: number, height?: number): Size {
  if (
    width &&
    height &&
    pixels.length === width * height
  ) {
    return { width, height };
  }
  const root = Math.round(Math.sqrt(pixels.length));
  if (root * root === pixels.length && root >= 8) {
    return { width: root, height: root };
  }
  return landscapeSize(width ?? DEFAULT_WIDTH);
}

function migrateTexts(page: {
  texts?: TextMark[];
  story?: string;
  caption?: string;
}): TextMark[] {
  if (page.texts?.length) {
    return page.texts.map((mark) => ({
      id: mark.id || createId("text"),
      x: clampUnit(mark.x),
      y: clampUnit(mark.y),
      body: mark.body ?? "",
      color: mark.color || "#000000",
      frame: isTextFrame(mark.frame) ? mark.frame : "plain",
    }));
  }
  const leftover = page.story ?? page.caption;
  if (!leftover?.trim()) {
    return [];
  }
  return [
    {
      id: createId("text"),
      x: 0.08,
      y: 0.78,
      body: leftover,
      color: "#000000",
      frame: "caption",
    },
  ];
}

function migratePage(
  page: Partial<Page> & { story?: string; caption?: string },
  fallback: Size,
): Page {
  const pixels = page.pixels ?? [];
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
  return {
    id: page.id || createId("page"),
    width: size.width,
    height: size.height,
    texts: migrateTexts(page),
    pixels: nextPixels,
  };
}

function normalizeFilm(parsed: Partial<Film> & { width?: number; height?: number }): Film | null {
  if (!parsed.pages?.length) {
    return null;
  }
  const fallback = landscapeSize(
    parsed.width ?? parsed.pages[0]?.width ?? DEFAULT_WIDTH,
  );
  return {
    brief: parsed.brief ?? "",
    pages: parsed.pages.map((page) => migratePage(page, fallback)),
    activeIndex: Math.min(
      Math.max(0, parsed.activeIndex ?? 0),
      parsed.pages.length - 1,
    ),
  };
}

function readStored(): Film | null {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) {
      return normalizeFilm(JSON.parse(current) as Partial<Film>);
    }
    const legacy =
      LEGACY_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ??
      null;
    if (!legacy) {
      return null;
    }
    const parsed = JSON.parse(legacy) as Partial<Film>;
    return normalizeFilm({
      ...parsed,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    });
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

function pushUndo() {
  const page = activePage();
  if (!page) {
    return;
  }
  undos.push(clonePixels(page.pixels));
  if (undos.length > UNDO_LIMIT) {
    undos.shift();
  }
}

function applyDensity(film: Film, width: number): Film {
  const page = activePage(film);
  if (!page) {
    return film;
  }
  const size = landscapeSize(width);
  const from = pageSize(page);
  if (size.width === from.width && size.height === from.height) {
    return film;
  }
  undos.length = 0;
  return {
    ...film,
    pages: film.pages.map((item, index) =>
      index === film.activeIndex
        ? {
            ...item,
            width: size.width,
            height: size.height,
            pixels: resizePixels(item.pixels, from, size),
          }
        : item,
    ),
  };
}

function patchActivePage(patch: Partial<Pick<Page, "pixels" | "texts" | "width" | "height">>) {
  const film = memory;
  const page = activePage(film);
  if (!page) {
    return;
  }
  commit({
    ...film,
    pages: film.pages.map((item, index) =>
      index === film.activeIndex ? { ...item, ...patch } : item,
    ),
  });
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

function createApi(
  film: Film,
  currentTool: DrawTool,
  currentColor: string,
  currentFrame: TextFrame,
): FilmApi {
  return {
    film,
    tool: currentTool,
    color: currentColor,
    frame: currentFrame,
    active: activePage(film),
    setTool: (next) => {
      tool = next;
      emit();
    },
    setColor: (next) => {
      color = hexColor(next, currentColor);
      emit();
    },
    setFrame: (next) => {
      frame = next;
      emit();
    },
    setBrief: (brief) => {
      commit({ ...getSnapshot(), brief });
    },
    setDensity: (width) => {
      commit(applyDensity(getSnapshot(), width));
    },
    addPage: (input = {}) => {
      const current = getSnapshot();
      const size = liveSize();
      const page = blankPage(size);
      if (input.draw?.trim()) {
        page.pixels = paintScene(input.draw.trim(), size);
      }
      if (input.story?.trim()) {
        page.texts = [
          {
            id: createId("text"),
            x: 0.08,
            y: 0.78,
            body: input.story.trim(),
            color: currentColor,
            frame: "caption",
          },
        ];
      }
      const pages = [...current.pages, page];
      undos.length = 0;
      commit({
        ...current,
        pages,
        activeIndex: pages.length - 1,
      });
      return page;
    },
    selectPage: (index) => {
      const current = getSnapshot();
      if (index < 0 || index >= current.pages.length) {
        return false;
      }
      undos.length = 0;
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
      const pages = current.pages.filter((_, i) => i !== index);
      undos.length = 0;
      commit({
        ...current,
        pages,
        activeIndex: Math.min(current.activeIndex, pages.length - 1),
      });
      return true;
    },
    addText: (input) => {
      const page = activePage();
      if (!page) {
        return null;
      }
      const mark: TextMark = {
        id: createId("text"),
        x: clampUnit(input.x),
        y: clampUnit(input.y),
        body: input.body ?? "",
        color: hexColor(input.color, currentColor),
        frame: input.frame && isTextFrame(input.frame) ? input.frame : currentFrame,
      };
      patchActivePage({ texts: [...page.texts, mark] });
      return mark;
    },
    setText: (id, body) => {
      const page = activePage();
      if (!page?.texts.some((mark) => mark.id === id)) {
        return false;
      }
      patchActivePage({
        texts: page.texts.map((mark) =>
          mark.id === id ? { ...mark, body } : mark,
        ),
      });
      return true;
    },
    moveText: (id, x, y) => {
      const page = activePage();
      if (!page?.texts.some((mark) => mark.id === id)) {
        return false;
      }
      patchActivePage({
        texts: page.texts.map((mark) =>
          mark.id === id
            ? { ...mark, x: clampUnit(x), y: clampUnit(y) }
            : mark,
        ),
      });
      return true;
    },
    removeText: (id) => {
      const page = activePage();
      if (!page?.texts.some((mark) => mark.id === id)) {
        return false;
      }
      patchActivePage({
        texts: page.texts.filter((mark) => mark.id !== id),
      });
      return true;
    },
    paint: (x, y, recordUndo = true) => {
      if (currentTool === "type") {
        return;
      }
      const size = liveSize();
      if (!inBounds(x, y, size)) {
        return;
      }
      const page = activePage();
      if (!page) {
        return;
      }
      if (recordUndo) {
        pushUndo();
      }
      if (currentTool === "fill") {
        patchActive(floodFill(page.pixels, size, x, y, currentColor));
        return;
      }
      const paintColor = currentTool === "eraser" ? EMPTY : currentColor;
      patchActive(setPixel(page.pixels, size, x, y, paintColor));
    },
    drawPixels: (dots) => {
      const page = activePage();
      if (!page) {
        return 0;
      }
      const size = liveSize();
      pushUndo();
      const next = setPixels(page.pixels, size, dots);
      patchActive(next);
      return dots.filter((dot) => inBounds(dot.x, dot.y, size)).length;
    },
    rect: (x, y, width, height, paint) => {
      const page = activePage();
      if (!page) {
        return;
      }
      pushUndo();
      patchActive(fillRect(page.pixels, liveSize(), x, y, width, height, paint));
    },
    line: (x0, y0, x1, y1, paint) => {
      const page = activePage();
      if (!page) {
        return;
      }
      pushUndo();
      patchActive(drawLine(page.pixels, liveSize(), x0, y0, x1, y1, paint));
    },
    fill: (x, y, paint) => {
      const page = activePage();
      if (!page) {
        return;
      }
      pushUndo();
      patchActive(floodFill(page.pixels, liveSize(), x, y, paint ?? currentColor));
    },
    clearPage: () => {
      const page = activePage();
      if (!page) {
        return;
      }
      const size = liveSize();
      pushUndo();
      patchActivePage({
        pixels: emptyPixels(size.width, size.height),
        texts: [],
      });
    },
    drawScene: (prompt) => {
      const page = activePage();
      if (!page) {
        return;
      }
      pushUndo();
      patchActive(paintScene(prompt, liveSize()));
    },
    undo: () => {
      const previous = undos.pop();
      if (!previous) {
        return false;
      }
      patchActive(previous);
      return true;
    },
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
    () => "speech" as TextFrame,
  );
  const api = useMemo(
    () => createApi(film, currentTool, currentColor, currentFrame),
    [currentColor, currentFrame, currentTool, film],
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
