"use client";
import { useEffect } from "react";
import { useFilm } from "@/lib/film-store";
import type { DrawTool } from "@/lib/types";
import { saveProject } from "./ProjectControls";

export function useEditorShortcuts(disabled: boolean, onToolSelect: () => void) {
  const api = useFilm();
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (disabled || event.altKey || (event.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]")) return;
      const name = event.key.toLowerCase();
      if (event.metaKey || event.ctrlKey) {
        const action = name === "z" ? (event.shiftKey ? api.redo : api.undo)
          : name === "y" ? api.redo : name === "c" ? api.copySelection
          : name === "x" ? api.cutSelection : name === "v" ? api.pasteSelection
          : name === "d" ? api.duplicateSelection : name === "s" ? () => saveProject(api.film) : null;
        if (action) { event.preventDefault(); action(); }
        return;
      }
      if (name === "delete" || name === "backspace") { event.preventDefault(); api.deleteSelection(); return; }
      const tool: DrawTool | undefined = ({ b: "pencil", e: "eraser", g: "fill", t: "text", u: "shape", v: "move", m: "select", l: "line" } as Record<string, DrawTool>)[name];
      if (tool) { event.preventDefault(); api.setTool(tool); onToolSelect(); }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [api, disabled, onToolSelect]);
}
