"use client";

import { useState, type ReactNode } from "react";
import { AppTooltipTrigger } from "./AppTooltip";

export function ConfirmAction({ label, confirmLabel, className, disabled, onConfirm, children, confirmChildren = children }: {
  label: string;
  confirmLabel: string;
  className: string;
  disabled?: boolean;
  onConfirm: () => void;
  children: ReactNode;
  confirmChildren?: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const currentLabel = armed ? confirmLabel : label;

  return <AppTooltipTrigger label={currentLabel}><button
    type="button"
    className={className}
    aria-label={currentLabel}
    disabled={disabled}
    data-confirm={armed || undefined}
    onBlur={() => setArmed(false)}
    onClick={() => {
      if (!armed) return setArmed(true);
      setArmed(false);
      onConfirm();
    }}
  >{armed ? confirmChildren : children}</button></AppTooltipTrigger>;
}
