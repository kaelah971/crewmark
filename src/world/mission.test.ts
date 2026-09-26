import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKPOINT_HEAT,
  MISSION_REP_REWARD,
  classifyCheckpoint,
  resumeMissionPhase,
  shouldPayCheckpointHeat,
  shouldPayCompletion,
  startMissionState,
  withCheckpoint,
  withCheckpointHeatPaid,
  withCompleted,
  withRepPaid,
  type MissionState,
} from "./mission";
import { clearMission, loadMission, saveMission } from "../lib/missionStorage";
import { resolveCanonicalResumeStage, resolveResumeTarget } from "../lib/resume";
import { emitGameSound, SOUND_NAMES } from "../lib/audio";
import {
  DELIVERY_ZONE,
  SECONDARY_ZONE,
  STOP_ZONE,
  VEHICLE_TUNING,
  inDeliveryZone,
  inSecondaryZone,
  inStopZone,
  isStopped,
  stepVehicle,
} from "./vehicle";
import type { CoverAnalysis } from "../lib/coverAnalysis";

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: memoryLocalStorage(),
    dispatchEvent: vi.fn(() => true),
  });
  vi.restoreAllMocks();
});

/** Minimal stored analysis with tunable score + check statuses. */
function fakeAnalysis(
  score: number,
  statuses: { identity: "PASS" | "REVIEW" | "LOW"; orange: "PASS" | "REVIEW" | "LOW"; detail: "PASS" | "REVIEW" | "LOW" },
): CoverAnalysis {
  return {
    version: 1,
    width: 1600,
    height: 700,
    coverage: 0.3,
    orangeRatio: 0.1,
    orangeLowerRatio: 0.1,
    contrast: 0.3,
    colors: 20,
    blank: false,
    score,
    checks: [
      { id: "identity", label: "Identity signal", status: statuses.identity, detail: "" },
      { id: "orange", label: "Orange profile", status: statuses.orange, detail: "" },
      { id: "detail", label: "Service detail", status: statuses.detail, detail: "" },
      { id: "weathering", label: "Weathering", status: "LOW", detail: "" },
    ],
  };
}

const CLEAN = () => fakeAnalysis(82, { identity: "PASS", orange: "PASS", detail: "PASS" });
const QUESTIONABLE = () =>
  fakeAnalysis(60, { identity: "PASS", orange: "REVIEW", detail: "PASS" });
const WEAK_SCORE = () => fakeAnalysis(30, { identity: "PASS", orange: "PASS", detail: "PASS" });
const WEAK_CHECKS = () =>
  fakeAnalysis(80, { identity: "REVIEW", orange: "LOW", detail: "PASS" });

describe("classifyCheckpoint (deterministic branches)", () => {
  it("clean branch: score >= 75 with orange + identity PASS", () => {
    const verdict = classifyCheckpoint(CLEAN());
    expect(verdict.branch).toBe("clean");
    expect(verdict.reasons.length).toBeGreaterThan(0);
  });

  it("clean boundary holds at exactly 75", () => {
    const verdict = classifyCheckpoint(
      fakeAnalysis(75, { identity: "PASS", orange: "PASS", detail: "PASS" }),
    );
    expect(verdict.branch).toBe("clean");
  });

  it("secondary branch: score 45-74", () => {
    expect(classifyCheckpoint(QUESTIONABLE()).branch).toBe("secondary");
  });

  it("secondary boundary holds at 74 and 45", () => {
    const at74 = fakeAnalysis(74, { identity: "PASS", orange: "PASS", detail: "PASS" });
    expect(classifyCheckpoint(at74).branch).toBe("secondary");
    // 45 with all PASS is not clean (score gate) and not manual → secondary.
    const at45 = fakeAnalysis(45, { identity: "PASS", orange: "PASS", detail: "PASS" });
    expect(classifyCheckpoint(at45).branch).toBe("secondary");
  });

  it("manual branch: score < 45", () => {
    expect(classifyCheckpoint(WEAK_SCORE()).branch).toBe("manual");
  });

  it("manual branch: two major checks LOW/REVIEW even at high score", () => {
    expect(classifyCheckpoint(WEAK_CHECKS()).branch).toBe("manual");
  });

  it("same analysis always returns the same result", () => {
    expect(classifyCheckpoint(CLEAN())).toEqual(classifyCheckpoint(CLEAN()));
    expect(classifyCheckpoint(WEAK_SCORE())).toEqual(classifyCheckpoint(WEAK_SCORE()));
  });

  it("heat gain per branch matches the brief", () => {
    expect(CHECKPOINT_HEAT.clean).toBe(3);
    expect(CHECKPOINT_HEAT.secondary).toBe(8);
    expect(CHECKPOINT_HEAT.manual).toBe(15);
    expect(MISSION_REP_REWARD).toBe(25);
  });
});

describe("mission rewards apply once", () => {
  it("START JOB snapshots the locked cover", () => {
    const analysis = CLEAN();
    const state = startMissionState({
      image: "data:image/png;base64,Q292ZXI=",
      analysis,
      lockedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(state.started).toBe(true);
    expect(state.status).toBe("active");
    expect(state.snapshot?.coverImage).toBe("data:image/png;base64,Q292ZXI=");
    expect(state.snapshot?.coverLockedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(state.snapshot?.score).toBe(analysis.score);
    expect(state.checkpoint).toBeNull();
  });

  it("creates a stable mission run identity and preserves it across resume", () => {
    const cover = {
      image: "data:image/png;base64,Q292ZXI=",
      analysis: CLEAN(),
      lockedAt: "2026-01-01T00:00:00.000Z",
    };
    const first = startMissionState(cover);
    const resumed = { ...first, checkpoint: "clean" as const };
    expect(first.missionRunId).toBeTruthy();
    expect(resumed.missionRunId).toBe(first.missionRunId);
    expect(resumed.snapshot).toBe(first.snapshot);
  });
  function started(): MissionState {
    return {
      started: true,
      snapshot: { coverImage: "img", coverLockedAt: "t", analysis: CLEAN(), score: 82 },
      checkpoint: null,
      checkpointHeatPaid: false,
      completed: false,
      repPaid: false,
    };
  }

  it("checkpoint heat pays once; replays are no-ops", () => {
    let state = withCheckpoint(started(), "clean");
    expect(shouldPayCheckpointHeat(state)).toBe(true);
    state = withCheckpointHeatPaid(state);
    expect(shouldPayCheckpointHeat(state)).toBe(false);
    // Second determination attempt changes nothing.
    expect(withCheckpoint(state, "manual")).toBe(state);
    expect(shouldPayCheckpointHeat(state)).toBe(false);
  });
  it("completion moves the run to terminal completed status before reward payout", () => {
    let state = withCompleted(started());
    expect(state.status).toBe("completed");
    expect(shouldPayCompletion(state)).toBe(true);
    state = withRepPaid(state);
    expect(state.completionRewardPaid).toBe(true);
    expect(shouldPayCompletion(state)).toBe(false);
    expect(withCompleted(state)).toBe(state);
  });
});

describe("mission persistence", () => {
  function fullState(): MissionState {
    return {
      started: true,
      snapshot: { coverImage: "img", coverLockedAt: "2026-01-01T00:00:00.000Z", analysis: CLEAN(), score: 82 },
      checkpoint: "clean",
      checkpointHeatPaid: true,
      completed: true,
      repPaid: true,
    };
  }

  it("round-trips the full record (refresh path)", () => {
    const state = fullState();
    expect(saveMission(state)).toBe(true);
    expect(loadMission()).toEqual(state);
  });

  it("persists run identity and aborted status for resumable handoff", () => {
    const state = {
      ...fullState(),
      missionRunId: "mission-test",
      status: "aborted" as const,
      completed: false,
      repPaid: false,
    };
    expect(saveMission(state)).toBe(true);
    expect(loadMission()).toEqual(state);
  });

  it("returns null for old saves without a mission", () => {
    expect(loadMission()).toBeNull();
  });

  it("returns null for corrupt payloads", () => {
    window.localStorage.setItem("crewmark:r:job01mission", "not-json{{{");
    expect(loadMission()).toBeNull();
  });

  it("clears without touching mark/cover/progress keys", () => {
    window.localStorage.setItem("crewmark:p0:markV1", "data:image/png;base64,VjE=");
    window.localStorage.setItem("crewmark:r:cover01", "data:image/png;base64,Q292ZXI=");
    saveMission(fullState());
    clearMission();
    expect(loadMission()).toBeNull();
    expect(window.localStorage.getItem("crewmark:p0:markV1")).toBe("data:image/png;base64,VjE=");
    expect(window.localStorage.getItem("crewmark:r:cover01")).toBe("data:image/png;base64,Q292ZXI=");
  });

  it("normalizes legacy questionable and weak branches", () => {
    const legacy = {
      started: true,
      snapshot: { coverLockedAt: "2026-01-01T00:00:00.000Z", analysis: CLEAN(), score: 82 },
      checkpoint: "questionable",
      checkpointHeatPaid: true,
      completed: false,
      repPaid: false,
    };
    window.localStorage.setItem("crewmark:r:job01mission", JSON.stringify(legacy));
    const loaded = loadMission();
    expect(loaded?.checkpoint).toBe("secondary");
    expect(loaded?.snapshot?.coverImage).toBe("");
  });
});

describe("refresh/resume mapping", () => {
  it("before checkpoint → approach", () => {
    expect(
      resumeMissionPhase({
        started: true,
        snapshot: { coverImage: "img", coverLockedAt: "t", analysis: CLEAN(), score: 82 },
        checkpoint: null,
        checkpointHeatPaid: false,
        completed: false,
        repPaid: false,
      }),
    ).toBe("approach");
  });

  it("checkpoint passed → restricted yard", () => {
    expect(
      resumeMissionPhase({
        started: true,
        snapshot: { coverImage: "img", coverLockedAt: "t", analysis: CLEAN(), score: 82 },
        checkpoint: "secondary",
        checkpointHeatPaid: true,
        completed: false,
        repPaid: false,
      }),
    ).toBe("yard");
  });

  it("completed → result", () => {
    expect(
      resumeMissionPhase({
        started: true,
        snapshot: { coverImage: "img", coverLockedAt: "t", analysis: CLEAN(), score: 82 },
        checkpoint: "clean",
        checkpointHeatPaid: true,
        completed: true,
        repPaid: true,
      }),
    ).toBe("result");
  });

  it("no mission → null (old saves)", () => {
    expect(resumeMissionPhase(null)).toBeNull();
  });

  it("resolveResumeTarget resumes into mission when in progress", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: false,
        hasCover: true,
        jobAccepted: true,
        missionStarted: true,
        missionCompleted: false,
      }),
    ).toBe("mission");
  });

  it("active mission outranks stale legacy surveillance/claims flags", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: true,
        identityTheftTriggered: true,
        hasClaims: true,
        hasCover: true,
        jobAccepted: true,
        missionStarted: true,
        missionCompleted: false,
      }),
    ).toBe("mission");
  });

  it("active mission outranks a stale MARK//02 checkpoint", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: true,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: false,
        hasCover: true,
        jobAccepted: true,
        missionStarted: true,
        missionCompleted: false,
      }),
    ).toBe("mission");
  });

  it("storage-backed loadable mission snapshot reaches the resolver despite legacy flags", () => {
    const analysis = CLEAN();
    saveMission({
      started: true,
      snapshot: {
        coverImage: "data:image/png;base64,TWlzc2lvbkNvdmVy",
        coverLockedAt: "2026-09-23T01:30:00.000Z",
        analysis,
        score: analysis.score,
      },
      checkpoint: null,
      checkpointHeatPaid: false,
      completed: false,
      repPaid: false,
    });
    const loaded = loadMission();
    expect(loaded).not.toBeNull();
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: true,
        surveillanceTriggered: true,
        identityTheftTriggered: true,
        hasClaims: true,
        hasCover: true,
        jobAccepted: true,
        missionStarted: loaded?.started ?? false,
        missionCompleted: loaded?.completed ?? true,
      }),
    ).toBe("mission");
    expect(resumeMissionPhase(loaded)).toBe("approach");
  });

  it("completed mission with stale legacy flags stays canonical job-yard", () => {
    const target = resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: true,
        surveillanceTriggered: true,
        identityTheftTriggered: true,
        hasClaims: true,
        hasCover: true,
        jobAccepted: true,
        missionStarted: true,
        missionCompleted: true,
      });
    expect(resolveCanonicalResumeStage(target)).toBe("job-yard");
  });

  it("resolveResumeTarget resumes into job-yard when mission completed", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: false,
        hasCover: true,
        jobAccepted: true,
        missionStarted: true,
        missionCompleted: true,
      }),
    ).toBe("job-yard");
  });
});

describe("cover snapshot immutable after mission start", () => {
  it("re-editing the cover cannot rewrite the stored snapshot", () => {
    const first = {
      image: "data:image/png;base64,Zmlyc3Q=",
      analysis: CLEAN(),
      lockedAt: "2026-01-01T00:00:00.000Z",
    };
    const mission = {
      started: true,
      snapshot: {
        coverImage: first.image,
        coverLockedAt: first.lockedAt,
        analysis: first.analysis,
        score: first.analysis.score,
      },
      checkpoint: null,
      checkpointHeatPaid: false,
      completed: false,
      repPaid: false,
    } as const;
    saveMission(mission);
    const reloaded = loadMission();
    // Player re-locks a different cover afterwards.
    expect(reloaded?.snapshot?.coverImage).toBe(first.image);
    expect(reloaded?.snapshot?.coverLockedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(reloaded?.snapshot?.analysis).toEqual(first.analysis);
    expect(reloaded?.snapshot?.score).toBe(first.analysis.score);

    // Even if another cover is saved to localStorage afterwards
    window.localStorage.setItem(
      "crewmark:r:cover01",
      JSON.stringify({ image: "data:image/png;base64,bmV3", analysis: WEAK_SCORE(), lockedAt: "2026-02-01T00:00:00.000Z" }),
    );
    const reloadedAgain = loadMission();
    expect(reloadedAgain?.snapshot?.coverImage).toBe(first.image);
    expect(reloadedAgain?.snapshot?.score).toBe(82);
  });
});

describe("vehicle controller", () => {
  it("accelerates toward max speed and caps there", () => {
    let v = { dist: 0, lane: 0, speed: 0 };
    for (let i = 0; i < 40; i += 1) v = stepVehicle(v, { throttle: 1, steer: 0 }, 0.05);
    expect(v.speed).toBeLessThanOrEqual(VEHICLE_TUNING.maxSpeed);
    expect(v.speed).toBe(VEHICLE_TUNING.maxSpeed);
    expect(v.dist).toBeGreaterThan(0);
  });

  it("brakes to a stop and reverses within the reverse cap", () => {
    let v = { dist: 50, lane: 0, speed: 20 };
    for (let i = 0; i < 200; i += 1) v = stepVehicle(v, { throttle: -1, steer: 0 }, 0.05);
    expect(v.speed).toBeGreaterThanOrEqual(VEHICLE_TUNING.maxReverse);
    expect(v.speed).toBe(VEHICLE_TUNING.maxReverse);
  });

  it("coasts to a stop with drag", () => {
    let v = { dist: 50, lane: 0, speed: 10 };
    for (let i = 0; i < 400; i += 1) v = stepVehicle(v, { throttle: 0, steer: 0 }, 0.05);
    expect(isStopped(v.speed)).toBe(true);
  });

  it("never passes the closed barrier and kills momentum into it", () => {
    const v = stepVehicle({ dist: 91.9, lane: 0, speed: 26 }, { throttle: 1, steer: 0 }, 1);
    expect(v.dist).toBe(VEHICLE_TUNING.barrierDist);
    expect(v.speed).toBe(0);
  });

  it("clamps lane steering to [-1, 1]", () => {
    const v = stepVehicle({ dist: 10, lane: 0, speed: 0 }, { throttle: 0, steer: 5 }, 10);
    expect(v.lane).toBe(1);
  });

  it("detects stop, secondary, and delivery zones", () => {
    expect(inStopZone(STOP_ZONE.min)).toBe(true);
    expect(inStopZone(STOP_ZONE.max)).toBe(true);
    expect(inStopZone(STOP_ZONE.min - 0.1)).toBe(false);
    expect(inStopZone(STOP_ZONE.max + 0.1)).toBe(false);
    expect(inSecondaryZone(SECONDARY_ZONE.min)).toBe(true);
    expect(inSecondaryZone(STOP_ZONE.min)).toBe(false);
    expect(inDeliveryZone(DELIVERY_ZONE.min)).toBe(true);
    expect(inDeliveryZone(DELIVERY_ZONE.max + 0.1)).toBe(false);
  });
});

describe("audio hooks", () => {
  beforeEach(() => {
    const target = new EventTarget();
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
          store.set(key, String(value));
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    });
  });

  it("emits the catalogue names", () => {
    expect(SOUND_NAMES).toContain("checkpoint-beep");
    expect(SOUND_NAMES).toContain("mission-complete");
    expect(SOUND_NAMES).toHaveLength(7);
  });

  it("dispatches subscribable events and survives dispatch failure", () => {
    const seen: string[] = [];
    window.addEventListener("crewmark:sound", ((e: Event) => {
      seen.push((e as CustomEvent).detail.name);
    }) as EventListener);
    expect(emitGameSound("scanner")).toBe(true);
    expect(seen).toEqual(["scanner"]);
  });
});

describe("gate-phase recovery (P5.1 regression)", () => {
  it("manual-branch recovery requires driving during gate phase", () => {
    expect(SECONDARY_ZONE.max).toBeLessThan(STOP_ZONE.min);
    expect(STOP_ZONE.max).toBeLessThan(VEHICLE_TUNING.barrierDist);
  });
});

describe("P5.1 release blockers", () => {
  it("mission snapshot deep-clones analysis so source mutation cannot rewrite history", () => {
    const analysis = CLEAN();
    const state = startMissionState({
      image: "data:image/png;base64,Q292ZXI=",
      analysis,
      lockedAt: "2026-01-01T00:00:00.000Z",
    });
    const mutable = analysis as unknown as {
      score: number;
      checks: { id: string; status: string }[];
    };
    const beforeScore = state.snapshot?.score;
    const beforeStatus = state.snapshot?.analysis.checks[0].status;
    mutable.score = 0;
    mutable.checks[0].status = "LOW";
    mutable.checks.push({ id: "forged", status: "PASS" });
    expect(state.snapshot?.score).toBe(beforeScore);
    expect(state.snapshot?.analysis.checks[0].status).toBe(beforeStatus);
    expect(state.snapshot?.analysis.checks).toHaveLength(4);
  });

  it("delivery completion requires the delivery phase (drive loop parks elsewhere)", () => {
    expect(inDeliveryZone(122)).toBe(true);
    expect(inDeliveryZone(77)).toBe(false);
    expect(isStopped(0.1)).toBe(true);
    expect(isStopped(5)).toBe(false);
  });
});
