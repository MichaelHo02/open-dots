import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { buildCallSheet } from "./call-sheet";
import { createId, nowIso } from "./id";
import { paintPixelFrame } from "./pixel-paint";
import { createEmptySnapshot } from "./seed";
import {
  PRODUCTION_FORMATS,
  SHOT_STATUSES,
  type AgentLogEntry,
  type Character,
  type Production,
  type ProductionFormat,
  type Scene,
  type Shot,
  type ShotStatus,
  type StudioSnapshot,
  type StudioTab,
} from "./types";

const STORAGE_KEY = "pixel-film-studio:v1";
const MAX_LOGS = 40;
const SEED = createEmptySnapshot();

export interface SearchHit {
  kind: "production" | "scene" | "shot" | "character" | "note";
  id: string;
  productionId: string;
  title: string;
  snippet: string;
}

export interface StudioApi {
  snapshot: StudioSnapshot;
  hydrated: boolean;
  active: Production | null;
  setTab: (tab: StudioTab) => void;
  createProduction: (input: {
    title: string;
    logline?: string;
    genre?: string;
    format?: ProductionFormat;
    targetMinutes?: number;
  }) => Production;
  openProduction: (id: string) => Production | null;
  updateScript: (script: string) => void;
  addScene: (input: { heading: string; synopsis?: string }) => Scene | null;
  addShot: (input: {
    sceneId?: string;
    number?: string;
    title: string;
    description?: string;
    location?: string;
    characterIds?: string[];
    durationSec?: number;
    camera?: string;
    lens?: string;
  }) => Shot | null;
  updateShot: (
    shotId: string,
    patch: Partial<
      Pick<
        Shot,
        | "title"
        | "description"
        | "location"
        | "durationSec"
        | "camera"
        | "lens"
        | "notes"
        | "characterIds"
        | "number"
      >
    >,
  ) => Shot | null;
  setShotStatus: (shotId: string, status: ShotStatus) => Shot | null;
  addCharacter: (input: {
    name: string;
    role?: string;
    palette?: string;
    notes?: string;
  }) => Character | null;
  paintShotFrame: (shotId: string, prompt?: string) => Shot | null;
  addNote: (body: string, author: "human" | "agent") => void;
  searchAssets: (query: string) => SearchHit[];
  logTool: (entry: Omit<AgentLogEntry, "id" | "at">) => void;
}

const StudioContext = createContext<StudioApi | null>(null);

function isShotStatus(value: string): value is ShotStatus {
  return (SHOT_STATUSES as readonly string[]).includes(value);
}

export function isProductionFormat(value: string): value is ProductionFormat {
  return (PRODUCTION_FORMATS as readonly string[]).includes(value);
}

export { isShotStatus };

function touch(production: Production): Production {
  return { ...production, updatedAt: nowIso() };
}

function replaceProduction(
  snapshot: StudioSnapshot,
  production: Production,
): StudioSnapshot {
  return {
    ...snapshot,
    productions: snapshot.productions.map((item) =>
      item.id === production.id ? production : item,
    ),
  };
}

function matches(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

let memory = SEED;
let clientReady = false;
const listeners = new Set<() => void>();

function readStored(): StudioSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StudioSnapshot;
    if (!parsed.productions?.length) {
      return null;
    }
    return {
      productions: parsed.productions,
      activeId: parsed.activeId ?? parsed.productions[0]?.id ?? null,
      tab: parsed.tab ?? "floor",
      logs: parsed.logs ?? [],
    };
  } catch {
    return null;
  }
}

function persist(snapshot: StudioSnapshot) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private mode — keep working in memory.
  }
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function commit(next: StudioSnapshot) {
  memory = next;
  if (clientReady) {
    persist(next);
  }
  emit();
}

function getSnapshot(): StudioSnapshot {
  return memory;
}

function getServerSnapshot(): StudioSnapshot {
  return SEED;
}

function subscribe(listener: () => void): () => void {
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

function currentActive(snapshot: StudioSnapshot): Production | null {
  return (
    snapshot.productions.find((production) => production.id === snapshot.activeId) ??
    null
  );
}

function mutateActive(updater: (production: Production) => Production) {
  const snapshot = getSnapshot();
  const active = currentActive(snapshot);
  if (!active) {
    return;
  }
  commit(replaceProduction(snapshot, touch(updater(active))));
}

function searchAssets(query: string): SearchHit[] {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const hits: SearchHit[] = [];
  for (const production of getSnapshot().productions) {
    if (
      matches(production.title, q) ||
      matches(production.logline, q) ||
      matches(production.genre, q) ||
      matches(production.script, q)
    ) {
      hits.push({
        kind: "production",
        id: production.id,
        productionId: production.id,
        title: production.title,
        snippet: production.logline.slice(0, 160),
      });
    }
    for (const scene of production.scenes) {
      if (matches(scene.heading, q) || matches(scene.synopsis, q)) {
        hits.push({
          kind: "scene",
          id: scene.id,
          productionId: production.id,
          title: `Scene ${scene.number}: ${scene.heading}`,
          snippet: scene.synopsis.slice(0, 160),
        });
      }
    }
    for (const shot of production.shots) {
      if (
        matches(shot.title, q) ||
        matches(shot.description, q) ||
        matches(shot.number, q) ||
        matches(shot.location, q)
      ) {
        hits.push({
          kind: "shot",
          id: shot.id,
          productionId: production.id,
          title: `Shot ${shot.number} — ${shot.title}`,
          snippet: shot.description.slice(0, 160),
        });
      }
    }
    for (const character of production.characters) {
      if (
        matches(character.name, q) ||
        matches(character.role, q) ||
        matches(character.notes, q)
      ) {
        hits.push({
          kind: "character",
          id: character.id,
          productionId: production.id,
          title: character.name,
          snippet: character.role,
        });
      }
    }
    for (const note of production.notes) {
      if (matches(note.body, q)) {
        hits.push({
          kind: "note",
          id: note.id,
          productionId: production.id,
          title: `${note.author} note`,
          snippet: note.body.slice(0, 160),
        });
      }
    }
  }
  return hits.slice(0, 20);
}

function createStudioApi(snapshot: StudioSnapshot, hydrated: boolean): StudioApi {
  const active = currentActive(snapshot);
  return {
    snapshot,
    hydrated,
    active,
    setTab: (tab) => {
      commit({ ...getSnapshot(), tab });
    },
    createProduction: (input) => {
      const production: Production = {
        id: createId("prod"),
        title: input.title.trim() || "Untitled production",
        logline: input.logline?.trim() || "",
        genre: input.genre?.trim() || "Unspecified",
        format: input.format ?? "short",
        targetMinutes: input.targetMinutes ?? 8,
        script: "",
        scenes: [],
        shots: [],
        characters: [],
        notes: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const current = getSnapshot();
      commit({
        ...current,
        productions: [production, ...current.productions],
        activeId: production.id,
        tab: "floor",
      });
      return production;
    },
    openProduction: (id) => {
      const found = getSnapshot().productions.find(
        (production) => production.id === id,
      );
      if (!found) {
        return null;
      }
      commit({ ...getSnapshot(), activeId: id, tab: "floor" });
      return found;
    },
    updateScript: (script) => {
      mutateActive((production) => ({ ...production, script }));
    },
    addScene: (input) => {
      let created: Scene | null = null;
      mutateActive((production) => {
        const scene: Scene = {
          id: createId("scene"),
          number: production.scenes.length + 1,
          heading: input.heading.trim(),
          synopsis: input.synopsis?.trim() || "",
        };
        created = scene;
        return { ...production, scenes: [...production.scenes, scene] };
      });
      return created;
    },
    addShot: (input) => {
      let created: Shot | null = null;
      mutateActive((production) => {
        const sceneId = input.sceneId || production.scenes[0]?.id;
        if (!sceneId) {
          return production;
        }
        const shot: Shot = {
          id: createId("shot"),
          sceneId,
          number: input.number?.trim() || `${production.shots.length + 1}A`,
          title: input.title.trim(),
          description: input.description?.trim() || "",
          location: input.location?.trim() || "",
          characterIds: input.characterIds ?? [],
          durationSec: input.durationSec ?? 5,
          status: "unshot",
          camera: input.camera?.trim() || "Alexa Mini",
          lens: input.lens?.trim() || "35mm",
          frame: null,
          notes: "",
        };
        created = shot;
        return { ...production, shots: [...production.shots, shot] };
      });
      return created;
    },
    updateShot: (shotId, patch) => {
      let updated: Shot | null = null;
      mutateActive((production) => ({
        ...production,
        shots: production.shots.map((shot) => {
          if (shot.id !== shotId) {
            return shot;
          }
          updated = { ...shot, ...patch };
          return updated;
        }),
      }));
      return updated;
    },
    setShotStatus: (shotId, status) => {
      let updated: Shot | null = null;
      mutateActive((production) => ({
        ...production,
        shots: production.shots.map((shot) => {
          if (shot.id !== shotId) {
            return shot;
          }
          updated = { ...shot, status };
          return updated;
        }),
      }));
      return updated;
    },
    addCharacter: (input) => {
      let created: Character | null = null;
      mutateActive((production) => {
        const character: Character = {
          id: createId("char"),
          name: input.name.trim(),
          role: input.role?.trim() || "Unspecified",
          palette: input.palette?.trim() || "#e8b86d",
          notes: input.notes?.trim() || "",
        };
        created = character;
        return {
          ...production,
          characters: [...production.characters, character],
        };
      });
      return created;
    },
    paintShotFrame: (shotId, prompt) => {
      let updated: Shot | null = null;
      mutateActive((production) => ({
        ...production,
        shots: production.shots.map((shot) => {
          if (shot.id !== shotId) {
            return shot;
          }
          const scene = production.scenes.find((item) => item.id === shot.sceneId);
          const lead = production.characters.find((character) =>
            shot.characterIds.includes(character.id),
          );
          const text =
            prompt?.trim() ||
            [shot.title, shot.description, scene?.heading, shot.location]
              .filter(Boolean)
              .join(" ");
          updated = {
            ...shot,
            frame: paintPixelFrame(text, lead?.palette),
          };
          return updated;
        }),
      }));
      return updated;
    },
    addNote: (body, author) => {
      mutateActive((production) => ({
        ...production,
        notes: [
          {
            id: createId("note"),
            at: nowIso(),
            author,
            body: body.trim(),
          },
          ...production.notes,
        ],
      }));
    },
    searchAssets,
    logTool: (entry) => {
      const current = getSnapshot();
      commit({
        ...current,
        logs: [
          { ...entry, id: createId("log"), at: nowIso() },
          ...current.logs,
        ].slice(0, MAX_LOGS),
      });
    },
  };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const api = useMemo(() => createStudioApi(snapshot, true), [snapshot]);
  return <StudioContext.Provider value={api}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioApi {
  const value = useContext(StudioContext);
  if (!value) {
    throw new Error("useStudio must be used inside StudioProvider");
  }
  return value;
}

export function summarizeProduction(production: Production) {
  return {
    id: production.id,
    title: production.title,
    logline: production.logline,
    genre: production.genre,
    format: production.format,
    targetMinutes: production.targetMinutes,
    sceneCount: production.scenes.length,
    shotCount: production.shots.length,
    characterCount: production.characters.length,
    callSheet: buildCallSheet(production),
  };
}
