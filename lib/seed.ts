import { paintPixelFrame } from "./pixel-paint";
import type { Production, StudioSnapshot } from "./types";

const SEEDED_AT = "2026-08-30T00:00:00.000Z";

export function createEqualValueProduction(): Production {
  const lin = {
    id: "char_lin",
    name: "Lin",
    role: "Stand-in / co-lead",
    palette: "#e8b86d",
    notes: "Holds the T-mark. Speaks only when the slate is closed.",
  };
  const kael = {
    id: "char_kael",
    name: "Kael",
    role: "Stand-in / co-lead",
    palette: "#4ad4d4",
    notes: "Billed at equal value. Keeps counting the degrees on the black.",
  };
  const dp = {
    id: "char_mira",
    name: "Mira Chen",
    role: "Director of Photography",
    palette: "#c23b3b",
    notes: "Shoots at the lowest light the sensor will still read as picture.",
  };

  const market = {
    id: "scene_market",
    number: 1,
    heading: "EXT. NIGHT MARKET — NIGHT",
    synopsis:
      "Rain on canvas stalls. Two stand-ins wait where the lead should be.",
  };
  const stand = {
    id: "scene_stand",
    number: 2,
    heading: "EXT. BLACK STAND — NIGHT",
    synopsis:
      "A T-mark on wet asphalt. The call sheet lists both names at equal value.",
  };
  const roof = {
    id: "scene_roof",
    number: 3,
    heading: "EXT. ROOFTOP — LATER",
    synopsis: "The city is a gel pack. They decide whether to stay in frame.",
  };

  const shots = [
    {
      id: "shot_1a",
      sceneId: market.id,
      number: "1A",
      title: "Wide, rain, stalls",
      description:
        "Locked wide of the night market. Rain reads as white ticks. Two figures under the awning.",
      location: "Night market, lane 4",
      characterIds: [lin.id, kael.id],
      durationSec: 8,
      status: "in_can" as const,
      camera: "Alexa Mini",
      lens: "24mm",
      frame: paintPixelFrame(
        "wide night market rain neon stalls two stand-ins black",
        lin.palette,
      ),
      notes: "Keep the practicals one stop under.",
    },
    {
      id: "shot_1b",
      sceneId: market.id,
      number: "1B",
      title: "CU Lin, slate edge",
      description: "Close on Lin. Slate sticks pass through the bottom of frame.",
      location: "Night market, lane 4",
      characterIds: [lin.id],
      durationSec: 4,
      status: "locked" as const,
      camera: "Alexa Mini",
      lens: "50mm",
      frame: paintPixelFrame(
        "closeup face night black lin slate interior booth",
        lin.palette,
      ),
      notes: "",
    },
    {
      id: "shot_2a",
      sceneId: stand.id,
      number: "2A",
      title: "The black stand",
      description:
        "Top-down on the T-mark. Two pairs of shoes at equal distance. Degree of black is the only key.",
      location: "Black stand, wet asphalt",
      characterIds: [lin.id, kael.id],
      durationSec: 6,
      status: "setup" as const,
      camera: "Alexa Mini",
      lens: "35mm",
      frame: paintPixelFrame(
        "night black stand mark equal value two figures wet street",
        kael.palette,
      ),
      notes: "Hold until the puddle stops ringing.",
    },
    {
      id: "shot_2b",
      sceneId: stand.id,
      number: "2B",
      title: "Equal value",
      description: "Two-shot. Neither is listed as the lead. Neither steps off.",
      location: "Black stand, wet asphalt",
      characterIds: [lin.id, kael.id, dp.id],
      durationSec: 9,
      status: "unshot" as const,
      camera: "Alexa Mini",
      lens: "40mm",
      frame: null,
      notes: "Needs the pixel frame before we roll.",
    },
    {
      id: "shot_3a",
      sceneId: roof.id,
      number: "3A",
      title: "Skyline gel",
      description: "Rooftop wide. Cyan and amber signs. They look at the city, not each other.",
      location: "Rooftop above the market",
      characterIds: [lin.id, kael.id],
      durationSec: 7,
      status: "unshot" as const,
      camera: "Alexa Mini",
      lens: "21mm",
      frame: null,
      notes: "",
    },
  ];

  return {
    id: "prod_equal_value",
    title: "Equal Value",
    logline:
      "On a blacked-out city block, two stand-ins billed at equal value wait on a T-mark while the degree of black decides who is actually in the picture.",
    genre: "Pixel noir short",
    format: "short",
    targetMinutes: 8,
    script: `EQUAL VALUE

A pixel noir short.

FADE IN:

EXT. NIGHT MARKET — NIGHT

Rain ticks on canvas. LIN and KAEL stand under the same awning, billed at equal value. The lead has not arrived.

                    LIN
          They wrote us as the same number.

                    KAEL
          Then the black has to choose.

EXT. BLACK STAND — NIGHT

A T-mark on wet asphalt. Mira's key is a single practical, one degree above true black. Two pairs of shoes. Neither steps off.

                    MIRA (O.S.)
          Hold. If it still reads, we roll.

EXT. ROOFTOP — LATER

The city is a gel pack. They stay in frame.

FADE OUT.
`,
    scenes: [market, stand, roof],
    shots,
    characters: [lin, kael, dp],
    notes: [
      {
        id: "note_legal_black",
        at: SEEDED_AT,
        author: "human",
        body: "Minimum picture quality: if the black still holds a face, we are legal. If it doesn't, we add one gel, never two.",
      },
    ],
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
}

export function createEmptySnapshot(): StudioSnapshot {
  const production = createEqualValueProduction();
  return {
    productions: [production],
    activeId: production.id,
    tab: "floor",
    logs: [],
  };
}
