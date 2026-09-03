export type Symmetry = "none" | "x" | "y" | "both";

export function strokePoints(x0: number, y0: number, x1: number, y1: number) {
  const points: Array<{ x: number; y: number }> = [];
  let x = x0; let y = y0;
  const dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return points;
}

export function symmetricPoints(point: { x: number; y: number }, width: number, height: number, symmetry: Symmetry) {
  const points = [point];
  if (symmetry === "x" || symmetry === "both") points.push({ x: width - 1 - point.x, y: point.y });
  if (symmetry === "y" || symmetry === "both") points.push({ x: point.x, y: height - 1 - point.y });
  if (symmetry === "both") points.push({ x: width - 1 - point.x, y: height - 1 - point.y });
  return points.filter((item, index, all) => all.findIndex((other) => other.x === item.x && other.y === item.y) === index);
}

export function constrainDiagonal(start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (Math.abs(dx) >= Math.abs(dy) * 2) return { x: start.x + (dx < 0 ? -distance : distance), y: start.y };
  if (Math.abs(dy) >= Math.abs(dx) * 2) return { x: start.x, y: start.y + (dy < 0 ? -distance : distance) };
  return { x: start.x + (dx < 0 ? -distance : distance), y: start.y + (dy < 0 ? -distance : distance) };
}
