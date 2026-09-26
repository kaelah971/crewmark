import type { PixelBuffer } from "./coverAnalysis";

/**
 * P3.5A-R.5: "COVER//02 / VISUAL SIGNATURE ROTATION"
 *
 * Deterministic visual signature comparison engine.
 * Computes coarse visual fingerprints across color distribution,
 * spatial zone layout, and edge complexity to calculate signature distance
 * between COVER//01 (burned) and COVER//02 (candidate).
 */

export const MIN_ROTATION_LOCK_DISTANCE = 20;

export type CorrelationLevel = "CRITICAL" | "HIGH" | "REDUCED" | "LOW";

export type CorrelationStatus =
  | "TOO CLOSE // STILL HOT"
  | "MATCH REDUCED // KEEP PUSHING"
  | "SIGNATURE BROKEN // READY TO ROTATE";

export interface SignatureFingerprint {
  readonly colorHistogram: readonly number[]; // 64 bins (4x4x4 RGB)
  readonly zoneDensity: readonly number[]; // 4x2 spatial grid (8 zones)
  readonly edgeDensity: number; // local gradient complexity summary
  readonly totalNonBaseRatio: number; // overall ink coverage
}

export interface VisualSignatureComparison {
  readonly signatureDistance: number; // 0 to 100
  readonly colorShift: number; // 0 to 100
  readonly layoutShift: number; // 0 to 100
  readonly complexityShift: number; // 0 to 100
  readonly cityMatchEstimate: number; // 10% to 95%
  readonly correlationLevel: CorrelationLevel;
  readonly status: CorrelationStatus;
  readonly canLock: boolean; // signatureDistance >= 20
  readonly reasons: readonly string[];
}

const BASE_R = 0xf2;
const BASE_G = 0xeb;
const BASE_B = 0xdd;
const CHANNEL_TOL = 24;

function isNonBase(r: number, g: number, b: number): boolean {
  return Math.max(Math.abs(r - BASE_R), Math.abs(g - BASE_G), Math.abs(b - BASE_B)) > CHANNEL_TOL;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Extract normalized coarse visual fingerprint from a PixelBuffer.
 * Pure and deterministic: same buffer always produces the exact same fingerprint.
 */
export function extractFingerprint(buffer: PixelBuffer): SignatureFingerprint {
  const { data, width, height } = buffer;
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return {
      colorHistogram: new Array(64).fill(0),
      zoneDensity: new Array(8).fill(0),
      edgeDensity: 0,
      totalNonBaseRatio: 0,
    };
  }

  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 20000)));
  const hist = new Array(64).fill(0);
  const zoneCounts = new Array(8).fill(0);
  const zoneTotals = new Array(8).fill(0);
  let totalSamples = 0;
  let nonBaseSamples = 0;
  let edgeSum = 0;

  for (let y = 0; y < height; y += step) {
    const row = y * width;
    const zoneRow = y < height / 2 ? 0 : 1;

    for (let x = 0; x < width; x += step) {
      const idx = (row + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      totalSamples++;

      // Spatial zone: 4 columns x 2 rows
      const zoneCol = Math.min(3, Math.floor((x / width) * 4));
      const zoneIdx = zoneRow * 4 + zoneCol;
      zoneTotals[zoneIdx]++;

      // 4x4x4 color quantization across all sampled pixels -> 64 bins
      const binR = Math.min(3, Math.floor(r / 64));
      const binG = Math.min(3, Math.floor(g / 64));
      const binB = Math.min(3, Math.floor(b / 64));
      const bin = binR * 16 + binG * 4 + binB;
      hist[bin]++;

      if (isNonBase(r, g, b)) {
        nonBaseSamples++;
        zoneCounts[zoneIdx]++;
      }

      // Local edge contrast with neighbor
      if (x + step < width) {
        const nextIdx = (row + x + step) * 4;
        const lum1 = luminance(r, g, b);
        const lum2 = luminance(data[nextIdx], data[nextIdx + 1], data[nextIdx + 2]);
        edgeSum += Math.abs(lum1 - lum2);
      }
    }
  }

  // Normalize color histogram across all sampled pixels so tiny edits scale with coverage
  const normalizedHist = hist.map((count) => (totalSamples > 0 ? count / totalSamples : 0));

  // Normalize zone density
  const normalizedZones = zoneCounts.map((count, i) => (zoneTotals[i] > 0 ? count / zoneTotals[i] : 0));

  // Edge density normalized to 0..1 scale
  const edgeDensity = totalSamples > 0 ? (edgeSum / totalSamples) / 255 : 0;

  return {
    colorHistogram: normalizedHist,
    zoneDensity: normalizedZones,
    edgeDensity,
    totalNonBaseRatio: totalSamples > 0 ? nonBaseSamples / totalSamples : 0,
  };
}

/**
 * Compare two fingerprints and calculate signature distance and correlation estimate.
 * Pure and deterministic.
 */
export function compareFingerprints(
  fpA: SignatureFingerprint,
  fpB: SignatureFingerprint,
): VisualSignatureComparison {
  // 1. Color shift: Manhattan distance of normalized 64-bin color histograms across all pixels
  let histDiff = 0;
  for (let i = 0; i < 64; i++) {
    histDiff += Math.abs(fpA.colorHistogram[i] - fpB.colorHistogram[i]);
  }
  // Max Manhattan distance of two unit-sum distributions is 2.0. Scale to 0..100:
  const colorShift = Math.min(100, Math.round(histDiff * 140));

  // 2. Layout shift: Mean absolute difference across the 8 spatial zones
  let zoneDiffSum = 0;
  for (let i = 0; i < 8; i++) {
    zoneDiffSum += Math.abs(fpA.zoneDensity[i] - fpB.zoneDensity[i]);
  }
  const avgZoneDiff = zoneDiffSum / 8;
  const layoutShift = Math.min(100, Math.round(avgZoneDiff * 180));

  // 3. Complexity shift: Difference in edge/gradient variation
  const maxEdge = Math.max(fpA.edgeDensity, fpB.edgeDensity, 0.04);
  const complexityDiff = Math.abs(fpA.edgeDensity - fpB.edgeDensity) / maxEdge;
  const complexityShift = Math.min(100, Math.round(complexityDiff * 100));

  // Combine into weighted signature distance:
  // Weight by non-base coverage so tiny/isolated pixel edits cannot score high distance
  const maxCoverage = Math.max(fpA.totalNonBaseRatio, fpB.totalNonBaseRatio);
  const coverageWeight = Math.min(1.0, maxCoverage / 0.05);

  const rawDistance = (0.42 * colorShift + 0.44 * layoutShift + 0.14 * complexityShift) * coverageWeight;
  const signatureDistance = Math.min(100, Math.max(0, Math.round(rawDistance)));

  // Map to city match estimate % (inverse correlation)
  let cityMatchEstimate: number;
  let correlationLevel: CorrelationLevel;
  let status: CorrelationStatus;

  if (signatureDistance < 25) {
    cityMatchEstimate = Math.round(95 - signatureDistance * 0.4);
    correlationLevel = "CRITICAL";
    status = "TOO CLOSE // STILL HOT";
  } else if (signatureDistance < 50) {
    cityMatchEstimate = Math.round(84 - (signatureDistance - 25) * 0.96);
    correlationLevel = "HIGH";
    status = "MATCH REDUCED // KEEP PUSHING";
  } else if (signatureDistance < 70) {
    cityMatchEstimate = Math.round(59 - (signatureDistance - 50) * 1.2);
    correlationLevel = "REDUCED";
    status = "SIGNATURE BROKEN // READY TO ROTATE";
  } else {
    cityMatchEstimate = Math.max(12, Math.round(34 - (signatureDistance - 70) * 0.73));
    correlationLevel = "LOW";
    status = "SIGNATURE BROKEN // READY TO ROTATE";
  }

  const hasAdequateCoverage = fpB.totalNonBaseRatio >= 0.02;
  const canLock = signatureDistance >= MIN_ROTATION_LOCK_DISTANCE && hasAdequateCoverage;

  const reasons = [
    `Color distribution shift: ${colorShift}%`,
    `Spatial layout shift: ${layoutShift}%`,
    `Surface complexity shift: ${complexityShift}%`,
    !hasAdequateCoverage
      ? "Candidate cover has insufficient contractor coverage (blank vinyl stock)"
      : canLock
        ? `Visual distance ${signatureDistance}% meets rotation threshold (>= ${MIN_ROTATION_LOCK_DISTANCE}%)`
        : `Visual distance ${signatureDistance}% below threshold (needs >= ${MIN_ROTATION_LOCK_DISTANCE}% to rotate)`,
  ];

  return {
    signatureDistance,
    colorShift,
    layoutShift,
    complexityShift,
    cityMatchEstimate,
    correlationLevel,
    status,
    canLock,
    reasons,
  };
}

/**
 * Compare two PixelBuffers directly.
 */
export function comparePixelBuffers(bufA: PixelBuffer, bufB: PixelBuffer): VisualSignatureComparison {
  const fpA = extractFingerprint(bufA);
  const fpB = extractFingerprint(bufB);
  return compareFingerprints(fpA, fpB);
}

/**
 * Decode a data URL into a PixelBuffer using an Image element and Canvas 2D.
 */
export function decodeDataUrlToBuffer(dataUrl: string): Promise<PixelBuffer | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          if (!width || !height) {
            resolve(null);
            return;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, width, height);
          resolve({ data: imageData.data, width, height });
        } catch (err) {
          console.warn("[crewmark] Failed to decode image data URL to buffer:", err);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch (err) {
      console.warn("[crewmark] Image load error:", err);
      resolve(null);
    }
  });
}

/**
 * Compare two cover images (data URLs) end-to-end.
 */
export async function compareCoverImages(
  dataUrlA: string,
  dataUrlB: string,
): Promise<VisualSignatureComparison | null> {
  const [bufA, bufB] = await Promise.all([
    decodeDataUrlToBuffer(dataUrlA),
    decodeDataUrlToBuffer(dataUrlB),
  ]);
  if (!bufA || !bufB) return null;
  return comparePixelBuffers(bufA, bufB);
}
