import { useState } from "react";
import type { HotspotDef } from "../../world/types";

export type ZoneState = "idle" | "near" | "done";
export type ZoneMarker = "objective" | "normal" | "locked" | "done";

interface InteractionZoneProps {
  hotspot: HotspotDef;
  state: ZoneState;
  onActivate: (id: string) => void;
  label?: { title: string; action: string };
  /** P7C.2: always-visible micro-marker treatment */
  marker?: ZoneMarker;
}

/**
 * P7C.2 Point-and-explore marker:
 * - Always-visible 12px micro marker (dot + thin ring); never fully disappears.
 * - Objective marker pulses brighter; locked markers render muted grey.
 * - Hover / keyboard focus expands the contextual label; leave / blur
 *   collapses back to the micro marker.
 */
export default function InteractionZone({ hotspot, state, onActivate, label, marker = "normal" }: InteractionZoneProps) {
  const [expanded, setExpanded] = useState(false);

  const title = label?.title ?? hotspot.label;
  const action = label?.action ?? (state === "done" ? "INSPECTED" : "CLICK TO INSPECT");

  return (
    <button
      type="button"
      className={`cm-zone-hitbox is-${state} mk-${marker}${expanded ? " is-hovered" : ""}`}
      style={{ left: `${hotspot.at.x}%`, top: `${hotspot.at.y}%` }}
      onClick={() => onActivate(hotspot.id)}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      aria-label={`${title}. ${action}.`}
    >
      <span className="cm-zone-dot" aria-hidden="true" />
      {expanded && (
        <span className="cm-zone-hover-label" aria-hidden="true">
          <span className="cm-zone-hover-title">{title}</span>
          <span className="cm-zone-hover-action">{action}</span>
        </span>
      )}
    </button>
  );
}
