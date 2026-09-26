// Deterministic visual-check engine for COVER//01 (P3.5A-R.2).
//
// Pixel-derived heuristics only — there is no OCR and no text recognition
// here, and the UI must say so. The core is the pure function
// analyzePixels(), which takes an RGBA buffer plus dimensions and returns
// the same record for the same input, every time. The async
// analyzeCoverImage() wrapper only decodes a data URL into that buffer
// (mirroring markAlpha.ts); all judgment lives in the pure core so tests
// feed it synthetic pixels directly.
//
// Reference background: the blank vinyl stock COVER_BASE (#F2EBDD). A
// sample "differs" when any channel is more than CHANNEL_TOL from base.
//
// Metrics:
// - coverage: fraction of samples differing from base (is anything there?)
// - orangeRatio / orangeLowerRatio: fraction of orange-like samples overall
//   and in the bottom third (orange = r>=175, 70<=g<=195, b<=120, r-b>=70)
// - contrast: stddev of Rec.709 luminance, scaled to 0..1 (readable identity?)
// - colors: distinct 12-bit color buckets (more than one flat shape?)
// - weathering: fraction of samples with *subtle* deviation (24 < dist <=
//   100) — tonal variation that reads as wear/grime at gate distance.
//   Labeled as pixel variation, never certified wear.
// - blank: coverage below 2% — effectively untouched vinyl.
//
// Score (0-100, deterministic):
//   100 * (0.30*min(1,coverage/0.35) + 0.25*min(1,orangeLower/0.12)
//        + 0.20*min(1,contrast/0.25) + 0.25*min(1,colors/40))
// Blank images always score 0.

// Reference background: COVER_BASE (#F2EBDD) from coverCanvas.ts — the
// blank vinyl stock the starter panel is filled with. Kept as literals
// here so the analysis core stays dependency-free and trivially testable.

export const COVER_ANALYSIS_VERSION = 1;

export type CoverCheckStatus = "PASS" | "REVIEW" | "LOW";

export interface CoverCheck {
  readonly id: "identity" | "orange" | "detail" | "weathering";
  readonly label: string;
  readonly status: CoverCheckStatus;
  readonly detail: string;
}

export interface CoverAnalysis {
  readonly version: number;
  readonly width: number;
  readonly height: number;
  readonly coverage: number;
  readonly orangeRatio: number;
  readonly orangeLowerRatio: number;
  readonly contrast: number;
  readonly colors: number;
  readonly blank: boolean;
  readonly score: number;
  readonly checks: readonly CoverCheck[];
}

export interface PixelBuffer {
  readonly data: Uint8ClampedArray | Uint8Array | number[];
  readonly width: number;
  readonly height: number;
}

const BASE_R = 0xf2;
const BASE_G = 0xeb;
const BASE_B = 0xdd;
const CHANNEL_TOL = 24;
const WEATHER_TOL = 100;
const BLANK_COVERAGE = 0.02;
const MAX_SAMPLES = 24000;

function channelDist(r: number, g: number, b: number): number {
  return Math.max(Math.abs(r - BASE_R), Math.abs(g - BASE_G), Math.abs(b - BASE_B));
}

function isOrange(r: number, g: number, b: number): boolean {
  return r >= 175 && g >= 70 && g <= 195 && b <= 120 && r - b >= 70;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function analyzePixels(buffer: PixelBuffer): CoverAnalysis {
  const { data, width, height } = buffer;
  const total = width * height;
  if (width <= 0 || height <= 0 || data.length < total * 4) {
    throw new Error("[crewmark] analyzePixels received an empty or truncated buffer.");
  }

  const stride = Math.max(1, Math.floor(total / MAX_SAMPLES));
  let samples = 0;
  let differing = 0;
  let orange = 0;
  let orangeLower = 0;
  let lowerSamples = 0;
  let weathered = 0;
  let lumSum = 0;
  let lumSqSum = 0;
  const buckets = new Set<number>();

  for (let i = 0; i < total; i += stride) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const dist = channelDist(r, g, b);
    const lower = i / width >= (height * 2) / 3;
    samples += 1;
    if (lower) lowerSamples += 1;
    if (dist > CHANNEL_TOL) {
      differing += 1;
      if (dist <= WEATHER_TOL) weathered += 1;
    }
    if (isOrange(r, g, b)) {
      orange += 1;
      if (lower) orangeLower += 1;
    }
    const lum = luminance(r, g, b);
    lumSum += lum;
    lumSqSum += lum * lum;
    buckets.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
  }

  const coverage = differing / samples;
  const orangeRatio = orange / samples;
  const orangeLowerRatio = lowerSamples > 0 ? orangeLower / lowerSamples : 0;
  const mean = lumSum / samples;
  const variance = Math.max(0, lumSqSum / samples - mean * mean);
  const contrast = Math.min(1, Math.sqrt(variance) / 128);
  const colors = buckets.size;
  const weatherRatio = weathered / samples;
  const blank = coverage < BLANK_COVERAGE;

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const score = blank
    ? 0
    : Math.round(
        100 *
          (0.3 * clamp01(coverage / 0.35) +
            0.25 * clamp01(orangeLowerRatio / 0.12) +
            0.2 * clamp01(contrast / 0.25) +
            0.25 * clamp01(colors / 40)),
      );

  const checks: CoverCheck[] = [
    {
      id: "identity",
      label: "Identity signal",
      status: contrast >= 0.12 ? "PASS" : "REVIEW",
      detail: `contrast ${pct(contrast)} — dark/light separation for gate-distance reading`,
    },
    {
      id: "orange",
      label: "Orange profile",
      status: orangeLowerRatio >= 0.04 ? "PASS" : orangeRatio >= 0.02 ? "REVIEW" : "LOW",
      detail: `orange ${pct(orangeRatio)} overall, ${pct(orangeLowerRatio)} lower third`,
    },
    {
      id: "detail",
      label: "Service detail",
      status: colors >= 12 && coverage >= 0.15 ? "PASS" : colors >= 6 || coverage >= 0.06 ? "REVIEW" : "LOW",
      detail: `${colors} tones across ${pct(coverage)} of the panel`,
    },
    {
      id: "weathering",
      label: "Weathering",
      status: weatherRatio >= 0.1 ? "PASS" : weatherRatio >= 0.04 ? "REVIEW" : "LOW",
      detail: `tonal variation ${pct(weatherRatio)} — pixel variation, not certified wear`,
    },
  ];

  return {
    version: COVER_ANALYSIS_VERSION,    width,
    height,
    coverage,
    orangeRatio,
    orangeLowerRatio,
    contrast,
    colors,
    blank,
    score,
    checks,
  };
}

/** Decode a cover data URL and run the deterministic core. Null on failure. */
export function analyzeCoverImage(dataUrl: string): Promise<CoverAnalysis | null> {
  return new Promise((resolve) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (width === 0 || height === 0) {
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
        const data = ctx.getImageData(0, 0, width, height).data;
        resolve(analyzePixels({ data, width, height }));
      } catch (err) {
        console.warn("[crewmark] Cover analysis failed; treating as unknown.", err);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn("[crewmark] Cover analysis could not decode the image.");
      resolve(null);
    };
    img.src = dataUrl;
  });
}

/**
 * Guard: a cover analysis can only be locked if it is not blank vinyl stock.
 * Shared contract used by ForgeryBay.handleLock for both COVER//01 and COVER//02.
 */
export function canLockCover(analysis: CoverAnalysis | null): boolean {
  if (!analysis) return false;
  return !analysis.blank && analysis.score > 0;
}
