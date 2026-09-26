// Reusable WORLD MODE foundation (P3.5A).
//
// Small 2.5D cinematic hub system for React: normalized world coordinates
// (0..100 on both axes, frame-locked to a 16/9 viewport), keyboard-driven
// player, gentle follow camera, interaction zones, and mark surfaces that
// composite the real saved artwork into the environment plate.
//
// Rendering stays DOM/CSS over a realistic raster plate — no canvas engine,
// no 3D dependency. P3.5B/P4B reuse these modules for district/wall hubs.

export interface Vec2 {
  x: number;
  y: number;
}

export type Facing = "left" | "right";

export interface WalkBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface HotspotDef {
  /** Stable id, e.g. "car" | "safehouse" | "package" | "exit". */
  id: string;
  /** World-space center. */
  at: Vec2;
  /** Interaction radius in world units. */
  radius: number;
  label: string;
  sysLine: string;
  /** True for the district-access gate (always usable, never "inspected"). */
  isExit?: boolean;
}

export interface MarkSurfaceDef {
  /** Surface id, e.g. "car-door". */
  id: string;
  /** Placement fractions of the scene frame (matches MarkPlacementSpec). */
  placement: {
    left: string;
    top: string;
    width: string;
    height: string;
    rotate?: number;
  };
  alt: string;
}

export interface PlayerState {
  pos: Vec2;
  facing: Facing;
  moving: boolean;
  /** Optional realistic sprite URL. Absent until a real sprite asset lands. */
  spriteSrc: string | null;
}
