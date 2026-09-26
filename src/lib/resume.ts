// Story-aware resume targets (P4A).
//
// Pure decision helper so the landing CONTINUE routing is testable without
// rendering. Priority is furthest-valid-checkpoint: an existing MARK//002
// outranks everything; otherwise a reached P4 (compromised MARK//001 without
// an evolved mark yet) resumes into mark-evolution; older sessions keep
// their P2.3 checkpoints unchanged.

export type ResumeTarget =
  | "identity-reveal"
  | "district-select"
  | "surveillance"
  | "mark-evolution"
  | "mark-v2-reveal"
  | "job-yard"
  | "mission"
  | "final-run-receipt";

export interface ResumeState {
  hasMarkV1: boolean;
  hasMarkV2: boolean;
  surveillanceTriggered: boolean;
  identityTheftTriggered: boolean;
  hasClaims: boolean;
  /** P3.5A-R.2: a locked cover resumes into the playable yard. Optional so older callers still compile. */
  hasCover?: boolean;
  /** P3.5A-R.2: an accepted job without cover resumes into the yard objective. */
  jobAccepted?: boolean;
  /** P3.5A-R.3: an in-progress mission resumes into Port Vice. */
  missionStarted?: boolean;
  missionCompleted?: boolean;
  /** P6 Creative Playground: chosen front. */
  hasChosenFront?: boolean;
  /** P6 Creative Playground: receipts reviewed. */
  receiptsReviewed?: boolean;
  /** P6 Creative Playground: final run receipt created. */
  hasFinalReceipt?: boolean;
}

/**
 * Furthest valid checkpoint for a saved session. Callers must guarantee
 * hasMarkV1 (CONTINUE is only offered when MARK//001 exists).
 */
export function resolveResumeTarget(state: ResumeState): ResumeTarget {
  if (state.hasFinalReceipt) return "final-run-receipt";
  // Active mission outranks legacy story checkpoints: a valid in-progress
  // mission must resume into Port Vice even when stale legacy flags exist.
  if (state.missionStarted && !state.missionCompleted) return "mission";
  if (state.hasMarkV2) return "mark-v2-reveal";
  if (state.identityTheftTriggered) return "mark-evolution";
  if (state.surveillanceTriggered) return "surveillance";
  if (state.hasClaims) return "district-select";
  if (state.hasCover || state.jobAccepted) return "job-yard";
  return "identity-reveal";
}

/**
 * P6 Canonical Release router:
 * - in-progress mission resumes to "mission"
 * - final receipt resumes to "final-run-receipt"
 * - all other marked sessions resume directly to the 305 hub ("job-yard")
 */
export function resolveCanonicalResumeStage(target: ResumeTarget): "mission" | "job-yard" | "final-run-receipt" {
  if (target === "mission") return "mission";
  if (target === "final-run-receipt") return "final-run-receipt";
  return "job-yard";
}
