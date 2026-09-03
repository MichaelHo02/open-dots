"use client";

import { useEffect, useRef } from "react";
import { PagePreview } from "./PagePreview";
import type { Asset, Page } from "@/lib/types";

export function PresentMode({
  pages,
  assets,
  index,
  onClose,
  onSelect,
}: {
  pages: Page[];
  assets: Asset[];
  index: number;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const last = pages.length - 1;
  const page = pages[index];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        onSelect(Math.min(index + 1, last));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelect(Math.max(index - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last, onClose, onSelect]);

  if (!page) {
    return null;
  }

  return (
    <dialog ref={dialogRef} className="present" aria-label="Read the book" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button type="button" className="pill ghost present-done" autoFocus onClick={onClose}>
        Done
      </button>
      <button
        type="button"
        className="present-hit present-prev"
        aria-label="Previous page"
        disabled={index === 0}
        onClick={() => onSelect(Math.max(index - 1, 0))}
      />
      <article className="present-page">
        <PagePreview page={page} assets={assets} animated />
      </article>
      <button
        type="button"
        className="present-hit present-next"
        aria-label="Next page"
        disabled={index === last}
        onClick={() => onSelect(Math.min(index + 1, last))}
      />
      <p className="present-folio">
        {index + 1} / {pages.length}
      </p>
    </dialog>
  );
}
