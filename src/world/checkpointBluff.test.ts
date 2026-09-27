import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BLUFF_CHECK_COUNT,
  applyBluffResponse,
  activateCheckpointBluff,
  branchForBluffOutcome,
  createCheckpointBluffState,
  deriveInitialBelief,
  evidenceChoices,
  resolveBluffOutcome,
  selectCheckpointQuestions,
  type CheckpointBluffState,
} from "./checkpointBluff";
import {
  MISSION_REP_REWARD,
  resumeMissionPhase,
  shouldPayCheckpointHeat,
  shouldPayCompletion,
  withCheckpoint,
  withCheckpointHeatPaid,
  withCompleted,
  withRepPaid,
  type MissionState,
} from "./mission";
import {
  EMPTY_RECEIPT_STATE,
  generateReceipts,
  shouldPayBurnHeat,
  withBurnHeatPaid,
  withReceiptsReviewed,
} from "./receipts";
import { loadMission, saveMission } from "../lib/missionStorage";
import type { CoverAnalysis } from "../lib/coverAnalysis";

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
  };
}

const analysis: CoverAnalysis = {
  version: 1,
  width: 1600,
  height: 700,
  coverage: 0.3,
  orangeRatio: 0.1,
  orangeLowerRatio: 0.1,
  contrast: 0.3,
  colors: 20,
  blank: false,
  score: 82,
  checks: [
    { id: "identity", label: "Identity signal", status: "PASS", detail: "" },
    { id: "orange", label: "Orange profile", status: "PASS", detail: "" },
    { id: "detail", label: "Service detail", status: "PASS", detail: "" },
    { id: "weathering", label: "Weathering", status: "LOW", detail: "" },
  ],
};

function started(bluff?: CheckpointBluffState): MissionState {
  return {
    started: true,
    missionRunId: "mission-bluff-test",
    status: "active",
    snapshot: {
      coverImage: "data:image/png;base64,Q292ZXI=",
      coverLockedAt: "2026-01-01T00:00:00.000Z",
      analysis,
      score: analysis.score,
    },
    checkpoint: null,
    checkpointHeatPaid: false,
    checkpointBluff: bluff,
    completed: false,
    repPaid: false,
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryLocalStorage() });
  vi.restoreAllMocks();
});

describe("checkpoint bluff deterministic core", () => {
  it("selects the same three questions for the same missionRunId", () => {
    const first = selectCheckpointQuestions("mission-coral");
    const second = selectCheckpointQuestions("mission-coral");
    expect(first).toEqual(second);
    expect(first).toHaveLength(BLUFF_CHECK_COUNT);
    expect(new Set(first).size).toBe(BLUFF_CHECK_COUNT);
    expect(selectCheckpointQuestions("mission-bug-out")).toHaveLength(BLUFF_CHECK_COUNT);
  });

  it("derives and clamps initial belief from readiness and attention", () => {
    expect(deriveInitialBelief(100, "LOW")).toBe(65);
    expect(deriveInitialBelief(100, "BALANCED")).toBe(60);
    expect(deriveInitialBelief(100, "HIGH")).toBe(53);
    expect(deriveInitialBelief(0, "HIGH")).toBe(25);
  });

  it("scores correct, plausible, wrong, and timeout responses", () => {
    const question = createCheckpointBluffState("mission-score", 100, "LOW");
    let state = activateCheckpointBluff(question);
    state = applyBluffResponse(state, "correct");
    expect(state.belief).toBe(83);
    state = applyBluffResponse(state, "plausible");
    expect(state.belief).toBe(73);
    state = applyBluffResponse(state, "wrong");
    expect(state.belief).toBe(55);
    expect(state.status).toBe("resolving");
    expect(state.outcome).toBe("secondary-review");
  });

  it("applies timeout as a real response and resolves the final outcome once", () => {
    let state = activateCheckpointBluff(createCheckpointBluffState("mission-timeout", 45, "HIGH"));
    state = applyBluffResponse(state, "timeout");
    state = applyBluffResponse(state, "timeout");
    state = applyBluffResponse(state, "timeout");
    expect(state.responses).toEqual(["timeout", "timeout", "timeout"]);
    expect(state.belief).toBe(0);
    expect(state.outcome).toBe("busted");
    expect(branchForBluffOutcome(state.outcome!)).toBe("manual");
    expect(applyBluffResponse(state, "correct")).toBe(state);
    expect(resolveBluffOutcome(70)).toBe("clean-pass");
    expect(resolveBluffOutcome(45)).toBe("secondary-review");
  });

  it("keeps the three evidence choices tied to each real question", () => {
    expect(evidenceChoices("company")).toEqual(["vehicle", "pass", "crate"]);
    expect(evidenceChoices("authorization")).toEqual(["pass", "jacket", "vehicle"]);
    expect(evidenceChoices("cargo")).toEqual(["crate", "vehicle", "jacket"]);
    expect(evidenceChoices("company-id")).toEqual(["jacket", "pass", "crate"]);
  });
});

describe("checkpoint bluff lifecycle guards", () => {
  it("persists the active question and resumes without rerolling", () => {
    let bluff = activateCheckpointBluff(createCheckpointBluffState("mission-resume", 80, "BALANCED"));
    bluff = applyBluffResponse(bluff, "plausible");
    const aborted = { ...started(bluff), status: "aborted" as const };
    expect(saveMission(aborted)).toBe(true);
    const restored = loadMission();
    expect(restored?.missionRunId).toBe("mission-bluff-test");
    expect(restored?.checkpointBluff).toEqual(bluff);
    expect(resumeMissionPhase(restored)).toBe("bluff");
  });

  it("pays checkpoint heat, completion rep, and CCTV burn only once", () => {
    let state = started(activateCheckpointBluff(createCheckpointBluffState("mission-once", 100, "LOW")));
    state = withCheckpoint(state, "clean");
    expect(shouldPayCheckpointHeat(state)).toBe(true);
    state = withCheckpointHeatPaid(state);
    expect(shouldPayCheckpointHeat(withCheckpoint(state, "manual"))).toBe(false);

    state = withCompleted(state);
    expect(shouldPayCompletion(state)).toBe(true);
    state = withRepPaid(state);
    expect(shouldPayCompletion(withCompleted(state))).toBe(false);
    expect(MISSION_REP_REWARD).toBe(25);

    const receipts = generateReceipts(state.snapshot!, state.checkpoint);
    expect(receipts).toHaveLength(3);
    const reviewed = withReceiptsReviewed(EMPTY_RECEIPT_STATE, "first");
    expect(withReceiptsReviewed(reviewed, "second").burnedAt).toBe("first");
    expect(shouldPayBurnHeat(reviewed)).toBe(true);
    expect(shouldPayBurnHeat(withBurnHeatPaid(reviewed))).toBe(false);
  });
});
