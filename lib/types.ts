export const SHOT_STATUSES = [
  "unshot",
  "setup",
  "rolling",
  "in_can",
  "needs_pickup",
  "locked",
] as const;

export type ShotStatus = (typeof SHOT_STATUSES)[number];

export const PRODUCTION_FORMATS = [
  "short",
  "feature",
  "series-pilot",
  "music-video",
] as const;

export type ProductionFormat = (typeof PRODUCTION_FORMATS)[number];

export const STUDIO_TABS = [
  "floor",
  "script",
  "board",
  "shots",
  "timeline",
  "dailies",
] as const;

export type StudioTab = (typeof STUDIO_TABS)[number];

export const NOTE_AUTHORS = ["human", "agent"] as const;

export type NoteAuthor = (typeof NOTE_AUTHORS)[number];

export interface PixelFrame {
  width: number;
  height: number;
  pixels: string[];
  prompt: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  palette: string;
  notes: string;
}

export interface Scene {
  id: string;
  number: number;
  heading: string;
  synopsis: string;
}

export interface Shot {
  id: string;
  sceneId: string;
  number: string;
  title: string;
  description: string;
  location: string;
  characterIds: string[];
  durationSec: number;
  status: ShotStatus;
  camera: string;
  lens: string;
  frame: PixelFrame | null;
  notes: string;
}

export interface ProductionNote {
  id: string;
  at: string;
  author: NoteAuthor;
  body: string;
}

export interface Production {
  id: string;
  title: string;
  logline: string;
  genre: string;
  format: ProductionFormat;
  targetMinutes: number;
  script: string;
  scenes: Scene[];
  shots: Shot[];
  characters: Character[];
  notes: ProductionNote[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentLogEntry {
  id: string;
  at: string;
  tool: string;
  summary: string;
  ok: boolean;
}

export interface StudioSnapshot {
  productions: Production[];
  activeId: string | null;
  tab: StudioTab;
  logs: AgentLogEntry[];
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}

export function shotStatusLabel(status: ShotStatus): string {
  switch (status) {
    case "unshot":
      return "Unshot";
    case "setup":
      return "Setup";
    case "rolling":
      return "Rolling";
    case "in_can":
      return "In the can";
    case "needs_pickup":
      return "Needs pickup";
    case "locked":
      return "Locked";
    default:
      return assertNever(status, "Unknown shot status");
  }
}

export function formatLabel(format: ProductionFormat): string {
  switch (format) {
    case "short":
      return "Short";
    case "feature":
      return "Feature";
    case "series-pilot":
      return "Series pilot";
    case "music-video":
      return "Music video";
    default:
      return assertNever(format, "Unknown format");
  }
}

export function tabLabel(tab: StudioTab): string {
  switch (tab) {
    case "floor":
      return "Floor";
    case "script":
      return "Script";
    case "board":
      return "Board";
    case "shots":
      return "Shots";
    case "timeline":
      return "Timeline";
    case "dailies":
      return "Dailies";
    default:
      return assertNever(tab, "Unknown tab");
  }
}
