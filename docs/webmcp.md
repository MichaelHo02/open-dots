# WebMCP in Open Dots

Open Dots is a [WebMCP Challenge](https://webmcp.devpost.com/) app: agents paint picture-book pages through the browser’s `document.modelContext` API instead of clicking the human UI. This document explains how the harness works, why we skip Chrome’s `use-webmcp-tool` hook, and how to test it.

## What WebMCP is here

**WebMCP** exposes site-defined tools to an in-browser agent (ChatGPT’s browser, Chrome with `chrome://flags/#enable-webmcp-testing`, Cursor, etc.). The agent discovers tools via `document.modelContext.getTools()`, calls them via `executeTool`, and receives structured results.

Open Dots registers **14 agent-focused tools** (4 read / 10 write) on `document.modelContext` while the editor route is mounted:

| Read | Write |
| --- | --- |
| `get_pixel_art_guide` | `set_palette`, `add_page`, `select_page`, `place_text` |
| `get_storybook` | `add_asset`, `paint_asset`, `review_asset`, `stamp_assets` |
| `get_asset_image` | `paint_page`, `review_page` |
| `get_page_image` | |

The surface is intentionally minimal — inspired by [pixel-art-cli](https://github.com/vossenwout/pixel-art-cli) (`set_pixel` / `fill_rect` / `line` / `clear` + export) — with book features and bulk ops. `paint_asset` declares its visual pass; `get_asset_image` returns the current revision; `review_asset` records a concrete vision verdict for that revision. Only approved asset revisions can be stamped. Full pages follow the same `get_page_image` → `review_page` loop. Generated images can be imported as editable assets, then cleaned with hard-edged pixel passes.

**Polyfill:** `lib/webmcp-polyfill.ts` installs a spec-shaped `document.modelContext` when the native API is missing, so judges and local dev can inspect tools without the Chrome flag. If native WebMCP is already present, the polyfill does not replace it.

Deleting pages and assets is intentionally UI-only because those irreversible actions require confirmation outside agent control.

## Why we do not use `use-webmcp-tool`

Chrome ships [`use-webmcp-tool`](https://www.npmjs.com/package/use-webmcp-tool) (`useWebMCP`), a React hook that registers one tool for a component lifetime. Open Dots already has one bridge that registers the complete tool set, shares one live editor API ref, batches polyfill notifications, and normalizes results and errors. Adding a hook per tool would duplicate that existing lifecycle.

`WebMCPBridge` owns an `AbortController` for the editor route. Every `registerTool` call receives its signal, and the bridge aborts it on unmount. This removes the tools during Next.js client-side navigation to the gallery and avoids stale editor actions. A later editor mount registers a fresh tool set.

The bridge still keeps registration stable within one mount:

- **Re-register same name:** update `description`, `inputSchema`, `annotations`, and `execute` **in place** with no `toolchange` (polyfill `registerTool` when the name already exists).
- **Window singleton `__openDotsWebmcp`:** keeps the active controller and registration metadata together.
- **Silent batch + single flush:** initial registration uses `{ silent: true }` on each `registerTool`, then one `flushToolChanges()` — one `toolchange` for the whole set.

Result normalization also already exists:

- **`toolResult` / `toolError`** (`lib/tool-result.ts`) — validation failures return `{ isError: true, content: [...] }`; successes return `{ content: [{ type: "text", ... }] }` (plus optional PNG blocks via `toolResultWithImage`).
- **`withSafeExecute`** (`lib/register-tools.ts`) — unexpected throws become structured `toolError` results instead of rejected promises the model cannot reason about.

No hook dependency required for that behavior.

## Registration architecture

```
FilmApp
  └── WebMCPBridge (client component)
        ├── syncWebmcpApiRef(apiRef)     — every render; stable sharedApiRef
        └── registerFilmTools(apiRef)    — once per document load (deferred 2× rAF)
              ├── ensureWebMCPPolyfill()
              ├── buildFilmTools()       — 14 tools, withToolAnnotations + withSafeExecute
              ├── register get_storybook first — agents can poll readiness immediately
              ├── register rest (silent)
              └── flushToolChanges()     — one toolchange
```

**`WebMCPBridge`** (`components/WebMCPBridge.tsx`) mounts once in the app tree. Registration is deferred until after hydration (double `requestAnimationFrame`) so `localStorage` storybook state is stable before agents call `get_storybook`. A small badge shows `live tool count` when live.

**`window.__openDotsWebmcp`** stores `{ apiRef, controller, generation, native, count }`. `generation` is stable for one editor registration lifetime. `syncWebmcpApiRef` keeps `sharedApiRef.current` pointing at the latest editor API without re-registering tool names.

**`withToolAnnotations`** defaults missing `readOnlyHint` to `false` (write). Cursor and other hosts classify tools from this field; omitting it hides mutating tools.

**`get_storybook` first:** during the registering phase, only `get_storybook` may be available. It exposes `webmcp.ready`, `webmcp.phase`, `webmcp.generation`, `webmcp.toolCount`, and a refresh hint so agents can poll instead of failing opaque “tool not found” errors.

## Agent workflow after refresh

A full page reload **unloads** all `document.modelContext` registrations and **invalidates** the host’s tool snapshot. In-flight calls that referenced pre-refresh tool handles fail.

Storybook data (pages, assets, named color profiles) **persists** in `localStorage`. After refresh:

1. **Re-fetch live tools** from `document.modelContext` (do not reuse a pre-refresh snapshot).
2. **Poll `get_storybook`** until `webmcp.ready === true` (and `webmcp.phase === "ready"`).
3. **Note `webmcp.generation`** — if it changes, treat prior tool handles as stale.
4. **Call `get_storybook`** again to recover asset ids, page indices, and `agentChecklist`.
5. Then mutate (`add_asset`, `paint_asset`, `stamp_assets`, …).

`get_storybook` sets `nextRequired` while `webmcp.ready` is false so agents wait instead of drawing blind.

Typical session start after tools are ready: `get_pixel_art_guide` and inspect its attached quality target → create cohesive material ramps → generate/import a clean PNG reference or draw explicit outline/fill/shadow/highlight/cleanup passes → `get_asset_image` → `review_asset` → stamp approved assets back-to-front → `get_page_image` → `review_page`.

## Chrome best practices we follow

Aligned with [Chrome’s WebMCP docs](https://developer.chrome.com/docs/ai/webmcp) and [eval guidance](https://developer.chrome.com/docs/ai/webmcp/evals):

| Practice | How Open Dots implements it |
| --- | --- |
| **`readOnlyHint` on every tool** | `withToolAnnotations` in `lib/webmcp-polyfill.ts`; getters set `readOnlyHint: true` |
| **JSON Schema** | Each tool has `inputSchema: { type: "object", properties, required, enum, maxItems }` |
| **Intent-rich descriptions** | Each tool says what it does, when to use it, and key constraints (coords, erase via `color ""`, PNG feedback) — no repo file paths |
| **Graceful errors** | `toolError()` for validation; `withSafeExecute` backstop for runtime throws |
| **Route-scoped registration** | One shared `AbortSignal`; editor unmount removes all tools; initial registration batches `toolchange` |
| **Vision loop** | Guide returns a visual quality target; reviews are bound to inspected asset/page revisions; edits invalidate approval; unapproved assets cannot be stamped |
| **Evals** | Chrome-format suite + deterministic CI runner (see below) |

## Running evals

Eval files live in [`evals/`](../evals/). See [`evals/README.md`](../evals/README.md) for the three-layer model.

**Deterministic (CI-friendly, no browser, no API key):**

```bash
npm run test:webmcp
```

`scripts/webmcp-evals.ts` lints every tool (name, description, schema, `readOnlyHint`), runs validation and graceful-error paths, verifies the eval suite references only real tools/args, and regenerates `evals/schema.json`.

**Probabilistic (live model + browser):**

```bash
npx webmcp-evals browser -u https://opendots.thach.app -e evals/open-dots.evals.json
```

For a deterministic smoke run against a local dev server:

```bash
npx webmcp-evals smoke -u http://localhost:3000 -e evals/open-dots.evals.json -v
```

## When `use-webmcp-tool` would be appropriate

The hook is a good fit when a tool’s **scope matches a component’s lifetime**:

- A modal that exposes `apply_crop` only while open
- A wizard step that registers `confirm_step_2` until the user advances
- A ephemeral panel whose tools should disappear when the panel unmounts

For Open Dots, one route-level `WebMCPBridge` is smaller and clearer than 14 individual hook calls. The important behavior is the same: register on editor mount and unregister with an `AbortSignal` on unmount.

## Related files

| File | Role |
| --- | --- |
| `components/WebMCPBridge.tsx` | Bootstrap registration after hydration |
| `lib/webmcp-polyfill.ts` | `document.modelContext` polyfill, `withToolAnnotations`, silent batch |
| `lib/register-tools.ts` | Tool definitions, `registerFilmTools`, `withSafeExecute`, `__openDotsWebmcp` |
| `lib/tool-result.ts` | `toolResult`, `toolError`, `toolResultWithImage` |
| `evals/open-dots.evals.json` | Chrome-format eval cases |
| `scripts/webmcp-evals.ts` | Deterministic test runner |
