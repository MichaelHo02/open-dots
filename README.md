# Pixel Film Studio

A WebMCP film floor. People write, board, and cut on the desks. Agents call the same tools through `document.modelContext.registerTool` — they do not scrape the UI.

Built for the [WebMCP Challenge](https://webmcp.devpost.com/).

**Live URL:** [https://pixel-film-studio.vercel.app](https://pixel-film-studio.vercel.app)

The seeded picture is **Equal Value**: two stand-ins billed at the same number, waiting on a T-mark while the degree of black decides who is actually in frame. The floor will not roll a shot until a 32×18 pixel frame still reads a face on that black. That is the minimum picture quality.

## Why this is a WebMCP use case

Film production is already a tool surface: slate, shot list, call sheet, storyboard, status. Humans need to *see* those objects. Agents need to *act* on them without guessing buttons.

WebMCP lets the site declare the contract:

- Search the catalog (`search_assets`) instead of hallucinating shot numbers
- Open a production, add scenes and shots, paint frames, move status
- Hand the human the right desk (`open_desk`) after a change
- Read a call sheet without scraping a table

What was hard before: an agent in the page would click around a dense production UI, miss a required scene, or invent coverage that is not on the board. What is possible now: the agent and the DP share one studio state. The person watches the board update as tools fire.

## How WebMCP is implemented

Tools register from a client runtime (`components/WebMCPBridge.tsx` → `lib/register-tools.ts`) using the challenge-required shape:

```js
await document.modelContext.registerTool({
  name: "search_assets",
  description: "Search the Pixel Film Studio catalog",
  inputSchema: { /* JSON Schema */ },
  execute: async (input) => { /* mutate studio state, return JSON */ },
});
```

- Native path: Chrome 149+ with `chrome://flags/#enable-webmcp-testing`, or ChatGPT's in-app browser.
- Fallback: `lib/webmcp-polyfill.ts` installs a spec-shaped `document.modelContext` when the browser does not provide one, so the Agent dock still works and judges can inspect tools without the flag.
- Lifecycle: tools abort/unregister when the studio unmounts (`AbortSignal`).
- Read vs write: catalog/state/call-sheet tools set `annotations.readOnlyHint`.
- Results: MCP text content wrapping bounded JSON (no secrets, no unbounded dumps).

## Tools

| Tool | What it does |
| --- | --- |
| `search_assets` | Catalog search across productions, scenes, shots, cast, notes |
| `list_productions` | Productions on the floor |
| `create_production` | Open a new picture |
| `open_production` | Switch the active slate |
| `get_studio_state` | Full read of the active production |
| `get_call_sheet` | Printable coverage + remaining duration |
| `update_script` | Replace the screenplay |
| `add_scene` | Add a slugline |
| `add_shot` | Add coverage |
| `update_shot` | Patch a shot |
| `set_shot_status` | unshot → setup → rolling → in_can → needs_pickup → locked |
| `add_character` | Cast / crew |
| `paint_pixel_frame` | Procedural 32×18 storyboard (night, rain, neon, stand, closeup, …) |
| `add_note` | Pin a floor note as the agent |
| `open_desk` | floor / script / board / shots / timeline / dailies |

## People + agents together

| Person | Agent |
| --- | --- |
| Watches the board, script, and timeline | Paints missing frames, fills the shot list from the script |
| Sets legal black and pins notes | Searches assets, updates status, hands back a call sheet |
| Rolls or rejects a take | Never purchases, never leaves the origin, never invents a shot id |

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test WebMCP

1. **On this page (any browser):** Agent dock → pick `search_assets` → Execute. The floor log should show the call and the board should update for write tools.
2. **ChatGPT in-app browser:** open the live URL and ask the agent to search assets, paint shot 2B, and open the board desk.
3. **Chrome 149+:** enable `chrome://flags/#enable-webmcp-testing`, restart, reload. The badge should read **Native WebMCP**. Optional: [Model Context Tool Inspector](https://github.com/beaufortfrancois/model-context-tool-inspector).

## Stack

Next.js App Router, React 19, TypeScript, Tailwind v4. Studio state lives in `localStorage` so judges get a working floor with no accounts.

## License

MIT. See [LICENSE](./LICENSE).
