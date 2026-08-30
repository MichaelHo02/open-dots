import type { Production, ShotStatus } from "./types";
import { shotStatusLabel } from "./types";

export interface CallSheet {
  title: string;
  logline: string;
  genre: string;
  format: string;
  targetMinutes: number;
  scenes: Array<{ number: number; heading: string; synopsis: string }>;
  shots: Array<{
    number: string;
    title: string;
    status: ShotStatus;
    statusLabel: string;
    location: string;
    durationSec: number;
    characters: string[];
    hasFrame: boolean;
  }>;
  characters: Array<{ name: string; role: string }>;
  totals: {
    shots: number;
    inCan: number;
    remainingSec: number;
    withFrames: number;
  };
}

export function buildCallSheet(production: Production): CallSheet {
  const charactersById = new Map(
    production.characters.map((character) => [character.id, character.name]),
  );
  const inCan = production.shots.filter(
    (shot) => shot.status === "in_can" || shot.status === "locked",
  ).length;
  const remainingSec = production.shots
    .filter((shot) => shot.status !== "locked" && shot.status !== "in_can")
    .reduce((sum, shot) => sum + shot.durationSec, 0);

  return {
    title: production.title,
    logline: production.logline,
    genre: production.genre,
    format: production.format,
    targetMinutes: production.targetMinutes,
    scenes: production.scenes.map((scene) => ({
      number: scene.number,
      heading: scene.heading,
      synopsis: scene.synopsis,
    })),
    shots: production.shots.map((shot) => ({
      number: shot.number,
      title: shot.title,
      status: shot.status,
      statusLabel: shotStatusLabel(shot.status),
      location: shot.location,
      durationSec: shot.durationSec,
      characters: shot.characterIds
        .map((id) => charactersById.get(id))
        .filter((name): name is string => Boolean(name)),
      hasFrame: Boolean(shot.frame),
    })),
    characters: production.characters.map((character) => ({
      name: character.name,
      role: character.role,
    })),
    totals: {
      shots: production.shots.length,
      inCan,
      remainingSec,
      withFrames: production.shots.filter((shot) => shot.frame).length,
    },
  };
}
