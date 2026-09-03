"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChromeIcon } from "./ChromeIcons";
import { parseHex } from "@/lib/types";

function parseDraft(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return parseHex(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
}

export function ColorAddPopover({
  currentColor,
  onAdd,
}: {
  currentColor: string;
  onAdd: (color: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(currentColor);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hexRef = useRef<HTMLInputElement>(null);
  const hexId = useId();
  const parsed = parseDraft(draft);
  const preview = parsed ?? currentColor;

  function dismiss(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function save() {
    if (!parsed) {
      return;
    }
    onAdd(parsed);
    dismiss(true);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    hexRef.current?.focus();
    hexRef.current?.select();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const node = wrapRef.current;
      if (node && !node.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="color-add-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="color-add"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (open) {
            dismiss(true);
            return;
          }
          setDraft(parseHex(currentColor) ?? "#000000");
          setOpen(true);
        }}
      >
        <ChromeIcon name="plus" />
        New color
      </button>
      {open ? (
        <div
          className="color-add-popover"
          role="dialog"
          aria-label="Add color"
        >
          <div className="color-add-preview-row">
            <span
              className="color-add-preview"
              style={{ background: preview }}
              aria-hidden
            />
            <label className="color-add-picker">
              Pick
              <input
                type="color"
                value={parsed ?? "#000000"}
                aria-label="Pick color"
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
          </div>
          <label className="color-add-hex" htmlFor={hexId}>
            Hex
          </label>
          <input
            ref={hexRef}
            id={hexId}
            className="color-add-hex-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            aria-invalid={parsed == null}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
            }}
          />
          <div className="color-add-actions">
            <button
              type="button"
              className="pill ghost"
              onClick={() => dismiss(true)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pill primary"
              disabled={parsed == null}
              onClick={save}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
