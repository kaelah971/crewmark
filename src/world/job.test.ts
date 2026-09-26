import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearJob01Accepted,
  JOB_01_STORAGE_KEY,
  loadJob01Accepted,
  saveJob01Accepted,
} from "../lib/jobStorage";
import {
  JOB_01,
  exitGateReport,
  jobObjective,
  printShopReport,
  vehicleReport,
} from "../world/jobs";
import { JOB_YARD_BOUNDS, JOB_YARD_HOTSPOTS } from "../world/jobYard";
import { clampToBounds, inRange } from "../world/movement";
import { resolveCanonicalResumeStage, resolveResumeTarget } from "../lib/resume";

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
  vi.stubGlobal("window", { localStorage: memoryLocalStorage() });
  vi.restoreAllMocks();
});

describe("jobStorage (JOB//01 acceptance flag)", () => {
  it("defaults to unaccepted so old saves are untouched", () => {
    expect(loadJob01Accepted()).toBe(false);
  });

  it("round-trips acceptance (refresh path)", () => {
    saveJob01Accepted();
    expect(loadJob01Accepted()).toBe(true);
  });

  it("clears on reset without touching other keys", () => {
    window.localStorage.setItem("crewmark:p0:markV1", "data:image/png;base64,VjE=");
    saveJob01Accepted();
    clearJob01Accepted();
    expect(loadJob01Accepted()).toBe(false);
    expect(window.localStorage.getItem("crewmark:p0:markV1")).toBe("data:image/png;base64,VjE=");
  });

  it("uses its own storage key", () => {
    expect(JOB_01_STORAGE_KEY).toBe("crewmark:r:job01accepted");
  });
});

describe("JOB//01 brief (deterministic mission data)", () => {
  it("carries the full work order", () => {
    expect(JOB_01.id).toBe("JOB//01");
    expect(JOB_01.title).toBe("PORT VICE // NIGHT DELIVERY");
    expect(JOB_01.client).toBe("UNKNOWN");
    expect(JOB_01.target).toBe("PORT VICE SERVICE GATE");
    expect(JOB_01.window).toBe("01:20–02:00");
    expect(JOB_01.objective).toBe("GET THE VEHICLE THROUGH THE SERVICE GATE.");
    expect(JOB_01.warning).toContain("THE GATE DOESN'T KNOW WHO YOU ARE.");
  });

  it("specifies the contractor cover requirements", () => {
    const joined = JOB_01.requirements.join(" ").toLowerCase();
    expect(JOB_01.requirements.length).toBeGreaterThanOrEqual(4);
    expect(joined).toContain("orange");
    expect(joined).toContain("service number");
    expect(joined).toContain("weathered");
  });
});

describe("hub gate messaging (no cover output exists yet)", () => {
  it("vehicle honestly reports no active cover", () => {
    const report = vehicleReport();
    expect(report.line).toBe("VEHICLE // NO ACTIVE COVER");
  });

  it("print shop gates on acceptance", () => {
    expect(printShopReport(false).line).toBe("NO ACTIVE WORK ORDER");
    expect(printShopReport(true).line).toBe("COVER//01 // WORK ORDER READY");
  });

  it("exit gate always blocks departure in this slice", () => {
    expect(exitGateReport().line).toBe("JOB PREP INCOMPLETE");
  });

  it("objective flips on acceptance", () => {
    expect(jobObjective(false)).toBe("JOB//01 — CHECK THE JOB BOARD");
    expect(jobObjective(true)).toBe("JOB//01 — ENTER THE PRINT SHOP");
  });
});

describe("job-yard tuning on the dedicated plate", () => {
  it("every hotspot center sits inside walk bounds (reachable)", () => {
    for (const hotspot of JOB_YARD_HOTSPOTS) {
      const clamped = clampToBounds(hotspot.at, JOB_YARD_BOUNDS);
      expect(clamped).toEqual(hotspot.at);
      expect(inRange(clamped, hotspot)).toBe(true);
    }
  });

  it("defines the four required hotspots including the exit gate", () => {
    const ids = JOB_YARD_HOTSPOTS.map((h) => h.id).sort();
    expect(ids).toEqual(["exit-gate", "job-terminal", "print-shop", "vehicle"]);
    expect(JOB_YARD_HOTSPOTS.find((h) => h.id === "exit-gate")?.isExit).toBe(true);
  });
});

describe("legacy resume untouched", () => {
  it("mark-only sessions still target the cinematic board", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: false,
      }),
    ).toBe("identity-reveal");
  });

  it("claimed sessions still target district select", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: true,
      }),
    ).toBe("district-select");
  });
});

describe("P5 canonical resume containment", () => {
  it("routes active mission to 'mission'", () => {
    expect(resolveCanonicalResumeStage("mission")).toBe("mission");
  });

  it("routes all legacy and intermediate targets to 'job-yard'", () => {
    expect(resolveCanonicalResumeStage("identity-reveal")).toBe("job-yard");
    expect(resolveCanonicalResumeStage("district-select")).toBe("job-yard");
    expect(resolveCanonicalResumeStage("surveillance")).toBe("job-yard");
    expect(resolveCanonicalResumeStage("mark-evolution")).toBe("job-yard");
    expect(resolveCanonicalResumeStage("mark-v2-reveal")).toBe("job-yard");
    expect(resolveCanonicalResumeStage("job-yard")).toBe("job-yard");
  });
});
