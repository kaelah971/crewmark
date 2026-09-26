import { describe, it, expect } from "vitest";
import {
  SURFACE_IDS,
  SURFACE_DEFINITIONS,
  getSurfaceDefinition,
  isSurfaceId,
  type SurfaceId,
} from "./multiSurfacePreview";

describe("multiSurfacePreview domain", () => {
  it("defines the four core surfaces", () => {
    expect(SURFACE_IDS).toEqual(["CAR", "CRATE", "JACKET", "PASS"]);
  });

  it("provides definitions with all metadata fields for each surface", () => {
    for (const id of SURFACE_IDS) {
      const def = getSurfaceDefinition(id);
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.shortName).toBeTruthy();
      expect(def.tagline).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.detailNotes).toBeTruthy();
      expect(def.material).toBeTruthy();
      expect(def.clearanceLevel).toBeTruthy();
      expect(def.dimensionsLabel).toBeTruthy();
    }
  });

  it("correctly identifies valid and invalid surface IDs", () => {
    expect(isSurfaceId("CAR")).toBe(true);
    expect(isSurfaceId("CRATE")).toBe(true);
    expect(isSurfaceId("JACKET")).toBe(true);
    expect(isSurfaceId("PASS")).toBe(true);
    expect(isSurfaceId("TRUCK")).toBe(false);
    expect(isSurfaceId(null)).toBe(false);
    expect(isSurfaceId(undefined)).toBe(false);
  });

  it("falls back to CAR for unmapped IDs in getSurfaceDefinition", () => {
    const fallback = getSurfaceDefinition("INVALID" as SurfaceId);
    expect(fallback).toBe(SURFACE_DEFINITIONS.CAR);
  });
});
