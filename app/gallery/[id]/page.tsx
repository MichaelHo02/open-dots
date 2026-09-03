import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GalleryReader } from "@/components/GalleryReader";
import { getStory } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/gallery/[id]">): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(id);
  return story ? { title: `${story.title} · Open Dots` } : { title: "Story not found · Open Dots" };
}

export default async function StoryPage({ params }: PageProps<"/gallery/[id]">) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();
  return <GalleryReader story={story} />;
}
