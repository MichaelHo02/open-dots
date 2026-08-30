import { buildCallSheet } from "./call-sheet";
import {
  isProductionFormat,
  isShotStatus,
  summarizeProduction,
  type StudioApi,
} from "./studio-store";
import { asNumber, asString, asStringArray, toolError, toolResult } from "./tool-result";
import { SHOT_STATUSES, STUDIO_TABS, type StudioTab } from "./types";
import { ensureWebMCPPolyfill, type WebMCPTool } from "./webmcp-polyfill";

type ApiRef = { current: StudioApi };

function requireActive(api: StudioApi) {
  if (!api.active) {
    return toolError("No production is open. Call create_production or open_production first.");
  }
  return null;
}

function isStudioTab(value: string): value is StudioTab {
  return (STUDIO_TABS as readonly string[]).includes(value);
}

export function buildStudioTools(apiRef: ApiRef): WebMCPTool[] {
  return [
    {
      name: "search_assets",
      description:
        "Search the Pixel Film Studio catalog across productions, scenes, shots, characters, and notes. Use this before creating duplicates.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term, e.g. a character, location, or shot number",
          },
        },
        required: ["query"],
      },
      execute: async (input) => {
        const query = asString(input.query)?.trim();
        if (!query) {
          return toolError("query is required");
        }
        const hits = apiRef.current.searchAssets(query);
        apiRef.current.logTool({
          tool: "search_assets",
          summary: `Search “${query}” → ${hits.length} hits`,
          ok: true,
        });
        return toolResult({ query, count: hits.length, hits });
      },
    },
    {
      name: "list_productions",
      description: "List every production on the studio floor with title, format, and shot counts.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const productions = apiRef.current.snapshot.productions.map((production) => ({
          id: production.id,
          title: production.title,
          genre: production.genre,
          format: production.format,
          shotCount: production.shots.length,
          active: production.id === apiRef.current.snapshot.activeId,
        }));
        apiRef.current.logTool({
          tool: "list_productions",
          summary: `${productions.length} productions on the floor`,
          ok: true,
        });
        return toolResult({ productions });
      },
    },
    {
      name: "create_production",
      description:
        "Open a new production on the floor and make it active. Does not invent a script; add scenes and shots next.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Production title" },
          logline: { type: "string", description: "One-sentence logline" },
          genre: { type: "string", description: "Genre or tone, e.g. pixel noir short" },
          format: {
            type: "string",
            enum: ["short", "feature", "series-pilot", "music-video"],
          },
          targetMinutes: { type: "number", description: "Target runtime in minutes" },
        },
        required: ["title"],
      },
      execute: async (input) => {
        const title = asString(input.title)?.trim();
        if (!title) {
          return toolError("title is required");
        }
        const formatRaw = asString(input.format);
        const production = apiRef.current.createProduction({
          title,
          logline: asString(input.logline),
          genre: asString(input.genre),
          format: formatRaw && isProductionFormat(formatRaw) ? formatRaw : "short",
          targetMinutes: asNumber(input.targetMinutes),
        });
        apiRef.current.logTool({
          tool: "create_production",
          summary: `Opened “${production.title}”`,
          ok: true,
        });
        return toolResult({
          id: production.id,
          title: production.title,
          next: "Add scenes with add_scene, then shots with add_shot.",
        });
      },
    },
    {
      name: "open_production",
      description: "Switch the active production by id.",
      inputSchema: {
        type: "object",
        properties: {
          productionId: { type: "string", description: "Production id from list_productions" },
        },
        required: ["productionId"],
      },
      execute: async (input) => {
        const productionId = asString(input.productionId);
        if (!productionId) {
          return toolError("productionId is required");
        }
        const opened = apiRef.current.openProduction(productionId);
        if (!opened) {
          return toolError("Production not found");
        }
        apiRef.current.logTool({
          tool: "open_production",
          summary: `Now on “${opened.title}”`,
          ok: true,
        });
        return toolResult({ id: opened.id, title: opened.title });
      },
    },
    {
      name: "get_studio_state",
      description:
        "Read the active production: logline, script length, scenes, shots, characters, and call-sheet totals. Read-only.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const blocked = requireActive(apiRef.current);
        if (blocked) {
          return blocked;
        }
        const production = apiRef.current.active;
        if (!production) {
          return toolError("No production is open");
        }
        apiRef.current.logTool({
          tool: "get_studio_state",
          summary: `Read “${production.title}”`,
          ok: true,
        });
        return toolResult(summarizeProduction(production));
      },
    },
    {
      name: "get_call_sheet",
      description:
        "Return a printable call sheet for the active production: scenes, shot statuses, cast, and remaining duration.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const production = apiRef.current.active;
        if (!production) {
          return toolError("No production is open");
        }
        apiRef.current.logTool({
          tool: "get_call_sheet",
          summary: `Call sheet for “${production.title}”`,
          ok: true,
        });
        return toolResult(buildCallSheet(production));
      },
    },
    {
      name: "update_script",
      description:
        "Replace the active production screenplay. Pass the full script text, not a patch. Humans see it immediately on the Script desk.",
      inputSchema: {
        type: "object",
        properties: {
          script: { type: "string", description: "Full screenplay text" },
        },
        required: ["script"],
      },
      execute: async (input) => {
        const blocked = requireActive(apiRef.current);
        if (blocked) {
          return blocked;
        }
        const script = asString(input.script);
        if (script === undefined) {
          return toolError("script is required");
        }
        apiRef.current.updateScript(script);
        apiRef.current.logTool({
          tool: "update_script",
          summary: `Script now ${script.length} characters`,
          ok: true,
        });
        return toolResult({ ok: true, length: script.length });
      },
    },
    {
      name: "add_scene",
      description: "Add a scene heading to the active production (slugline + optional synopsis).",
      inputSchema: {
        type: "object",
        properties: {
          heading: {
            type: "string",
            description: "Slugline, e.g. EXT. BLACK STAND — NIGHT",
          },
          synopsis: { type: "string", description: "What happens in the scene" },
        },
        required: ["heading"],
      },
      execute: async (input) => {
        const blocked = requireActive(apiRef.current);
        if (blocked) {
          return blocked;
        }
        const heading = asString(input.heading)?.trim();
        if (!heading) {
          return toolError("heading is required");
        }
        const scene = apiRef.current.addScene({
          heading,
          synopsis: asString(input.synopsis),
        });
        apiRef.current.logTool({
          tool: "add_scene",
          summary: `Scene ${scene?.number}: ${heading}`,
          ok: Boolean(scene),
        });
        return toolResult(scene);
      },
    },
    {
      name: "add_shot",
      description:
        "Add a shot to the active production. If sceneId is omitted, the first scene is used. Does not paint a storyboard frame — call paint_pixel_frame after.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short shot title" },
          description: { type: "string", description: "What the camera sees" },
          sceneId: { type: "string", description: "Existing scene id" },
          number: { type: "string", description: "Shot number such as 2B" },
          location: { type: "string" },
          durationSec: { type: "number" },
          camera: { type: "string" },
          lens: { type: "string" },
          characterIds: {
            type: "array",
            items: { type: "string" },
            description: "Character ids appearing in the shot",
          },
        },
        required: ["title"],
      },
      execute: async (input) => {
        const blocked = requireActive(apiRef.current);
        if (blocked) {
          return blocked;
        }
        const title = asString(input.title)?.trim();
        if (!title) {
          return toolError("title is required");
        }
        const shot = apiRef.current.addShot({
          title,
          description: asString(input.description),
          sceneId: asString(input.sceneId),
          number: asString(input.number),
          location: asString(input.location),
          durationSec: asNumber(input.durationSec),
          camera: asString(input.camera),
          lens: asString(input.lens),
          characterIds: asStringArray(input.characterIds),
        });
        if (!shot) {
          return toolError("Add a scene before adding shots.");
        }
        apiRef.current.logTool({
          tool: "add_shot",
          summary: `Shot ${shot.number} — ${shot.title}`,
          ok: true,
        });
        return toolResult({
          id: shot.id,
          number: shot.number,
          title: shot.title,
          status: shot.status,
        });
      },
    },
    {
      name: "update_shot",
      description: "Patch fields on an existing shot (title, description, location, camera, lens, notes, duration).",
      inputSchema: {
        type: "object",
        properties: {
          shotId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          notes: { type: "string" },
          camera: { type: "string" },
          lens: { type: "string" },
          number: { type: "string" },
          durationSec: { type: "number" },
          characterIds: { type: "array", items: { type: "string" } },
        },
        required: ["shotId"],
      },
      execute: async (input) => {
        const shotId = asString(input.shotId);
        if (!shotId) {
          return toolError("shotId is required");
        }
        const updated = apiRef.current.updateShot(shotId, {
          title: asString(input.title),
          description: asString(input.description),
          location: asString(input.location),
          notes: asString(input.notes),
          camera: asString(input.camera),
          lens: asString(input.lens),
          number: asString(input.number),
          durationSec: asNumber(input.durationSec),
          characterIds: asStringArray(input.characterIds),
        });
        if (!updated) {
          return toolError("Shot not found");
        }
        apiRef.current.logTool({
          tool: "update_shot",
          summary: `Updated ${updated.number}`,
          ok: true,
        });
        return toolResult({
          id: updated.id,
          number: updated.number,
          title: updated.title,
        });
      },
    },
    {
      name: "set_shot_status",
      description: `Move a shot through the floor: ${SHOT_STATUSES.join(", ")}.`,
      inputSchema: {
        type: "object",
        properties: {
          shotId: { type: "string" },
          status: { type: "string", enum: [...SHOT_STATUSES] },
        },
        required: ["shotId", "status"],
      },
      execute: async (input) => {
        const shotId = asString(input.shotId);
        const status = asString(input.status);
        if (!shotId || !status) {
          return toolError("shotId and status are required");
        }
        if (!isShotStatus(status)) {
          return toolError(`status must be one of: ${SHOT_STATUSES.join(", ")}`);
        }
        const updated = apiRef.current.setShotStatus(shotId, status);
        if (!updated) {
          return toolError("Shot not found");
        }
        apiRef.current.logTool({
          tool: "set_shot_status",
          summary: `${updated.number} → ${status}`,
          ok: true,
        });
        return toolResult({
          id: updated.id,
          number: updated.number,
          status: updated.status,
        });
      },
    },
    {
      name: "add_character",
      description: "Add a cast member or crew entry to the active production.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          palette: {
            type: "string",
            description: "Hex color used when painting their pixel frames",
          },
          notes: { type: "string" },
        },
        required: ["name"],
      },
      execute: async (input) => {
        const blocked = requireActive(apiRef.current);
        if (blocked) {
          return blocked;
        }
        const name = asString(input.name)?.trim();
        if (!name) {
          return toolError("name is required");
        }
        const character = apiRef.current.addCharacter({
          name,
          role: asString(input.role),
          palette: asString(input.palette),
          notes: asString(input.notes),
        });
        apiRef.current.logTool({
          tool: "add_character",
          summary: `Cast ${name}`,
          ok: Boolean(character),
        });
        return toolResult(character);
      },
    },
    {
      name: "paint_pixel_frame",
      description:
        "Paint a 32×18 pixel storyboard frame for a shot. If prompt is omitted, the shot title, description, and scene heading are used. This is the minimum picture quality the floor will accept.",
      inputSchema: {
        type: "object",
        properties: {
          shotId: { type: "string" },
          prompt: {
            type: "string",
            description:
              "Visual brief: night, rain, neon, closeup, wide, rooftop, stand, two figures, etc.",
          },
        },
        required: ["shotId"],
      },
      execute: async (input) => {
        const shotId = asString(input.shotId);
        if (!shotId) {
          return toolError("shotId is required");
        }
        const shot = apiRef.current.paintShotFrame(shotId, asString(input.prompt));
        if (!shot?.frame) {
          return toolError("Shot not found");
        }
        apiRef.current.logTool({
          tool: "paint_pixel_frame",
          summary: `Painted ${shot.number} (${shot.frame.width}×${shot.frame.height})`,
          ok: true,
        });
        return toolResult({
          shotId: shot.id,
          number: shot.number,
          prompt: shot.frame.prompt,
          size: `${shot.frame.width}x${shot.frame.height}`,
        });
      },
    },
    {
      name: "add_note",
      description: "Pin a production note on the slate. Use for coverage, legal black, or pickup reasons.",
      inputSchema: {
        type: "object",
        properties: {
          body: { type: "string", description: "Note text" },
        },
        required: ["body"],
      },
      execute: async (input) => {
        const blocked = requireActive(apiRef.current);
        if (blocked) {
          return blocked;
        }
        const body = asString(input.body)?.trim();
        if (!body) {
          return toolError("body is required");
        }
        apiRef.current.addNote(body, "agent");
        apiRef.current.logTool({
          tool: "add_note",
          summary: body.slice(0, 80),
          ok: true,
        });
        return toolResult({ ok: true });
      },
    },
    {
      name: "open_desk",
      description:
        "Switch the human-visible desk: floor, script, board, shots, timeline, or dailies. Use after making a change so the person can see it.",
      inputSchema: {
        type: "object",
        properties: {
          desk: {
            type: "string",
            enum: [...STUDIO_TABS],
            description: "Which desk to show",
          },
        },
        required: ["desk"],
      },
      execute: async (input) => {
        const desk = asString(input.desk);
        if (!desk || !isStudioTab(desk)) {
          return toolError(`desk must be one of: ${STUDIO_TABS.join(", ")}`);
        }
        apiRef.current.setTab(desk);
        apiRef.current.logTool({
          tool: "open_desk",
          summary: `Desk → ${desk}`,
          ok: true,
        });
        return toolResult({ desk });
      },
    },
  ];
}

export async function registerStudioTools(
  apiRef: ApiRef,
  signal: AbortSignal,
): Promise<{ native: boolean; count: number }> {
  const context = ensureWebMCPPolyfill();
  const native = !("isPolyfill" in context && context.isPolyfill);
  const tools = buildStudioTools(apiRef);

  for (const tool of tools) {
    if (signal.aborted) {
      break;
    }
    // Required WebMCP Challenge shape: document.modelContext.registerTool
    await document.modelContext?.registerTool(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        execute: async (input: Record<string, unknown>) => tool.execute(input),
      },
      { signal },
    );
  }

  return { native, count: tools.length };
}
