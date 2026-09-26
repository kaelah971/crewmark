import type { HotspotDef, Vec2, WalkBounds } from "./types";

export const WORLD_SIZE = 100;

/** Clamp a scalar into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamp a position into the walkable rectangle. */
export function clampToBounds(pos: Vec2, bounds: WalkBounds): Vec2 {
  return {
    x: clamp(pos.x, bounds.minX, bounds.maxX),
    y: clamp(pos.y, bounds.minY, bounds.maxY),
  };
}

/**
 * Normalize a raw input direction so diagonal movement is not faster than
 * axial movement. Zero input stays zero (idle).
 */
export function normalizeDirection(dir: Vec2): Vec2 {
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: dir.x / len, y: dir.y / len };
}

/** Advance a position by a normalized direction, speed (units/sec) and dt. */
export function stepPosition(pos: Vec2, dir: Vec2, speed: number, dtSeconds: number): Vec2 {
  const n = normalizeDirection(dir);
  return {
    x: pos.x + n.x * speed * dtSeconds,
    y: pos.y + n.y * speed * dtSeconds,
  };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** True when a world position is inside a hotspot's interaction radius. */
export function inRange(pos: Vec2, hotspot: Pick<HotspotDef, "at" | "radius">): boolean {
  return distance(pos, hotspot.at) <= hotspot.radius;
}

/** Nearest in-range hotspot, or null when the player is out of range of all. */
export function nearestInRange<T extends Pick<HotspotDef, "at" | "radius">>(
  pos: Vec2,
  hotspots: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const h of hotspots) {
    const d = distance(pos, h.at);
    if (d <= h.radius && d < bestDist) {
      best = h;
      bestDist = d;
    }
  }
  return best;
}
