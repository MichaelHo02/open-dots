import type { CSSProperties, ReactNode } from "react";
import { assertNever, type TextFrame, type TextMark } from "@/lib/types";

function ShapeBackdrop({
  frame,
  filled,
}: {
  frame: TextFrame;
  filled: boolean;
}) {
  const fill = filled ? "currentColor" : "#fff";
  switch (frame) {
    case "circle":
    case "rectangle":
    case "square":
      return <span className="bubble-shape" aria-hidden="true" />;
    case "heart":
      return (
        <svg
          className="bubble-shape"
          viewBox="0 0 100 90"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            d="M50 82 C 22 60 8 44 8 26 C 8 14 18 6 30 6 C 38 6 45 10 50 18 C 55 10 62 6 70 6 C 82 6 92 14 92 26 C 92 44 78 60 50 82 Z"
            fill={fill}
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "star":
      return (
        <svg
          className="bubble-shape"
          viewBox="0 0 100 100"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <polygon
            points="50,4 61.8,35.5 96,38.2 70,59.5 79.4,93 50,75.2 20.6,93 30,59.5 4,38.2 38.2,35.5"
            fill={fill}
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return assertNever(frame, "Unknown frame");
  }
}

export function FrameSample({ frame }: { frame: TextFrame }) {
  return (
    <span className={`frame-sample bubble-${frame}`} data-frame={frame}>
      <ShapeBackdrop frame={frame} filled={false} />
    </span>
  );
}

export function TextMarkFrame({
  mark,
  children,
  chrome,
  className = "",
}: {
  mark: TextMark;
  children: ReactNode;
  chrome?: ReactNode;
  className?: string;
}) {
  const style: CSSProperties = {
    left: `${mark.x * 100}%`,
    top: `${mark.y * 100}%`,
    color: mark.color,
  };
  return (
    <div
      className={`text-mark ${className}`.trim()}
      data-font={mark.font}
      data-size={mark.size}
      style={style}
    >
      {chrome}
      <div className="text-mark-body">{children}</div>
    </div>
  );
}
