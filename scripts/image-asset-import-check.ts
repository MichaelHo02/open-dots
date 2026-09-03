import assert from "node:assert/strict";
import { fitAssetSize, opaqueBounds, quantizePixels } from "../lib/image-asset-import";

const data = new Uint8ClampedArray(4 * 3 * 4);
data[(1 * 4 + 1) * 4 + 3] = 255;
data[(1 * 4 + 2) * 4 + 3] = 255;
assert.deepEqual(opaqueBounds({ data, width: 4, height: 3 }), { x: 1, y: 1, width: 2, height: 1 });
assert.deepEqual(fitAssetSize(192, 96), { width: 96, height: 48 });
assert.deepEqual(quantizePixels({ data: new Uint8ClampedArray([250, 5, 5, 255, 0, 0, 0, 0]), width: 2, height: 1 }, ["#ff0000", "#0000ff"]), ["#ff0000", ""]);
console.log("image asset import checks passed");
