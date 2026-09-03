"use client";

import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Layers2, Lock, Merge, Plus, Trash2, Unlock } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { activePageLayer, pageLayers, type Page, type PageLayer } from "@/lib/types";
import { AssetThumb, PagePreview } from "./PagePreview";
import { AppTooltipTrigger } from "./AppTooltip";

function thumbnailPage(page: Page, layer: PageLayer): Page {
  return { id: layer.id, width: page.width, height: page.height, pixels: layer.pixels, placements: layer.placements, texts: layer.texts, boardX: 0, boardY: 0 };
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <AppTooltipTrigger label={label}><button type="button" className="layers-icon-button icon-tooltip" aria-label={label} disabled={disabled} onClick={onClick}>{children}</button></AppTooltipTrigger>;
}

function LayerRow({ page, layer, index, layers }: { page: Page; layer: PageLayer; index: number; layers: PageLayer[] }) {
  const api = useFilm();
  const active = activePageLayer(page).id === layer.id;
  const lowerLayer = index > 0 ? layers[index - 1] : null;
  const canMerge = Boolean(active && lowerLayer && !layer.locked && !lowerLayer.locked);

  return <li className="layers-item" data-active={active || undefined}>
    <button type="button" className="layers-select" aria-label={`Select ${layer.name}`} aria-pressed={active} title={`Select ${layer.name}`} onClick={() => api.selectLayer(layer.id)}>
      <PagePreview page={thumbnailPage(page, layer)} assets={api.film.assets} />
    </button>
    <div className="layers-row">
      <input className="layers-name" aria-label={`Layer name: ${layer.name}`} defaultValue={layer.name} onFocus={() => api.selectLayer(layer.id)} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== layer.name) api.updateLayer(layer.id, { name }); else event.currentTarget.value = layer.name; }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      <IconButton label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`} onClick={() => api.updateLayer(layer.id, { visible: !layer.visible })}>{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconButton>
      <IconButton label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`} onClick={() => api.updateLayer(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock size={14} /> : <Unlock size={14} />}</IconButton>
    </div>
    {active ? <div className="layers-actions" aria-label={`${layer.name} actions`}>
      <IconButton label="Move layer forward" disabled={index === layers.length - 1} onClick={() => api.moveLayer(layer.id, 1)}><ChevronUp size={14} /></IconButton>
      <IconButton label="Move layer back" disabled={index === 0} onClick={() => api.moveLayer(layer.id, -1)}><ChevronDown size={14} /></IconButton>
      <IconButton label="Duplicate layer" onClick={() => api.duplicateLayer(layer.id)}><Copy size={14} /></IconButton>
      <IconButton label="Merge with layer below" disabled={!canMerge} onClick={() => api.mergeLayerDown(layer.id)}><Merge size={14} /></IconButton>
      <IconButton label="Delete layer" disabled={layers.length <= 1 || layer.locked} onClick={() => api.removeLayer(layer.id)}><Trash2 size={14} /></IconButton>
    </div> : null}
    {layer.placements.length ? <ul className="layers-assets" aria-label={`Assets in ${layer.name}`}>
      {layer.placements.map((placement) => {
        const asset = api.film.assets.find((item) => item.id === placement.assetId);
        if (!asset) return null;
        return <li key={placement.id}><button type="button" className="layers-asset" aria-label={`Select ${asset.name}`} aria-pressed={api.selectedPlacementId === placement.id} title={`Select ${asset.name}`} onClick={() => { api.selectLayer(layer.id); api.setTool("move"); api.selectPlacement(placement.id); }}><AssetThumb asset={asset} /><span>{asset.name}</span></button></li>;
      })}
    </ul> : null}
  </li>;
}

export function LayersPanel() {
  const api = useFilm();
  const page = api.active;
  if (!page) return null;
  const layers = pageLayers(page);
  return <section className="sidebar-section layers-panel" aria-label="Layers">
    <div className="layers-heading"><p className="sidebar-label"><Layers2 size={14} aria-hidden="true" />Layers</p><button type="button" className="layers-new" title="New layer" onClick={() => api.addLayer()}><Plus size={14} aria-hidden="true" />New</button></div>
    <ul className="layers-list">{[...layers].reverse().map((layer) => <LayerRow key={layer.id} page={page} layer={layer} index={layers.indexOf(layer)} layers={layers} />)}</ul>
  </section>;
}
