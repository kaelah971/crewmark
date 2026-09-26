import type { HotspotDef, Vec2, WalkBounds } from "./types";

/**
 * Job-yard hub configuration (P3.5A-R), retuned to the dedicated plate
 * src/assets/world/yard-wide.png (1672x941):
 *
 * - office/personnel door with terminal glow: x~29%, base y~60%
 * - roll-up print-shop shutter: x~8-26%, base y~60%
 * - crew sedan three-quarter, mid-right: x~39-63%, body mid y~57%
 * - crates right: x~74-93% (set dressing, no hotspot in this slice)
 * - exit gate/fence far right: x~82%, base y~55%
 * - walkable wet pavement band: y 60-92%
 *
 * All coordinates are fractions of the plate. The legacy afterHoursYard
 * config (landing-plate tuning) is left intact for rollback.
 */

export const JOB_YARD_BOUNDS: WalkBounds = { minX: 6, maxX: 94, minY: 60, maxY: 92 };

export const JOB_YARD_SPAWN: Vec2 = { x: 40, y: 80 };

export const JOB_YARD_SPEED = 26;

export const JOB_YARD_HOTSPOTS: readonly HotspotDef[] = [
  {
    id: "job-terminal",
    at: { x: 27, y: 64 },
    radius: 9,
    label: "Job terminal",
    sysLine: "Check jobs",
  },
  {
    id: "print-shop",
    at: { x: 15, y: 66 },
    radius: 9,
    label: "Print shop",
    sysLine: "Enter print shop",
  },
  {
    id: "vehicle",
    at: { x: 51, y: 68 },
    radius: 11,
    label: "Vehicle",
    sysLine: "Inspect vehicle",
  },
  {
    id: "exit-gate",
    at: { x: 84, y: 62 },
    radius: 10,
    label: "Exit gate",
    sysLine: "Leave yard",
    isExit: true,
  },
];
