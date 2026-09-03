# Board and movable stamps verification — 2026-09-03

Verified against `npm run dev` at localhost:3000 in an isolated Playwright browser session. Existing user artwork was not changed.

- WebMCP created an 8×8 sprite with transparent cells and stamped it over a colored page.
- Real pointer drag first hit the page boundary, then moved the overlay from (0,8) to (20,12). Background pixels were identical before and after.
- Undo restored (0,8) without removing the stamp. Reload retained the placement.
- Canvas pixel reads confirmed opaque sprite cells and the background beneath transparent cells.
- Page header dragging changed saved board coordinates. Background dragging panned the board.
- Added pages, changed story links, dragged a connector at 75% zoom, and checked that links and board positions survived reload.
- Present followed a link to a page identified by its distinct color, rather than array order.
- A fresh disposable browser context loaded two legacy pages without coordinates; migration positioned them separately at x=0 and x=392.
- Inactive page preview canvas width matched its board node after the CSS fix.

Automated checks:

```sh
node --import tsx scripts/board-check.ts
node --import tsx scripts/webmcp-evals.ts
npx tsc --noEmit
npm run lint
npm run build
```

The board regression assertions, 19 WebMCP checks, TypeScript, and production build passed. Lint has zero errors; existing unused-variable/dependency warnings remain. The direct `node --import tsx` runner avoids the sandbox IPC permission error from the `tsx` CLI.

Existing artwork previously baked into page pixels remains raster artwork; only overlay placements retain independent asset movement. No production deployment or live-site verification was performed.

## Canvas inspector and compact toolbar

Verified in the user's Codex in-app browser on 2026-09-03:

- Clicking a canvas opens its density and contextual tool controls on the right. A before/after `get_page_image` comparison was identical, confirming that the inspection click did not paint.
- Selecting Page 2 updates the inspector heading to Page 2.
- Text size and Shape/Fill controls appear for their respective tools.
- Icon buttons expose accessible names and active states. Keyboard focus shows the Shape description; mouse hover shows the Move description.
- The left palette/library remains visible, and global zoom remains outside the inspector. Checked the normal 1250px viewport and a temporary 900px viewport, then restored the normal size.
- Dense artwork stays readable because the editor grid is hidden below four CSS pixels per cell.
- Production build and targeted lint passed. Added `scripts/inspector-browser-check.js` as a replayable Playwright CLI regression; syntax checked it with Node. The interaction assertions above were exercised directly through Codex browser controls.
