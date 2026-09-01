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
- Story text belongs on the canvas as pixel text rasterized into the grid (Text tool: font + size), not HTML textarea overlays. Decorations are a separate Shape tool that rasterizes circle, rectangle, square, heart, or star into pixels — not comic speech/thought bubbles or captions under the page.
- Prefer presentation/slide mode for reading the book over an export-book flow.
- Treat the product as a children’s picture-book canvas; “film” naming is misleading. Call the writing tool Text, not Type.
- Keep chrome as a mix of top bar and sidebar (Canva-like), not all controls in one strip. Left sidebar stays always visible — never collapse it for Draw/Erase/Fill/Move; show the asset library or contextual empty state instead. Color and density live on the access bar.
- Draw and Erase brush size is separate from page pixel density (Pixilart-style brush size vs canvas W×H).
- Asset workflow is Lego-style: always show a persistent film-level asset library for stamp/reuse; remove “Save asset” sidebar clutter. Design character/land assets once, stamp across pages.
- Present mode may animate multi-frame assets: hover on a placed sprite plays a loop (e.g., walking character).

## Learned Workspace Facts

- This is a WebMCP Challenge app: pixel-art picture-book pages drawn by hand or via `document.modelContext` tools.
- Public repo is `https://github.com/MichaelHo02/pixel-film-studio` (MIT); live URL is `https://pixel-film-studio.vercel.app`.
- Pages are landscape rectangles; pixel density is per-page, not a global scale; canvases should not use border-radius. Editor checker/grid cell count tracks `page.width` × `page.height` and retiles when density changes.
- On-canvas **Text** rasterizes words into `page.pixels` (bitmap glyphs), not HTML overlays. **Shape** drag-sizes circle/rectangle/square/heart/star. DrawTool ids are `text` and `shape`.
- Brush size for Draw/Erase is a tool setting distinct from page W×H density.
- Film-level **assets** (`{ id, name, width, height, pixels }`) live in a persistent library; stamp by nearest-neighbor like game pixel art. Agents can add assets via WebMCP. Shape still rasterizes primitives without a saved asset.
- Multi-frame assets store an ordered list of pixel buffers; Present hover cycles frames for loop animation.
- Present mode is the reader: full-screen slides, arrow keys or page-side clicks to turn.
