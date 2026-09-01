# Pixel Book

A picture-book canvas. Draw each page, drop speech bubbles on the art, then present the story — or ask an agent to paint through WebMCP.

Built for the [WebMCP Challenge](https://webmcp.devpost.com/). Theme tokens come from [DESIGN.md](./DESIGN.md) (`npx getdesign@latest add figma`).

**Live URL:** [https://pixel-film-studio.vercel.app](https://pixel-film-studio.vercel.app)

## What it is

You land on a blank landscape page. Draw the scene, place words in speech / thought / shout / caption bubbles, then **Present** to flip through the book.

- **You** draw with pencil, eraser, and fill. **Type** drops a bubble on the page.
- **An agent** uses `document.modelContext` tools to paint pages and place bubbles.
- **Present** reads the book full-screen. Arrow keys or the sides of the page turn slides.

## WebMCP tools

| Tool | What it does |
| --- | --- |
| `get_film` | Page list, canvas size, and active index |
| `set_canvas` | Density for the **active page** only |
| `set_brief` | Optional note |
| `add_page` | New blank page, or `draw` a visual beat |
| `select_page` / `remove_page` | Move around the book |
| `place_text` / `set_text` / `move_text` / `remove_text` | Story text in a bubble (`frame`: speech, thought, shout, caption, plain) |
| `set_pixel` / `draw_pixels` | Paint |
| `fill_rect` / `draw_line` / `flood_fill` | Shape tools |
| `clear_page` | Back to blank |
| `draw_scene` | Paint a beat from a description (night, rain, city, two figures, …) |

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test WebMCP

1. Draw on the canvas, or add a page.
2. In ChatGPT’s in-app browser or Chrome with `chrome://flags/#enable-webmcp-testing`, tell the agent your story and ask it to `add_page` / `draw_scene`.
3. The same tools register via `document.modelContext.registerTool`.

## License

MIT. See [LICENSE](./LICENSE).
