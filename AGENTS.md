<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- Keep the landing UI as a blank canvas: no on-page story forms, hint copy, or page footnotes. Story is told to the agent in chat, not typed into the site.
- Use light mode and Figma theme tokens from `DESIGN.md` (`npx getdesign@latest add figma`).
- Run local `npm run dev` and verify in the browser before extra UI or production deploys.
- Toolbar and type controls must be labeled and obvious; unlabeled native widgets (for example a bare color input) are confusing.
- Story text belongs on the canvas in speech/thought-style bubbles, not as captions or narrative under the page.
- Prefer presentation/slide mode for reading the book over an export-book flow.
- Treat the product as a children’s picture-book canvas; “film” naming is misleading.

## Learned Workspace Facts

- This is a WebMCP Challenge app: pixel-art picture-book pages drawn by hand or via `document.modelContext` tools.
- Public repo is `https://github.com/MichaelHo02/pixel-film-studio` (MIT); live URL is `https://pixel-film-studio.vercel.app`.
- Pages are landscape rectangles; pixel density is per-page, not a global scale; canvases should not use border-radius.
- On-canvas text uses bubble frames (speech, thought, shout, caption, plain).
- Present mode is the reader: full-screen slides, arrow keys or page-side clicks to turn.
