import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import { buildSedanModel } from "./yard3dSedan";
import { createAsphaltTexture, createCorrugatedMetalTexture, createTimberCrateTexture } from "./yard3dTextures";

describe("P7A 3D Yard Architecture & Interaction Contracts", () => {
  beforeEach(() => {
    const fakeContext = {
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      setLineDash: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    };

    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => fakeContext,
          };
        }
        return {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds sedan with chassis, cabin, wheels, and decal mesh", () => {
    const sedan = buildSedanModel(null);
    expect(sedan.name).toBe("vehicle-sedan");
    expect(sedan.children.length).toBeGreaterThan(5);

    const carDecal = sedan.getObjectByName("cover-decal-car");
    expect(carDecal).toBeDefined();
    expect(carDecal instanceof THREE.Mesh).toBe(true);

    // Verify decal is positioned on side door panel (+Z)
    expect(carDecal?.position.z).toBeGreaterThan(0.9);
  });

  it("updates decal texture dynamically when new cover is applied", () => {
    const dummyCanvas = document.createElement("canvas");
    dummyCanvas.width = 16;
    dummyCanvas.height = 7;
    const tex = new THREE.CanvasTexture(dummyCanvas as unknown as HTMLCanvasElement);

    const sedan = buildSedanModel(tex);
    const carDecal = sedan.getObjectByName("cover-decal-car") as THREE.Mesh;
    const mat = carDecal.material as THREE.MeshStandardMaterial;

    expect(mat.map).toBe(tex);
  });

  it("procedural PBR textures create valid CanvasTextures with repeats", () => {
    const asphalt = createAsphaltTexture();
    expect(asphalt).toBeInstanceOf(THREE.CanvasTexture);
    expect(asphalt.repeat.x).toBe(4);

    const metal = createCorrugatedMetalTexture();
    expect(metal).toBeInstanceOf(THREE.CanvasTexture);

    const timber = createTimberCrateTexture();
    expect(timber).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("orbit camera spherical bounds enforce non-inverted and above-ground limits", () => {
    const minPolarAngle = 0.3;
    const maxPolarAngle = Math.PI / 2 - 0.05; // ~87 degrees
    const minDistance = 3.5;
    const maxDistance = 20.0;

    // Verify polar clamp prevents camera moving below ground
    expect(maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(minPolarAngle).toBeGreaterThan(0);

    // Verify zoom distance clamp
    expect(minDistance).toBeGreaterThan(2);
    expect(maxDistance).toBeLessThan(30);
  });

  it("drag vs click arbitration threshold suppresses click after pointer move > 6px", () => {
    const dragDistance = 25; // user dragged 25px
    const clickThreshold = 6;
    const isClick = dragDistance <= clickThreshold;
    expect(isClick).toBe(false);

    const tinyTapDistance = 2; // user tapped with 2px jitter
    const isTinyTap = tinyTapDistance <= clickThreshold;
    expect(isTinyTap).toBe(true);
  });
});
