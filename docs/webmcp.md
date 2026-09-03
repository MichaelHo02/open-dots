# WebMCP in Open Dots

Open Dots is a [WebMCP Challenge](https://webmcp.devpost.com/) app: agents paint picture-book pages through the browser’s `document.modelContext` API instead of clicking the human UI. This document explains how the harness works, why we skip Chrome’s `use-webmcp-tool` hook, and how to test it.

## What WebMCP is here

**WebMCP** exposes site-defined tools to an in-browser agent (ChatGPT’s browser, Chrome with `chrome://flags/#enable-webmcp-testing`, Cursor, etc.). The agent discovers tools via `document.modelContext.getTools()`, calls them via `executeTool`, and receives structured results.

Open Dots registers **15 agent-focused tools** (4 read / 11 write) on `document.modelContext`:

| Read | Write |
| --- | --- |
| `get_pixel_art_guide` | `set_palette`, `add_page`, `select_page`, `remove_page`, `place_text` |
| `get_storybook` | `add_asset`, `draw_asset_pixels`, `stamp_assets`, `remove_asset` |
| `get_asset_image` | `draw_pixels`, `clear_page` |
| `get_page_image` | |

The surface is intentionally minimal — inspired by [pixel-art-cli](https://github.com/vossenwout/pixel-art-cli) (`set_pixel` / `fill_rect` / `line` / `clear` + export) — with book features (pages, reusable assets, stamp) and bulk ops: `draw_asset_pixels` and `draw_pixels` accept **rects / lines / fills / pixels** in one call (one rect fills any block server-side; `color ""` erases). UI-only controls (brush, workshop, tool picker, stage zoom) are not exposed.

**Polyfill:** `lib/webmcp-polyfill.ts` installs a spec-shaped `document.modelContext` when the native API is missing, so judges and local dev can inspect tools without the Chrome flag. If native WebMCP is already present, the polyfill does not replace it.

## Why we do not use `use-webmcp-tool`

Chrome ships [`use-webmcp-tool`](https://www.npmjs.com/package/use-webmcp-tool) (`useWebMCP`), a React hook that registers a tool on mount and **unregisters on unmount** via an `AbortSignal` passed to `registerTool`. We evaluated it and skipped it for three reasons:

### 1. Mount/unmount abort vs page-lifetime registration

Open Dots tools must live for the **entire document lifetime** — from first paint until refresh or navigation. Storybook state persists in `localStorage`; agents may hold a tool snapshot across many turns. Unmount-driven unregister would drop tools whenever React remounts the bridge (Strict Mode double-mount, route transitions, conditional rendering), invalidating the host’s cached tool list mid-session.

`WebMCPBridge` deliberately does **not** pass an abort signal. Its cleanup only cancels the pending `requestAnimationFrame` bootstrap, not registration:

```26:28:components/WebMCPBridge.tsx
      // Page-lifetime registration: do not abort on React unmount (Strict Mode /
      // Fast Refresh). Aborting unregisters tools and invalidates the host's
      // snapshot. Tools last until this document unloads (refresh/navigation).
```

### 2. HMR / Strict Mode snapshot invalidation

React Strict Mode and Fast Refresh remount components. Hook-based registration fires `toolchange` on every mount/unmount cycle. Hosts that snapshot tools at discovery time treat each `toolchange` as “invalidate and re-fetch” — noisy at best, broken at worst if an in-flight `add_asset` used a stale snapshot.

Our polyfill and `registerFilmTools` handle HMR differently:

- **Re-register same name:** update `description`, `inputSchema`, `annotations`, and `execute` **in place** with no `toolchange` (polyfill `registerTool` when the name already exists).
- **Window singleton `__openDotsWebmcp`:** survives HMR remounts; `registerFilmTools` detects prior registration and refreshes handler closures instead of re-emitting a full batch.
- **Silent batch + single flush:** initial registration uses `{ silent: true }` on each `registerTool`, then one `flushToolChanges()` — one `toolchange` for the whole set.

### 3. We already normalize results and errors

`useWebMCP` wraps execute to normalize return values. We do the same explicitly:

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
              ├── buildFilmTools()       — 15 tools, withToolAnnotations + withSafeExecute
              ├── register get_storybook first — agents can poll readiness immediately
              ├── register rest (silent)
              └── flushToolChanges()     — one toolchange
```

**`WebMCPBridge`** (`components/WebMCPBridge.tsx`) mounts once in the app tree. Registration is deferred until after hydration (double `requestAnimationFrame`) so `localStorage` storybook state is stable before agents call `get_storybook`. A small badge shows `WebMCP · 15` when live.

**`window.__openDotsWebmcp`** stores `{ apiRef, generation, native, count }`. `generation` is stable for the document load (`performance.timeOrigin`); it changes only on refresh/navigation. `syncWebmcpApiRef` keeps `sharedApiRef.current` pointing at the latest editor API without re-registering tool names.

**`withToolAnnotations`** defaults missing `readOnlyHint` to `false` (write). Cursor and other hosts classify tools from this field; omitting it hides mutating tools.

**`get_storybook` first:** during the registering phase, only `get_storybook` may be available. It exposes `webmcp.ready`, `webmcp.phase`, `webmcp.generation`, `webmcp.toolCount`, and a refresh hint so agents can poll instead of failing opaque “tool not found” errors.

## Agent workflow after refresh

A full page reload **unloads** all `document.modelContext` registrations and **invalidates** the host’s tool snapshot. In-flight calls that referenced pre-refresh tool handles fail.

Storybook data (pages, assets, named color profiles) **persists** in `localStorage`. After refresh:

1. **Re-fetch live tools** from `document.modelContext` (do not reuse a pre-refresh snapshot).
2. **Poll `get_storybook`** until `webmcp.ready === true` (and `webmcp.phase === "ready"`).
3. **Note `webmcp.generation`** — if it changes, treat prior tool handles as stale.
4. **Call `get_storybook`** again to recover asset ids, page indices, and `agentChecklist`.
5. Then mutate (`add_asset`, `draw_asset_pixels`, `stamp_assets`, …).

`get_storybook` sets `nextRequired` while `webmcp.ready` is false so agents wait instead of drawing blind.

Typical session start after tools are ready: `get_pixel_art_guide` → `set_palette` → decompose scene into small assets → outline/fill/shade passes with inline PNG compare → `stamp_assets` overlays back-to-front (floor tiles → emblem/shadows → furniture → plants/characters) → `get_page_image` with `sceneHint` check.

## Chrome best practices we follow

Aligned with [Chrome’s WebMCP docs](https://developer.chrome.com/docs/ai/webmcp) and [eval guidance](https://developer.chrome.com/docs/ai/webmcp/evals):

| Practice | How Open Dots implements it |
| --- | --- |
| **`readOnlyHint` on every tool** | `withToolAnnotations` in `lib/webmcp-polyfill.ts`; getters set `readOnlyHint: true` |
| **JSON Schema** | Each tool has `inputSchema: { type: "object", properties, required, enum, maxItems }` |
| **Intent-rich descriptions** | Each tool says what it does, when to use it, and key constraints (coords, erase via `color ""`, PNG feedback) — no repo file paths |
| **Graceful errors** | `toolError()` for validation; `withSafeExecute` backstop for runtime throws |
| **Stable registration** | Page-lifetime tools; HMR updates closures in place; batched `toolchange` |
| **Vision loop** | Mutating asset tools return inline PNG + `passHint` / `nextRequired`; `get_page_image` composites overlay stamps and returns `sceneHint` (few placements, huge stamps, full-page paint, noisy colorCount) |
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

For Open Dots, the agent API is **application-global**: the same 15 tools should remain discoverable for the whole editing session, across React remounts and HMR. Page-lifetime registration via `WebMCPBridge` + `registerFilmTools` matches that model; `use-webmcp-tool` does not.

## Related files

| File | Role |
| --- | --- |
| `components/WebMCPBridge.tsx` | Bootstrap registration after hydration |
| `lib/webmcp-polyfill.ts` | `document.modelContext` polyfill, `withToolAnnotations`, silent batch |
| `lib/register-tools.ts` | Tool definitions, `registerFilmTools`, `withSafeExecute`, `__openDotsWebmcp` |
| `lib/tool-result.ts` | `toolResult`, `toolError`, `toolResultWithImage` |
| `evals/open-dots.evals.json` | Chrome-format eval cases |
| `scripts/webmcp-evals.ts` | Deterministic test runner |
