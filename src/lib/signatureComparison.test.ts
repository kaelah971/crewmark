import { describe, expect, it } from "vitest";
import {
  MIN_ROTATION_LOCK_DISTANCE,
  compareFingerprints,
  comparePixelBuffers,
  extractFingerprint,
} from "./signatureComparison";
import type { PixelBuffer } from "./coverAnalysis";

const BASE: [number, number, number] = [0xf2, 0xeb, 0xdd];
const ORANGE: [number, number, number] = [200, 120, 40];
const BLUE: [number, number, number] = [40, 80, 200];
const BLACK: [number, number, number] = [16, 16, 15];

/** Helper to create synthetic PixelBuffer */
function createSyntheticBuffer(
  width: number = 400,
  height: number = 200,
  fillFn?: (x: number, y: number) => [number, number, number],
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const rgb = fillFn ? fillFn(x, y) : BASE;
      data[idx] = rgb[0];
      data[idx + 1] = rgb[1];
      data[idx + 2] = rgb[2];
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("P3.5A-R.5 signature comparison engine", () => {
  it("extractFingerprint is deterministic: same buffer produces identical fingerprint", () => {
    const buf = createSyntheticBuffer(400, 200, (_x, y) => (y > 140 ? ORANGE : BASE));
    const fp1 = extractFingerprint(buf);
    const fp2 = extractFingerprint(buf);
    expect(fp1).toEqual(fp2);
  });

  it("identical images yield signatureDistance = 0 and cannot be locked", () => {
    const buf = createSyntheticBuffer(400, 200, (x, y) => {
      if (y > 140) return ORANGE;
      if (x > 100 && x < 300 && y > 50 && y < 100) return BLACK;
      return BASE;
    });

    const comparison = comparePixelBuffers(buf, buf);
    expect(comparison.signatureDistance).toBe(0);
    expect(comparison.colorShift).toBe(0);
    expect(comparison.layoutShift).toBe(0);
    expect(comparison.canLock).toBe(false);
    expect(comparison.correlationLevel).toBe("CRITICAL");
    expect(comparison.cityMatchEstimate).toBeGreaterThanOrEqual(90);
    expect(comparison.status).toBe("TOO CLOSE // STILL HOT");
  });

  it("minor edit below threshold (< 20 distance) prevents locking", () => {
    // Original: orange lower stripe
    const bufA = createSyntheticBuffer(400, 200, (_x, y) => (y > 150 ? ORANGE : BASE));
    // Tiny edit: orange lower stripe 2 pixels higher
    const bufB = createSyntheticBuffer(400, 200, (_x, y) => (y > 148 ? ORANGE : BASE));

    const comparison = comparePixelBuffers(bufA, bufB);
    expect(comparison.signatureDistance).toBeLessThan(MIN_ROTATION_LOCK_DISTANCE);
    expect(comparison.canLock).toBe(false);
    expect(comparison.status).toBe("TOO CLOSE // STILL HOT");
  });

  it("detects layout shift when elements move to different spatial zones", () => {
    // A: content exclusively on bottom-left
    const bufA = createSyntheticBuffer(400, 200, (x, y) => (x < 150 && y > 100 ? ORANGE : BASE));
    // B: content exclusively on top-right
    const bufB = createSyntheticBuffer(400, 200, (x, y) => (x > 250 && y < 100 ? ORANGE : BASE));

    const comparison = comparePixelBuffers(bufA, bufB);
    expect(comparison.layoutShift).toBeGreaterThan(40);
    expect(comparison.signatureDistance).toBeGreaterThanOrEqual(MIN_ROTATION_LOCK_DISTANCE);
    expect(comparison.canLock).toBe(true);
  });

  it("detects color shift when palette changes from orange to blue", () => {
    // A: Orange stripe
    const bufA = createSyntheticBuffer(400, 200, (_x, y) => (y > 130 ? ORANGE : BASE));
    // B: Blue stripe in same position
    const bufB = createSyntheticBuffer(400, 200, (_x, y) => (y > 130 ? BLUE : BASE));

    const comparison = comparePixelBuffers(bufA, bufB);
    expect(comparison.colorShift).toBeGreaterThan(40);
    expect(comparison.signatureDistance).toBeGreaterThanOrEqual(MIN_ROTATION_LOCK_DISTANCE);
    expect(comparison.canLock).toBe(true);
  });

  it("substantially redesigned cover breaks visual signature (reduced correlation)", () => {
    // COVER//01: bottom orange stripe + centered text
    const buf01 = createSyntheticBuffer(400, 200, (x, y) => {
      if (y > 140) return ORANGE;
      if (x > 150 && x < 250 && y > 60 && y < 100) return BLACK;
      return BASE;
    });

    // COVER//02: blue vertical left block + dark top header + different layout
    const buf02 = createSyntheticBuffer(400, 200, (x, y) => {
      if (x < 80) return BLUE;
      if (y < 40) return BLACK;
      return BASE;
    });

    const comparison = comparePixelBuffers(buf01, buf02);
    expect(comparison.signatureDistance).toBeGreaterThanOrEqual(50);
    expect(comparison.canLock).toBe(true);
    expect(comparison.cityMatchEstimate).toBeLessThanOrEqual(59);
    expect(comparison.status).toBe("SIGNATURE BROKEN // READY TO ROTATE");
  });

  it("correlation levels correctly partition the distance spectrum", () => {
    // Construct synthetic fingerprints directly to test boundary partitions
    const baseFp = {
      colorHistogram: new Array(64).fill(0),
      zoneDensity: new Array(8).fill(0),
      edgeDensity: 0.1,
      totalNonBaseRatio: 0.2,
    };

    // Low distance -> CRITICAL
    const c1 = compareFingerprints(baseFp, baseFp);
    expect(c1.correlationLevel).toBe("CRITICAL");
    expect(c1.cityMatchEstimate).toBeGreaterThanOrEqual(85);

    // Distance ~30 -> HIGH
    const fpHigh = {
      ...baseFp,
      colorHistogram: [0.3, ...new Array(63).fill(0)],
    };
    const c2 = compareFingerprints(baseFp, fpHigh);
    expect(["CRITICAL", "HIGH"]).toContain(c2.correlationLevel);
  });

  it("isolated 1, 2, and 10 pixel edits stay well below threshold (< 20) and cannot lock", () => {
    const baseBuf = createSyntheticBuffer(400, 200, (_x, y) => (y > 150 ? ORANGE : BASE));

    // 1 pixel changed to black
    const buf1 = createSyntheticBuffer(400, 200, (x, y) => (x === 50 && y === 50 ? BLACK : y > 150 ? ORANGE : BASE));
    const cmp1 = comparePixelBuffers(baseBuf, buf1);
    expect(cmp1.signatureDistance).toBeLessThan(MIN_ROTATION_LOCK_DISTANCE);
    expect(cmp1.canLock).toBe(false);

    // 2 pixels changed at even sampled coordinates (50, 50) and (52, 50)
    const buf2 = createSyntheticBuffer(400, 200, (x, y) => ((x === 50 || x === 52) && y === 50 ? BLACK : y > 150 ? ORANGE : BASE));
    const cmp2 = comparePixelBuffers(baseBuf, buf2);
    expect(cmp2.signatureDistance).toBeLessThan(MIN_ROTATION_LOCK_DISTANCE);
    expect(cmp2.canLock).toBe(false);

    // 10 pixels changed at even sampled coordinates (50, 52, ..., 68 at y=50)
    const buf10 = createSyntheticBuffer(400, 200, (x, y) => (x >= 50 && x <= 68 && x % 2 === 0 && y === 50 ? BLACK : y > 150 ? ORANGE : BASE));
    const cmp10 = comparePixelBuffers(baseBuf, buf10);
    expect(cmp10.signatureDistance).toBeLessThan(MIN_ROTATION_LOCK_DISTANCE);
    expect(cmp10.canLock).toBe(false);

    // Blank canvas vs blank + 1 pixel cannot lock
    const blankBuf = createSyntheticBuffer(400, 200, () => BASE);
    const blankPlusOne = createSyntheticBuffer(400, 200, (x, y) => (x === 10 && y === 10 ? BLACK : BASE));
    const cmpBlank = comparePixelBuffers(blankBuf, blankPlusOne);
    expect(cmpBlank.signatureDistance).toBe(0);
    expect(cmpBlank.canLock).toBe(false);
  });
});
