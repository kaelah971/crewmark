// P6 Creative Metrics: how "finished" a cover looks and how loudly it
// reads at gate distance.
//
// The readiness score reuses the COVER//01 weighting (coverage, contrast,
// color depth, layout) so a P6 front and a JOB//01 cover are judged on the
// same physical intuition: does this vehicle look like it is working?
// Attention is a separate axis — a cover can be believable AND too loud.
// Reactions are authored copy chosen by deterministic precedence, so the
// same metrics always produce the same line.

import type { CoverAnalysis, PixelBuffer } from "./coverAnalysis";

export type CoverReadiness = number;

export type CityAttention = "LOW" | "BALANCED" | "HIGH";

export interface CreativeMetrics {
  readonly schemaVersion: 1;
  readonly width: number;
  readonly height: number;
  readonly coverage: number;
  readonly contrast: number;
  readonly colorDepth: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly colorPop: number;
  readonly layout: number;
  readonly coverReadiness: CoverReadiness;
  readonly cityAttention: CityAttention;
  readonly reaction: string;
}

const BASE_R = 0xf2;
const BASE_G = 0xeb;
const BASE_B = 0xdd;
const CHANNEL_TOL = 24;
const MAX_SAMPLES = 24000;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface ReadinessInputs {
  readonly coverage: number;
  readonly contrast: number;
  readonly colors: number;
  readonly layout: number;
}

/** Weighted readiness: 30% coverage, 25% contrast, 20% color depth, 25% layout. */
export function deriveCoverReadiness(inputs: ReadinessInputs): CoverReadiness {
  const coverageScore = clamp01(inputs.coverage / 0.35);
  const contrastScore = clamp01(inputs.contrast / 0.25);
  const colorDepthScore = clamp01(inputs.colors / 40);
  const layoutScore = clamp01(inputs.layout);
  return Math.round(
    100 * (0.3 * coverageScore + 0.25 * contrastScore + 0.2 * colorDepthScore + 0.25 * layoutScore),
  );
}

export interface AttentionInputs {
  readonly saturation: number;
  readonly brightness: number;
  readonly contrast: number;
  readonly colorPop: number;
}

export function deriveCityAttention(inputs: AttentionInputs): CityAttention {
  if (
    inputs.saturation >= 0.72 ||
    inputs.brightness >= 0.84 ||
    inputs.contrast >= 0.72 ||
    inputs.colorPop >= 0.68
  ) {
    return "HIGH";
  }
  if (
    inputs.saturation <= 0.28 &&
    inputs.brightness <= 0.62 &&
    inputs.contrast <= 0.3 &&
    inputs.colorPop <= 0.35
  ) {
    return "LOW";
  }
  return "BALANCED";
}

/** Authored reaction line, chosen by fixed precedence. */
export function reactionForCover(readiness: CoverReadiness, attention: CityAttention): string {
  if (readiness < 45) return "YOU'VE INVENTED A COMPANY CALLED 'BLANK.'";
  if (readiness >= 75 && attention === "HIGH") {
    return "LOOKS OFFICIAL. TOO LOUD FOR A CITY THAT REMEMBERS.";
  }
  if (attention === "HIGH") return "SUBTLE WASN'T THE BRIEF, BUT OKAY.";
  if (readiness >= 75 && attention === "LOW") return "BORING ENOUGH TO WORK.";
  if (readiness >= 75) return "BELIEVABLE AT THE CURB, READABLE IN MOTION.";
  return "THE GATE MIGHT BUY IT. EVERY CAMERA WILL REMEMBER IT.";
}

function quadrantIndex(x: number, y: number, width: number, height: number): number {
  const right = x >= width / 2 ? 1 : 0;
  const bottom = y >= height / 2 ? 2 : 0;
  return bottom + right;
}

/**
 * Pure core: derive creative metrics from a pixel buffer. When a frozen
 * CoverAnalysis is supplied, its coverage / contrast / color count take
 * precedence (mission history authority); vividness and layout still come
 * from the pixels. Deterministic: same buffer, same metrics.
 */
export function computeCreativeMetricsFromPixels(
  buffer: PixelBuffer,
  analysis: CoverAnalysis | null = null,
): CreativeMetrics {
  const { data, width, height } = buffer;
  const total = width * height;
  if (width <= 0 || height <= 0 || data.length < total * 4) {
    throw new Error("[crewmark] computeCreativeMetricsFromPixels received an empty buffer.");
  }

  const stride = Math.max(1, Math.floor(total / MAX_SAMPLES));
  let samples = 0;
  let differing = 0;
  let lumSum = 0;
  let lumSqSum = 0;
  let satSum = 0;
  let brightSum = 0;
  let vivid = 0;
  const buckets = new Set<number>();
  const quadSamples = [0, 0, 0, 0];
  const quadDiffering = [0, 0, 0, 0];

  for (let i = 0; i < total; i += stride) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const x = i % width;
    const y = Math.floor(i / width);
    const quad = quadrantIndex(x, y, width, height);

    samples += 1;
    quadSamples[quad] += 1;

    const dist = Math.max(Math.abs(r - BASE_R), Math.abs(g - BASE_G), Math.abs(b - BASE_B));
    if (dist > CHANNEL_TOL) {
      differing += 1;
      quadDiffering[quad] += 1;
    }

    const lum = luminance(r, g, b);
    lumSum += lum;
    lumSqSum += lum * lum;

    const peak = Math.max(r, g, b);
    const trough = Math.min(r, g, b);
    const saturation = peak === 0 ? 0 : (peak - trough) / peak;
    const brightness = peak / 255;
    satSum += saturation;
    brightSum += brightness;
    if (saturation >= 0.7 && brightness >= 0.45) vivid += 1;

    buckets.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
  }

  const pixelCoverage = differing / samples;
  const mean = lumSum / samples;
  const variance = Math.max(0, lumSqSum / samples - mean * mean);
  const pixelContrast = Math.min(1, Math.sqrt(variance) / 128);

  const coverage = analysis ? analysis.coverage : pixelCoverage;
  const contrast = analysis ? analysis.contrast : pixelContrast;
  const colors = analysis ? analysis.colors : buckets.size;

  const saturation = satSum / samples;
  const brightness = brightSum / samples;
  const colorPop = vivid / samples;
  const colorDepth = clamp01(colors / 40);

  const quadCoverage = quadDiffering.map((diff, q) =>
    quadSamples[q] > 0 ? diff / quadSamples[q] : 0,
  );
  const occupied = quadCoverage.filter((c) => c >= 0.08).length;
  const spread = Math.max(...quadCoverage) - Math.min(...quadCoverage);
  const balance = clamp01(1 - spread);
  const layout = clamp01(0.5 * (occupied / 4) + 0.5 * balance);

  const coverReadiness = deriveCoverReadiness({ coverage, contrast, colors, layout });
  const cityAttention = deriveCityAttention({ saturation, brightness, contrast, colorPop });

  return {
    schemaVersion: 1,
    width,
    height,
    coverage,
    contrast,
    colorDepth,
    saturation,
    brightness,
    colorPop,
    layout,
    coverReadiness,
    cityAttention,
    reaction: reactionForCover(coverReadiness, cityAttention),
  };
}

function decodeToBuffer(dataUrl: string): Promise<PixelBuffer | null> {
  return new Promise((resolve) => {
    try {
      if (typeof Image === "undefined" || typeof document === "undefined") {
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
          resolve({ data: ctx.getImageData(0, 0, width, height).data, width, height });
        } catch (err) {
          console.warn("[crewmark] Creative metrics failed; treating as unknown.", err);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Analyze a cover data URL into creative metrics. Returns null when the
 * image cannot be decoded. A frozen CoverAnalysis may be supplied so the
 * mission snapshot stays authoritative for coverage / contrast / colors.
 */
export async function analyzeCreativeMetrics(
  dataUrl: string,
  analysis: CoverAnalysis | null = null,
): Promise<CreativeMetrics | null> {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return null;
  const buffer = await decodeToBuffer(dataUrl);
  if (!buffer) return null;
  return computeCreativeMetricsFromPixels(buffer, analysis);
}
