/** Run: node --import tsx scripts/board-check.ts */
import assert from "node:assert/strict";
import { compositePage, hitPlacementAt } from "../lib/draw";
import { readingOrder, type Page, type Asset, type Placement } from "../lib/types";

const asset: Asset = { id: "sprite", name: "Sprite", width: 2, height: 1, pixels: ["#ff0000", ""] };
const base = Array(8).fill("#00ff00");
const placement: Placement = { id: "stamp", assetId: asset.id, x: 0, y: 0, width: 2, height: 1 };
const resolve = (id: string) => id === asset.id ? asset : undefined;
assert.equal(hitPlacementAt([placement], 0, 0, resolve)?.id, placement.id);
assert.equal(hitPlacementAt([placement], 1, 0, resolve), null);
const rendered = compositePage(base, { width: 4, height: 2 }, [placement], resolve);
assert.deepEqual(rendered.slice(0, 2), ["#ff0000", "#00ff00"]);
assert.deepEqual(base, Array(8).fill("#00ff00"));
const moved = compositePage(base, { width: 4, height: 2 }, [{ ...placement, x: 2 }], resolve);
assert.deepEqual(moved.slice(0, 4), ["#00ff00", "#00ff00", "#ff0000", "#00ff00"]);
assert.deepEqual(compositePage(base, { width: 4, height: 2 }, [placement], () => undefined), base);
const page = (id: string, nextPageId: string | null): Page => ({ id, nextPageId, width: 4, height: 2, pixels: base, placements: [], texts: [], boardX: 0, boardY: 0 });
const pages = [page("a", "c"), page("b", null), page("c", null)];
assert.deepEqual(readingOrder(pages).map(p => p.id), ["a", "c", "b"]);
assert.deepEqual(readingOrder([page("a", "b"), page("b", "a")]).map(p => p.id), ["a", "b"]);
assert.deepEqual(readingOrder([page("a", "missing"), page("b", null)]).map(p => p.id), ["a", "b"]);
console.log("PASS: overlay transparency, movement, base preservation, missing assets, story order and cycles");
