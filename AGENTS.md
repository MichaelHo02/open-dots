<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- Keep the landing UI as a blank canvas: no on-page story forms, hint copy, or page footnotes. Story is told to the agent in chat, not typed into the site.
- Use light mode and Figma theme tokens from `DESIGN.md` (`npx getdesign@latest add figma`). Prefer icon libraries (lucide) and Figma-like chrome over homemade pixel PNGs; use custom SVG cursors per tool.
- Run local `npm run dev` and verify in the browser before extra UI or production deploys.
- Toolbar and Text controls must be labeled and fully visible; unlabeled native widgets, clipped labels, overlapping pills, and a doubled “+” on + Page are confusing.
- Story text belongs on the canvas as pixel text rasterized into the grid (Text tool: Inter only, numeric size 1–8 with live preview), not HTML textarea overlays. Decorations are a separate Shape tool that rasterizes circle, rectangle, square, heart, or star into pixels — not comic speech/thought bubbles or captions under the page.
- Prefer presentation/slide mode for reading the book over an export-book flow; Present may animate multi-frame assets (hover on a placed sprite plays a loop, e.g. walking character).
- Product is **Open Dots** (children's picture-book canvas; "film"/"Pixel Book" names are outdated). Call the writing tool Text, not Type. Brand the nav with `--brand-accent`; logo mark is dotmatrix `dotm-circular-7` via shadcn registry.
- Keep chrome as a mix of top bar and sidebar (Canva-like), not all controls in one strip. Left sidebar stays always visible — never collapse it for Draw/Erase/Fill/Move; show the asset library or contextual empty state instead. Color and density live on the access bar.
- Draw and Erase brush size is a 1–24 access-bar slider (not pills), separate from page pixel density (Pixilart-style stamp vs canvas W×H).
- Asset workflow is Lego-style: persistent film-level asset library; design sprites in an **Asset workshop** that **replaces the main stage** (not a right drawer). Stamp at native 1:1 on click; proportional scale only when drag-resizing.
- **Agents building from reference images** must decompose dense scenes into small assets (≤96×96px each, max 48 in library), not paint whole pages pixel-by-pixel. Workflow: `set_palette` → `add_asset` (template `empty` at 8×8–48×48) → `draw_asset_pixels` in regional chunks → `get_asset` to verify → `stamp_assets` back-to-front (floor → furniture → characters). Use `draw_pixels` only for tiny page touch-ups or tiled 32×32 regions (max 4,096 pixels/call); use `clear_rect` to erase before redraw.
- Let WebMCP agents set/replace the color swatch theme; keep built-in PALETTE as default so users reuse agent-designed themes instead of manual hex picking.

## Learned Workspace Facts

- This is a WebMCP Challenge app (**Open Dots**): pixel-art picture-book pages drawn by hand or via `document.modelContext` tools.
- Public repo is `https://github.com/MichaelHo02/pixel-film-studio` (MIT); live URL is `https://pixel-film-studio.vercel.app`.
- Pages are landscape rectangles; pixel density is per-page (max 256×144 landscape), not a global scale; canvases should not use border-radius. Editor checker/grid cell count tracks `page.width` × `page.height` and retiles when density changes.
- On-canvas **Text** rasterizes words into `page.pixels` (bitmap glyphs), not HTML overlays. **Shape** drag-sizes circle/rectangle/square/heart/star. DrawTool ids are `text` and `shape`.
- WebMCP tool results are text-only JSON; agents verify pixel art via `get_asset` `rows` (comma-separated hex per row), not images.
- Film-level **assets** (`{ id, name, width, height, pixels }`) live in a persistent library; stamp by nearest-neighbor like game pixel art (native size on click, proportional drag to scale). Agents add assets via WebMCP `add_asset` (template `empty`, pixels, comma-separated `rows`, solid `fill`, or page-rect copy), refine with `draw_asset_pixels` / `clear_rect`, inspect with `get_asset`, fork variants with `duplicate_asset`, and compose pages with `stamp_asset` / `stamp_assets` (batch). Each asset side ≤96px; library holds ≤48. Shape still rasterizes primitives without a saved asset.
- Multi-frame assets store an ordered list of pixel buffers; Present hover cycles frames for loop animation.
- Present mode is the reader: full-screen slides, arrow keys or page-side clicks to turn.
- dotmatrix (shadcn registry) is for logo/loader chrome only — not pixel fonts or canvas rendering; Text uses `lib/pixel-font.ts`.

## Agent quality asset checklist

When building sprites from a reference image or scene description:

1. **Decompose** — Break the scene into 8×8–48×48 sprites (tiles, props, characters). Never one-shot a complex sprite in a single `add_asset` call.
2. **Theme first** — Call `set_palette` with 6–10 harmonious swatches before drawing.
3. **Blank canvas** — `add_asset` with `template: "empty"`, `width`, `height` (32×32 is a good default for characters).
4. **Iterate regions** — `draw_asset_pixels` in chunks (outline → fill → shading → highlights). A full 32×32 = 1,024 pixels; max 4,096/call fits a 64×64 asset.
5. **Verify** — `get_asset` returns `rows` (comma-separated per row) — read back and fix mistakes.
6. **Erase mistakes** — `clear_rect` with `target: "asset"` before redrawing a region.
7. **Variants** — `duplicate_asset` for outfit/pose copies, then patch with `draw_asset_pixels`.
8. **Compose** — `stamp_assets` back-to-front: sky → floor → walls → furniture → props → characters. Use `scale: 1` for crisp pixels.
9. **Page touch-ups only** — `draw_pixels` with optional `offsetX`/`offsetY` for tiled page edits; not for building sprites.
