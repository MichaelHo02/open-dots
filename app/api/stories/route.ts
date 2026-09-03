import { del, put } from "@vercel/blob";
import { hasBlobCredentials, MAX_STORY_PAGES, type GalleryStory } from "@/lib/gallery";

export const runtime = "nodejs";

const MAX_PAGE_BYTES = 1024 * 1024;
const MAX_STORY_BYTES = 3.5 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function isPng(file: File) {
  if (file.type !== "image/png" || file.size < PNG_SIGNATURE.length) return false;
  const bytes = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export async function POST(request: Request) {
  if (!hasBlobCredentials()) {
    return error("Story sharing is not configured yet.", 503);
  }
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return error("Invalid request.", 403);
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_STORY_BYTES) return error("This story is too large to share.", 413);

  const data = await request.formData();
  const title = String(data.get("title") ?? "").trim().replace(/\s+/g, " ");
  const pages = data.getAll("pages").filter((page): page is File => page instanceof File);
  if (!title || title.length > 80) return error("Use a story title between 1 and 80 characters.");
  if (!pages.length || pages.length > MAX_STORY_PAGES) return error(`Share between 1 and ${MAX_STORY_PAGES} pages.`);
  if (pages.some(page => page.size > MAX_PAGE_BYTES) || pages.reduce((sum, page) => sum + page.size, 0) > MAX_STORY_BYTES) {
    return error("This story is too large to share.", 413);
  }
  if (!(await Promise.all(pages.map(isPng))).every(Boolean)) return error("Every story page must be a PNG image.");

  const id = crypto.randomUUID();
  const uploaded: string[] = [];
  try {
    for (const [index, page] of pages.entries()) {
      const blob = await put(`stories/${id}/page-${String(index + 1).padStart(2, "0")}.png`, page, {
        access: "public",
        addRandomSuffix: false,
        cacheControlMaxAge: 31536000,
        contentType: "image/png",
      });
      uploaded.push(blob.url);
    }
    const story: GalleryStory = { id, title, createdAt: new Date().toISOString(), pages: uploaded };
    await put(`stories/${id}/story.json`, JSON.stringify(story), {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
      contentType: "application/json",
    });
    return Response.json({ id }, { status: 201 });
  } catch {
    if (uploaded.length) await del(uploaded).catch(() => undefined);
    return error("Could not share this story. Please try again.", 500);
  }
}
