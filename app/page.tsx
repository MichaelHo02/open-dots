"use client";

import { StudioApp } from "@/components/StudioApp";
import { StudioProvider } from "@/lib/studio-store";

export default function Home() {
  return (
    <StudioProvider>
      <StudioApp />
    </StudioProvider>
  );
}
