"use client";

import { Eye, EyeOff, Lock, Unlock, ChevronDown, ChevronUp } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import { activePageLayer, pageLayers, type PageLayer } from "@/lib/types";

function LayerRow({
  layer,
  index,
  count,
  active,
}: {
  layer: PageLayer;
  index: number;
  count: number;
  active: boolean;
}) {
  const api = useFilm();
  const placements = layer.placements ?? [];

  return (
    <li className="layers-item" data-active={active}>
      <div className="layers-row">
        <button
          type="button"
          className="layers-select"
          aria-label={`Select layer ${layer.name}`}
          aria-pressed={active}
          onClick={() => api.selectLayer(layer.id)}
        >
          <span className="layers-swatch" aria-hidden="true" />
        </button>
        <input
          className="layers-name"
          aria-label={`Layer ${layer.name} name`}
          defaultValue={layer.name}
          onClick={() => api.selectLayer(layer.id)}
          onBlur={(event) => {
            const name = event.currentTarget.value.trim();
            if (!name) {
              event.currentTarget.value = layer.name;
            } else if (name !== layer.name) {
              api.updateLayer(layer.id, { name });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <button
          type="button"
          className="layers-icon-button"
          title={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
          aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
          aria-pressed={!layer.visible}
          onClick={() => api.updateLayer(layer.id, { visible: !layer.visible })}
        >
          {layer.visible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="layers-icon-button"
          title={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
          aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
          aria-pressed={layer.locked}
          onClick={() => api.updateLayer(layer.id, { locked: !layer.locked })}
        >
          {layer.locked ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
        </button>
      </div>
      {active && placements.length > 0 ? (
        <ul className="layers-assets" aria-label={`Assets in ${layer.name}`}>
          {[...placements].reverse().map((placement) => {
            const asset = api.film.assets.find((item) => item.id === placement.assetId);
            return (
              <li key={placement.id}>
                <button
                  type="button"
                  className="layers-asset"
                  aria-label={`Select ${asset?.name ?? "asset"}`}
                  aria-pressed={api.selectedPlacementId === placement.id}
                  disabled={!layer.visible || layer.locked}
                  onClick={() => {
                    api.setTool("move");
                    api.selectPlacement(placement.id);
                  }}
                >
                  {asset?.name ?? "Unnamed asset"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {active ? (
        <div className="layers-reorder" aria-label={`Reorder ${layer.name}`}>
          <button
            type="button"
            className="layers-icon-button"
            aria-label={`Move ${layer.name} up`}
            title="Move up"
            disabled={index === 0}
            onClick={() => api.moveLayer(layer.id, 1)}
          >
            <ChevronUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="layers-icon-button"
            aria-label={`Move ${layer.name} down`}
            title="Move down"
            disabled={index === count - 1}
            onClick={() => api.moveLayer(layer.id, -1)}
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function LayersPanel() {
  const api = useFilm();
  const page = api.active;
  if (!page) return null;

  const layers = pageLayers(page);
  const visibleLayers = [...layers].reverse();
  const activeLayer = activePageLayer(page);
  const canFlatten = Boolean(activeLayer && activeLayer.visible && !activeLayer.locked && activeLayer.placements.length);

  return (
    <section className="sidebar-section layers-panel" aria-label="Layers">
      <div className="layers-heading">
        <p className="sidebar-label">Layers</p>
        <button type="button" className="layers-new" onClick={() => api.addLayer()}>
          New layer
        </button>
      </div>
      <ul className="layers-list">
        {visibleLayers.map((layer, index) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            index={index}
            count={visibleLayers.length}
            active={layer.id === activeLayer.id}
          />
        ))}
      </ul>
      <button
        type="button"
        className="layers-flatten"
        disabled={!canFlatten}
        onClick={() => api.flattenLayer()}
      >
        Flatten assets
      </button>
    </section>
  );
}
