import {
  Pipette, MousePointer2, Scan, Slash, Redo2,
  BookOpen,
  Eraser,
  Grid2x2,
  MonitorPlay,
  PaintBucket,
  Pencil,
  Plus,
  RotateCcw,
  Shapes,
  SquareX,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { assertNever, type DrawTool } from "@/lib/types";

export type ChromeName =
  | "eyedropper" | "select" | "line" | "redo"
  | "logo"
  | "draw"
  | "erase"
  | "fill"
  | "text"
  | "shape"
  | "undo"
  | "clear"
  | "present"
  | "page"
  | "plus"
  | "delete"
  | "reset"
  | "move"
  | "asset";

const STROKE_WIDTH = 1.75;
const ICON_SIZE = 16;

const icons: Record<ChromeName, LucideIcon> = {
  eyedropper: Pipette, select: Scan, line: Slash, redo: Redo2,
  logo: BookOpen, draw: Pencil, erase: Eraser, fill: PaintBucket,
  text: Type, shape: Shapes, undo: Undo2, clear: SquareX,
  present: MonitorPlay, page: Plus, plus: Plus, delete: Trash2,
  reset: RotateCcw, move: MousePointer2, asset: Grid2x2,
};

export function ChromeIcon({
  name,
  size = ICON_SIZE,
}: {
  name: ChromeName;
  size?: number;
}) {
  const Icon = icons[name];
  return (
    <Icon
      className="chrome-icon"
      size={size}
      strokeWidth={STROKE_WIDTH}
      color="currentColor"
      aria-hidden
    />
  );
}

export function toolIconName(tool: DrawTool): ChromeName {
  switch (tool) {
    case "eyedropper": return "eyedropper";
    case "select": return "select";
    case "line": return "line";
    case "pencil":
      return "draw";
    case "eraser":
      return "erase";
    case "fill":
      return "fill";
    case "text":
      return "text";
    case "shape":
      return "shape";
    case "move":
      return "move";
    default:
      return assertNever(tool, "Unknown tool");
  }
}
