"use client";

import { useRef } from "react";
import { Keyboard, X } from "lucide-react";
import { AppTooltipTrigger } from "./AppTooltip";

const shortcuts = [["Draw","B"],["Erase","E"],["Fill","G"],["Text","T"],["Shape","U"],["Move","V"],["Select","M"],["Line","L"],["Undo","⌘ Z"],["Redo","⌘ ⇧ Z"],["Save project","⌘ S"],["Duplicate selection","⌘ D"]];

export function ShortcutHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <AppTooltipTrigger label="Keyboard shortcuts"><button type="button" className="toolbar-button" aria-label="Keyboard shortcuts" onClick={() => dialog.current?.showModal()}><Keyboard size={18} /></button></AppTooltipTrigger>
    <dialog ref={dialog} className="shortcut-dialog" aria-labelledby="shortcut-title"><div className="shortcut-heading"><h2 id="shortcut-title">Keyboard shortcuts</h2><button type="button" className="inspector-close" aria-label="Close shortcuts" onClick={() => dialog.current?.close()}><X size={16} /></button></div><dl>{shortcuts.map(([label,key]) => <div key={label}><dt>{label}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl></dialog>
  </>;
}
