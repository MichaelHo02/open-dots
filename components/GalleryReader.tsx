"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { OpenDotsLogo } from "./OpenDotsLogo";
import type { GalleryStory } from "@/lib/gallery";

export function GalleryReader({ story }: { story: GalleryStory }) {
  const [index, setIndex] = useState(0);
  const last = story.pages.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setIndex(current => Math.min(current + 1, last));
      }
      if (event.key === "ArrowLeft") setIndex(current => Math.max(current - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  return <main className="reader-shell">
    <header className="reader-nav">
      <Link href="/gallery" className="reader-back"><ArrowLeft size={16} aria-hidden="true" />Gallery</Link>
      <Link href="/" className="gallery-brand"><OpenDotsLogo size={20} /><span>Open Dots</span></Link>
      <Link href="/" className="pill ghost">Create yours</Link>
    </header>
    <section className="reader-heading">
      <h1>{story.title}</h1>
      <p aria-live="polite">Page {index + 1} of {story.pages.length}</p>
    </section>
    <section className="reader-stage" aria-label={story.title}>
      <button type="button" className="reader-turn reader-turn-prev" aria-label="Previous page" disabled={index === 0} onClick={() => setIndex(current => Math.max(current - 1, 0))}><ArrowLeft aria-hidden="true" /></button>
      <div className="reader-page">
        <Image key={story.pages[index]} src={story.pages[index]} alt={`Page ${index + 1} of ${story.title}`} width={1280} height={720} priority unoptimized />
      </div>
      <button type="button" className="reader-turn reader-turn-next" aria-label="Next page" disabled={index === last} onClick={() => setIndex(current => Math.min(current + 1, last))}><ArrowRight aria-hidden="true" /></button>
    </section>
  </main>;
}
