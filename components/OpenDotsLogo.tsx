"use client";

import { DotmCircular7 } from "@/components/ui/dotm-circular-7";

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
      <DotmCircular7
        size={size}
        dotSize={dotSize}
        color="currentColor"
        animated={animated}
        ariaLabel="Open Dots"
      />
    </span>
  );
}

export function OpenDotsWordmark() {
  return (
    <span className="brand-wordmark" aria-hidden>
      Open Dots
    </span>
  );
}
