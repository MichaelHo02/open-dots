"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, FolderOpen, History, Save, Download, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFilm } from "@/lib/film-store";
import { compositedPagePixels, paintPixelGrid } from "@/lib/draw";
import type { Film } from "@/lib/types";
import { ConfirmAction } from "./ConfirmAction";

const RECOVERY_KEY = "open-dots:recovery";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pagePng(page: Film["pages"][number], assets: Film["assets"]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = page.width;
  canvas.height = page.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("PNG export is unavailable in this browser."));
  paintPixelGrid(ctx, compositedPagePixels(page, assets), page.width, page.height);
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error("Could not prepare this story.")),
    "image/png",
  ));
}

async function printBook(film: Film) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow popups to export the complete book.");
  popup.document.title = "Open Dots book";
  const style = popup.document.createElement("style");
  style.textContent = "body{margin:0;background:#fff}img{display:block;width:100%;height:auto;break-after:page;image-rendering:pixelated}";
  popup.document.head.append(style);
  for (const page of film.pages) {
    const image = popup.document.createElement("img");
    image.src = URL.createObjectURL(await pagePng(page, film.assets));
    popup.document.body.append(image);
  }
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
}

export function saveProject(film: Film) {
  download(new Blob([JSON.stringify(film)], { type: "application/json" }), "open-dots.json");
}

export function ProjectControls({ children }: { children?: React.ReactNode }) {
  const api = useFilm();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [sharing, setSharing] = useState(false);
  const [pendingProject, setPendingProject] = useState<unknown>(null);
  const [hasRecovery, setHasRecovery] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHasRecovery(Boolean(window.localStorage.getItem(RECOVERY_KEY))), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <>
    <details name="editor-menu" className="project-menu">
      <summary title="Project files">File</summary>
      <div className="project-menu-items">
      <button type="button" onClick={() => saveProject(api.film)}><Save size={14} />Save project<kbd>⌘S</kbd></button>
      <button type="button" onClick={() => input.current?.click()}><FolderOpen size={14} />Open project</button>
      <button type="button" onClick={() => {
        if (!api.active) return;
        const page = api.active;
        const canvas = document.createElement("canvas");
        canvas.width = page.width;
        canvas.height = page.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setError("PNG export is unavailable in this browser."); return; }
        paintPixelGrid(ctx, compositedPagePixels(page, api.film.assets), page.width, page.height);
        canvas.toBlob(blob => { if (blob) download(blob, `page-${api.film.activeIndex + 1}.png`); else setError("Could not export this page."); });
      }}><Download size={14} />Export page PNG</button>
      <button type="button" onClick={() => { printBook(api.film).catch(cause => setError(cause instanceof Error ? cause.message : "Could not export this book.")); }}><BookOpen size={14} />Print / Save book PDF</button>
      <input ref={input} type="file" accept="application/json,.json" aria-label="Open project file" hidden onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        setError("");
        try {
          if (file.size > 20 * 1024 * 1024) throw new Error("Project file is too large (maximum 20 MB).");
          setPendingProject(JSON.parse(await file.text()) as unknown);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open project."); }
      }} />
      {pendingProject ? <ConfirmAction className="project-confirm" label="Open imported project" confirmLabel="Click again to replace this book" onConfirm={() => {
        const currentFilm = JSON.stringify(api.film);
        if (api.importProject(pendingProject)) {
          window.localStorage.setItem(RECOVERY_KEY, currentFilm);
          setHasRecovery(true);
        } else setError("This is not a valid Open Dots project.");
        setPendingProject(null);
      }}><FolderOpen size={14} />Open imported project</ConfirmAction> : null}
      {hasRecovery ? <ConfirmAction className="project-confirm" label="Restore previous book" confirmLabel="Click again to restore" onConfirm={() => {
        try { const stored = window.localStorage.getItem(RECOVERY_KEY); if (stored && api.importProject(JSON.parse(stored))) { window.localStorage.removeItem(RECOVERY_KEY); setHasRecovery(false); } }
        catch { setError("Could not restore the previous book."); }
      }}><History size={14} />Restore previous book</ConfirmAction> : null}
      <p className="project-save-state" role="status">Saved locally</p>
      {error && <p role="alert">{error}</p>}
      </div>
    </details>
    {children}
    <button className="toolbar-button toolbar-labelled share-story-button" type="button" onClick={() => { setError(""); shareDialog.current?.showModal(); }}>
      <Share2 size={16} aria-hidden="true" />
      <span>Share your story</span>
    </button>
    <dialog ref={shareDialog} className="share-dialog" onCancel={() => setError("")}>
      <form className="share-dialog-form" onSubmit={async event => {
        event.preventDefault();
        setSharing(true);
        setError("");
        try {
          const form = new FormData();
          form.set("title", title.trim());
          const pages = await Promise.all(api.film.pages.map(page => pagePng(page, api.film.assets)));
          pages.forEach((page, index) => form.append("pages", page, `page-${index + 1}.png`));
          const response = await fetch("/api/stories", { method: "POST", body: form });
          const result = await response.json() as { id?: string; error?: string };
          if (!response.ok || !result.id) throw new Error(result.error || "Could not share this story.");
          shareDialog.current?.close();
          router.push(`/gallery/${result.id}`);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Could not share this story.");
        } finally {
          setSharing(false);
        }
      }}>
        <div>
          <h2>Share this story</h2>
          <p>Publish a read-only copy of every page to the public gallery.</p>
        </div>
        <label>Story title<input required maxLength={80} value={title} onChange={event => setTitle(event.target.value)} autoFocus /></label>
        {error && <p className="share-error" role="alert">{error}</p>}
        <div className="share-dialog-actions">
          <button type="button" className="pill ghost" disabled={sharing} onClick={() => shareDialog.current?.close()}>Cancel</button>
          <button type="submit" className="pill primary" disabled={sharing}>{sharing ? "Sharing…" : "Share story"}</button>
        </div>
      </form>
    </dialog>
  </>;
}
