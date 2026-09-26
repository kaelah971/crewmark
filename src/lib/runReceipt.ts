// P6 Run Receipt: the immutable artifact a completed run leaves behind.
//
// A receipt freezes the front, the locked cover, its creative metrics, the
// gate outcome, and the mission timestamps into one record. buildRunReceipt
// is pure and deterministic (same input, same record); rendering turns that
// record into a shareable 1600x1000 PNG with a dark terminal aesthetic.

import type { CoverVersion } from "./coverStorage";
import type { CreativeMetrics } from "./creativeMetrics";
import type { ChosenFrontRecord } from "./fronts";
import type { CheckpointBranch } from "../world/mission";

export interface RunReceipt {
  readonly receiptId: string;
  readonly runId: string;
  readonly front: ChosenFrontRecord;
  readonly coverVersion: CoverVersion;
  readonly coverDataUrl: string;
  readonly cover01DataUrl?: string | null;
  readonly metrics: CreativeMetrics | null;
  readonly checkpoint: CheckpointBranch | null;
  readonly signatureDistance: number | null;
  readonly heat: number;
  readonly missionStartedAt: string;
  readonly missionCompletedAt: string;
  readonly receiptsReviewedAt: string;
  readonly completedAt: string;
  readonly shareText: string;
}

export interface RunReceiptInput {
  readonly receiptId?: string;
  readonly runId: string;
  readonly front: ChosenFrontRecord;
  readonly coverVersion: CoverVersion;
  readonly coverDataUrl: string;
  readonly cover01DataUrl?: string | null;
  readonly metrics?: CreativeMetrics | null;
  readonly checkpoint?: CheckpointBranch | null;
  readonly signatureDistance?: number | null;
  readonly heat?: number;
  readonly missionStartedAt: string;
  readonly missionCompletedAt: string;
  readonly receiptsReviewedAt: string;
  readonly completedAt?: string;
}

export interface RunReceiptPngOptions {
  /** Download filename without extension when using downloadRunReceiptPng. */
  readonly filename?: string;
}

export const RUN_RECEIPT_WIDTH = 1600;
export const RUN_RECEIPT_HEIGHT = 1000;

export const RUN_RECEIPT_STORAGE_KEY = "crewmark:p6:runReceipt";

export function loadRunReceipt(): RunReceipt | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(RUN_RECEIPT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RunReceipt;
  } catch {
    return null;
  }
}

export function saveRunReceipt(receipt: RunReceipt): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.setItem(RUN_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
    return true;
  } catch {
    return false;
  }
}

export function clearRunReceipt(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(RUN_RECEIPT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function randomReceiptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `RCT//${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return `RCT//${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, "0")}`;
}

/** Deterministic share line for a receipt. Same receipt, same text. */
export function buildShareText(receipt: Omit<RunReceipt, "shareText">): string {
  const readiness = receipt.metrics ? `${receipt.metrics.coverReadiness}/100` : "UNRATED";
  const attention = receipt.metrics ? receipt.metrics.cityAttention : "UNKNOWN";
  const gate = receipt.checkpoint ? receipt.checkpoint.toUpperCase() : "NO GATE";
  return (
    `CREWMARK // RUN ${receipt.runId} — ${receipt.front.resolvedFrontId} ` +
    `(${receipt.coverVersion}) // READINESS ${readiness} // ATTENTION ${attention} ` +
    `// GATE ${gate} // ${receipt.receiptId}`
  );
}

/**
 * Build the immutable run receipt. Pure and deterministic except for the
 * defaulted receiptId / completedAt, which callers may pin for tests.
 */
export function buildRunReceipt(input: RunReceiptInput): RunReceipt {
  const receiptId = input.receiptId ?? randomReceiptId();
  const completedAt = input.completedAt ?? input.receiptsReviewedAt;
  const base: Omit<RunReceipt, "shareText"> = {
    receiptId,
    runId: input.runId,
    front: input.front,
    coverVersion: input.coverVersion,
    coverDataUrl: input.coverDataUrl,
    cover01DataUrl: input.cover01DataUrl ?? null,
    metrics: input.metrics ?? null,
    checkpoint: input.checkpoint ?? null,
    signatureDistance: input.signatureDistance ?? null,
    heat: input.heat ?? 0,
    missionStartedAt: input.missionStartedAt,
    missionCompletedAt: input.missionCompletedAt,
    receiptsReviewedAt: input.receiptsReviewedAt,
    completedAt,
  };
  return { ...base, shareText: buildShareText(base) };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      if (typeof Image === "undefined") {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("[crewmark] Receipt canvas produced no pixels."));
      }, "image/png");
      return;
    }
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const [, base64] = dataUrl.split(",");
      const bytes = Uint8Array.from(atob(base64 ?? ""), (ch) => ch.charCodeAt(0));
      resolve(new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" }));
    } catch (err) {
      reject(err instanceof Error ? err : new Error("[crewmark] Receipt export failed."));
    }
  });
}

/**
 * Draw the receipt to a 1600x1000 canvas and return the PNG blob. Cover art
 * that cannot be decoded degrades to a labeled placeholder — the receipt
 * metadata always renders.
 */
export async function renderRunReceiptPng(
  receipt: RunReceipt,
  _options: RunReceiptPngOptions = {},
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = RUN_RECEIPT_WIDTH;
  canvas.height = RUN_RECEIPT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("[crewmark] 2D canvas context unavailable; cannot render the run receipt.");
  }

  ctx.fillStyle = "#0D0F12";
  ctx.fillRect(0, 0, RUN_RECEIPT_WIDTH, RUN_RECEIPT_HEIGHT);
  ctx.strokeStyle = "#2A2F36";
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, RUN_RECEIPT_WIDTH - 48, RUN_RECEIPT_HEIGHT - 48);

  ctx.fillStyle = "#F2EBDD";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 64px system-ui, sans-serif";
  ctx.fillText("CREWMARK // RUN RECEIPT", 80, 130);
  ctx.font = "500 34px system-ui, monospace";
  ctx.fillStyle = "#9AA3AD";
  ctx.fillText(`${receipt.receiptId}  \u2022  RUN ${receipt.runId}`, 80, 180);

  // Dual thumbnails: COVER//01 (burned) + COVER//02 (active)
  const thumbW = 420;
  const thumbH = Math.round((thumbW * 700) / 1600);
  const thumb1X = 80;
  const thumb1Y = 240;
  const thumb2X = 530;
  const thumb2Y = 240;

  // Draw Cover 01 (Burned)
  ctx.fillStyle = "#E11D48";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.fillText("COVER//01 [BURNED]", thumb1X, thumb1Y - 14);
  const c1Url = receipt.cover01DataUrl || (receipt.coverVersion === "COVER//01" ? receipt.coverDataUrl : null);
  const cover1 = c1Url ? await loadImage(c1Url) : null;
  if (cover1) {
    ctx.drawImage(cover1, thumb1X, thumb1Y, thumbW, thumbH);
  } else {
    ctx.fillStyle = "#1A1E24";
    ctx.fillRect(thumb1X, thumb1Y, thumbW, thumbH);
    ctx.fillStyle = "#9AA3AD";
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText("COVER//01 UNAVAILABLE", thumb1X + 24, thumb1Y + thumbH / 2);
  }
  ctx.strokeStyle = "#E11D48";
  ctx.lineWidth = 3;
  ctx.strokeRect(thumb1X, thumb1Y, thumbW, thumbH);

  // Draw Cover 02 (Active)
  ctx.fillStyle = "#10B981";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.fillText("COVER//02 [ACTIVE]", thumb2X, thumb2Y - 14);
  const c2Url = receipt.coverVersion === "COVER//02" ? receipt.coverDataUrl : null;
  const cover2 = c2Url ? await loadImage(c2Url) : null;
  if (cover2) {
    ctx.drawImage(cover2, thumb2X, thumb2Y, thumbW, thumbH);
  } else {
    ctx.fillStyle = "#1A1E24";
    ctx.fillRect(thumb2X, thumb2Y, thumbW, thumbH);
    ctx.fillStyle = "#9AA3AD";
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText("COVER//02 PENDING", thumb2X + 24, thumb2Y + thumbH / 2);
  }
  ctx.strokeStyle = "#10B981";
  ctx.lineWidth = 3;
  ctx.strokeRect(thumb2X, thumb2Y, thumbW, thumbH);

  const colX = 1030;
  let lineY = 240;
  const row = (label: string, value: string) => {
    ctx.fillStyle = "#9AA3AD";
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText(label, colX, lineY);
    ctx.fillStyle = "#F2EBDD";
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText(value, colX, lineY + 36);
    lineY += 86;
  };

  row("FRONT", receipt.front.resolvedFrontId.toUpperCase());
  row(
    "VISUAL DISTANCE",
    receipt.signatureDistance === null || receipt.signatureDistance === undefined
      ? "—"
      : `${Math.round(receipt.signatureDistance)}%`,
  );
  row("PORT VICE", receipt.checkpoint ? `CLEARED (${receipt.checkpoint.toUpperCase()})` : "NO GATE");
  row("HEAT", String(receipt.heat));
  row(
    "COVER READINESS",
    receipt.metrics ? `${receipt.metrics.coverReadiness}/100` : "UNRATED",
  );
  row("CITY ATTENTION", receipt.metrics ? receipt.metrics.cityAttention : "UNKNOWN");
  ctx.fillStyle = "#9AA3AD";
  ctx.font = "500 26px system-ui, monospace";
  ctx.fillText(
    `STARTED ${receipt.missionStartedAt}  \u2022  DONE ${receipt.missionCompletedAt}  \u2022  REVIEWED ${receipt.receiptsReviewedAt}`,
    80,
    RUN_RECEIPT_HEIGHT - 120,
  );
  ctx.fillStyle = "#F2EBDD";
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText(receipt.shareText.slice(0, 120), 80, RUN_RECEIPT_HEIGHT - 70);

  return toBlob(canvas);
}

/** Render the receipt PNG and trigger a browser download. */
export async function downloadRunReceiptPng(
  receipt: RunReceipt,
  options: RunReceiptPngOptions = {},
): Promise<void> {
  const blob = await renderRunReceiptPng(receipt, options);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${options.filename ?? `crewmark-receipt-${receipt.receiptId.replace(/[^A-Za-z0-9]+/g, "-")}`}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
