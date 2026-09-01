export const EMPTY = "#ffffff";
export const MIN_WIDTH = 48;
export const MAX_WIDTH = 192;
export const DEFAULT_WIDTH = 128;
export const DEFAULT_HEIGHT = 72;

export const DRAW_TOOLS = ["pencil", "eraser", "fill", "type"] as const;
export type DrawTool = (typeof DRAW_TOOLS)[number];

export const TEXT_FRAMES = [
  "speech",
  "thought",
  "shout",
  "caption",
  "plain",
] as const;
export type TextFrame = (typeof TEXT_FRAMES)[number];

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

export interface Size {
  width: number;
  height: number;
}

export interface TextMark {
  id: string;
  x: number;
  y: number;
  body: string;
  color: string;
  frame: TextFrame;
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
}

export interface FilmApi {
  film: Film;
  tool: DrawTool;
  color: string;
  frame: TextFrame;
  setTool: (tool: DrawTool) => void;
  setColor: (color: string) => void;
  setFrame: (frame: TextFrame) => void;
  setBrief: (brief: string) => void;
  setDensity: (width: number) => void;
  addPage: (input?: { story?: string; draw?: string }) => Page;
  selectPage: (index: number) => boolean;
  removePage: (index: number) => boolean;
  addText: (input: {
    x: number;
    y: number;
    body?: string;
    color?: string;
    frame?: TextFrame;
  }) => TextMark | null;
  setText: (id: string, body: string) => boolean;
  moveText: (id: string, x: number, y: number) => boolean;
  removeText: (id: string) => boolean;
  paint: (x: number, y: number, recordUndo?: boolean) => void;
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

export function isTextFrame(value: unknown): value is TextFrame {
  return TEXT_FRAMES.some((frame) => frame === value);
}

export function frameLabel(frame: TextFrame): string {
  switch (frame) {
    case "speech":
      return "Speech";
    case "thought":
      return "Thought";
    case "shout":
      return "Shout";
    case "caption":
      return "Caption";
    case "plain":
      return "Line";
    default:
      return assertNever(frame, "Unknown frame");
  }
}

export function frameHint(frame: TextFrame): string {
  switch (frame) {
    case "speech":
      return "Click the page to place a speech bubble";
    case "thought":
      return "Click the page to place a thought bubble";
    case "shout":
      return "Click the page to place a shout bubble";
    case "caption":
      return "Click the page to place a caption box";
    case "plain":
      return "Click the page to write a line";
    default:
      return assertNever(frame, "Unknown frame");
  }
}

export function framePlaceholder(frame: TextFrame): string {
  switch (frame) {
    case "speech":
      return "Hello…";
    case "thought":
      return "Hmm…";
    case "shout":
      return "Wow!";
    case "caption":
      return "Meanwhile…";
    case "plain":
      return "Write here…";
    default:
      return assertNever(frame, "Unknown frame");
  }
}

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

export function isEmptyPage(page: Page): boolean {
  const blankPixels = page.pixels.every((pixel) => pixel === EMPTY);
  const blankText = (page.texts ?? []).every((mark) => !mark.body.trim());
  return blankPixels && blankText;
}
