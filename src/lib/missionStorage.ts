import type { CoverAnalysis } from "./coverAnalysis";
import type { CheckpointBranch, MissionState } from "../world/mission";
import type { DisguisePackage } from "./disguisePackage";
import type { VehicleLivery } from "./vehicleLivery";
// One dedicated localStorage key — never merged into mark, progress, job,
// or cover slots — so old saves load with no mission and RESET simply
// removes the key. The stored snapshot freezes the cover analysis from
// START JOB; later cover edits cannot rewrite mission history.

const STORAGE_KEY = "crewmark:r:job01mission";

export { STORAGE_KEY as MISSION_STORAGE_KEY };

function isPlausibleAnalysis(value: unknown): value is CoverAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === "number" &&
    typeof v.blank === "boolean" &&
    Array.isArray(v.checks) &&
    typeof v.width === "number" &&
    typeof v.height === "number"
  );
}

function normalizeBranch(value: unknown): CheckpointBranch | null {
  if (value === "clean") return "clean";
  if (value === "secondary" || value === "questionable") return "secondary";
  if (value === "manual" || value === "weak") return "manual";
  return null;
}

function sanitize(raw: unknown): MissionState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const snapshot = v.snapshot as Record<string, unknown> | null;
  if (v.started !== true) return null;
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    typeof snapshot.coverLockedAt !== "string" ||
    typeof snapshot.score !== "number" ||
    !isPlausibleAnalysis(snapshot.analysis)
  ) {
    return null;
  }
  let checkpointBranch: CheckpointBranch | null = null;
  if (v.checkpoint !== null && v.checkpoint !== undefined) {
    checkpointBranch = normalizeBranch(v.checkpoint);
    if (!checkpointBranch) return null;
  }
  return {
    started: true,
    snapshot: {
      coverImage: typeof snapshot.coverImage === "string" ? snapshot.coverImage : "",
      coverLockedAt: snapshot.coverLockedAt,
      analysis: snapshot.analysis,
      score: snapshot.score,
      startedAt: typeof snapshot.startedAt === "string" ? snapshot.startedAt : undefined,
      disguisePackage: (snapshot.disguisePackage as DisguisePackage) ?? undefined,
      vehicleLivery: (snapshot.vehicleLivery as VehicleLivery) ?? undefined,
    },
    checkpoint: checkpointBranch,
    checkpointHeatPaid: v.checkpointHeatPaid === true,
    completed: v.completed === true,
    repPaid: v.repPaid === true,
  };
}

/** Load the mission record, or null when absent/invalid (old saves). */
export function loadMission(): MissionState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch (err) {
    console.warn("[crewmark] Mission load failed; treating as no mission.", err);
    return null;
  }
}

/** Persist the mission record. Callers keep in-memory copies on failure. */
export function saveMission(state: MissionState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn("[crewmark] Mission save failed; mission is session-only.", err);
    return false;
  }
}

/** Clear the mission record (RESET). */
export function clearMission(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[crewmark] Mission clear failed.", err);
  }
}
