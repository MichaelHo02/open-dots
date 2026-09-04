"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { FilmApi } from "@/lib/types";
import { rasterizeImageBlob } from "@/lib/image-asset-import";

export function AssetImageImport({ api, disabled }: { api: FilmApi; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  return <>
    <button type="button" className="color-add" disabled={disabled} onClick={() => input.current?.click()}>
      <ImagePlus size={15} aria-hidden="true" />Import image
    </button>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="Import image as asset" onChange={async event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      setError("");
      try {
        const { pixels, ...size } = await rasterizeImageBlob(file, api.film.palette);
        const name = file.name.replace(/\.[^.]+$/, "") || "Imported image";
        const asset = api.addAsset({ name, ...size, pixels });
        if (!asset) throw new Error("Could not add this image to the asset library.");
        api.selectAsset(asset.id);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not import this image.");
      }
    }} />
    {error ? <p className="asset-import-error" role="alert">{error}</p> : null}
  </>;
}
