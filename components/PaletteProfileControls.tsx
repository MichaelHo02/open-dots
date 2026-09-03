"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChromeIcon } from "./ChromeIcons";
import {
  MAX_PALETTE_NAME,
  isDefaultPaletteId,
  usablePaletteName,
  type PaletteProfile,
} from "@/lib/types";

export function PaletteProfileControls({
  palettes,
  activePaletteId,
  onSelect,
  onCreate,
  onRename,
}: {
  palettes: PaletteProfile[];
  activePaletteId: string;
  onSelect: (id: string) => boolean;
  onCreate: (name: string) => PaletteProfile | null;
  onRename: (id: string, name: string) => boolean;
}) {
  const active =
    palettes.find((profile) => profile.id === activePaletteId) ?? palettes[0];
  const custom = active ? !isDefaultPaletteId(active.id) : false;
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [renameDraft, setRenameDraft] = useState(active?.name ?? "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createId = useId();
  const renameId = useId();
  const createName = usablePaletteName(createDraft, palettes);
  const renameName = active
    ? usablePaletteName(renameDraft, palettes, active.id)
    : undefined;

  function dismissCreate(restoreFocus: boolean) {
    setCreating(false);
    setCreateDraft("");
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function dismissRename() {
    setRenaming(false);
    setRenameDraft(active?.name ?? "");
  }

  function saveCreate() {
    if (!createName) {
      return;
    }
    const profile = onCreate(createName);
    if (!profile) {
      return;
    }
    dismissCreate(true);
  }

  function commitRename() {
    if (!active || !custom) {
      return;
    }
    if (!renameName) {
      setRenameDraft(active.name);
      return;
    }
    if (renameName === active.name) {
      setRenameDraft(active.name);
      return;
    }
    if (!onRename(active.id, renameName)) {
      setRenameDraft(active.name);
    }
  }

  const activeKey = `${active?.id}:${active?.name}`;
  const [previousActiveKey, setPreviousActiveKey] = useState(activeKey);
  if (previousActiveKey !== activeKey) {
    setPreviousActiveKey(activeKey);
    setRenameDraft(active?.name ?? "");
  }

  useEffect(() => {
    if (!creating && !renaming) {
      return;
    }
    const input = creating ? createInputRef.current : renameInputRef.current;
    input?.focus();
    input?.select();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setCreating(false);
        setRenaming(false);
        setCreateDraft("");
        setRenameDraft(active?.name ?? "");
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const node = wrapRef.current;
      if (node && !node.contains(event.target as Node)) {
        setCreating(false);
        setRenaming(false);
        setCreateDraft("");
        setRenameDraft(active?.name ?? "");
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [active?.name, creating, renaming]);

  return (
    <div className="palette-profile-controls" ref={wrapRef}>
      <div className="palette-profile-row">
        <select
          className="palette-profile-select"
          value={activePaletteId}
          aria-label="Color profile"
          onChange={(event) => onSelect(event.target.value)}
        >
          {palettes.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        {custom ? <button type="button" className="palette-profile-edit icon-tooltip" aria-label="Rename color profile" aria-expanded={renaming} onClick={() => { setCreating(false); setRenaming(value => !value); }}><ChromeIcon name="draw" /></button> : null}
        <button
          ref={triggerRef}
          type="button"
          className="pill ghost palette-profile-new"
          aria-label="New profile"
          aria-expanded={creating}
          aria-haspopup="dialog"
          title="New profile"
          onClick={() => {
            if (creating) {
              dismissCreate(true);
              return;
            }
            setCreateDraft("");
            setRenaming(false);
            setCreating(true);
          }}
        >
          <ChromeIcon name="plus" />
          New
        </button>
      </div>
      {creating ? (
        <div
          className="palette-profile-popover"
          role="dialog"
          aria-label="New color profile"
        >
          <label className="palette-name-label" htmlFor={createId}>
            Name
          </label>
          <input
            ref={createInputRef}
            id={createId}
            className="palette-name-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={MAX_PALETTE_NAME}
            placeholder="Ocean"
            value={createDraft}
            aria-invalid={createDraft.trim().length > 0 && !createName}
            onChange={(event) => setCreateDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveCreate();
              }
            }}
          />
          <div className="color-add-actions">
            <button
              type="button"
              className="pill ghost"
              onClick={() => dismissCreate(true)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pill primary"
              disabled={!createName}
              onClick={saveCreate}
            >
              Save
            </button>
          </div>
        </div>
      ) : renaming && custom && active ? (
        <div className="palette-profile-popover" role="dialog" aria-label="Rename color profile">
          <input
            ref={renameInputRef}
            id={renameId}
            className="palette-name-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={MAX_PALETTE_NAME}
            value={renameDraft}
            aria-invalid={renameDraft.trim().length > 0 && !renameName}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
                setRenaming(false);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                dismissRename();
              }
            }}
          />
          <div className="color-add-actions"><button type="button" className="pill ghost" onClick={dismissRename}>Cancel</button><button type="button" className="pill primary" disabled={!renameName} onClick={() => { commitRename(); setRenaming(false); }}>Save</button></div>
        </div>
      ) : null}
    </div>
  );
}
