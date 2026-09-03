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

## Fixed page editor — 2026-09-03

Supersedes the freeform board UI: one fixed canvas, bottom numbered thumbnails,
New page appended in array order, retained right inspector, and Present in the
same numbered order. Legacy board metadata remains readable for saved books.

Verified in the user's localhost browser: first canvas click opens settings
without changing the get_page_image result; New page selects Page 3 and shows
3 / 3; removing that temporary page restores two pages; Page 1 selects the matching
inspector; Present advances 1 / 2 to 2 / 2. Existing Page 2 image stayed identical
after the checks. Browser error log was empty. No existing page was deleted.

Extended scripts/inspector-browser-check.js with an append/select/delete regression
check. Syntax checked; equivalent lifecycle was exercised through browser tools.
TypeScript and targeted ESLint passed (seven existing store warnings, no errors).
Production build passed with `npx next build --webpack`; default Turbopack failed
because its CSS worker could not bind a local port in this environment.

## Named page layers — 2026-09-03

Each page now has ordered named layers containing paint plus movable asset
placements. Existing artwork is preserved in a Background layer. The right
inspector supports select, rename, visibility, lock, reorder, and Flatten assets.
Flatten composites all placements into that layer's paint without changing its
appearance; Undo restores the placements. Painting and stamping target the active
layer. Hidden/locked layers reject edits. Asset placement has a hover preview,
and selecting a drawing tool cancels stamping even if that tool was already active.

Browser verification used a temporary third page: named Floor and Characters;
stamped a library trainer; checked flatten PNG equality and Undo restoring the
asset row; locked Characters and confirmed a Draw click left its image unchanged;
reloaded and verified names/lock/placement persisted; hid/showed and reordered the
layer. Removed only the temporary page, selected existing Page 1, and confirmed
its get_page_image result was identical to the pre-check result.

Runnable checks: `node --import tsx scripts/layers-check.ts` (composition/legacy
art), `node --import tsx scripts/layers-store-check.ts` (actual store edit guards,
isolation, flatten/undo), and `node --import tsx scripts/webmcp-evals.ts` (19/19).
The node --import form avoids the tsx CLI's sandbox-blocked IPC socket.
Final production build: `npx next build --webpack` passed. Targeted ESLint had
zero errors and eight pre-existing warnings. TypeScript passed. Additional
store regressions confirmed lifted/moved pixel selections survive layer changes.

## Layer deletion and compact controls — 2026-09-03

Selected-layer trash button deletes an unlocked layer; last layer is protected.
Undo restores content, order and selection. Actual-store regression covers those
cases and invalid IDs. Density/brush/zoom now use minus, value, plus (Fit retained).
Browser verified delete/Undo on a temporary layer, density minimum disabling and
48×27 → 64×36, brush 1×1 → 2×2, zoom 100% → 125%. Removed the temporary test page
and reset brush/zoom. TypeScript, targeted lint and regression checks passed.

## Standard pixel-editor priority 1 and 2 — 2026-09-03

Added Undo/Redo history and shortcuts; dedicated Select and Line tools;
continuous interpolated strokes; project JSON save/open with strict validation;
page PNG export; placement delete/duplicate/proportional resize/flip/stacking/layer
transfer; pixel copy/cut/paste/duplicate/delete; layer previews/duplicate/merge;
Shift constraints; symmetry and explicit grid controls; and separate Scale art versus
Canvas bounds resizing.

Browser verification used the disposable blank Page 2: drew a fast continuous line,
Undo/Redo restored it, drew a straight Line, selected and cut/pasted pixels, sampled
with the color controls, placed and transformed a trainer, exercised placement delete/Undo,
duplicated and merged a layer with Undo, and opened the File actions. Store checks
cover history invalidation, placement/layer locks and transforms, clipboard, both
resize modes, workshop history/line drawing, and strict project round-trip rejection.
`stroke-check.ts` covers interpolation and symmetry; layer compositing checks cover
flipped transparency. WebMCP checks remain 19/19. Webpack production build passed.
