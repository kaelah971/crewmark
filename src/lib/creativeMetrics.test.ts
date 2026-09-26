import { describe, expect, it } from "vitest";
import { analyzePixels } from "./coverAnalysis";
import {
  analyzeCreativeMetrics,
  computeCreativeMetricsFromPixels,
  deriveCityAttention,
  deriveCoverReadiness,
  reactionForCover,
} from "./creativeMetrics";

const BASE: [number, number, number] = [0xf2, 0xeb, 0xdd];
const ORANGE: [number, number, number] = [200, 120, 40];
const INK: [number, number, number] = [20, 20, 20];
const PURE_RED: [number, number, number] = [255, 0, 0];

/** Deterministic RGBA buffer: base fill plus painted rects. */
function paint(
  width: number,
  height: number,
  rects: { x: number; y: number; w: number; h: number; color: [number, number, number] }[] = [],
) {
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

describe("deriveCoverReadiness", () => {
  it("scores a fully-covered, high-contrast, deep, well-laid-out cover at 100", () => {
    expect(
      deriveCoverReadiness({ coverage: 0.35, contrast: 0.25, colors: 40, layout: 1 }),
    ).toBe(100);
  });

  it("floors at 0 and clamps over-saturated inputs", () => {
    expect(deriveCoverReadiness({ coverage: 0, contrast: 0, colors: 0, layout: 0 })).toBe(0);
    expect(deriveCoverReadiness({ coverage: 9, contrast: 9, colors: 900, layout: 9 })).toBe(
      100,
    );
  });

  it("applies the 30/25/20/25 weights", () => {
    // Half coverage alone: 100 * 0.30 * 0.5 = 15.
    expect(deriveCoverReadiness({ coverage: 0.175, contrast: 0, colors: 0, layout: 0 })).toBe(
      15,
    );
    // Full coverage + full contrast: 30 + 25 = 55.
    expect(
      deriveCoverReadiness({ coverage: 0.35, contrast: 0.25, colors: 0, layout: 0 }),
    ).toBe(55);
    // Full color depth adds 20; full layout adds 25.
    expect(
      deriveCoverReadiness({ coverage: 0.35, contrast: 0.25, colors: 40, layout: 1 }),
    ).toBe(100);
  });

  it("rounds to whole points", () => {
    expect(deriveCoverReadiness({ coverage: 0.1, contrast: 0, colors: 0, layout: 0 })).toBe(
      Math.round(100 * 0.3 * (0.1 / 0.35)),
    );
  });
});

describe("deriveCityAttention", () => {
  it("reads HIGH when any single channel shouts", () => {
    expect(
      deriveCityAttention({ saturation: 0.72, brightness: 0, contrast: 0, colorPop: 0 }),
    ).toBe("HIGH");
    expect(
      deriveCityAttention({ saturation: 0, brightness: 0.84, contrast: 0, colorPop: 0 }),
    ).toBe("HIGH");
    expect(
      deriveCityAttention({ saturation: 0, brightness: 0, contrast: 0.72, colorPop: 0 }),
    ).toBe("HIGH");
    expect(
      deriveCityAttention({ saturation: 0, brightness: 0, contrast: 0, colorPop: 0.68 }),
    ).toBe("HIGH");
  });

  it("reads LOW only when every channel is quiet", () => {
    expect(
      deriveCityAttention({ saturation: 0.28, brightness: 0.62, contrast: 0.3, colorPop: 0.35 }),
    ).toBe("LOW");
    // One loud channel vetoes LOW.
    expect(
      deriveCityAttention({ saturation: 0.29, brightness: 0.62, contrast: 0.3, colorPop: 0.35 }),
    ).toBe("BALANCED");
    expect(
      deriveCityAttention({ saturation: 0.28, brightness: 0.63, contrast: 0.3, colorPop: 0.35 }),
    ).toBe("BALANCED");
  });

  it("defaults the middle to BALANCED", () => {
    expect(
      deriveCityAttention({ saturation: 0.5, brightness: 0.7, contrast: 0.4, colorPop: 0.4 }),
    ).toBe("BALANCED");
  });
});

describe("reactionForCover (authored precedence)", () => {
  it("calls a blank canvas blank no matter the attention", () => {
    expect(reactionForCover(0, "LOW")).toBe("YOU'VE INVENTED A COMPANY CALLED 'BLANK.'");
    expect(reactionForCover(44, "HIGH")).toBe("YOU'VE INVENTED A COMPANY CALLED 'BLANK.'");
  });

  it("warns that a finished loud cover is too loud", () => {
    expect(reactionForCover(75, "HIGH")).toBe(
      "LOOKS OFFICIAL. TOO LOUD FOR A CITY THAT REMEMBERS.",
    );
    expect(reactionForCover(100, "HIGH")).toBe(
      "LOOKS OFFICIAL. TOO LOUD FOR A CITY THAT REMEMBERS.",
    );
  });

  it("notes loudness on unfinished covers before praising finish", () => {
    expect(reactionForCover(60, "HIGH")).toBe("SUBTLE WASN'T THE BRIEF, BUT OKAY.");
  });

  it("blesses boring finished covers, then balanced ones", () => {
    expect(reactionForCover(75, "LOW")).toBe("BORING ENOUGH TO WORK.");
    expect(reactionForCover(90, "BALANCED")).toBe(
      "BELIEVABLE AT THE CURB, READABLE IN MOTION.",
    );
  });

  it("falls through to the cameras line for middling work", () => {
    expect(reactionForCover(60, "BALANCED")).toBe(
      "THE GATE MIGHT BUY IT. EVERY CAMERA WILL REMEMBER IT.",
    );
    expect(reactionForCover(45, "LOW")).toBe(
      "THE GATE MIGHT BUY IT. EVERY CAMERA WILL REMEMBER IT.",
    );
  });
});

describe("computeCreativeMetricsFromPixels", () => {
  it("scores blank vinyl low and names it blank", () => {
    const metrics = computeCreativeMetricsFromPixels(paint(64, 64));
    expect(metrics.schemaVersion).toBe(1);
    expect(metrics.width).toBe(64);
    expect(metrics.height).toBe(64);
    expect(metrics.coverage).toBe(0);
    expect(metrics.coverReadiness).toBeLessThan(45);
    expect(metrics.reaction).toBe("YOU'VE INVENTED A COMPANY CALLED 'BLANK.'");
  });

  it("is deterministic: same pixels, same metrics", () => {
    const buffer = paint(64, 64, [{ x: 0, y: 0, w: 32, h: 64, color: ORANGE }]);
    const first = computeCreativeMetricsFromPixels(buffer);
    const second = computeCreativeMetricsFromPixels(buffer);
    expect(second).toEqual(first);
  });

  it("rewards painted, contrasty, multi-tone, spread-out work", () => {
    const blank = computeCreativeMetricsFromPixels(paint(64, 64));
    const painted = computeCreativeMetricsFromPixels(
      paint(64, 64, [
        { x: 0, y: 0, w: 32, h: 32, color: ORANGE },
        { x: 32, y: 0, w: 32, h: 32, color: INK },
        { x: 0, y: 32, w: 32, h: 32, color: INK },
        { x: 32, y: 32, w: 32, h: 32, color: ORANGE },
      ]),
    );
    expect(painted.coverage).toBeGreaterThan(blank.coverage);
    expect(painted.contrast).toBeGreaterThan(blank.contrast);
    expect(painted.coverReadiness).toBeGreaterThan(blank.coverReadiness);
  });

  it("keeps every field inside its range", () => {
    const metrics = computeCreativeMetricsFromPixels(
      paint(80, 60, [{ x: 10, y: 10, w: 40, h: 30, color: ORANGE }]),
    );
    for (const field of [
      metrics.coverage,
      metrics.contrast,
      metrics.colorDepth,
      metrics.saturation,
      metrics.brightness,
      metrics.colorPop,
      metrics.layout,
    ] as const) {
      expect(field).toBeGreaterThanOrEqual(0);
      expect(field).toBeLessThanOrEqual(1);
    }
    expect(metrics.coverReadiness).toBeGreaterThanOrEqual(0);
    expect(metrics.coverReadiness).toBeLessThanOrEqual(100);
    expect(Number.isInteger(metrics.coverReadiness)).toBe(true);
  });

  it("rewards spread layouts over a single crowded quadrant", () => {
    const single = computeCreativeMetricsFromPixels(
      paint(64, 64, [{ x: 0, y: 0, w: 32, h: 32, color: INK }]),
    );
    const spread = computeCreativeMetricsFromPixels(
      paint(64, 64, [
        { x: 0, y: 0, w: 16, h: 16, color: INK },
        { x: 48, y: 0, w: 16, h: 16, color: INK },
        { x: 0, y: 48, w: 16, h: 16, color: INK },
        { x: 48, y: 48, w: 16, h: 16, color: INK },
      ]),
    );
    expect(spread.layout).toBeGreaterThan(single.layout);
  });

  it("flags vivid saturated paint as HIGH attention", () => {
    const metrics = computeCreativeMetricsFromPixels(
      paint(64, 64, [{ x: 0, y: 0, w: 64, h: 64, color: PURE_RED }]),
    );
    expect(metrics.colorPop).toBeGreaterThan(0.68);
    expect(metrics.cityAttention).toBe("HIGH");
  });

  it("lets a frozen CoverAnalysis speak for coverage, contrast, and color count", () => {
    const analysis = analyzePixels(
      paint(64, 64, [{ x: 0, y: 0, w: 64, h: 32, color: ORANGE }]),
    );
    const metrics = computeCreativeMetricsFromPixels(paint(64, 64), analysis);
    expect(metrics.coverage).toBe(analysis.coverage);
    expect(metrics.contrast).toBe(analysis.contrast);
    expect(metrics.coverReadiness).toBe(
      deriveCoverReadiness({
        coverage: analysis.coverage,
        contrast: analysis.contrast,
        colors: analysis.colors,
        layout: metrics.layout,
      }),
    );
  });

  it("throws on an empty or truncated buffer", () => {
    expect(() =>
      computeCreativeMetricsFromPixels({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
    ).toThrow(/empty/);
    expect(() =>
      computeCreativeMetricsFromPixels({ data: new Uint8ClampedArray(4), width: 8, height: 8 }),
    ).toThrow(/truncated|empty/);
  });
});

describe("analyzeCreativeMetrics", () => {
  it("returns null for non-image input without touching the DOM", async () => {
    await expect(analyzeCreativeMetrics("")).resolves.toBeNull();
    await expect(analyzeCreativeMetrics("not-a-url")).resolves.toBeNull();
    await expect(analyzeCreativeMetrics("data:text/plain,hello")).resolves.toBeNull();
  });

  it("returns null when the image cannot be decoded in this runtime", async () => {
    await expect(
      analyzeCreativeMetrics(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      ),
    ).resolves.toBeNull();
  });
});
