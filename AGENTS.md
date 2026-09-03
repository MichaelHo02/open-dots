<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- Keep the landing UI as a blank canvas: no on-page story forms, hint copy, or page footnotes. Story is told to the agent in chat, not typed into the site.
- Use light mode and Figma theme tokens from `DESIGN.md` (`npx getdesign@latest add figma`). Prefer icon libraries (lucide) and Figma-like chrome over homemade pixel PNGs; use custom SVG cursors per tool.
- Run local `npm run dev` and verify in the browser before extra UI or production deploys.
- Keep the top toolbar compact with icon buttons, accessible names, and hover/focus descriptions. Text and other inspector controls remain labeled and fully visible; avoid clipped labels, overlapping pills, and a doubled “+” on + Page.
- Story text belongs on the canvas as pixel text rasterized into the grid (Text tool: Inter only, numeric size 1–8 with live preview), not HTML textarea overlays. Decorations are a separate Shape tool that rasterizes circle, rectangle, square, heart, or star into pixels — not comic speech/thought bubbles or captions under the page.
- Prefer presentation/slide mode for reading the book over an export-book flow; Present may animate multi-frame assets (hover on a placed sprite plays a loop, e.g. walking character).
- Product is **Open Dots**, a children's picture-book canvas. Call the writing tool Text, not Type. Brand the nav with `--brand-accent`; logo mark is dotmatrix `dotm-circular-7` via shadcn registry.
- Keep chrome as a mix of top bar and sidebar (Canva-like), not all controls in one strip. Left sidebar stays always visible — never collapse it for Draw/Erase/Fill/Move; show the asset library or contextual empty state instead. Color swatches live on the left sidebar (unlimited, plus a New color button that opens a pick → Save/Cancel popover; do not add a swatch until Save); page density lives in the selected canvas right inspector; zoom stays global.
- Draw and Erase brush size is a 1–24 right-inspector slider (not pills), separate from page pixel density (Pixilart-style stamp vs canvas W×H).
- Asset workflow is Lego-style: persistent storybook asset library; design sprites in an **Asset workshop** that **replaces the main stage** (not a right drawer). Stamp at native 1:1 on click; proportional scale only when drag-resizing.
- **Agents building from reference images** must decompose dense scenes into MANY small assets (≤96×96px each, max 100 in library; a rich room needs 12–30+), not paint whole pages pixel-by-pixel. Use image generation for complex organic characters/props when available and import each clean PNG; use `paint_asset` for deliberate pixel cleanup, simple sprites, and animation frames. The recurring failure is a sparse, flat "decorated wall" (4–5 big 1-tone objects on empty canvas) instead of a full, layered scene. **Start with `get_pixel_art_guide`** (topic `full` or `workflow`), compare every asset PNG, stamp back-to-front, then inspect full-page and cropped PNGs rather than trusting counts alone.
- Let WebMCP agents create **multiple named color profiles** via `set_palette` (pass `name` + any number of swatches). Profiles are reusable working sets for material or asset families, never hard-bound to one asset; most bespoke assets may use their own profile while related assets reuse one. Rich scenes can naturally exceed 100 unique colors through purposeful shadow, reflected-light, base, and highlight ramps. The built-in **Default** profile is always preserved. Palette size is unlimited, and extra #rrggbb colors can be used inline. Tool-facing strings must not cite repository files.

## Learned Workspace Facts

- This is a WebMCP Challenge app (**Open Dots**): pixel-art picture-book pages drawn by hand or via `document.modelContext` tools. **12 agent-focused WebMCP tools** (4 read / 8 write; irreversible page/asset deletion stays in the confirmed human UI). **Agent-native harness** — optimize for agent draw/compose/verify, not human UI mirrors (brush, workshop, tool picker, stage zoom stay UI-only). Match [pixel-art-cli](https://github.com/vossenwout/pixel-art-cli) minimal surface (`set_pixel`/`fill_rect`/`line`/`clear` + export/undo) + mandatory vision loop; Open Dots adds bulk draw (rects/lines/fills + 4,096 px/call), reusable assets, and multi-page stamp. `paint_asset` and `paint_page` take **rects/lines/fills/pixels** in one call — one rect fills any block server-side (no per-pixel cap); `color ""` erases (replaces `clear_rect`). **Every tool must set `annotations.readOnlyHint`** (`true` for getters, `false` for mutations). `withToolAnnotations` in `lib/webmcp-polyfill.ts` defaults missing hints to write. Keep route-scoped registration in `WebMCPBridge`: pass one shared `AbortSignal` to all tools and abort when the editor unmounts; see `docs/webmcp.md`. Run evals with `npm run test:webmcp`.
- Public repo is `https://github.com/MichaelHo02/open-dots` (MIT); live URL is `https://opendots.thach.app`.
- Pages are landscape rectangles; pixel density is per-page (max 256×144 landscape), not a global scale; canvases should not use border-radius. Editor checker/grid cell count tracks `page.width` × `page.height` and retiles when density changes.
- On-canvas **Text** rasterizes words into `page.pixels` (bitmap glyphs), not HTML overlays. **Shape** drag-sizes circle/rectangle/square/heart/star. DrawTool ids are `text` and `shape`.
- WebMCP tool results include text JSON plus PNG images from `get_asset_image` and `get_page_image` for vision-capable agents. **Mutating asset tools (`paint_asset`, `add_asset` with pixels) auto-return inline PNG + `nextRequired`/`passHint`** — the harness enforces compare-before-next-pass. `get_asset_image` accepts `frameIndex`; `get_page_image` composites overlay stamps and reports composition evidence. Treat color and placement counts as evidence only: inspect full-page and cropped PNGs. `get_storybook` exposes palettes, asset frame metadata, placements, the agent checklist, and readiness.
- **WebMCP after refresh:** `document.modelContext` tools live with the document. A reload unregisters them and **invalidates the host's tool snapshot** (in-flight `add_asset` etc. fail). Re-fetch live tools; wait until `get_storybook.webmcp.ready` is true before mutating. **Storybook data persists in localStorage** — after refresh, call `get_storybook` to recover asset ids.
- Storybook **assets** (`{ id, name, width, height, pixels }`) live in a persistent library; **stamp_assets adds movable overlay placements** (`{ id, assetId, x, y, width, height }`) on a page — they are **not baked into `page.pixels`**. Transparent asset pixels do not punch holes; Move repositions placements. Existing baked pages stay as pixels. Agents call **`get_pixel_art_guide`** early, then `add_asset` (template `empty`, comma-separated `rows`, solid `fill`, or page-rect copy), refine with `paint_asset` in passes (outline → fill → shade → highlight), inspect with inline PNG or `get_asset_image`, and compose pages with `stamp_assets` (floor tiles → emblem/shadows → furniture → plants/characters; repeat stamps). Bulk advantage over pxcli's one-pixel-at-a-time: a single `rects`/`lines`/`fills` op fills any region server-side, plus up to 4,096 detail pixels/call. Each asset side ≤96px; library holds ≤100.
- Multi-frame assets store ordered pixel buffers. WebMCP `paint_asset` uses `frameIndex` to edit/append frames and `frameDuration` for timing; `get_asset_image` inspects a selected frame. Present mode respects per-asset timing and reduced-motion preferences.
- Present mode is the reader: full-screen slides, arrow keys or page-side clicks to turn.
- dotmatrix (shadcn registry) is for logo/loader chrome only — not pixel fonts or canvas rendering; Text uses `lib/pixel-font.ts`.

## Agent quality asset checklist

When building sprites from a reference image or scene description:

0. **After refresh/navigation** — Re-fetch live WebMCP tools; wait until `get_storybook.webmcp.ready` before mutating. Call `get_storybook` to recover asset ids and color profiles (`palettes`, `activePaletteId`).
1. **Load guide** — Call `get_pixel_art_guide` (topic `full`) at session start.
2. **Decompose** — Break the scene into 8×8–48×48 sprites (tiles, props, characters). Never one-shot a complex sprite in a single `add_asset` call.
3. **Profiles first** — Create several named profiles for material/asset families with shadow, reflected-light, base, and highlight ramps. Profiles are reusable, not asset bindings; 100+ combined scene colors is normal. After refresh, `get_storybook.palettes` lists them.
4. **Blank canvas** — `add_asset` with `template: "empty"`, `width`, `height` (32×32 default for characters).
5. **Iterate regions** — `paint_asset` in passes: outline (lines/rects, #000) → fill (fills/rects) → shade → highlights. rects/lines/fills fill blocks with no per-pixel cap; the `pixels` array (≤4,096/call) is for fine detail and applies last.
6. **Verify visually** — inline PNG on every `paint_asset` / `add_asset` (with pixels) response; also `get_asset_image` for extra compare.
7. **Erase mistakes** — paint a `rects` op with `color ""` over the region, then repaint (no `clear_rect`/`undo` tool).
8. **Compose** — `stamp_assets` overlay placements back-to-front: floor tiles → emblem/shadows → furniture → plants/characters (repeat stamps, e.g. plants ×4). `get_page_image` (region crop) to compare against the reference; read `sceneHint`.
9. **Page paint** — `paint_page` (rects/lines/fills/pixels, optional `offsetX`/`offsetY` tiling) for flat backgrounds and touch-ups; not for building character/prop sprites.

- Clicking a canvas selects it and opens its right settings sidebar without painting. Keep tool settings contextual there; open the inspector after the selection pointer ends so layout changes do not shift a drawing gesture.
