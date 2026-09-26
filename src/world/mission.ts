import type { CoverAssetRef } from "../lib/coverAssetStore";
import type { CoverAnalysis, CoverCheckStatus } from "../lib/coverAnalysis";
import { createDisguisePackage, type DisguisePackage } from "../lib/disguisePackage";
import type { CoverRecord } from "../lib/coverStorage";
import type { VehicleLivery } from "../lib/vehicleLivery";
import type { CreativeMetrics } from "../lib/creativeMetrics";
/** The checkpoint classifies the FROZEN cover snapshot taken at START JOB,
 * never live pixels: re-editing COVER//01 later cannot rewrite history.
 * Same analysis always returns the same branch, heat, and reward.
 */

export type CheckpointBranch = "clean" | "secondary" | "manual";

export interface CheckpointVerdict {
  readonly branch: CheckpointBranch;
  /** Human-readable citations of the stored metrics behind the branch. */
  readonly reasons: readonly string[];
}

/** Heat paid per checkpoint branch. Deterministic, mission-scoped. */
export const CHECKPOINT_HEAT: Record<CheckpointBranch, number> & Record<string, number> = {
  clean: 3,
  secondary: 8,
  manual: 15,
  // Legacy aliases
  questionable: 8,
  weak: 15,
};

/** Flat completion payment. No territory in this slice (not narratively justified). */
export const MISSION_REP_REWARD = 25;

/** Major checks: identity, orange profile, service detail. Weathering is advisory only. */
const MAJOR_IDS = ["identity", "orange", "detail"] as const;

function majorStatuses(analysis: CoverAnalysis): CoverCheckStatus[] {
  return analysis.checks
    .filter((c) => (MAJOR_IDS as readonly string[]).includes(c.id))
    .map((c) => c.status);
}

function statusOf(analysis: CoverAnalysis, id: string): CoverCheckStatus | null {
  return analysis.checks.find((c) => c.id === id)?.status ?? null;
}

/**
 * Deterministic branch from stored analysis, per the mission brief:
 * - CLEAN: score >= 75 with orange PASS and identity PASS.
 * - WEAK: score < 45, or 2+ major checks LOW/REVIEW.
 * - QUESTIONABLE: everything else (45-74, or a single major REVIEW).
 */
export function classifyCheckpoint(analysis: CoverAnalysis): CheckpointVerdict {
  const majors = majorStatuses(analysis);
  const weakMajors = majors.filter((s) => s === "LOW" || s === "REVIEW").length;
  const orange = statusOf(analysis, "orange");
  const identity = statusOf(analysis, "identity");

  if (analysis.score >= 75 && orange === "PASS" && identity === "PASS") {
    return {
      branch: "clean",
      reasons: [
        `score ${analysis.score} >= 75`,
        "orange profile PASS",
        "identity signal PASS",
      ],
    };
  }
  if (analysis.score < 45 || weakMajors >= 2) {
    const reasons =
      analysis.score < 45
        ? [`score ${analysis.score} < 45`]
        : [`${weakMajors} major checks LOW/REVIEW`];
    return { branch: "manual", reasons };
  }
  return {
    branch: "secondary",
    reasons: [
      `score ${analysis.score} in 45-74`,
      `orange ${orange ?? "unknown"} / identity ${identity ?? "unknown"}`,
    ],
  };
}

/**
 * P6 Checkpoint classification from CreativeMetrics:
 * - CLEAN: Cover Readiness >= 75 and Attention is LOW or BALANCED.
 * - MANUAL: Cover Readiness < 45, or (Attention is HIGH and Readiness < 70).
 * - SECONDARY: All other combinations (e.g. loud high-attention official covers).
 */
export function classifyCreativeCheckpoint(metrics: CreativeMetrics): CheckpointVerdict {
  if (metrics.coverReadiness >= 75 && metrics.cityAttention !== "HIGH") {
    return {
      branch: "clean",
      reasons: [
        `Readiness ${metrics.coverReadiness} >= 75`,
        `Attention ${metrics.cityAttention} is quiet/balanced`,
        metrics.reaction,
      ],
    };
  }
  if (metrics.coverReadiness < 45 || (metrics.cityAttention === "HIGH" && metrics.coverReadiness < 70)) {
    return {
      branch: "manual",
      reasons: [
        metrics.coverReadiness < 45
          ? `Readiness ${metrics.coverReadiness} < 45 (disguise too sparse)`
          : `Attention HIGH with Readiness ${metrics.coverReadiness} < 70 (too loud for weak detail)`,
        metrics.reaction,
      ],
    };
  }
  return {
    branch: "secondary",
    reasons: [
      `Readiness ${metrics.coverReadiness} / Attention ${metrics.cityAttention}`,
      metrics.reaction,
    ],
  };
}

/** Frozen cover & disguise package reference captured at START JOB. Later edits can't touch it. */
export interface MissionSnapshot {
  readonly coverImage: string;
  readonly coverAssetRef?: CoverAssetRef;
  readonly coverLockedAt: string;
  readonly analysis: CoverAnalysis;
  readonly metrics?: CreativeMetrics;
  readonly score: number;
  readonly startedAt?: string;
  readonly disguisePackage?: DisguisePackage;
  readonly vehicleLivery?: VehicleLivery;
}

export type MissionStatus = "active" | "aborted" | "completed";

export interface MissionState {
  readonly started: boolean;
  readonly missionRunId?: string;
  readonly status?: MissionStatus;
  readonly snapshot: MissionSnapshot | null;
  readonly checkpoint: CheckpointBranch | null;
  readonly checkpointHeatPaid: boolean;
  readonly completed: boolean;
  readonly completedAt?: string;
  readonly repPaid: boolean;
  readonly completionRewardPaid?: boolean;
}

export const EMPTY_MISSION: MissionState = {
  started: false,
  missionRunId: "",
  snapshot: null,
  checkpoint: null,
  checkpointHeatPaid: false,
  completed: false,
  repPaid: false,
  completionRewardPaid: false,
};

export function createMissionRunId(): string {
  return `mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
export function startMissionState(
  cover: CoverRecord,
  pkg?: DisguisePackage,
  missionRunId: string = createMissionRunId(),
): MissionState {
  const disguise =
    pkg ??
    cover.disguisePackage ??
    (cover.image ? createDisguisePackage(cover.image, cover.templateId) : null);

  return {
    started: true,
    missionRunId,
    status: "active",
    snapshot: {
      coverImage: cover.image,
      coverAssetRef: cover.assetRef,
      coverLockedAt: cover.lockedAt,
      analysis: {
        ...cover.analysis,
        checks: cover.analysis.checks.map((c) => ({ ...c })),
      },
      score: cover.analysis.score,
      startedAt: new Date().toISOString(),
      disguisePackage: disguise ?? undefined,
      vehicleLivery: disguise?.vehicleLivery,
    },
    checkpoint: null,
    checkpointHeatPaid: false,
    completed: false,
    repPaid: false,
    completionRewardPaid: false,
  };
}

/** Record the gate outcome. Pure — App pays heat separately via the guard below. */
export function withCheckpoint(state: MissionState, branch: CheckpointBranch): MissionState {
  if (state.checkpoint !== null) return state;
  return { ...state, checkpoint: branch };
}

/** True only when checkpoint heat has not been paid yet. */
export function shouldPayCheckpointHeat(state: MissionState): boolean {
  return state.checkpoint !== null && !state.checkpointHeatPaid;
}

export function withCheckpointHeatPaid(state: MissionState): MissionState {
  return { ...state, checkpointHeatPaid: true };
}

/** True only when the completion reward has not been paid yet. */
export function shouldPayCompletion(state: MissionState): boolean {
  return state.completed && !state.completionRewardPaid && !state.repPaid;
}

export function withCompleted(state: MissionState): MissionState {
  if (state.completed) return state;
  return { ...state, completed: true, status: "completed", completedAt: new Date().toISOString() };
}

export function withRepPaid(state: MissionState): MissionState {
  return { ...state, repPaid: true, completionRewardPaid: true };
}

export interface CoverAnchor {
  readonly left: string;
  readonly top: string;
  readonly width: string;
}

/**
 * Tuned against src/assets/world/service-vehicle.png:
 * Anchors the exact cover onto the driver/passenger door panel surface.
 */
export const DEFAULT_COVER_ANCHOR: CoverAnchor = {
  left: "28%",
  top: "48%",
  width: "28%",
};
export function resumeMissionPhase(
  state: MissionState | null,
): "approach" | "yard" | "result" | null {
  if (!state || !state.started) return null;
  if (state.completed) return "result";
  if (state.checkpoint !== null) return "yard";
  return "approach";
}
