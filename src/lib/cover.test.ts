import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzePixels,
  canLockCover,
  type CoverAnalysis,
} from "./coverAnalysis";
import {
  clearCoverRecord,
  loadCoverRecord,
  loadCover02Record,
  saveCoverRecord,
  saveCover02Record,
  resolveActiveCover,
} from "./coverStorage";
import { vehicleReport } from "../world/jobs";
import { resolveResumeTarget } from "./resume";

const BASE: [number, number, number] = [0xf2, 0xeb, 0xdd];
const ORANGE: [number, number, number] = [200, 120, 40];
const INK: [number, number, number] = [20, 20, 20];

/** Build a deterministic RGBA buffer: base fill plus painted rects. */
function paint(
  width: number,
  height: number,
  rects: { x: number; y: number; w: number; h: number; color: [number, number, number] }[] = [],
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = BASE[0];
    data[i * 4 + 1] = BASE[1];
    data[i * 4 + 2] = BASE[2];
    data[i * 4 + 3] = 255;
  }
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y += 1) {
      for (let x = r.x; x < r.x + r.w; x += 1) {
        const o = (y * width + x) * 4;
        data[o] = r.color[0];
        data[o + 1] = r.color[1];
        data[o + 2] = r.color[2];
      }
    }
  }
  return { data, width, height };
}

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryLocalStorage() });
  vi.restoreAllMocks();
});

describe("coverStorage (COVER//01 record)", () => {
  const image = "data:image/png;base64,Q292ZXI=";
  const analysis = analyzePixels(paint(64, 64));

  it("round-trips image + analysis + timestamp (refresh path)", () => {
    expect(saveCoverRecord(image, analysis, "2026-01-01T00:00:00.000Z")).toBe(true);
    const loaded = loadCoverRecord();
    expect(loaded?.image).toBe(image);
    expect(loaded?.analysis).toEqual(analysis);
    expect(loaded?.lockedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns null for old saves without a cover", () => {
    expect(loadCoverRecord()).toBeNull();
  });

  it("returns null when the analysis payload is corrupt", () => {
    window.localStorage.setItem("crewmark:r:cover01", image);
    window.localStorage.setItem("crewmark:r:cover01analysis", "not-json{{{");
    expect(loadCoverRecord()).toBeNull();
  });

  it("clears cover slots without touching mark keys", () => {
    window.localStorage.setItem("crewmark:p0:markV1", "data:image/png;base64,VjE=");
    saveCoverRecord(image, analysis, "t");
    clearCoverRecord();
    expect(loadCoverRecord()).toBeNull();
    expect(window.localStorage.getItem("crewmark:p0:markV1")).toBe("data:image/png;base64,VjE=");
  });

  it("uses keys independent of marks, progress, and jobs", () => {
    saveCoverRecord(image, analysis, "t");
    expect(window.localStorage.getItem("crewmark:p0:markV1")).toBeNull();
    expect(window.localStorage.getItem("crewmark:p2:progress")).toBeNull();
    expect(window.localStorage.getItem("crewmark:r:job01accepted")).toBeNull();
  });
});
describe("coverStorage (COVER//02 record and active cover resolution)", () => {
  const sampleAnalysis = analyzePixels(paint(160, 70, [{ x: 10, y: 50, w: 140, h: 18, color: ORANGE }]));
  const sampleSignature = {
    signatureDistance: 54,
    colorShift: 48,
    layoutShift: 62,
    complexityShift: 30,
    cityMatchEstimate: 54,
    correlationLevel: "REDUCED" as const,
    status: "SIGNATURE BROKEN // READY TO ROTATE" as const,
    canLock: true,
    reasons: ["Test comparison"],
  };

  it("saving COVER//02 does not mutate or overwrite COVER//01", () => {
    const img1 = "data:image/png;base64,Y292ZXIwMQ==";
    const img2 = "data:image/png;base64,Y292ZXIwMg==";
    saveCoverRecord(img1, sampleAnalysis, "2026-09-23T01:00:00.000Z");
    saveCover02Record(img2, sampleAnalysis, sampleSignature, "2026-09-23T02:00:00.000Z");

    const loaded01 = loadCoverRecord();
    const loaded02 = loadCover02Record();

    expect(loaded01?.image).toBe(img1);
    expect(loaded01?.lockedAt).toBe("2026-09-23T01:00:00.000Z");
    expect(loaded02?.image).toBe(img2);
    expect(loaded02?.signature.signatureDistance).toBe(54);
  });

  it("resolveActiveCover prioritizes COVER//02 when present", () => {
    const cov01 = { image: "img1", analysis: sampleAnalysis, lockedAt: "t1" };
    const cov02 = { image: "img2", analysis: sampleAnalysis, signature: sampleSignature, lockedAt: "t2" };

    // Before Cover02: Cover01 is active (and may be burned)
    const activePre = resolveActiveCover(cov01, null, true);
    expect(activePre?.version).toBe("COVER//01");
    expect(activePre?.image).toBe("img1");
    expect(activePre?.burned).toBe(true);

    // After Cover02: Cover02 is active and unburned
    const activePost = resolveActiveCover(cov01, cov02, true);
    expect(activePost?.version).toBe("COVER//02");
    expect(activePost?.image).toBe("img2");
    expect(activePost?.burned).toBe(false);
    expect(activePost?.cityMatchEstimate).toBe(54);
  });

  it("clearCoverRecord resets both COVER//01 and COVER//02 on full reset", () => {
    saveCoverRecord("img1", sampleAnalysis, "t1");
    saveCover02Record("img2", sampleAnalysis, sampleSignature, "t2");
    clearCoverRecord();

    expect(loadCoverRecord()).toBeNull();
    expect(loadCover02Record()).toBeNull();
  });
});

describe("analyzePixels (deterministic visual check)", () => {
  it("flags untouched vinyl as blank with score 0", () => {
    const report = analyzePixels(paint(64, 64));
    expect(report.blank).toBe(true);
    expect(report.score).toBe(0);
    expect(report.coverage).toBe(0);
    expect(report.width).toBe(64);
    expect(report.height).toBe(64);
  });
  it("canLockCover guards against blank vinyl stock for both v1 and v2 locks", () => {
    const blankReport = analyzePixels(paint(160, 70));
    expect(blankReport.blank).toBe(true);
    expect(blankReport.score).toBe(0);
    expect(canLockCover(blankReport)).toBe(false);
    expect(canLockCover(null)).toBe(false);

    const validReport = analyzePixels(paint(160, 70, [{ x: 10, y: 50, w: 140, h: 18, color: ORANGE }]));
    expect(validReport.blank).toBe(false);
    expect(validReport.score).toBeGreaterThan(0);
    expect(canLockCover(validReport)).toBe(true);
  });

  it("is deterministic for identical input", () => {
    const a = analyzePixels(paint(80, 60, [{ x: 10, y: 40, w: 30, h: 15, color: ORANGE }]));
    const b = analyzePixels(paint(80, 60, [{ x: 10, y: 40, w: 30, h: 15, color: ORANGE }]));
    expect(a).toEqual(b);
  });

  it("detects a lower-third orange stripe as PASS", () => {
    const report = analyzePixels(
      paint(120, 90, [{ x: 10, y: 65, w: 100, h: 20, color: ORANGE }]),
    );
    expect(report.blank).toBe(false);
    expect(report.orangeLowerRatio).toBeGreaterThan(0.04);
    expect(report.checks.find((c) => c.id === "orange")?.status).toBe("PASS");
    expect(report.score).toBeGreaterThan(0);
  });

  it("returns a lockable low-score report for weak covers (never throws)", () => {
    const report: CoverAnalysis = analyzePixels(
      paint(120, 90, [{ x: 50, y: 10, w: 20, h: 20, color: INK }]),
    );
    expect(report.blank).toBe(false);
    expect(report.score).toBeLessThan(50);
    expect(report.checks).toHaveLength(4);
    // Weak covers still produce a committable record.
    expect(
      saveCoverRecord("data:image/png;base64,d2Vhaw==", report, "2026-01-01T00:00:00.000Z"),
    ).toBe(true);
    expect(loadCoverRecord()?.analysis.score).toBe(report.score);
  });

  it("rejects truncated buffers loudly instead of scoring garbage", () => {
    expect(() => analyzePixels({ data: new Uint8ClampedArray(10), width: 4, height: 4 })).toThrow();
    expect(() => analyzePixels({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toThrow();
  });
});

describe("vehicle state follows cover existence", () => {
  it("reports no cover by default (backward compatible)", () => {
    expect(vehicleReport().line).toBe("VEHICLE // NO ACTIVE COVER");
    expect(vehicleReport(null).line).toBe("VEHICLE // NO ACTIVE COVER");
  });

  it("reports the active cover plus its stored score", () => {
    expect(vehicleReport(78).line).toBe("VEHICLE // COVER//01 ACTIVE — VISUAL CHECK // 78%");
  });
});

describe("resume routes the cover flow", () => {
  it("cover exists → playable yard with cover applied", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: false,
        hasCover: true,
        jobAccepted: true,
      }),
    ).toBe("job-yard");
  });

  it("job accepted without cover → yard print-shop objective", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: false,
        hasCover: false,
        jobAccepted: true,
      }),
    ).toBe("job-yard");
  });

  it("legacy checkpoints still win where they used to", () => {
    const base = {
      hasMarkV1: true,
      hasMarkV2: false,
      surveillanceTriggered: false,
      identityTheftTriggered: false,
      hasClaims: true,
      hasCover: true,
      jobAccepted: true,
    };
    expect(resolveResumeTarget(base)).toBe("district-select");
    expect(resolveResumeTarget({ ...base, hasMarkV2: true })).toBe("mark-v2-reveal");
  });
});
