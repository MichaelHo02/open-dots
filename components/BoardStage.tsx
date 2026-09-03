"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Plus, Trash2, Crosshair } from "lucide-react";
import { useFilm } from "@/lib/film-store";
import {
  BOARD_NODE_CANVAS_HEIGHT,
  BOARD_NODE_HEADER,
  BOARD_NODE_HEIGHT,
  BOARD_NODE_WIDTH,
  readingOrder,
  type Page,
} from "@/lib/types";
import { PixelCanvas } from "./PixelCanvas";
import { PagePreview } from "./PagePreview";

type Pan = { x: number; y: number };

type PanGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type NodeDrag = {
  pointerId: number;
  id: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type Connect = {
  pointerId: number;
  fromId: string;
  x: number;
  y: number;
};

const PORT_CENTER_Y = BOARD_NODE_HEADER + BOARD_NODE_CANVAS_HEIGHT / 2;

function portOut(page: Page): { x: number; y: number } {
  return { x: page.boardX + BOARD_NODE_WIDTH, y: page.boardY + PORT_CENTER_Y };
}

function portIn(page: Page): { x: number; y: number } {
  return { x: page.boardX, y: page.boardY + PORT_CENTER_Y };
}

function edgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = Math.max(40, Math.abs(to.x - from.x) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

export function BoardStage({
  viewportRef,
}: {
  viewportRef: RefObject<HTMLElement | null>;
}) {
  const api = useFilm();
  const { film, stageZoom } = api;
  const pages = film.pages;

  const localViewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<Pan>({ x: 48, y: 48 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [connect, setConnect] = useState<Connect | null>(null);
  const panGesture = useRef<PanGesture | null>(null);
  const nodeDrag = useRef<NodeDrag | null>(null);
  const centered = useRef(false);

  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      localViewportRef.current = node;
      viewportRef.current = node;
    },
    [viewportRef],
  );

  const screenToBoard = useCallback(
    (clientX: number, clientY: number) => {
      const rect = localViewportRef.current?.getBoundingClientRect();
      if (!rect) {
        return { x: 0, y: 0 };
      }
      return {
        x: (clientX - rect.left - pan.x) / stageZoom,
        y: (clientY - rect.top - pan.y) / stageZoom,
      };
    },
    [pan.x, pan.y, stageZoom],
  );

  const recenter = useCallback(() => {
    const rect = localViewportRef.current?.getBoundingClientRect();
    if (!rect || pages.length === 0) {
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const page of pages) {
      minX = Math.min(minX, page.boardX);
      minY = Math.min(minY, page.boardY);
      maxX = Math.max(maxX, page.boardX + BOARD_NODE_WIDTH);
      maxY = Math.max(maxY, page.boardY + BOARD_NODE_HEIGHT);
    }
    const contentW = (maxX - minX) * stageZoom;
    const contentH = (maxY - minY) * stageZoom;
    setPan({
      x: (rect.width - contentW) / 2 - minX * stageZoom,
      y: (rect.height - contentH) / 2 - minY * stageZoom,
    });
  }, [pages, stageZoom]);

  useLayoutEffect(() => {
    if (centered.current) {
      return;
    }
    centered.current = true;
    recenter();
  }, [recenter]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, input, select, button, [contenteditable]")) {
        return;
      }
      event.preventDefault();
      setSpaceHeld(true);
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setSpaceHeld(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const beginPan = (event: ReactPointerEvent, node: HTMLElement) => {
    node.setPointerCapture(event.pointerId);
    setPanning(true);
    panGesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const onViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const onBackground =
      target === event.currentTarget ||
      target.classList.contains("board-content") ||
      target.classList.contains("board-pan-veil");
    if (spaceHeld || event.button === 1 || (event.button === 0 && onBackground)) {
      beginPan(event, event.currentTarget);
    }
  };

  const onViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = panGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    setPan({
      x: gesture.originX + (event.clientX - gesture.startX),
      y: gesture.originY + (event.clientY - gesture.startY),
    });
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panGesture.current?.pointerId === event.pointerId) {
      panGesture.current = null;
      setPanning(false);
    }
  };

  const startNodeDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    page: Page,
    index: number,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    api.selectPage(index);
    event.currentTarget.setPointerCapture(event.pointerId);
    nodeDrag.current = {
      pointerId: event.pointerId,
      id: page.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: page.boardX,
      originY: page.boardY,
      moved: false,
    };
  };

  const onNodeDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = nodeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = (event.clientX - drag.startX) / stageZoom;
    const dy = (event.clientY - drag.startY) / stageZoom;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      drag.moved = true;
    }
    api.movePage(drag.id, drag.originX + dx, drag.originY + dy);
  };

  const endNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (nodeDrag.current?.pointerId === event.pointerId) {
      nodeDrag.current = null;
    }
  };

  const startConnect = (event: ReactPointerEvent<HTMLButtonElement>, page: Page) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = screenToBoard(event.clientX, event.clientY);
    setConnect({ pointerId: event.pointerId, fromId: page.id, x: at.x, y: at.y });
  };

  const onConnectMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!connect || connect.pointerId !== event.pointerId) {
      return;
    }
    const at = screenToBoard(event.clientX, event.clientY);
    setConnect({ ...connect, x: at.x, y: at.y });
  };

  const endConnect = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!connect || connect.pointerId !== event.pointerId) {
      return;
    }
    const at = screenToBoard(event.clientX, event.clientY);
    const target = pages.find(
      (page) =>
        page.id !== connect.fromId &&
        at.x >= page.boardX &&
        at.x <= page.boardX + BOARD_NODE_WIDTH &&
        at.y >= page.boardY &&
        at.y <= page.boardY + BOARD_NODE_HEIGHT,
    );
    if (target) {
      api.linkPages(connect.fromId, target.id);
    }
    setConnect(null);
  };

  const order = readingOrder(pages);
  const orderIndex = new Map(order.map((page, index) => [page.id, index] as const));

  const contentStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${stageZoom})`,
    transformOrigin: "0 0",
  };

  return (
    <div
      ref={setViewport}
      className="board-viewport screen-only"
      data-space={spaceHeld ? "true" : undefined}
      data-panning={panning ? "true" : undefined}
      onPointerDown={onViewportPointerDown}
      onPointerMove={onViewportPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div className="board-toolbar">
        <button
          type="button"
          className="pill primary"
          onClick={() => api.addPage()}
        >
          <Plus size={14} aria-hidden="true" />
          Page
        </button>
        <button
          type="button"
          className="pill ghost"
          onClick={() => recenter()}
          aria-label="Recenter board"
        >
          <Crosshair size={14} aria-hidden="true" />
          Recenter
        </button>
      </div>

      <div className="board-content" style={contentStyle}>
        <svg className="board-edges" width={1} height={1} aria-hidden="true">
          {pages.map((page) => {
            if (!page.nextPageId) {
              return null;
            }
            const target = pages.find((item) => item.id === page.nextPageId);
            if (!target) {
              return null;
            }
            return (
              <path
                key={`${page.id}->${target.id}`}
                className="board-edge"
                d={edgePath(portOut(page), portIn(target))}
              />
            );
          })}
          {connect
            ? (() => {
                const from = pages.find((page) => page.id === connect.fromId);
                if (!from) {
                  return null;
                }
                return (
                  <path
                    className="board-edge board-edge-live"
                    d={edgePath(portOut(from), { x: connect.x, y: connect.y })}
                  />
                );
              })()
            : null}
        </svg>

        {pages.map((page, index) => {
          const active = index === film.activeIndex;
          const readIndex = orderIndex.get(page.id) ?? index;
          return (
            <div
              key={page.id}
              className="board-node"
              data-active={active ? "true" : undefined}
              style={{
                left: page.boardX,
                top: page.boardY,
                width: BOARD_NODE_WIDTH,
                height: BOARD_NODE_HEIGHT,
              }}
            >
              <div
                className="board-node-head"
                onPointerDown={(event) => startNodeDrag(event, page, index)}
                onPointerMove={onNodeDragMove}
                onPointerUp={endNodeDrag}
                onPointerCancel={endNodeDrag}
              >
                <button
                  type="button"
                  className="board-node-title board-node-del"
                  aria-label={`Select or move page ${readIndex + 1}`}
                  onClick={() => api.selectPage(index)}
                  onKeyDown={(event) => {
                    const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
                    if (!delta) return;
                    event.preventDefault();
                    api.movePage(page.id, page.boardX + delta[0], page.boardY + delta[1]);
                  }}
                >Page {readIndex + 1}</button>
                <select
                  className="board-next"
                  aria-label={`Next after page ${readIndex + 1}`}
                  value={page.nextPageId ?? ""}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => api.linkPages(page.id, event.target.value || null)}
                >
                  <option value="">End</option>
                  {pages.filter((item) => item.id !== page.id).map((item) => (
                    <option key={item.id} value={item.id}>Next: Page {(orderIndex.get(item.id) ?? 0) + 1}</option>
                  ))}
                </select>
                {pages.length > 1 ? (
                  <button
                    type="button"
                    className="board-node-del"
                    aria-label={`Delete page ${readIndex + 1}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => api.removePage(index)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div
                className="board-node-canvas"
                onPointerDown={(event) => {
                  if (active || spaceHeld || event.button !== 0) {
                    return;
                  }
                  api.selectPage(index);
                }}
              >
                {active ? (
                  <PixelCanvas />
                ) : (
                  <PagePreview
                    page={page}
                    assets={film.assets}
                    className="board-node-preview"
                  />
                )}
              </div>

              <button
                type="button"
                className="board-node-port"
                aria-label={`Link page ${readIndex + 1} to another page`}
                title="Drag to another page to set what comes next"
                onPointerDown={(event) => startConnect(event, page)}
                onPointerMove={onConnectMove}
                onPointerUp={endConnect}
                onPointerCancel={() => setConnect(null)}
              />
            </div>
          );
        })}
      </div>

      {spaceHeld ? <div className="board-pan-veil" aria-hidden="true" /> : null}
    </div>
  );
}
