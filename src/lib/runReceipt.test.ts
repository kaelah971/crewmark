import { describe, expect, it, vi } from "vitest";
import {
  RUN_RECEIPT_HEIGHT,
  RUN_RECEIPT_WIDTH,
  buildRunReceipt,
  buildShareText,
  downloadRunReceiptPng,
  renderRunReceiptPng,
  type RunReceipt,
} from "./runReceipt";
import type { ChosenFrontRecord } from "./fronts";
import type { CreativeMetrics } from "./creativeMetrics";

const FRONT: ChosenFrontRecord = {
  schemaVersion: 1,
  requestedFrontId: "pool-service",
  resolvedFrontId: "pool-service",
  customProfile: null,
  selectedAt: "2026-09-24T00:00:00.000Z",
};

function metrics(overrides: Partial<CreativeMetrics> = {}): CreativeMetrics {
  return {
    schemaVersion: 1,
    width: 1600,
    height: 700,
    coverage: 0.4,
    contrast: 0.3,
    colorDepth: 0.8,
    saturation: 0.5,
    brightness: 0.7,
    colorPop: 0.4,
    layout: 0.8,
    coverReadiness: 85,
    cityAttention: "BALANCED",
    reaction: "BELIEVABLE AT THE CURB, READABLE IN MOTION.",
    ...overrides,
  };
}

function input(overrides: Partial<Parameters<typeof buildRunReceipt>[0]> = {}) {
  return {
    receiptId: "RCT//TEST0001",
    runId: "RUN//0001",
    front: FRONT,
    coverVersion: "COVER//01" as const,
    coverDataUrl: "data:image/png;base64,Q292ZXI=",
    metrics: metrics(),
    checkpoint: "clean" as const,
    signatureDistance: 42,
    missionStartedAt: "2026-09-24T00:00:00.000Z",
    missionCompletedAt: "2026-09-24T01:00:00.000Z",
    receiptsReviewedAt: "2026-09-24T02:00:00.000Z",
    ...overrides,
  };
}

/** Canvas stand-in: records draw calls and yields a fake PNG blob. */
function stubCanvasEnvironment(options: { coverDecodes?: boolean } = {}) {
  const coverDecodes = options.coverDecodes ?? false;
  const drawn: string[] = [];

  const ctx = {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn((text: string) => {
      drawn.push(String(text));
    }),
    drawImage: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textBaseline: "",
  };

  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ctx,
          toDataURL: () => "data:image/png;base64,ZmFrZQ==",
          toBlob: (cb: (blob: Blob | null) => void) => {
            cb(new Blob(["fake-png"], { type: "image/png" }));
          },
        };
      }
      if (tag === "a") {
        return { href: "", download: "", click: vi.fn(), remove: vi.fn() };
      }
      throw new Error(`unexpected element ${tag}`);
    },
    body: { appendChild: vi.fn() },
  });

  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1600;
      naturalHeight = 700;
      set src(_value: string) {
        queueMicrotask(() => {
          if (coverDecodes) this.onload?.();
          else this.onerror?.();
        });
      }
    } as unknown as typeof Image,
  );

  return { ctx, drawn };
}

describe("buildRunReceipt", () => {
  it("freezes every field and derives completedAt from the review timestamp", () => {
    const receipt = buildRunReceipt(input());
    expect(receipt.receiptId).toBe("RCT//TEST0001");
    expect(receipt.runId).toBe("RUN//0001");
    expect(receipt.front).toEqual(FRONT);
    expect(receipt.coverVersion).toBe("COVER//01");
    expect(receipt.coverDataUrl).toBe("data:image/png;base64,Q292ZXI=");
    expect(receipt.metrics?.coverReadiness).toBe(85);
    expect(receipt.checkpoint).toBe("clean");
    expect(receipt.signatureDistance).toBe(42);
    expect(receipt.missionStartedAt).toBe("2026-09-24T00:00:00.000Z");
    expect(receipt.completedAt).toBe("2026-09-24T02:00:00.000Z");
    expect(receipt.shareText.length).toBeGreaterThan(0);
  });

  it("honors an explicit completedAt and defaults missing optionals to null", () => {
    const receipt = buildRunReceipt(
      input({ completedAt: "2026-09-24T03:00:00.000Z", metrics: undefined, checkpoint: undefined }),
    );
    expect(receipt.completedAt).toBe("2026-09-24T03:00:00.000Z");
    expect(receipt.metrics).toBeNull();
    expect(receipt.checkpoint).toBeNull();
    expect(receipt.signatureDistance).toBe(42);
  });

  it("generates a receipt id when none is supplied", () => {
    const first = buildRunReceipt({ ...input(), receiptId: undefined });
    const second = buildRunReceipt({ ...input(), receiptId: undefined });
    expect(first.receiptId.startsWith("RCT//")).toBe(true);
    expect(second.receiptId.startsWith("RCT//")).toBe(true);
  });

  it("is deterministic: same input (pinned id), same receipt", () => {
    expect(buildRunReceipt(input())).toEqual(buildRunReceipt(input()));
  });
});

describe("buildShareText", () => {
  it("names the run, front, cover, readiness, attention, and gate", () => {
    const receipt = buildRunReceipt(input());
    const text = buildShareText(receipt);
    expect(text).toContain("RUN//0001");
    expect(text).toContain("pool-service");
    expect(text).toContain("COVER//01");
    expect(text).toContain("85/100");
    expect(text).toContain("BALANCED");
    expect(text).toContain("CLEAN");
    expect(text).toContain("RCT//TEST0001");
  });

  it("degrades gracefully without metrics or gate", () => {
    const receipt: RunReceipt = {
      ...buildRunReceipt(input({ metrics: undefined, checkpoint: undefined })),
      metrics: null,
      checkpoint: null,
    };
    const text = buildShareText(receipt);
    expect(text).toContain("UNRATED");
    expect(text).toContain("UNKNOWN");
    expect(text).toContain("NO GATE");
  });
});

describe("renderRunReceiptPng", () => {
  it("renders at 1600x1000 with a PNG blob", async () => {
    const { drawn } = stubCanvasEnvironment({ coverDecodes: true });
    const receipt = buildRunReceipt(input());
    const blob = await renderRunReceiptPng(receipt);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
    const joined = drawn.join("\n");
    expect(joined).toContain("CREWMARK // RUN RECEIPT");
    expect(joined).toContain("RCT//TEST0001");
    expect(joined).toContain("pool-service");
    vi.unstubAllGlobals();
  });

  it("renders a placeholder when the cover cannot be decoded", async () => {
    const { ctx, drawn } = stubCanvasEnvironment({ coverDecodes: false });
    const receipt = buildRunReceipt(input());
    const blob = await renderRunReceiptPng(receipt);
    expect(blob.type).toBe("image/png");
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(drawn.join("\n")).toContain("COVER//01 UNAVAILABLE");
    vi.unstubAllGlobals();
  });

  it("renders unrated receipts without metrics", async () => {
    const { drawn } = stubCanvasEnvironment();
    const receipt = buildRunReceipt(input({ metrics: undefined }));
    await renderRunReceiptPng(receipt);
    expect(drawn.join("\n")).toContain("UNRATED");
    vi.unstubAllGlobals();
  });

  it("fails loudly without a 2d context", async () => {
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => null, width: 0, height: 0 }),
    });
    await expect(renderRunReceiptPng(buildRunReceipt(input()))).rejects.toThrow(/2d/i);
    vi.unstubAllGlobals();
  });
});

describe("downloadRunReceiptPng", () => {
  it("renders and triggers a download with a receipt-derived filename", async () => {
    stubCanvasEnvironment({ coverDecodes: true });
    const clicks: string[] = [];
    const created = vi.fn((blob: Blob) => `blob:${blob.size}`);
    const revoked: string[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        created(blob);
        return `blob:${blob.size}`;
      },
      revokeObjectURL: (url: string) => {
        revoked.push(url);
      },
    });
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              fillRect: vi.fn(),
              strokeRect: vi.fn(),
              fillText: vi.fn(),
              drawImage: vi.fn(),
              fillStyle: "",
              strokeStyle: "",
              lineWidth: 0,
              font: "",
              textBaseline: "",
            }),
            toBlob: (cb: (blob: Blob | null) => void) => {
              cb(new Blob(["fake-png"], { type: "image/png" }));
            },
          };
        }
        return {
          href: "",
          download: "",
          click: vi.fn(() => {
            clicks.push("clicked");
          }),
          remove: vi.fn(),
        };
      },
      body: { appendChild: vi.fn() },
    });

    const receipt = buildRunReceipt(input());
    await downloadRunReceiptPng(receipt, { filename: "test-receipt" });
    expect(created).toHaveBeenCalledTimes(1);
    expect(clicks).toEqual(["clicked"]);
    expect(revoked).toHaveLength(1);
    expect(RUN_RECEIPT_WIDTH).toBe(1600);
    expect(RUN_RECEIPT_HEIGHT).toBe(1000);
    vi.unstubAllGlobals();
  });
});
