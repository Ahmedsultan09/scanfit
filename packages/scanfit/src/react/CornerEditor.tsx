import { useEffect, useRef, useState } from "react";
import {
  FULL_QUAD,
  copyQuad,
  validateQuad,
  type Quad,
  type ScanPage,
} from "../core";
import { useObjectUrl } from "./hooks";
import type { ScannerMessages } from "./messages";

export function CornerEditor({
  page,
  onApply,
  messages: m,
  disabled,
}: {
  page: ScanPage;
  onApply: (q: Quad) => void;
  messages: ScannerMessages;
  disabled: boolean;
}) {
  const url = useObjectUrl(page.preview),
    [corners, setCorners] = useState(() => copyQuad(page.edits.corners)),
    [selected, setSelected] = useState(0);
  const area = useRef<HTMLDivElement>(null),
    drag = useRef<{ index: number; rect: DOMRect } | null>(null);
  useEffect(
    () => setCorners(copyQuad(page.edits.corners)),
    [page.edits.corners],
  );
  const labels = [m.topLeft, m.topRight, m.bottomRight, m.bottomLeft];
  function move(index: number, x: number, y: number) {
    const next = copyQuad(corners);
    next[index] = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
    try {
      validateQuad(next);
    } catch {
      return;
    }
    setCorners(next);
    onApply(next);
  }
  function nudge(dx: number, dy: number, step = 1) {
    const p = corners[selected];
    move(
      selected,
      p.x + (dx * step) / page.width,
      p.y + (dy * step) / page.height,
    );
  }
  const magWidth = 600,
    magHeight = (magWidth * page.height) / page.width;
  return (
    <div className="sf-crop">
      <div
        className="sf-image-wrap"
        ref={area}
        style={{ aspectRatio: `${page.width}/${page.height}` }}
      >
        {url ? <img src={url} alt={m.sourcePreview} draggable={false} /> : null}
        <svg
          className="sf-outline"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points={corners.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
          />
        </svg>
        {corners.map((p, i) => (
          <button
            key={i}
            type="button"
            className={`sf-handle ${selected === i ? "sf-selected" : ""}`}
            aria-label={`${m.corner}: ${labels[i]}`}
            aria-pressed={selected === i}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            disabled={disabled}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            onFocus={() => setSelected(i)}
            onPointerDown={(event) => {
              if (disabled) return;
              setSelected(i);
              drag.current = {
                index: i,
                rect: area.current!.getBoundingClientRect(),
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const d = drag.current;
              if (d?.index === i)
                move(
                  i,
                  (event.clientX - d.rect.left) / d.rect.width,
                  (event.clientY - d.rect.top) / d.rect.height,
                );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onKeyDown={(event) => {
              const direction: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              const delta = direction[event.key];
              if (delta) {
                event.preventDefault();
                const step = event.shiftKey ? 10 : 1;
                move(
                  i,
                  p.x + (delta[0] * step) / page.width,
                  p.y + (delta[1] * step) / page.height,
                );
              }
            }}
          />
        ))}
      </div>
      <div className="sf-corner-tools">
        <div
          className="sf-magnifier"
          aria-hidden="true"
          style={{
            backgroundImage: url ? `url("${url}")` : undefined,
            backgroundSize: `${magWidth}px ${magHeight}px`,
            backgroundPosition: `${48 - corners[selected].x * magWidth}px ${48 - corners[selected].y * magHeight}px`,
          }}
        >
          <span>+</span>
        </div>
        <div>
          <label className="sf-label">
            {m.corner}
            <select
              value={selected}
              disabled={disabled}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {labels.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="sf-nudges">
            {[
              [m.nudgeLeft, -1, 0, "←"],
              [m.nudgeUp, 0, -1, "↑"],
              [m.nudgeDown, 0, 1, "↓"],
              [m.nudgeRight, 1, 0, "→"],
            ].map(([label, dx, dy, icon]) => (
              <button
                key={String(label)}
                type="button"
                aria-label={String(label)}
                disabled={disabled}
                onClick={() => nudge(Number(dx), Number(dy), 5)}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className="sf-crop-actions">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const next = copyQuad(FULL_QUAD);
              setCorners(next);
              onApply(next);
            }}
          >
            {m.resetCrop}
          </button>
        </div>
      </div>
      <p className="sf-hint">{m.cropHelp}</p>
      <p className="sf-file-input" role="status" aria-live="polite" aria-atomic="true">
        {labels[selected]}: x {(corners[selected].x * 100).toFixed(1)}%, y {(corners[selected].y * 100).toFixed(1)}%
      </p>
    </div>
  );
}
