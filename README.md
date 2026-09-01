# Pixel Book

A picture-book canvas. Draw each page, place words and shapes on the art, then present the story — or ask an agent to paint through WebMCP.

Built for the [WebMCP Challenge](https://webmcp.devpost.com/). Theme tokens come from [DESIGN.md](./DESIGN.md) (`npx getdesign@latest add figma`).

**Live URL:** [https://pixel-film-studio.vercel.app](https://pixel-film-studio.vercel.app)

## What it is

You land on a blank landscape page. Draw the scene, place words with **Text** and pixel decorations with **Shape**, then **Present** to flip through the book.

- **You** draw with pencil, eraser, and fill. **Text** writes words (font + size). **Shape** drag-sizes a circle, rectangle, square, heart, or star into the pixel grid. Save a stamp as an **asset** and reuse it.
- **An agent** uses `document.modelContext` tools. For complex art, build small **assets** (`add_asset`) and **stamp** them (`stamp_assets`); avoid painting entire pages pixel-by-pixel.
- **Present** reads the book full-screen. Arrow keys or the sides of the page turn slides.

## WebMCP tools

| Tool | What it does |
| --- | --- |
| `get_film` | Page list, canvas size, palette, asset ids/names/sizes, and active index |
| `set_canvas` | Density for the **active page** only |
| `set_brief` | Optional note |
| `set_palette` | Replace Color swatches with 4–16 `#rrggbb` colors (optional `name`); `add_swatch` / `reset_palette` |
| `add_page` | New blank page, or `draw` a visual beat |
| `select_page` / `remove_page` | Move around the book |
| `place_text` | Rasterize story words on the page (`font`: inter / geist-mono, `size` 1–8) |
| `place_shape` | Rasterize a pixel circle, rectangle, square, heart, or star (like the Shape tool) |
| `list_assets` / `add_asset` / `stamp_asset` / `stamp_assets` / `remove_asset` | Reusable pixel assets — prefer batch `stamp_assets` to compose scenes |
| `draw_pixels` | Tiny touch-ups only (max 4,096 pixels/call — use `add_asset` for sprites) |
| `clear_page` | Back to blank |

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test WebMCP

1. Draw on the canvas, or add a page.
2. In ChatGPT’s in-app browser or Chrome with `chrome://flags/#enable-webmcp-testing`, tell the agent your story and ask it to `set_palette` → `add_asset` → `stamp_assets`.
3. The same tools register via `document.modelContext.registerTool`.

## License

MIT. See [LICENSE](./LICENSE).
