import assert from "node:assert/strict";
import { isGalleryStory } from "../lib/gallery";

const valid = {
  id: "9d2de018-e605-4bd4-a66a-48eb737e4669",
  title: "A tiny story",
  createdAt: "2026-09-03T00:00:00.000Z",
  pages: ["https://example.public.blob.vercel-storage.com/stories/page-01.png"],
};

assert.equal(isGalleryStory(valid), true);
assert.equal(isGalleryStory({ ...valid, pages: ["javascript:alert(1)"] }), false);
assert.equal(isGalleryStory({ ...valid, id: "../../other-story" }), false);

console.log("gallery manifest validation passed");
