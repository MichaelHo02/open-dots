"use client";

import { ProjectControls } from "./ProjectControls";
import { useEffect, useRef } from "react";
import { ClipboardPaste, Copy, CopyPlus, Images, PanelRight, Scissors, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFilm } from "@/lib/film-store";
import { DRAW_TOOLS, assertNever, type DrawTool } from "@/lib/types";
import { ChromeIcon, toolIconName } from "./ChromeIcons";
import { OpenDotsLogo, OpenDotsWordmark } from "./OpenDotsLogo";
import { WebMCPBridge } from "./WebMCPBridge";
import { AppTooltipTrigger } from "./AppTooltip";
import { ShortcutHelp } from "./ShortcutHelp";

export type EditorToolbarProps = {
  onPresent: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
};

function toolLabel(tool: DrawTool): string {
  switch (tool) {
    case "select": return "Select";
    case "line": return "Line";
    case "pencil":
      return "Draw";
    case "eraser":
      return "Erase";
    case "fill":
      return "Fill";
    case "text":
      return "Text";
    case "shape":
      return "Shape";
    case "move":
      return "Move";
    default:
      return assertNever(tool, "Unknown tool");
  }
}

function toolDescription(tool: DrawTool): string {
  switch (tool) {
    case "select": return "Select pixels (M)";
    case "line": return "Draw a straight line (L)";
    case "pencil":
      return "Draw on the page";
    case "eraser":
      return "Erase on the page";
    case "fill":
      return "Fill an area";
    case "text":
      return "Add pixel text";
    case "shape":
      return "Add a pixel shape";
    case "move":
      return "Move pixels or assets";
    default:
      return assertNever(tool, "Unknown tool");
  }
}

function ToolbarButton({
  label,
  description,
  children,
  active,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <AppTooltipTrigger label={description}><button
      type="button"
      className="toolbar-button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button></AppTooltipTrigger>
  );
}

export function EditorToolbar({ onPresent, inspectorOpen, onToggleInspector }: EditorToolbarProps) {
  const api = useFilm();
  const toolbar = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeMenus = () => toolbar.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu => { menu.open = false; });
    const dismiss = (event: PointerEvent) => { if (!toolbar.current?.contains(event.target as Node)) closeMenus(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenus(); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, []);

  return (
    <header ref={toolbar} className="top-nav editor-toolbar" onClick={(event) => {
      if ((event.target as Element).closest(".project-menu-items button")) toolbar.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu => { menu.open = false; });
    }}>
      <div className="brand" aria-label="Open Dots">
        <OpenDotsLogo size={22} />
        <OpenDotsWordmark />
      </div>
      <nav className="tool-list" aria-label="Tools">
        {DRAW_TOOLS.map((item) => {
          const label = toolLabel(item);
          return (
            <ToolbarButton
              key={item}
              label={label}
              description={toolDescription(item)}
              active={!api.selectedAssetId && api.tool === item}
              onClick={() => api.setTool(item)}
            >
              <ChromeIcon name={toolIconName(item)} />
            </ToolbarButton>
          );
        })}
      </nav>
      <div className="top-actions">
        <ProjectControls>
          <details name="editor-menu" className="project-menu"><summary title="Selection actions">Edit</summary><div className="project-menu-items">
          <button type="button" onClick={() => api.copySelection()}><Copy size={14} />Copy<kbd>⌘C</kbd></button>
          <button type="button" onClick={() => api.cutSelection()}><Scissors size={14} />Cut<kbd>⌘X</kbd></button>
          <button type="button" onClick={() => api.pasteSelection()}><ClipboardPaste size={14} />Paste<kbd>⌘V</kbd></button>
          <button type="button" onClick={() => api.duplicateSelection()}><CopyPlus size={14} />Duplicate<kbd>⌘D</kbd></button>
          <button type="button" onClick={() => api.deleteSelection()}><Trash2 size={14} />Delete selection<kbd>⌫</kbd></button>
          </div></details>
          <Link className="toolbar-button toolbar-labelled" href="/gallery">
            <Images size={17} aria-hidden="true" />
            <span>Gallery</span>
          </Link>
        </ProjectControls>
        <ToolbarButton
          label="Canvas settings"
          description={`${inspectorOpen ? "Hide" : "Show"} canvas settings`}
          active={inspectorOpen}
          onClick={onToggleInspector}
        >
          <PanelRight size={18} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Present"
          description="Present the picture book"
          onClick={onPresent}
        >
          <ChromeIcon name="present" />
        </ToolbarButton>
        <ShortcutHelp />
        <WebMCPBridge />
      </div>
    </header>
  );
}
