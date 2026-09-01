import {
  BookOpen,
  Eraser,
  Grid2x2,
  MonitorPlay,
  Move,
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
  | "delete"
  | "reset"
  | "move"
  | "asset";

const STROKE_WIDTH = 1.75;
const ICON_SIZE = 16;

function iconFor(name: ChromeName): LucideIcon {
  switch (name) {
    case "logo":
      return BookOpen;
    case "draw":
      return Pencil;
    case "erase":
      return Eraser;
    case "fill":
      return PaintBucket;
    case "text":
      return Type;
    case "shape":
      return Shapes;
    case "undo":
      return Undo2;
    case "clear":
      return SquareX;
    case "present":
      return MonitorPlay;
    case "page":
      return Plus;
    case "delete":
      return Trash2;
    case "reset":
      return RotateCcw;
    case "move":
      return Move;
    case "asset":
      return Grid2x2;
    default:
      return assertNever(name, "Unknown chrome icon");
  }
}

export function ChromeIcon({
  name,
  size = ICON_SIZE,
}: {
  name: ChromeName;
  size?: number;
}) {
  const Icon = iconFor(name);
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
