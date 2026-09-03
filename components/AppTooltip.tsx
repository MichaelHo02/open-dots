"use client";

import type { ReactElement } from "react";
import { Tooltip } from "@base-ui/react/tooltip";

const handle = Tooltip.createHandle<string>();

export function AppTooltipTrigger({ label, children }: { label: string; children: ReactElement }) {
  return <Tooltip.Trigger handle={handle} payload={label} delay={350} render={children} />;
}

export function AppTooltip() {
  return <Tooltip.Root handle={handle}>
    {({ payload }) => <Tooltip.Portal>
      <Tooltip.Positioner className="app-tooltip-positioner" positionMethod="fixed" sideOffset={8} collisionPadding={8}>
        <Tooltip.Popup className="app-tooltip-popup">{payload}</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>}
  </Tooltip.Root>;
}
