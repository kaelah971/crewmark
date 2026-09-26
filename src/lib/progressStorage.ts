// P2+P3 persistence: crew progress (rep/heat/territory + claims) and one-way
// story event flags. The mark itself stays in markStorage. Progress without
// a stored mark is treated as orphaned and discarded, so a cleared mark can
// never resurrect stale territory.
//
// BACKWARD COMPATIBILITY: P2-era stored data has no `events` key. sanitize()
// defaults missing/invalid events to { false, false }, so old saves load
// cleanly and P3 events simply trigger fresh — never double-award, since the
// App guards on these flags before paying heat.

import type { DistrictId } from "./districts";
import type { WallPlacement } from "../components/WallScene";
import { loadMark } from "./markStorage";

export interface ClaimRecord {
  districtId: DistrictId;
  placement: WallPlacement;
}

export type StoryEvent = "surveillanceTriggered" | "identityTheftTriggered";

export interface StoryEvents {
  surveillanceTriggered: boolean;
  identityTheftTriggered: boolean;
}

export interface ProgressState {
  rep: number;
  heat: number;
  territory: number;
  claims: ClaimRecord[];
  events: StoryEvents;
}

const STORAGE_KEY = "crewmark:p2:progress";

const EMPTY_EVENTS: StoryEvents = {
  surveillanceTriggered: false,
  identityTheftTriggered: false,
};

export const EMPTY_PROGRESS: ProgressState = {
  rep: 0,
  heat: 0,
  territory: 0,
  claims: [],
  events: { ...EMPTY_EVENTS },
};

function isValidPlacement(p: unknown): p is WallPlacement {
  if (typeof p !== "object" || p === null) return false;
  const v = p as Record<string, unknown>;
  return (
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    typeof v.scale === "number" &&
    typeof v.rotate === "number"
  );
}

function sanitizeEvents(raw: unknown): StoryEvents {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_EVENTS };
  const v = raw as Record<string, unknown>;
  return {
    surveillanceTriggered: v.surveillanceTriggered === true,
    identityTheftTriggered: v.identityTheftTriggered === true,
  };
}

function sanitize(raw: unknown): ProgressState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (
    typeof v.rep !== "number" ||
    typeof v.heat !== "number" ||
    typeof v.territory !== "number" ||
    !Array.isArray(v.claims)
  ) {
    return null;
  }
  const claims: ClaimRecord[] = [];
  for (const c of v.claims) {
    if (typeof c !== "object" || c === null) continue;
    const r = c as Record<string, unknown>;
    if (
      (r.districtId === "port-vice" ||
        r.districtId === "vice-beach" ||
        r.districtId === "little-leonida") &&
      isValidPlacement(r.placement)
    ) {
      claims.push({ districtId: r.districtId, placement: r.placement });
    }
  }
  return {
    rep: Math.max(0, Math.floor(v.rep)),
    heat: Math.max(0, Math.floor(v.heat)),
    territory: Math.max(0, Math.floor(v.territory)),
    claims,
    events: sanitizeEvents(v.events),
  };
}

/** Load progress, or null when nothing valid (or no mark) is stored. */
export function loadProgress(): ProgressState | null {
  try {
    if (loadMark() === null) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch (err) {
    console.warn("[crewmark] Progress load failed; starting at zero.", err);
    return null;
  }
}

export function saveProgress(state: ProgressState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("[crewmark] Progress save failed; progress is session-only.", err);
  }
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[crewmark] Progress clear failed.", err);
  }
}
