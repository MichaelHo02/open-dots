import type { Asset } from "./types";
import { isPaintedPixel } from "./types";
import type { PixelStats } from "./rasterize";

export type PassHint = "outline" | "fill" | "shade" | "highlight" | "verify";

export interface AgentAssetVerifyRecord {
  assetId: string;
  timestamp: number;
}

export interface AgentChecklist {
  guideLoaded: boolean;
  lastAssetVerify: AgentAssetVerifyRecord | null;
  assetsPendingVerify: string[];
}

interface AgentSessionState {
  guideLoaded: boolean;
  lastAssetVerify: AgentAssetVerifyRecord | null;
  assetsPendingVerify: string[];
  assetLastEditedAt: Record<string, number>;
  assetLastVerifiedAt: Record<string, number>;
}

const session: AgentSessionState = {
  guideLoaded: false,
  lastAssetVerify: null,
  assetsPendingVerify: [],
  assetLastEditedAt: {},
  assetLastVerifiedAt: {},
};

export function markGuideLoaded(): void {
  session.guideLoaded = true;
}

export function markAssetEdited(assetId: string): void {
  const now = Date.now();
  session.assetLastEditedAt[assetId] = now;
  session.assetsPendingVerify = session.assetsPendingVerify.filter(
    (id) => id !== assetId,
  );
}

export function markAssetVerified(assetId: string): void {
  const now = Date.now();
  session.assetLastVerifiedAt[assetId] = now;
  session.lastAssetVerify = { assetId, timestamp: now };
  session.assetsPendingVerify = session.assetsPendingVerify.filter(
    (id) => id !== assetId,
  );
}

export function isAssetVerifiedSinceEdit(assetId: string): boolean {
  const editedAt = session.assetLastEditedAt[assetId];
  if (editedAt === undefined) {
    return session.assetLastVerifiedAt[assetId] !== undefined;
  }
  const verifiedAt = session.assetLastVerifiedAt[assetId];
  return verifiedAt !== undefined && verifiedAt >= editedAt;
}

export function recordStampedAssets(assetIds: string[]): string[] {
  const unverified: string[] = [];
  for (const assetId of assetIds) {
    if (!isAssetVerifiedSinceEdit(assetId)) {
      if (!session.assetsPendingVerify.includes(assetId)) {
        session.assetsPendingVerify.push(assetId);
      }
      unverified.push(assetId);
    }
  }
  return unverified;
}

export function getAgentChecklist(): AgentChecklist {
  return {
    guideLoaded: session.guideLoaded,
    lastAssetVerify: session.lastAssetVerify,
    assetsPendingVerify: [...session.assetsPendingVerify],
  };
}

export function guideNextRequired(): string | undefined {
  if (session.guideLoaded) {
    return undefined;
  }
  return "Call get_pixel_art_guide first";
}

function isDarkOutlineColor(color: string): boolean {
  if (!color || color === "") {
    return false;
  }
  const hex = color.toLowerCase();
  if (hex === "#000000" || hex === "#000") {
    return true;
  }
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(hex);
  if (!match) {
    return false;
  }
  const r = Number.parseInt(match[1]!, 16);
  const g = Number.parseInt(match[2]!, 16);
  const b = Number.parseInt(match[3]!, 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 64;
}

export function inferPassHint(
  stats: PixelStats,
  dots?: Array<{ x: number; y: number; color: string }>,
): PassHint {
  const paintedDots =
    dots?.filter((dot) => dot.color && dot.color !== "") ?? [];
  if (
    paintedDots.length > 0 &&
    paintedDots.every((dot) => isDarkOutlineColor(dot.color)) &&
    stats.coverage < 0.35
  ) {
    return "outline";
  }
  if (stats.coverage < 0.25 || stats.colorCount <= 1) {
    return "outline";
  }
  if (stats.colorCount <= 3 && stats.coverage < 0.55) {
    return "fill";
  }
  if (stats.colorCount <= 5 && stats.coverage < 0.75) {
    return "shade";
  }
  if (stats.coverage >= 0.5) {
    return "highlight";
  }
  return "verify";
}

export function buildNextRequired(passHint: PassHint): string {
  switch (passHint) {
    case "outline":
      return "Compare the PNG to your intent. Fix the silhouette (lines/rects) before the fill pass, then flood or rect the base colors.";
    case "fill":
      return "Compare the PNG fill colors to your reference. Adjust with paint_asset (rects/fills) before shading.";
    case "shade":
      return "Compare shadow placement to your light direction (one source). Add highlights next or get_asset_image to verify bounds.";
    case "highlight":
      return "Compare the final sprite to your reference. Call get_asset_image, then stamp_assets when satisfied.";
    case "verify":
      return "Compare the PNG to your intent. Fix issues with paint_asset (color \"\" erases) before the next pass.";
    default: {
      const _exhaustive: never = passHint;
      return _exhaustive;
    }
  }
}

/**
 * Scene-level nudge for get_page_image: flags few overlay stamps, huge
 * assets, full-page painting, or noisy unique-hex counts. Encourages
 * tiled overlays and 4–12 tone ramps per sprite — not maximizing page colors.
 */
export interface SceneHintContext {
  assetCount: number;
  placementCount: number;
  uniqueStampedAssets: number;
  /** Largest placement area / page area (0–1). */
  largestPlacementRatio: number;
  /** Coverage of page.pixels only (background buffer, not overlays). */
  backgroundCoverage: number;
}

const FEW_PLACEMENTS = 8;
const HUGE_PLACEMENT_RATIO = 0.4;
const FULL_PAGE_BG_COVERAGE = 0.55;
const FULL_PAGE_FEW_PLACEMENTS = 4;
const NOISY_COLOR_COUNT = 512;

export function inferSceneHint(
  stats: PixelStats,
  context: SceneHintContext,
): string {
  const {
    assetCount,
    placementCount,
    uniqueStampedAssets,
    largestPlacementRatio,
    backgroundCoverage,
  } = context;

  if (stats.paintedCount === 0 && placementCount === 0) {
    return "Page is empty. Set a palette, build small assets, and stamp overlays back-to-front (floor tiles → emblem/shadows → furniture → plants/characters). Repeat stamps (a plant ×4) instead of unique copies.";
  }
  if (
    backgroundCoverage >= FULL_PAGE_BG_COVERAGE &&
    placementCount < FULL_PAGE_FEW_PLACEMENTS
  ) {
    return "Background buffer looks like full-page painting. Keep page.pixels for flat floor/sky only; compose furniture, plants, and characters as overlay stamp_assets so they stay movable and transparent pixels do not punch holes.";
  }
  if (largestPlacementRatio >= HUGE_PLACEMENT_RATIO) {
    return "A stamp covers most of the page. Split huge assets into tiles and props (8–48px), then stamp many overlays. One near-full-page sprite reads as a decorated wall.";
  }
  if (placementCount < FEW_PLACEMENTS) {
    return `Only ${placementCount} overlay placement(s). Dense scenes reuse stamps (plants ×4) across 12–30+ small assets — floor tiles, then emblem/shadows, furniture, plants, and characters.`;
  }
  if (stats.coverage < 0.35) {
    return "Page reads sparse (low coverage). Fill the frame with tiled floor/wall stamps and overlapping props so there is little empty canvas.";
  }
  if (stats.colorCount > NOISY_COLOR_COUNT) {
    return "colorCount is noisy (too many unique hexes). Each sprite should use a 4–12 tone ramp, not a unique color per pixel. Scene totals can be high after composing many assets — that is expected — but do not maximize distinct hexes.";
  }
  if (stats.colorCount <= 6 && uniqueStampedAssets < 8) {
    return "Palette reads flat. Give each sprite a 4–12 tone ramp (outline, base, shadow, highlight). After many assets the page colorCount can be high; do not chase thousands of unique hexes.";
  }
  if (assetCount < 8 && uniqueStampedAssets < 8) {
    return `Only ${assetCount} asset(s) in the library. Dense scenes use 12–30+ small assets — decompose further into tiles, props, and characters.`;
  }
  return "Looks populated. Crop regions with get_page_image (scale 2–4) to check per-object shading, overlap, and repeated stamps against your reference.";
}

export function pageSceneHintContext(
  page: {
    width: number;
    height: number;
    placements?: Array<{ assetId: string; width: number; height: number }>;
  },
  assetCount: number,
  backgroundCoverage: number,
): SceneHintContext {
  const placements = page.placements ?? [];
  const pageArea = page.width * page.height;
  let largest = 0;
  for (const placement of placements) {
    largest = Math.max(largest, placement.width * placement.height);
  }
  return {
    assetCount,
    placementCount: placements.length,
    uniqueStampedAssets: new Set(placements.map((item) => item.assetId)).size,
    largestPlacementRatio: pageArea > 0 ? largest / pageArea : 0,
    backgroundCoverage,
  };
}

export function emptyAssetNextRequired(): string {
  return "Start outline pass with paint_asset; response includes PNG";
}

export function assetHasPaintedPixels(asset: Asset): boolean {
  return asset.pixels.some((pixel) => isPaintedPixel(pixel));
}
