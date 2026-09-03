/** Run: node --import tsx scripts/editor-store-check.ts */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { FilmProvider, useFilm } from "../lib/film-store";
import { compositedPagePixels } from "../lib/draw";
import { pageLayers, type FilmApi, type Page } from "../lib/types";

let captured: FilmApi | null = null;
function Probe() {
  // eslint-disable-next-line react-hooks/globals -- SSR-only capture of the real editor store.
  captured = useFilm();
  return null;
}
renderToString(createElement(FilmProvider, null, createElement(Probe)));
const api = captured as unknown as FilmApi;
assert.ok(api);
const page = () => api.active as Page;
const image = () => compositedPagePixels(page(), api.film.assets);
const pixel = (x: number, y: number) => page().pixels[y * page().width + x];
const fresh = () => api.addPage();

api.drawPixels([{ x: 0, y: 0, color: "#ff0000" }]);
assert.equal(api.canUndo, true);
assert.equal(api.undo(), true);
assert.equal(pixel(0, 0), "");
assert.equal(api.canRedo, true);
assert.equal(api.redo(), true);
assert.equal(pixel(0, 0), "#ff0000");
api.undo();
api.drawPixels([{ x: 1, y: 0, color: "#00ff00" }]);
assert.equal(api.redo(), false, "editing after undo invalidates redo");

const asset = api.addAsset({ name: "two colors", width: 2, height: 1, pixels: ["#ff0000", "#0000ff"] });
assert.ok(asset);
fresh();
const original = api.stampAsset({ id: asset.id, x: 4, y: 4 });
assert.ok(original);
assert.equal(api.flipPlacement(original.id, "x"), true);
assert.equal(image()[4 * page().width + 4], "#0000ff");
assert.equal(api.undo(), true);
assert.equal(image()[4 * page().width + 4], "#ff0000");
assert.equal(api.redo(), true);
const duplicate = api.duplicatePlacement(original.id);
assert.ok(duplicate);
assert.notEqual(duplicate.id, original.id);
assert.equal(duplicate.flipX, true);
assert.equal(api.resizePlacement(duplicate.id, 8, 8), true);
let resized = page().placements.find((p) => p.id === duplicate.id)!;
assert.deepEqual([resized.width, resized.height], [8, 4], "resize preserves sprite proportions");
assert.equal(api.resizePlacement(duplicate.id, Infinity, 8), false);
assert.equal(api.reorderPlacement(duplicate.id, -1), true);
assert.equal(page().placements[0].id, duplicate.id);
const source = page().activeLayerId!;
const target = api.addLayer()!;
api.selectLayer(source);
assert.equal(api.movePlacementToLayer(duplicate.id, target.id), true);
assert.equal(page().activeLayerId, target.id);
assert.equal(page().placements[0].id, duplicate.id);
api.updateLayer(target.id, { locked: true });
const locked = JSON.stringify(page());
assert.equal(api.removePlacement(duplicate.id), false);
assert.equal(api.flipPlacement(duplicate.id, "y"), false);
assert.equal(api.resizePlacement(duplicate.id, 4, 2), false);
assert.equal(api.duplicatePlacement(duplicate.id), null);
assert.equal(JSON.stringify(page()), locked);
api.updateLayer(target.id, { locked: false });
assert.equal(api.removePlacement(duplicate.id), true);
assert.equal(api.undo(), true);
assert.equal(page().placements[0].id, duplicate.id);

const copyLayer = api.duplicateLayer(target.id)!;
assert.notEqual(copyLayer.id, target.id);
assert.notEqual(copyLayer.placements[0].id, duplicate.id);
const beforeMerge = image();
assert.equal(api.mergeLayerDown(copyLayer.id), true);
assert.deepEqual(image(), beforeMerge, "merge down preserves composed appearance");
assert.equal(api.undo(), true);
assert.deepEqual(image(), beforeMerge);
api.updateLayer(target.id, { locked: true });
assert.equal(api.mergeLayerDown(copyLayer.id), false);

fresh();
api.drawPixels([{ x: 4, y: 4, color: "#aa0000" }, { x: 5, y: 4, color: "#0000aa" }]);
api.liftMarquee(4, 4, 2, 1);
assert.equal(api.copySelection(), true);
assert.equal(api.cutSelection(), true);
assert.equal(pixel(4, 4), "");
assert.equal(api.pasteSelection(), true);
assert.equal(pixel(5, 5), "#aa0000");
assert.equal(pixel(6, 5), "#0000aa");
assert.equal(api.undo(), true);
assert.equal(pixel(5, 5), "");
assert.equal(api.redo(), true);
assert.equal(pixel(5, 5), "#aa0000");
api.liftMarquee(5, 5, 2, 1);
assert.equal(api.duplicateSelection(), true);
assert.equal(pixel(6, 6), "#aa0000");
assert.equal(api.deleteSelection(), true);
assert.equal(pixel(6, 6), "");
assert.equal(pixel(5, 5), "#aa0000", "deleting duplicate preserves original selection");

fresh();
api.setDensity(64);
api.drawPixels([{ x: 2, y: 2, color: "#ff0000" }]);
const scaledStamp = api.stampAsset({ id: asset.id, x: 10, y: 10 })!;
assert.equal(api.resizeCanvas(128, "scale"), true);
assert.equal(pixel(4, 4), "#ff0000");
assert.equal(pixel(5, 5), "#ff0000");
resized = page().placements.find((p) => p.id === scaledStamp.id)!;
assert.deepEqual([resized.x, resized.y, resized.width, resized.height], [20, 20, 4, 2]);
assert.equal(api.undo(), true);
assert.equal(page().width, 64);
assert.equal(pixel(2, 2), "#ff0000");
assert.equal(api.redo(), true);
assert.equal(page().width, 128);
assert.equal(api.resizeCanvas(64, "canvas"), true);
assert.equal(pixel(4, 4), "#ff0000", "canvas resize preserves pixel coordinates");
assert.equal(page().placements[0].x, 20, "canvas resize preserves placement coordinates");
api.undo();
assert.equal(page().width, 128);

assert.equal(api.openWorkshop(), true);
api.setWorkshopName("lines");
const nativeWidth = api.workshopDraft!.width;
api.setWorkshopSize(64);
assert.equal(api.undo(), true);
assert.equal(api.workshopDraft!.width, nativeWidth);
assert.equal(api.redo(), true);
assert.equal(api.workshopDraft!.pixels.length, 64 * 64);
api.setTool("line");
api.setColor("#00aa00");
api.setBrushSize(1);
api.paintLine(1, 1, 8, 1);
assert.equal(api.workshopDraft!.pixels.slice(65, 73).every((c) => c === "#00aa00"), true);
api.undo();
assert.equal(api.workshopDraft!.pixels[65], "");
api.redo();
assert.equal(api.workshopDraft!.pixels[65], "#00aa00");
api.undo();
api.paintLine(1, 2, 8, 2);
assert.equal(api.canRedo, false);
api.closeWorkshop(false);

const exported = JSON.parse(JSON.stringify(api.film));
const exportedImage = image();
assert.equal(api.importProject(exported), true, "the editor must import its own JSON");
assert.deepEqual(image(), exportedImage);
assert.equal(api.canUndo, false);
assert.equal(api.canRedo, false);
assert.equal(pageLayers(page()).length, exported.pages[exported.activeIndex].layers.length);
for (const invalid of [null, {}, { pages: [] }, { ...exported, activeIndex: -1 },
  { ...exported, pages: [{ ...exported.pages[0], pixels: ["not-a-color"] }] },
  { ...exported, assets: [{ ...exported.assets[0], width: 99999 }] }]) {
  const before = JSON.stringify(api.film);
  assert.equal(api.importProject(invalid), false);
  assert.equal(JSON.stringify(api.film), before, "invalid imports must preserve the current project");
}
console.log("PASS: redo, placement controls, layer duplicate/merge, clipboard, resize+undo, workshop line/history, strict import");
