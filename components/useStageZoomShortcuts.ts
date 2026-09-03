"use client";

import { useEffect, type RefObject } from "react";
import { useFilm } from "@/lib/film-store";

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("textarea, input, select, [contenteditable]"));
}

export function useStageZoomShortcuts(stageRef: RefObject<HTMLElement | null>) {
  const { stepStageZoom, resetStageZoom } = useFilm();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        stepStageZoom(1);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        stepStageZoom(-1);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        resetStageZoom();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetStageZoom, stepStageZoom]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return;
    }

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      stepStageZoom(event.deltaY > 0 ? -1 : 1);
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [stageRef, stepStageZoom]);
}
