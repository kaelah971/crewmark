import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDisguisePackages,
  createDisguisePackage,
  DEFAULT_CLEAN_VEHICLE_LIVERY,
  loadDisguisePackage,
  replaceDisguisePackage,
  validateDisguisePackage,
} from "./disguisePackage";

function memoryLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryLocalStorage() });
  vi.restoreAllMocks();
});

describe("authoritative disguise packages", () => {
  it("creates a coherent Bug Out package from one template selection", () => {
    const packageValue = createDisguisePackage(
      "data:image/png;base64,BUGOUT",
      "bug-out-305",
      undefined,
      undefined,
      "COVER//01",
    );

    expect(packageValue.version).toBe(1);
    expect(packageValue.slot).toBe("COVER//01");
    expect(packageValue.templateId).toBe("bug-out-305");
    expect(packageValue.companyName).toBe("BUG OUT 305");
    expect(packageValue.identityArtwork).toContain("BUGOUT");
    expect(packageValue.vehicleLivery.templateId).toBe("bug-out-305");
    expect(packageValue.vehicleLivery.sourceCoverDataUrl).toBe(packageValue.identityArtwork);
    expect(validateDisguisePackage(packageValue, "COVER//01")).toBe(true);
  });

  it("replacing Bug Out with Clearwater replaces the complete active package", () => {
    const bugOut = createDisguisePackage("data:image/png;base64,BUGOUT", "bug-out-305", undefined, undefined, "COVER//01");
    const clearwater = createDisguisePackage("data:image/png;base64,CLEARWATER", "clearwater-pool", undefined, undefined, "COVER//01");

    expect(replaceDisguisePackage("COVER//01", bugOut)).toBe(true);
    expect(replaceDisguisePackage("COVER//01", clearwater)).toBe(true);

    const active = loadDisguisePackage("COVER//01");
    expect(active?.templateId).toBe("clearwater-pool");
    expect(active?.companyName).toBe("CLEARWATER POOL CO.");
    expect(active?.identityArtwork).toContain("CLEARWATER");
    expect(active?.vehicleLivery.templateId).toBe("clearwater-pool");
    expect(active?.vehicleLivery.companyLabel).not.toBe("BUG OUT 305");
  });

  it("does not let a legacy template key override explicit package truth", () => {
    window.localStorage.setItem("crewmark:r:template_id", "clearwater-pool");
    const bugOut = createDisguisePackage("data:image/png;base64,BUGOUT", "bug-out-305", undefined, undefined, "COVER//01");

    expect(bugOut.templateId).toBe("bug-out-305");
    expect(bugOut.vehicleLivery.templateId).toBe("bug-out-305");
  });

  it("keeps COVER//01 and COVER//02 package slots independent", () => {
    const bugOut = createDisguisePackage("data:image/png;base64,BUGOUT", "bug-out-305", undefined, undefined, "COVER//01");
    const clearwater = createDisguisePackage("data:image/png;base64,CLEARWATER", "clearwater-pool", undefined, undefined, "COVER//02");

    expect(replaceDisguisePackage("COVER//01", bugOut)).toBe(true);
    expect(replaceDisguisePackage("COVER//02", clearwater)).toBe(true);

    expect(loadDisguisePackage("COVER//01")?.templateId).toBe("bug-out-305");
    expect(loadDisguisePackage("COVER//02")?.templateId).toBe("clearwater-pool");
    expect(loadDisguisePackage("COVER//01")?.vehicleLivery.templateId).toBe("bug-out-305");
    expect(loadDisguisePackage("COVER//02")?.vehicleLivery.templateId).toBe("clearwater-pool");
  });

  it("rejects packages whose artwork and livery source diverge", () => {
    const packageValue = createDisguisePackage("data:image/png;base64,BUGOUT", "bug-out-305", undefined, undefined, "COVER//01");
    const invalid = {
      ...packageValue,
      vehicleLivery: {
        ...packageValue.vehicleLivery,
        sourceCoverDataUrl: "data:image/png;base64,OTHER",
      },
    };

    expect(validateDisguisePackage(invalid, "COVER//01")).toBe(false);
    expect(replaceDisguisePackage("COVER//01", invalid)).toBe(false);
  });

  it("keeps the clean default genuinely unbranded", () => {
    expect(DEFAULT_CLEAN_VEHICLE_LIVERY.bodyBaseColor).toBe("#111214");
    expect(DEFAULT_CLEAN_VEHICLE_LIVERY.doorGraphicDataUrl).toBe("");
    expect(DEFAULT_CLEAN_VEHICLE_LIVERY.hoodGraphicDataUrl).toBe("");
    expect(DEFAULT_CLEAN_VEHICLE_LIVERY.rearGraphicDataUrl).toBe("");
    expect(DEFAULT_CLEAN_VEHICLE_LIVERY.badgeWidth).toBe(0);
    expect(DEFAULT_CLEAN_VEHICLE_LIVERY.badgeHeight).toBe(0);
    expect(DEFAULT_CLEAN_VEHICLE_LIVERY.stripePattern).toBe("detail");
  });

  it("clears both package slots", () => {
    const bugOut = createDisguisePackage("data:image/png;base64,BUGOUT", "bug-out-305", undefined, undefined, "COVER//01");
    const clearwater = createDisguisePackage("data:image/png;base64,CLEARWATER", "clearwater-pool", undefined, undefined, "COVER//02");
    replaceDisguisePackage("COVER//01", bugOut);
    replaceDisguisePackage("COVER//02", clearwater);
    clearDisguisePackages();

    expect(loadDisguisePackage("COVER//01")).toBeNull();
    expect(loadDisguisePackage("COVER//02")).toBeNull();
  });
});
