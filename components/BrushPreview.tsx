import type { BrushSize, DrawTool } from "@/lib/types";

export function BrushPreview({
  tool,
  brushSize,
  pixel,
  gridWidth,
  gridHeight,
  hidden,
}: {
  tool: DrawTool;
  brushSize: BrushSize;
  pixel: { x: number; y: number } | null;
  gridWidth: number;
  gridHeight: number;
  hidden?: boolean;
}) {
  if (
    hidden ||
    !pixel ||
    (tool !== "pencil" && tool !== "eraser") ||
    gridWidth < 1 ||
    gridHeight < 1
  ) {
    return null;
  }
  return (
    <span
      className="brush-preview"
      data-mode={tool}
      aria-hidden="true"
      style={{
        left: `${(pixel.x / gridWidth) * 100}%`,
        top: `${(pixel.y / gridHeight) * 100}%`,
        width: `${(brushSize / gridWidth) * 100}%`,
        height: `${(brushSize / gridHeight) * 100}%`,
      }}
    />
  );
}
