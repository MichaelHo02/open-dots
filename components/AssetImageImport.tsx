"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { FilmApi } from "@/lib/types";
import { fitAssetSize, opaqueBounds, quantizePixels } from "@/lib/image-asset-import";

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
        if (file.size > 10 * 1024 * 1024) throw new Error("Image must be 10 MB or smaller.");
        const bitmap = await createImageBitmap(file);
        const source = document.createElement("canvas");
        source.width = bitmap.width; source.height = bitmap.height;
        const sourceContext = source.getContext("2d", { willReadFrequently: true });
        if (!sourceContext) throw new Error("Image processing is unavailable in this browser.");
        sourceContext.drawImage(bitmap, 0, 0); bitmap.close();
        const bounds = opaqueBounds(sourceContext.getImageData(0, 0, source.width, source.height));
        if (!bounds) throw new Error("The image is fully transparent.");
        const size = fitAssetSize(bounds.width, bounds.height);
        const output = document.createElement("canvas");
        output.width = size.width; output.height = size.height;
        const outputContext = output.getContext("2d", { willReadFrequently: true });
        if (!outputContext) throw new Error("Image processing is unavailable in this browser.");
        outputContext.imageSmoothingEnabled = false;
        outputContext.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, size.width, size.height);
        const pixels = quantizePixels(outputContext.getImageData(0, 0, size.width, size.height), api.film.palette);
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
