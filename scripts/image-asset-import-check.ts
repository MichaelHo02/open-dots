import assert from "node:assert/strict";
import { fitAssetSize, indexedRowsToPixels, isSupportedImageDataUrl, opaqueBounds, quantizePixels } from "../lib/image-asset-import";

const data = new Uint8ClampedArray(4 * 3 * 4);
data[(1 * 4 + 1) * 4 + 3] = 255;
data[(1 * 4 + 2) * 4 + 3] = 255;
assert.deepEqual(opaqueBounds({ data, width: 4, height: 3 }), { x: 1, y: 1, width: 2, height: 1 });
assert.deepEqual(fitAssetSize(192, 96), { width: 96, height: 48 });
assert.deepEqual(quantizePixels({ data: new Uint8ClampedArray([250, 5, 5, 255, 0, 0, 0, 0]), width: 2, height: 1 }, ["#ff0000", "#0000ff"]), ["#ff0000", ""]);
assert.deepEqual(quantizePixels({ data: new Uint8ClampedArray([0, 0, 102, 255]), width: 1, height: 1 }, ["#000000", "#0000ff"]), ["#0000ff"]);
assert.deepEqual(indexedRowsToPixels([".,0,1", "1,0,."], ["#FF0000", "#0000ff"]), {
  width: 3, height: 2, pixels: ["", "#ff0000", "#0000ff", "#0000ff", "#ff0000", ""],
});
assert.equal(indexedRowsToPixels(["0,2"], ["#ff0000"]), null);
assert.equal(indexedRowsToPixels(["0,0"], ["#ff0000"], 1), null);
assert.equal(isSupportedImageDataUrl("data:image/png;base64,iVBORw0KGgo="), true);
assert.equal(isSupportedImageDataUrl("https://example.com/image.png"), false);
console.log("image asset import checks passed");
