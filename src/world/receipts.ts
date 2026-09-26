import type { CheckpointBranch, MissionSnapshot } from "./mission";

/**
 * P3.5A-R.4: "CAMERAS KEEP RECEIPTS / THE COVER BURNS"
 *
 * Deterministic camera receipt model and exposure logic.
 * Every receipt references the immutable mission snapshot from START JOB —
 * re-editing COVER//01 later cannot rewrite historical camera captures.
 */

export type CameraReceiptId = "CAM//01" | "CAM//02" | "CAM//03";

export interface CameraReceipt {
  readonly id: CameraReceiptId;
  readonly source: string;
  readonly location: string;
  readonly timestamp: string;
  readonly confidence: number;
  readonly coverImage: string;
  readonly coverLockedAt: string;
  readonly analysisScore: number;
  readonly status: "CONFIRMED" | "CORRELATED" | "WATCHLIST";
  readonly cameraAngle: "gate" | "yard" | "causeway";
  readonly visualProfile: {
    readonly colorMatch: string;
    readonly identitySignal: string;
    readonly serviceDetail: string;
    readonly surfaceAge: string;
  };
}

export interface ReceiptState {
  readonly cameraReceiptsSeen: boolean;
  readonly cover01Burned: boolean;
  readonly burnHeatPaid: boolean;
  readonly burnedAt?: string;
}

export const EMPTY_RECEIPT_STATE: ReceiptState = {
  cameraReceiptsSeen: false,
  cover01Burned: false,
  burnHeatPaid: false,
};

/** Deterministic heat penalty when the burned cover reveal completes. */
export const BURN_HEAT_CONSEQUENCE = 10;

/**
 * Deterministic confidence mapping:
 * Operational gate success != urban invisibility.
 * Scrutiny level at the checkpoint correlates to how heavily surveillance
 * networks cross-reference the vehicle's visual profile.
 *
 * Clean: base scrutiny (72-76%)
 * Secondary: heightened scrutiny (82-86%)
 * Manual: maximum scrutiny (91-95%)
 */
export function confidenceForCamera(
  camId: CameraReceiptId,
  branch: CheckpointBranch | null,
  score: number,
): number {
  // Base offset by camera proximity/resolution
  const camOffset = camId === "CAM//01" ? 0 : camId === "CAM//02" ? -4 : -8;

  // Normalized branch scrutiny
  let baseScrutiny = 74;
  if (branch === "secondary") {
    baseScrutiny = 86;
  } else if (branch === "manual") {
    baseScrutiny = 94;
  }

  // Slight deterministic modulation from cover score:
  // higher visual complexity creates sharper edge correlations
  const complexityMod = Math.round((Math.min(100, Math.max(0, score)) - 50) * 0.04);

  return Math.min(99, Math.max(50, baseScrutiny + camOffset + complexityMod));
}

/**
 * Pure generator: creates the 3 immutable receipts for the completed mission.
 * Same completed mission state always generates the identical receipt set.
 */
export function generateReceipts(
  snapshot: MissionSnapshot,
  checkpointBranch: CheckpointBranch | null,
): readonly [CameraReceipt, CameraReceipt, CameraReceipt] {
  const orangeCheck = snapshot.analysis.checks.find((c) => c.id === "orange");
  const identityCheck = snapshot.analysis.checks.find((c) => c.id === "identity");
  const detailCheck = snapshot.analysis.checks.find((c) => c.id === "detail");
  const weatheringCheck = snapshot.analysis.checks.find((c) => c.id === "weathering");

  const colorStatus = orangeCheck?.status === "PASS" ? "MATCH // ORANGE LOWER PROFILE" : "CORRELATED // PARTIAL STRIPE";
  const identityStatus = identityCheck?.status === "PASS" ? "MATCH // CONTRACTOR IDENTITY" : "SUSPECT // CONTRACTOR VINYL";
  const detailStatus = detailCheck?.status === "PASS" ? "MATCH // FLEET ID & NUMBER" : "CORRELATED // SERVICE MARKING";
  const surfaceStatus = weatheringCheck?.status === "PASS" ? "VERIFIED // SURFACE WEAR VARIATION" : "SMOOTH // LOW WEAR PATTERN";

  const cam01: CameraReceipt = {
    id: "CAM//01",
    source: "PORT VICE SECURITY // CAM-01 [OVERHEAD ENTRANCE]",
    location: "PORT VICE SERVICE GATE",
    timestamp: "01:38:42 EDT",
    confidence: confidenceForCamera("CAM//01", checkpointBranch, snapshot.score),
    coverImage: snapshot.coverImage,
    coverLockedAt: snapshot.coverLockedAt,
    analysisScore: snapshot.score,
    status: "CONFIRMED",
    cameraAngle: "gate",
    visualProfile: {
      colorMatch: colorStatus,
      identitySignal: identityStatus,
      serviceDetail: detailStatus,
      surfaceAge: surfaceStatus,
    },
  };

  const cam02: CameraReceipt = {
    id: "CAM//02",
    source: "PORT VICE YARD // CAM-04 [CONTAINER PERIMETER]",
    location: "PORT VICE RESTRICTED YARD",
    timestamp: "01:44:19 EDT",
    confidence: confidenceForCamera("CAM//02", checkpointBranch, snapshot.score),
    coverImage: snapshot.coverImage,
    coverLockedAt: snapshot.coverLockedAt,
    analysisScore: snapshot.score,
    status: "CORRELATED",
    cameraAngle: "yard",
    visualProfile: {
      colorMatch: colorStatus,
      identitySignal: identityStatus,
      serviceDetail: detailStatus,
      surfaceAge: surfaceStatus,
    },
  };

  const cam03: CameraReceipt = {
    id: "CAM//03",
    source: "BISCAYNE CAUSEWAY // TOLL-09 [WESTBOUND]",
    location: "MACARTHUR CAUSEWAY // WESTBOUND",
    timestamp: "01:52:08 EDT",
    confidence: confidenceForCamera("CAM//03", checkpointBranch, snapshot.score),
    coverImage: snapshot.coverImage,
    coverLockedAt: snapshot.coverLockedAt,
    analysisScore: snapshot.score,
    status: "WATCHLIST",
    cameraAngle: "causeway",
    visualProfile: {
      colorMatch: colorStatus,
      identitySignal: identityStatus,
      serviceDetail: detailStatus,
      surfaceAge: surfaceStatus,
    },
  };

  return [cam01, cam02, cam03] as const;
}

/** Check if burn heat consequence should be paid (once only). */
export function shouldPayBurnHeat(state: ReceiptState): boolean {
  return state.cover01Burned && !state.burnHeatPaid;
}

/** Pure transition when player reviews receipts at terminal. */
export function withReceiptsReviewed(state: ReceiptState, burnedAt: string = new Date().toISOString()): ReceiptState {
  return {
    ...state,
    cameraReceiptsSeen: true,
    cover01Burned: true,
    burnedAt: state.burnedAt ?? burnedAt,
  };
}

/** Pure transition marking burn heat consequence paid. */
export function withBurnHeatPaid(state: ReceiptState): ReceiptState {
  return {
    ...state,
    burnHeatPaid: true,
  };
}
