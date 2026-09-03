/** Run: node --import tsx scripts/layers-store-check.ts */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { compositedPagePixels } from "../lib/draw";
import { FilmProvider, useFilm } from "../lib/film-store";
import type { FilmApi, Page } from "../lib/types";

let api: FilmApi | null = null;

function Probe() {
  // eslint-disable-next-line react-hooks/globals -- SSR-only probe captures the real store API for these checks.
  api = useFilm();
  return null;
}

renderToString(createElement(FilmProvider, null, createElement(Probe)));
assert.ok(api, "FilmProvider should expose its API during SSR");

const store = api as FilmApi;
const page = (): Page => {
  assert.ok(store.active, "expected an active page");
  return store.active;
};
const composed = () => compositedPagePixels(page(), store.film.assets);

assert.equal(store.drawPixels([{ x: 0, y: 0, color: "#aa0000" }]), 1);
const top = store.addLayer();
assert.ok(top, "expected a new layer");
assert.equal(store.drawPixels([{ x: 1, y: 0, color: "#00aa00" }]), 1);
assert.equal(page().layers?.length, 2, "drawing should stay on the selected layer");
assert.equal(page().layers?.[0]?.pixels[0], "#aa0000");
assert.equal(page().layers?.[1]?.pixels[1], "#00aa00");

const asset = store.addAsset({
  name: "blue dot",
  width: 1,
  height: 1,
  pixels: ["#0000aa"],
});
assert.ok(asset, "expected a test asset");

const unchanged = () => JSON.stringify(page());
assert.equal(store.updateLayer(top.id, { locked: true }), true);
let before = unchanged();
assert.equal(store.drawPixels([{ x: 2, y: 0, color: "#ffffff" }]), 0);
assert.equal(store.stampAsset({ id: asset.id, x: 2, y: 0 }), null);
assert.equal(store.clearRect({ target: "page", x: 0, y: 0, width: 1, height: 1 }), false);
store.clearPage();
assert.equal(unchanged(), before, "a locked layer must reject every page mutation");

assert.equal(store.updateLayer(top.id, { locked: false, visible: false }), true);
before = unchanged();
assert.equal(store.drawPixels([{ x: 2, y: 0, color: "#ffffff" }]), 0);
assert.equal(store.stampAsset({ id: asset.id, x: 2, y: 0 }), null);
assert.equal(store.clearRect({ target: "page", x: 0, y: 0, width: 1, height: 1 }), false);
store.clearPage();
assert.equal(unchanged(), before, "a hidden layer must reject every page mutation");

assert.equal(store.updateLayer(top.id, { visible: true }), true);
const placement = store.stampAsset({ id: asset.id, x: 2, y: 0, keepFloating: false });
assert.ok(placement, "expected an editable layer to accept a stamp");
const appearanceBeforeFlatten = composed();
const activeLayerIdBeforeFlatten = page().activeLayerId;
assert.equal(store.flattenLayer(), true);
assert.deepEqual(composed(), appearanceBeforeFlatten, "flattening must preserve composed pixels");
assert.equal(page().placements.length, 0, "flattening should bake the active layer placement");
assert.equal(store.undo(), true);
assert.deepEqual(composed(), appearanceBeforeFlatten, "undo should restore the composed appearance");
assert.equal(page().activeLayerId, activeLayerIdBeforeFlatten, "undo should restore active-layer metadata");
assert.equal(page().placements.length, 1, "undo should restore flattened placements");
assert.equal(page().placements[0]?.id, placement.id);

assert.equal(store.selectAsset(asset.id), true);
assert.equal(store.selectedAssetId, asset.id);
store.setTool(store.tool);
assert.equal(store.selectedAssetId, null, "reselecting the current tool must clear an asset stamp");

// Floating selections are already baked into their source layer on lift/move.
// Dropping their interaction metadata must never remove their pixels.
const manage = {
  select: (_source: string, other: string) => store.selectLayer(other),
  add: () => Boolean(store.addLayer()),
  lock: (source: string) => store.updateLayer(source, { locked: true }),
  hide: (source: string) => store.updateLayer(source, { visible: false }),
  reorder: (source: string) => store.moveLayer(source, 1),
};
for (const moved of [false, true]) {
  for (const [action, change] of Object.entries(manage)) {
    store.addPage();
    store.drawPixels([{ x: 4, y: 4, color: "#aa0000" }]);
    const source = page().activeLayerId!;
    const other = store.addLayer()!;
    store.selectLayer(source);
    assert.equal(store.liftMarquee(4, 4, 1, 1), true);
    if (moved) assert.equal(store.moveFloating(7, 4, true), true);
    assert.ok(store.floating);
    const pixels = [...page().pixels];
    assert.equal(pixels[4 * page().width + (moved ? 7 : 4)], "#aa0000");
    assert.equal(change(source, other.id), true);
    assert.equal(store.floating, null);
    assert.deepEqual(page().layers?.find((layer) => layer.id === source)?.pixels, pixels,
      `${action} must preserve ${moved ? "moved" : "lifted"} floating pixels in the source layer`);
  }
}

store.addPage();
store.drawPixels([{ x: 4, y: 4, color: "#aa0000" }]);
const undoSource = page().activeLayerId!;
const undoOther = store.addLayer()!;
store.selectLayer(undoSource);
store.liftMarquee(4, 4, 1, 1);
store.moveFloating(7, 4, true);
store.selectLayer(undoOther.id);
assert.equal(store.undo(), true);
assert.equal(page().activeLayerId, undoSource);
assert.equal(page().pixels[4 * page().width + 4], "#aa0000");
assert.equal(page().pixels[4 * page().width + 7], "",
  "undo after a layer switch must restore the pre-move snapshot without anchoring moved pixels");

console.log("PASS: layer isolation, edit guards, flatten undo metadata, stamp clear, floating selection preservation");
