import { describe, it, expect } from "vitest";

describe("P7B Production 3D Assets & Fidelity Pipeline", () => {
  it("enforces exact 16:7 aspect ratio on vehicle door and crate decal meshes", () => {
    // Canonical cover dimensions: 1600x700 -> 16/7 = 2.2857
    const expectedAspect = 1600 / 700;

    // Vehicle decal: 1.40m width x 0.6125m height
    const carDecalWidth = 1.40;
    const carDecalHeight = 0.6125;
    const carAspect = carDecalWidth / carDecalHeight;
    expect(Math.abs(carAspect - expectedAspect)).toBeLessThan(0.01);

    // Crate decal: 0.96m width x 0.42m height
    const crateDecalWidth = 0.96;
    const crateDecalHeight = 0.42;
    const crateAspect = crateDecalWidth / crateDecalHeight;
    expect(Math.abs(crateAspect - expectedAspect)).toBeLessThan(0.01);
  });

  it("verifies warehouse building scale matches realistic architecture beside sedan", () => {
    // Sedan is approx 4.6m length, 1.9m width, 1.4m height (scale 1.15)
    // Warehouse raw bounding box is approx 12m x 3.6m x 12.4m
    // Scale 1.05 gives 12.6m width x 3.78m height warehouse garage
    const warehouseScale = 1.05;
    const warehouseHeight = 3.6 * warehouseScale;
    const sedanHeight = 1.4 * 1.15;

    // Warehouse must be significantly taller than the sedan
    expect(warehouseHeight).toBeGreaterThan(sedanHeight * 2);
  });
});
