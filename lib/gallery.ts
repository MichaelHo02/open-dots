import { cache } from "react";
import { list } from "@vercel/blob";

export const MAX_STORY_PAGES = 24;

export interface GalleryStory {
  id: string;
  title: string;
  createdAt: string;
  pages: string[];
}

const storyId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hasBlobCredentials() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}

export function isGalleryStory(value: unknown): value is GalleryStory {
  if (!value || typeof value !== "object") return false;
  const story = value as Partial<GalleryStory>;
  return typeof story.id === "string" && storyId.test(story.id) &&
    typeof story.title === "string" && story.title.length > 0 && story.title.length <= 80 &&
    typeof story.createdAt === "string" && Number.isFinite(Date.parse(story.createdAt)) &&
    Array.isArray(story.pages) && story.pages.length > 0 && story.pages.length <= MAX_STORY_PAGES &&
    story.pages.every(page => typeof page === "string" && page.startsWith("https://"));
}

async function readManifest(url: string): Promise<GalleryStory | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return isGalleryStory(value) ? value : null;
  } catch {
    return null;
  }
}

export async function listStories(): Promise<GalleryStory[]> {
  if (!hasBlobCredentials()) return [];
  // ponytail: cap the first gallery at 1,000 stories; add cursor pagination when real usage reaches it.
  const { blobs } = await list({ prefix: "stories/", limit: 1000 });
  const stories = await Promise.all(blobs
    .filter(blob => blob.pathname.endsWith("/story.json"))
    .map(blob => readManifest(blob.url)));
  return stories
    .filter((story): story is GalleryStory => story !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const getStory = cache(async (id: string): Promise<GalleryStory | null> => {
  if (!hasBlobCredentials() || !storyId.test(id)) return null;
  const pathname = `stories/${id}/story.json`;
  const { blobs } = await list({ prefix: pathname, limit: 1 });
  const manifest = blobs.find(blob => blob.pathname === pathname);
  return manifest ? readManifest(manifest.url) : null;
});
