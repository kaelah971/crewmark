import { getCoverAsset, putCoverAsset, type CoverAssetRef } from "./coverAssetStore";
import type { CoverAnalysis } from "./coverAnalysis";
import type { CreativeMetrics } from "./creativeMetrics";
import type { CheckpointBranch, MissionState } from "../world/mission";
import { validateCheckpointBluffState, type CheckpointBluffState } from "../world/checkpointBluff";
import { createDisguisePackage, type DisguisePackage } from "./disguisePackage";
import type { VehicleLivery } from "./vehicleLivery";
import { VEHICLE_TUNING, type VehicleState } from "../world/vehicle";
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

function isPlausibleMetrics(value: unknown): value is CreativeMetrics {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    typeof v.coverReadiness === "number" &&
    (v.cityAttention === "LOW" || v.cityAttention === "BALANCED" || v.cityAttention === "HIGH") &&
    typeof v.reaction === "string"
  );
}

function isPlausibleRouteState(value: unknown): value is VehicleState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.routeProgress === "number" &&
    Number.isFinite(v.routeProgress) &&
    v.routeProgress >= 0 &&
    v.routeProgress <= VEHICLE_TUNING.routeLength &&
    typeof v.lateralOffset === "number" &&
    Number.isFinite(v.lateralOffset) &&
    Math.abs(v.lateralOffset) <= VEHICLE_TUNING.maxLateralOffset &&
    typeof v.lateralVelocity === "number" &&
    Number.isFinite(v.lateralVelocity) &&
    typeof v.speed === "number" &&
    Number.isFinite(v.speed) &&
    v.speed >= VEHICLE_TUNING.maxReverse &&
    v.speed <= VEHICLE_TUNING.maxSpeed &&
    typeof v.heading === "number" &&
    Number.isFinite(v.heading) &&
    typeof v.steering === "number" &&
    Number.isFinite(v.steering)
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
  const checkpointBluff = validateCheckpointBluffState(v.checkpointBluff)
    ? (v.checkpointBluff as CheckpointBluffState)
    : undefined;
  const metrics = isPlausibleMetrics(snapshot.metrics) ? snapshot.metrics : undefined;
  const routeState = isPlausibleRouteState(v.routeState) ? v.routeState : undefined;
  return {
    started: true,
    snapshot: {
      coverImage: typeof snapshot.coverImage === "string" ? snapshot.coverImage : "",
      coverAssetRef: snapshot.coverAssetRef as CoverAssetRef | undefined,
      coverLockedAt: snapshot.coverLockedAt,
      analysis: snapshot.analysis,
      metrics,
      score: snapshot.score,
      startedAt: typeof snapshot.startedAt === "string" ? snapshot.startedAt : undefined,
      disguisePackage: (snapshot.disguisePackage as DisguisePackage) ?? undefined,
      vehicleLivery: (snapshot.vehicleLivery as VehicleLivery) ?? undefined,
    },
    checkpoint: checkpointBranch,
    checkpointHeatPaid: v.checkpointHeatPaid === true,
    ...(checkpointBluff ? { checkpointBluff } : {}),
    ...(routeState ? { routeState } : {}),
    completed: v.completed === true,
    repPaid: v.repPaid === true,
    ...(typeof v.missionRunId === "string" && v.missionRunId ? { missionRunId: v.missionRunId } : {}),
    ...(v.status === "active" || v.status === "aborted" || v.status === "completed" ? { status: v.status } : {}),
    ...(typeof v.completedAt === "string" ? { completedAt: v.completedAt } : {}),
    ...(typeof v.completionRewardPaid === "boolean" ? { completionRewardPaid: v.completionRewardPaid } : {}),
  };
}

/** Load the mission record, or null when absent/invalid (old saves). */
export function loadMission(): MissionState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && typeof (parsed as { snapshot?: { coverAssetRef?: unknown } }).snapshot?.coverAssetRef === "object") {
      return null;
    }
    return sanitize(parsed);
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

function missionPackageEnvelope(pkg: DisguisePackage | undefined): Record<string, unknown> | undefined {
  if (!pkg) return undefined;
  return {
    ...pkg,
    identityArtwork: undefined,
    vehicleLivery: {
      ...pkg.vehicleLivery,
      sourceCoverDataUrl: undefined,
      doorGraphicDataUrl: undefined,
      hoodGraphicDataUrl: undefined,
      rearGraphicDataUrl: undefined,
      sideStripeDataUrl: undefined,
    },
  };
}

export async function saveMissionAsync(state: MissionState): Promise<boolean> {
  try {
    if (!state.snapshot) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    }
    const ref = state.snapshot.coverAssetRef ?? await putCoverAsset(state.snapshot.coverImage);
    const persisted = {
      ...state,
      snapshot: {
        ...state.snapshot,
        coverImage: undefined,
        coverAssetRef: ref,
        disguisePackage: missionPackageEnvelope(state.snapshot.disguisePackage),
        vehicleLivery: undefined,
      },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    return true;
  } catch (err) {
    console.warn("[crewmark] Durable mission save failed; mission is session-only.", err);
    return false;
  }
}

export async function loadMissionAsync(): Promise<MissionState | null> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const snapshot = parsed.snapshot as Record<string, unknown> | null;
    const ref = snapshot?.coverAssetRef as CoverAssetRef | undefined;
    if (!ref) {
      const legacy = sanitize(parsed);
      if (!legacy?.snapshot?.coverImage) return legacy;
      const migratedRef = await putCoverAsset(legacy.snapshot.coverImage);
      const migrated = { ...legacy, snapshot: { ...legacy.snapshot, coverAssetRef: migratedRef } };
      await saveMissionAsync(migrated);
      return migrated;
    }
    const image = await getCoverAsset(ref);
    if (!image) return null;
    const storedPkg = snapshot?.disguisePackage as Record<string, unknown> | undefined;
    let pkg: DisguisePackage | undefined;
    if (storedPkg) {
      const slot = storedPkg.slot === "COVER//02" ? "COVER//02" : "COVER//01";
      const created = createDisguisePackage(image, typeof storedPkg.templateId === "string" ? storedPkg.templateId as never : null, (storedPkg.identityMetadata as { frontId?: never } | undefined)?.frontId, storedPkg.customization as never, slot);
      pkg = { ...created, id: typeof storedPkg.id === "string" ? storedPkg.id : created.id, createdAt: typeof storedPkg.createdAt === "string" ? storedPkg.createdAt : created.createdAt };
    }
    return sanitize({
      ...parsed,
      snapshot: {
        ...snapshot,
        coverImage: image,
        disguisePackage: pkg,
        vehicleLivery: pkg?.vehicleLivery,
      },
    });
  } catch (err) {
    console.warn("[crewmark] Durable mission load failed; treating as no mission.", err);
    return null;
  }
}
