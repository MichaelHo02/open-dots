"use client";

import { DotmSquare1 } from "@/components/ui/dotm-square-1";

/**
 * Open Dots brand mark — dotm-square-1 (Neon Drift) from dotmatrix by zzzzshawn.
 * https://dotmatrix.zzzzshawn.cloud/
 */
export function OpenDotsLogo({
  size = 22,
  animated = true,
}: {
  size?: number;
  animated?: boolean;
}) {
  const dotSize = Math.max(2, Math.round(size / 6.5));

  return (
    <span className="open-dots-logo" aria-hidden>
      <DotmSquare1
        size={size}
        dotSize={dotSize}
        color="currentColor"
        pattern="full"
        animated={animated}
        ariaLabel="Open Dots"
      />
    </span>
  );
}
