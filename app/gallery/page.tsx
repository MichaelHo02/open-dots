import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { OpenDotsLogo } from "@/components/OpenDotsLogo";
import { listStories } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Story gallery · Open Dots",
  description: "Read picture books shared by the Open Dots community.",
};

export default async function GalleryPage() {
  const stories = await listStories();
  return <main className="gallery-shell">
    <header className="gallery-nav">
      <Link href="/" className="gallery-brand"><OpenDotsLogo size={22} /><span>Open Dots</span></Link>
      <Link href="/" className="pill primary">Create a story</Link>
    </header>
    <section className="gallery-intro">
      <h1>Stories made with dots.</h1>
      <p>Picture books shared by the Open Dots community. Pick one and turn the page.</p>
    </section>
    {stories.length ? <section className="gallery-grid" aria-label="Shared stories">
      {stories.map(story => <Link className="story-card" href={`/gallery/${story.id}`} key={story.id}>
        <span className="story-cover">
          <Image src={story.pages[0]} alt={`Cover of ${story.title}`} width={1280} height={720} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" unoptimized />
        </span>
        <span className="story-card-copy">
          <strong>{story.title}</strong>
          <span>{story.pages.length} {story.pages.length === 1 ? "page" : "pages"}</span>
        </span>
      </Link>)}
    </section> : <section className="gallery-empty">
      <h2>The shelves are waiting.</h2>
      <p>Share the first story from the Open Dots editor.</p>
      <Link href="/" className="pill primary">Create a story</Link>
    </section>}
  </main>;
}
