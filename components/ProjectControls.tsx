"use client";

import { useRef, useState } from "react";
import { FolderOpen, Save, Download } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { compositedPagePixels, paintPixelGrid } from "@/lib/draw";
import type { Film } from "@/lib/types";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveProject(film: Film) {
  download(new Blob([JSON.stringify(film)], { type: "application/json" }), "open-dots.json");
}

export function ProjectControls() {
  const api = useFilm();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  return <details className="project-menu">
    <summary title="Project files">File</summary>
    <div className="project-menu-items">
      <button type="button" onClick={() => saveProject(api.film)}><Save size={14} />Save project</button>
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
      <input ref={input} type="file" accept="application/json,.json" aria-label="Open project file" hidden onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        setError("");
        try {
          if (file.size > 20 * 1024 * 1024) throw new Error("Project file is too large (maximum 20 MB).");
          const data: unknown = JSON.parse(await file.text());
          if (!window.confirm("Open this project and replace the current book? Save your current project first if you want to keep a separate copy.")) return;
          if (!api.importProject(data)) throw new Error("This is not a valid Open Dots project.");
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open project."); }
      }} />
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
