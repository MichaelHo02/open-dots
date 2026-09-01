"use client";

import { useEffect, useRef } from "react";

export function PixelTextInput({
  active,
  value,
  onChange,
  onCommit,
}: {
  active: boolean;
  value: string;
  onChange: (body: string) => void;
  onCommit?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) {
      inputRef.current?.focus();
    }
  }, [active]);

  if (!active) {
    return null;
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="pixel-text-input"
      value={value}
      aria-label="Type pixel text"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCommit?.();
          inputRef.current?.blur();
        }
      }}
      onBlur={() => onCommit?.()}
    />
  );
}
