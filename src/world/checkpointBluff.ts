import type { CityAttention } from "../lib/creativeMetrics";
import type { CheckpointBranch } from "./mission";

export type BluffEvidenceId = "vehicle" | "pass" | "crate" | "jacket";
export type BluffQuestionId = "company" | "authorization" | "cargo" | "company-id";
export type BluffResponse = "correct" | "plausible" | "wrong" | "timeout";
export type BluffOutcome = "clean-pass" | "secondary-review" | "busted";
export type CheckpointBluffStatus = "ready" | "active" | "resolving" | "resolved";

export interface BluffQuestion {
  readonly id: BluffQuestionId;
  readonly guard: string;
  readonly prompt: string;
  readonly bestEvidence: BluffEvidenceId;
  readonly plausibleEvidence: BluffEvidenceId;
}

export interface CheckpointBluffState {
  readonly version: 1;
  readonly status: CheckpointBluffStatus;
  readonly belief: number;
  /** Stable three-question order selected from the mission run identity. */
  readonly questionIds: readonly BluffQuestionId[];
  /** Number of checks already resolved. */
  readonly currentIndex: number;
  readonly responses: readonly BluffResponse[];
  readonly outcome?: BluffOutcome;
}

export const BLUFF_CHECK_COUNT = 3;
export const BLUFF_CHECK_MS = 7000;
export const BLUFF_FEEDBACK_MS = 650;

const QUESTIONS: readonly BluffQuestion[] = [
  {
    id: "company",
    guard: "GUARD",
    prompt: "WHO ARE YOU WITH?",
    bestEvidence: "vehicle",
    plausibleEvidence: "pass",
  },
  {
    id: "authorization",
    guard: "GUARD",
    prompt: "SHOW ME YOUR AUTHORIZATION.",
    bestEvidence: "pass",
    plausibleEvidence: "jacket",
  },
  {
    id: "cargo",
    guard: "GUARD",
    prompt: "WHAT'S IN THE BACK?",
    bestEvidence: "crate",
    plausibleEvidence: "vehicle",
  },
  {
    id: "company-id",
    guard: "GUARD",
    prompt: "STEP OUT. COMPANY ID.",
    bestEvidence: "jacket",
    plausibleEvidence: "pass",
  },
] as const;

const EVIDENCE_CHOICES: Readonly<Record<BluffQuestionId, readonly BluffEvidenceId[]>> = {
  company: ["vehicle", "pass", "crate"],
  authorization: ["pass", "jacket", "vehicle"],
  cargo: ["crate", "vehicle", "jacket"],
  "company-id": ["jacket", "pass", "crate"],
};

const EVIDENCE_LABELS: Readonly<Record<BluffEvidenceId, string>> = {
  vehicle: "VEHICLE",
  pass: "GATE PASS",
  crate: "CRATE",
  jacket: "CREW JACKET",
};

const EVIDENCE_SURFACES: Readonly<Record<BluffEvidenceId, "CAR" | "PASS" | "CRATE" | "JACKET">> = {
  vehicle: "CAR",
  pass: "PASS",
  crate: "CRATE",
  jacket: "JACKET",
};

function clampBelief(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function attentionPenalty(attention: CityAttention): number {
  if (attention === "HIGH") return 12;
  if (attention === "BALANCED") return 5;
  return 0;
}

export function deriveInitialBelief(readiness: number, attention: CityAttention): number {
  return Math.min(65, Math.max(25, Math.round(25 + Math.max(0, Math.min(100, readiness)) * 0.4 - attentionPenalty(attention))));
}

export function questionForId(id: BluffQuestionId): BluffQuestion {
  return QUESTIONS.find((question) => question.id === id) ?? QUESTIONS[0];
}

export function evidenceLabel(id: BluffEvidenceId): string {
  return EVIDENCE_LABELS[id];
}

export function evidenceSurface(id: BluffEvidenceId): "CAR" | "PASS" | "CRATE" | "JACKET" {
  return EVIDENCE_SURFACES[id];
}

export function evidenceChoices(questionId: BluffQuestionId): readonly BluffEvidenceId[] {
  return EVIDENCE_CHOICES[questionId];
}

/**
 * Stable selection and ordering: the same missionRunId always asks the same
 * three questions in the same order, even after refresh or abort/resume.
 */
export function selectCheckpointQuestions(missionRunId: string): readonly BluffQuestionId[] {
  return QUESTIONS
    .map((question) => ({
      question,
      sortKey: hashString(`${missionRunId}//${question.id}`),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, BLUFF_CHECK_COUNT)
    .map(({ question }) => question.id);
}

export function classifyEvidence(
  questionId: BluffQuestionId,
  evidenceId: BluffEvidenceId,
): Exclude<BluffResponse, "timeout"> {
  const question = questionForId(questionId);
  if (question.bestEvidence === evidenceId) return "correct";
  if (question.plausibleEvidence === evidenceId) return "plausible";
  return "wrong";
}

export function beliefDelta(response: BluffResponse): number {
  if (response === "correct") return 18;
  if (response === "plausible") return -10;
  if (response === "wrong") return -18;
  return -22;
}

export function resolveBluffOutcome(belief: number): BluffOutcome {
  if (belief >= 70) return "clean-pass";
  if (belief >= 45) return "secondary-review";
  return "busted";
}

export function branchForBluffOutcome(outcome: BluffOutcome): CheckpointBranch {
  if (outcome === "clean-pass") return "clean";
  if (outcome === "secondary-review") return "secondary";
  return "manual";
}

export function createCheckpointBluffState(
  missionRunId: string,
  readiness: number,
  attention: CityAttention,
): CheckpointBluffState {
  return {
    version: 1,
    status: "ready",
    belief: deriveInitialBelief(readiness, attention),
    questionIds: selectCheckpointQuestions(missionRunId),
    currentIndex: 0,
    responses: [],
  };
}

export function activateCheckpointBluff(state: CheckpointBluffState): CheckpointBluffState {
  if (state.status !== "ready") return state;
  return { ...state, status: "active" };
}

/** Pure, idempotent scoring transition used by the UI and focused tests. */
export function applyBluffResponse(
  state: CheckpointBluffState,
  response: BluffResponse,
): CheckpointBluffState {
  if (state.status !== "active" || state.currentIndex >= state.questionIds.length) return state;

  const belief = clampBelief(state.belief + beliefDelta(response));
  const currentIndex = state.currentIndex + 1;
  const responses = [...state.responses, response] as BluffResponse[];
  if (currentIndex < BLUFF_CHECK_COUNT) {
    return { ...state, belief, currentIndex, responses };
  }

  const outcome = resolveBluffOutcome(belief);
  return {
    ...state,
    belief,
    currentIndex,
    responses,
    status: "resolving",
    outcome,
  };
}

export function markBluffResolved(state: CheckpointBluffState): CheckpointBluffState {
  if (state.status !== "resolving") return state;
  return { ...state, status: "resolved" };
}

export function isBluffComplete(state: CheckpointBluffState): boolean {
  return state.currentIndex >= BLUFF_CHECK_COUNT && Boolean(state.outcome);
}

export function validateCheckpointBluffState(value: unknown): value is CheckpointBluffState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  if (state.version !== 1) return false;
  if (state.status !== "ready" && state.status !== "active" && state.status !== "resolving" && state.status !== "resolved") return false;
  if (typeof state.belief !== "number" || state.belief < 0 || state.belief > 100) return false;
  if (!Array.isArray(state.questionIds) || state.questionIds.length !== BLUFF_CHECK_COUNT || state.questionIds.some((id) => !QUESTIONS.some((question) => question.id === id))) return false;
  if (new Set(state.questionIds).size !== BLUFF_CHECK_COUNT) return false;
  const currentIndex = state.currentIndex;
  if (typeof currentIndex !== "number" || !Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex > BLUFF_CHECK_COUNT) return false;
  if (!Array.isArray(state.responses) || state.responses.length !== currentIndex || state.responses.some((response) => !["correct", "plausible", "wrong", "timeout"].includes(response as string))) return false;
  if (state.outcome !== undefined && !["clean-pass", "secondary-review", "busted"].includes(state.outcome as string)) return false;
  return true;
}
