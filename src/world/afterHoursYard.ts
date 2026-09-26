import type { HotspotDef, MarkSurfaceDef, Vec2, WalkBounds } from "./types";

/**
 * 305 PRINT & SIGN // AFTER-HOURS YARD — first playable hub (P3.5A).
 *
 * Environment plate: the approved landing raster
 * (src/assets/crewmark-landing-scene.png) reused as the same in-fiction
 * location on the same night — wet alley, parked crew car mid-ground,
 * safehouse wall right, crates/cans foreground right, street gate center.
 * All hotspot and mark-surface coordinates are fractions of that plate.
 */

export const YARD_BOUNDS: WalkBounds = { minX: 8, maxX: 92, minY: 60, maxY: 90 };

export const YARD_SPAWN: Vec2 = { x: 50, y: 80 };

export const YARD_SPEED = 26;

export const YARD_HOTSPOTS: readonly HotspotDef[] = [
  {
    id: "car",
    at: { x: 38, y: 70 },
    radius: 11,
    label: "Crew car",
    sysLine: "Identity applied",
  },
  {
    id: "safehouse",
    at: { x: 74, y: 62 },
    radius: 12,
    label: "Safehouse",
    sysLine: "Home base updated",
  },
  {
    id: "package",
    at: { x: 87, y: 79 },
    radius: 10,
    label: "Package",
    sysLine: "Distribution identity updated",
  },
  {
    id: "exit",
    at: { x: 50, y: 63 },
    radius: 9,
    label: "Exit // district access",
    sysLine: "Leave the yard",
    isExit: true,
  },
];

export interface WorldMarkSurface extends MarkSurfaceDef {
  /** Exact saved artwork — always the canonical mark, never a substitute. */
  src: string;
}

/**
 * Mark surfaces for the yard, bound to the one real saved mark. Every
 * surface carries the identical `mark` string by construction.
 */
export function buildYardMarkSurfaces(mark: string): WorldMarkSurface[] {
  const surfaces: MarkSurfaceDef[] = [
    {
      id: "car-door",
      placement: { left: "33%", top: "62%", width: "11%", height: "11%" },
      alt: "Your saved mark on the crew car door",
    },
    {
      id: "safehouse-panel",
      placement: { left: "72%", top: "27%", width: "9%", height: "13%" },
      alt: "Your saved mark on the safehouse wall panel",
    },
    {
      id: "crate-label",
      placement: { left: "83%", top: "73%", width: "9%", height: "9%", rotate: -4 },
      alt: "Your saved mark on the package crate",
    },
  ];
  return surfaces.map((s) => ({ ...s, src: mark }));
}

/** Hotspot ids that count toward the MAKE YOURSELF KNOWN unlock. */
export const YARD_INSPECTABLE_IDS = ["car", "safehouse", "package"] as const;
