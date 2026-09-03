"use client";

import { ArrowDownToLine, ArrowUpToLine, Clipboard, Copy, FlipHorizontal, FlipVertical, Forward, RotateCcw, Scissors, Trash2 } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { pageLayers } from "@/lib/types";
import { AssetThumb } from "./PagePreview";

function Action({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <button type="button" className="selection-action" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function SelectionControls() {
  const api = useFilm();
  const page = api.active;
  if (!page) return null;
  const layers = pageLayers(page);
  const selected = api.selectedPlacementId;
  const owner = selected ? layers.find((layer) => layer.placements.some((placement) => placement.id === selected)) : null;
  const placement = owner?.placements.find((item) => item.id === selected) ?? null;
  const asset = placement ? api.film.assets.find((item) => item.id === placement.assetId) : null;

  if (placement && asset && owner) {
    const disabled = owner.locked || !owner.visible;
    const placementIndex = owner.placements.findIndex((item) => item.id === placement.id);
    return <section className="sidebar-section selection-controls" aria-label="Selected asset">
      <div className="selection-heading">
        <div><p className="sidebar-label">Selected asset</p><p className="selection-title">{asset.name}</p></div>
        <span className="selection-thumb"><AssetThumb asset={asset} /></span>
      </div>
      <label className="selection-size">Width
        <input key={`${placement.id}:${placement.width}`} type="number" min={1} max={256} step={1} defaultValue={placement.width} aria-label="Selected asset width" disabled={disabled} onBlur={(event) => {
          const input = event.currentTarget;
          const width = Math.round(Number(input.value));
          if (!Number.isFinite(width) || width < 1 || width > 256) {
            input.value = String(placement.width);
            return;
          }
          if (!api.resizePlacement(placement.id, width, Math.max(1, Math.round(width * placement.height / placement.width)))) input.value = String(placement.width);
        }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /> px
      </label>
      <div className="selection-actions" aria-label="Asset actions">
        <Action label="Flip horizontally" disabled={disabled} onClick={() => api.flipPlacement(placement.id, "x")}><FlipHorizontal size={14} />Flip H</Action>
        <Action label="Flip vertically" disabled={disabled} onClick={() => api.flipPlacement(placement.id, "y")}><FlipVertical size={14} />Flip V</Action>
        <Action label="Bring forward" disabled={disabled || placementIndex === owner.placements.length - 1} onClick={() => api.reorderPlacement(placement.id, 1)}><ArrowUpToLine size={14} />Forward</Action>
        <Action label="Send backward" disabled={disabled || placementIndex === 0} onClick={() => api.reorderPlacement(placement.id, -1)}><ArrowDownToLine size={14} />Back</Action>
        <Action label="Duplicate asset" disabled={disabled} onClick={() => api.duplicatePlacement(placement.id)}><Copy size={14} />Duplicate</Action>
        <Action label="Delete asset" disabled={disabled} onClick={() => api.removePlacement(placement.id)}><Trash2 size={14} />Delete</Action>
      </div>
      <label className="selection-destination">Move to layer
        <select aria-label="Move selected asset to layer" value={owner.id} disabled={disabled} onChange={(event) => api.movePlacementToLayer(placement.id, event.target.value)}>
          {layers.map((layer) => <option key={layer.id} value={layer.id} disabled={layer.id !== owner.id && (layer.locked || !layer.visible)}>{layer.name}</option>)}
        </select>
      </label>
    </section>;
  }

  if (api.floating) {
    return <section className="sidebar-section selection-controls" aria-label="Pixel selection">
      <div className="selection-heading"><div><p className="sidebar-label">Pixel selection</p><p className="selection-title">{api.floating.width}×{api.floating.height} pixels</p></div><RotateCcw size={16} aria-hidden="true" /></div>
      <div className="selection-actions" aria-label="Pixel selection actions">
        <Action label="Copy selected pixels" onClick={() => api.copySelection()}><Clipboard size={14} />Copy</Action>
        <Action label="Cut selected pixels" onClick={() => api.cutSelection()}><Scissors size={14} />Cut</Action>
        <Action label="Paste copied pixels" onClick={() => api.pasteSelection()}><Forward size={14} />Paste</Action>
        <Action label="Duplicate selected pixels" onClick={() => api.duplicateSelection()}><Copy size={14} />Duplicate</Action>
        <Action label="Delete selected pixels" onClick={() => api.deleteSelection()}><Trash2 size={14} />Delete</Action>
      </div>
    </section>;
  }
  return null;
}
