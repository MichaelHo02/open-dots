import type { ReactNode } from "react";
import type { TextMark } from "@/lib/types";

export function BubbleFrame({
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
  return (
    <div
      className={`bubble bubble-${mark.frame} ${className}`.trim()}
      data-frame={mark.frame}
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        color: mark.color,
      }}
    >
      {chrome}
      <div className="bubble-body">{children}</div>
      {mark.frame === "speech" || mark.frame === "shout" ? (
        <span className="bubble-tail" aria-hidden="true" />
      ) : null}
      {mark.frame === "thought" ? (
        <span className="bubble-think" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </div>
  );
}
