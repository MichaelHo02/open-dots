/** Run: node --import tsx scripts/animation-check.ts */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { FilmProvider, useFilm } from "../lib/film-store";
import type { FilmApi } from "../lib/types";

let api: FilmApi | null = null;

function Probe() {
  // eslint-disable-next-line react-hooks/globals -- SSR-only probe captures the real store API for this check.
  api = useFilm();
  return null;
}

renderToString(createElement(FilmProvider, null, createElement(Probe)));
assert.ok(api, "FilmProvider should expose its API during SSR");

const store = api as FilmApi;
const asset = store.addAsset({ name: "blink", width: 2, height: 1, pixels: ["#111111", "#eeeeee"] });
assert.ok(asset);

assert.equal(store.drawAssetPixels(asset.id, [{ x: 1, y: 0, color: "#111111" }], 1, 1000), 1);
let animated = store.getAsset(asset.id)!;
assert.equal(animated.frames?.length, 2);
assert.deepEqual(animated.frames?.[0], ["#111111", "#eeeeee"]);
assert.deepEqual(animated.frames?.[1], ["#111111", "#111111"]);
assert.equal(animated.frameDuration, 1000);

assert.equal(store.drawAssetPixels(asset.id, [{ x: 0, y: 0, color: "#eeeeee" }], 0), 1);
animated = store.getAsset(asset.id)!;
assert.deepEqual(animated.pixels, ["#eeeeee", "#eeeeee"]);
assert.deepEqual(animated.frames?.[0], animated.pixels);

assert.equal(store.openWorkshop(asset.id), true);
assert.equal(store.workshopDraft?.frameDuration, 1000);
assert.equal(store.closeWorkshop(true), true);
assert.equal(store.getAsset(asset.id)?.frameDuration, 1000);

const copy = store.duplicateAsset(asset.id);
assert.equal(copy?.frameDuration, 1000);
assert.deepEqual(copy?.frames, store.getAsset(asset.id)?.frames);

console.log("PASS: tool-created animation frames, timing, workshop save, and duplication");
