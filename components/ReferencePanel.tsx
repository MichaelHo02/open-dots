"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import Image from "next/image";

export function ReferencePanel() {
  const input = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => () => { if (reference) URL.revokeObjectURL(reference.url); }, [reference]);
  return <section className="sidebar-section reference-panel" aria-label="Reference image">
    <div className="sidebar-assets-head"><p className="sidebar-label">Reference</p>{reference ? <button type="button" aria-label="Remove reference image" onClick={() => setReference(null)}><X size={14} /></button> : null}</div>
    {reference ? <><Image unoptimized width={240} height={150} src={reference.url} alt="Drawing reference" /><span title={reference.name}>{reference.name}</span></> : <button type="button" className="color-add" onClick={() => input.current?.click()}><ImagePlus size={15} />Add reference</button>}
    <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file || file.size > 10 * 1024 * 1024) return;
      setReference(current => { if (current) URL.revokeObjectURL(current.url); return { name: file.name, url: URL.createObjectURL(file) }; });
    }} />
  </section>;
}
