import { useEffect, useRef, useState } from "react";

interface HudProps {
  rep: number;
  heat: number;
  territory?: number;
  /** Compact overlay style for cinematic beats vs. full strip on the board. */
  variant?: "overlay" | "strip";
  /** P7C.1: omit legacy territory stat from canonical product */
  hideTerritory?: boolean;
}

function pad3(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(3, "0");
}

/** Number that ticks from its previous value to the new one on change. */
function TickNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const committedRef = useRef(value);

  useEffect(() => {
    const from = committedRef.current;
    if (from === value) return;
    let raf = 0;
    const start = performance.now();
    const duration = 700;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (k < 1) {
        raf = requestAnimationFrame(step);
      } else {
        committedRef.current = value;
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      committedRef.current = value;
    };
  }, [value]);

  return (
    <span>
      {pad3(display)}
      {suffix}
    </span>
  );
}

/**
 * Crew HUD. Receives live rep / heat / territory (P2 drives these after a
 * wall claim pays out) and ticks each number to its new value. Pure
 * presentational — no progression logic lives here.
 */
export default function Hud({
  rep,
  heat,
  territory = 0,
  variant = "overlay",
  hideTerritory = false,
}: HudProps) {
  const ariaLabel = hideTerritory
    ? `Crew status: rep ${rep}, heat ${heat}`
    : `Crew status: rep ${rep}, heat ${heat}, territory ${territory} percent`;
  return (
    <div
      className={variant === "overlay" ? "cm-hud cm-hud-overlay" : "cm-hud cm-hud-strip"}
      aria-label={ariaLabel}
    >
      <span className="cm-hud-item">
        <span className="cm-hud-label">Rep</span>
        <span className="cm-hud-value">
          <TickNumber value={rep} />
        </span>
      </span>
      <span className="cm-hud-item">
        <span className="cm-hud-label">Heat</span>
        <span className={`cm-hud-value${heat > 0 ? " hot" : ""}`}>
          <TickNumber value={heat} />
        </span>
      </span>
      {!hideTerritory && (
        <span className="cm-hud-item">
          <span className="cm-hud-label">Territory</span>
          <span className="cm-hud-value">
            <TickNumber value={territory} suffix="%" />
          </span>
        </span>
      )}
    </div>
  );
}
