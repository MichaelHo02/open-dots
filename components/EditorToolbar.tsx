"use client";

import { useId } from "react";
import { useFilm } from "@/lib/film-store";
import { DRAW_TOOLS, assertNever, type DrawTool } from "@/lib/types";
import { ChromeIcon, toolIconName } from "./ChromeIcons";
import { OpenDotsLogo, OpenDotsWordmark } from "./OpenDotsLogo";
import { WebMCPBridge } from "./WebMCPBridge";

export type EditorToolbarProps = {
  onPresent: () => void;
  onToolSelect?: () => void;
};

function toolLabel(tool: DrawTool): string {
  switch (tool) {
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
  onClick,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  const tooltipId = useId();
  return (
    <button
      type="button"
      className="toolbar-button"
      aria-label={label}
      aria-pressed={active}
      aria-describedby={tooltipId}
      onClick={onClick}
    >
      {children}
      <span id={tooltipId} className="toolbar-tooltip" role="tooltip">
        {description}
      </span>
    </button>
  );
}

export function EditorToolbar({ onPresent, onToolSelect }: EditorToolbarProps) {
  const api = useFilm();

  return (
    <header className="top-nav editor-toolbar">
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
              active={api.tool === item}
              onClick={() => {
                api.setTool(item);
                onToolSelect?.();
              }}
            >
              <ChromeIcon name={toolIconName(item)} />
            </ToolbarButton>
          );
        })}
      </nav>
      <div className="top-actions">
        <ToolbarButton
          label="Undo"
          description="Undo the last change"
          onClick={() => api.undo()}
        >
          <ChromeIcon name="undo" />
        </ToolbarButton>
        <ToolbarButton
          label="Clear"
          description="Clear the current page"
          onClick={() => api.clearPage()}
        >
          <ChromeIcon name="clear" />
        </ToolbarButton>
        <ToolbarButton
          label="Present"
          description="Present the picture book"
          onClick={onPresent}
        >
          <ChromeIcon name="present" />
        </ToolbarButton>
        <WebMCPBridge />
      </div>
    </header>
  );
}
