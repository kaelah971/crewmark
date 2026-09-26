import { describe, expect, it } from "vitest";
import {
  buildYardMarkSurfaces,
  YARD_BOUNDS,
  YARD_HOTSPOTS,
  YARD_INSPECTABLE_IDS,
} from "./afterHoursYard";
import { clampToBounds, inRange, nearestInRange, normalizeDirection, stepPosition } from "./movement";
import { resolveResumeTarget } from "../lib/resume";

const MARK = "data:image/png;base64,VjE=";

describe("movement bounds", () => {
  it("clamps positions into the walkable rectangle", () => {
    expect(clampToBounds({ x: -40, y: 200 }, YARD_BOUNDS)).toEqual({ x: 8, y: 90 });
    expect(clampToBounds({ x: 500, y: -3 }, YARD_BOUNDS)).toEqual({ x: 92, y: 60 });
    expect(clampToBounds({ x: 50, y: 75 }, YARD_BOUNDS)).toEqual({ x: 50, y: 75 });
  });

  it("never leaves bounds after a large step", () => {
    const stepped = stepPosition({ x: 90, y: 88 }, { x: 1, y: 1 }, 1000, 1);
    const clamped = clampToBounds(stepped, YARD_BOUNDS);
    expect(clamped.x).toBeLessThanOrEqual(YARD_BOUNDS.maxX);
    expect(clamped.y).toBeLessThanOrEqual(YARD_BOUNDS.maxY);
  });

  it("normalizes diagonal movement to axial speed", () => {
    const diag = stepPosition({ x: 50, y: 75 }, { x: 1, y: 1 }, 26, 1);
    const axial = stepPosition({ x: 50, y: 75 }, { x: 1, y: 0 }, 26, 1);
    const diagDist = Math.hypot(diag.x - 50, diag.y - 75);
    const axialDist = Math.hypot(axial.x - 50, axial.y - 75);
    expect(diagDist).toBeCloseTo(axialDist, 9);
    expect(diagDist).toBeCloseTo(26, 9);
  });

  it("zero input stays idle", () => {
    expect(normalizeDirection({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(stepPosition({ x: 50, y: 75 }, { x: 0, y: 0 }, 26, 1)).toEqual({ x: 50, y: 75 });
  });
});

describe("interaction-range detection", () => {
  it("detects the car hotspot in range and ignores distant ones", () => {
    const car = YARD_HOTSPOTS.find((h) => h.id === "car")!;
    expect(inRange({ x: 38, y: 70 }, car)).toBe(true);
    expect(inRange({ x: 38 + car.radius, y: 70 }, car)).toBe(true);
    expect(inRange({ x: 38 + car.radius + 0.5, y: 70 }, car)).toBe(false);
    expect(inRange({ x: 90, y: 88 }, car)).toBe(false);
  });

  it("returns the nearest in-range hotspot, or null when out of range", () => {
    expect(nearestInRange({ x: 38, y: 70 }, YARD_HOTSPOTS)?.id).toBe("car");
    expect(nearestInRange({ x: 50, y: 63 }, YARD_HOTSPOTS)?.id).toBe("exit");
    expect(nearestInRange({ x: 8, y: 90 }, YARD_HOTSPOTS)).toBeNull();
  });

  it("every inspectable hotspot is reachable from inside walk bounds", () => {
    for (const id of YARD_INSPECTABLE_IDS) {
      const hotspot = YARD_HOTSPOTS.find((h) => h.id === id)!;
      const clamped = clampToBounds(hotspot.at, YARD_BOUNDS);
      expect(inRange(clamped, hotspot)).toBe(true);
    }
  });
});

describe("markV1 stays canonical in-world", () => {
  it("binds the identical mark string to every yard surface", () => {
    const surfaces = buildYardMarkSurfaces(MARK);
    expect(surfaces.length).toBeGreaterThan(0);
    for (const surface of surfaces) {
      expect(surface.src).toBe(MARK);
    }
  });

  it("covers car, safehouse, and package surfaces", () => {
    const ids = buildYardMarkSurfaces(MARK).map((s) => s.id).sort();
    expect(ids).toEqual(["car-door", "crate-label", "safehouse-panel"]);
  });
});

describe("resume behavior is not broken", () => {
  it("mark-only sessions still target the cinematic board", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: false,
      }),
    ).toBe("identity-reveal");
  });

  it("claimed sessions still target district select", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: true,
      }),
    ).toBe("district-select");
  });

  it("post-theft sessions still route into P4 evolution", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: true,
        identityTheftTriggered: true,
        hasClaims: true,
      }),
    ).toBe("mark-evolution");
  });
});
