import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BURN_HEAT_CONSEQUENCE,
  confidenceForCamera,
  generateReceipts,
  shouldPayBurnHeat,
  withBurnHeatPaid,
  withReceiptsReviewed,
  type CameraReceipt,
} from "./receipts";
import {
  clearReceiptState,
  loadReceiptState,
  saveReceiptState,
} from "../lib/receiptStorage";
import type { CoverAnalysis } from "../lib/coverAnalysis";
import type { MissionSnapshot } from "./mission";
import { createDisguisePackage } from "../lib/disguisePackage";
import { jobObjective, vehicleReport, printShopReport, exitGateReport } from "./jobs";

function fakeAnalysis(score: number = 82): CoverAnalysis {
  return {
    version: 1,
    width: 400,
    height: 175,
    coverage: 0.45,
    orangeRatio: 0.28,
    orangeLowerRatio: 0.72,
    contrast: 0.65,
    colors: 18,
    blank: false,
    score,
    checks: [
      { id: "identity", label: "Identity signal", status: "PASS", detail: "Contractor identity confirmed" },
      { id: "orange", label: "Orange profile", status: "PASS", detail: "Perimeter stripe confirmed" },
      { id: "detail", label: "Service detail", status: "PASS", detail: "Fleet code confirmed" },
      { id: "weathering", label: "Surface age", status: "PASS", detail: "Surface finish pattern confirmed" },
    ],
  };
}

function fakeSnapshot(
  score: number = 82,
  coverImage: string = "data:image/png;base64,bWlzc2lvbkNvdmVy",
  vehicleLivery?: MissionSnapshot["vehicleLivery"],
): MissionSnapshot {
  return {
    coverImage,
    coverLockedAt: "2026-09-23T01:30:00.000Z",
    analysis: fakeAnalysis(score),
    score,
    startedAt: "2026-09-23T01:35:00.000Z",
    vehicleLivery,
  };
}

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
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryLocalStorage() });
});

describe("P3.5A-R.4 camera receipts model", () => {
  it("generates exactly three stable receipts with CAM//01, CAM//02, CAM//03", () => {
    const snap = fakeSnapshot(82);
    const receipts = generateReceipts(snap, "clean");
    expect(receipts).toHaveLength(3);
    expect(receipts.map((r: CameraReceipt) => r.id)).toEqual(["CAM//01", "CAM//02", "CAM//03"]);
  });

  it("receipts use mission snapshot cover and are immutable against later cover edits", () => {
    const snap = fakeSnapshot(82, "data:image/png;base64,T3JpZ2luYWxNaXNzaW9uQ292ZXI=");
    const receipts = generateReceipts(snap, "clean");

    // All receipts must contain the historical mission cover image
    expect(receipts[0].coverImage).toBe("data:image/png;base64,T3JpZ2luYWxNaXNzaW9uQ292ZXI=");
    expect(receipts[1].coverImage).toBe("data:image/png;base64,T3JpZ2luYWxNaXNzaW9uQ292ZXI=");
    expect(receipts[2].coverImage).toBe("data:image/png;base64,T3JpZ2luYWxNaXNzaW9uQ292ZXI=");

    // Simulate player editing COVER//01 in Forgery Bay afterwards:
    const editedCover = "data:image/png;base64,TmV3RWRpdGVkQ292ZXI=";
    window.localStorage.setItem("crewmark:r:cover01", editedCover);

    // Receipts generated from the mission snapshot are untouched
    expect(receipts[0].coverImage).toBe(snap.coverImage);
    expect(receipts[0].coverImage).not.toBe(editedCover);
  });

  it("freezes the COVER//01 livery even when COVER//02 is edited later", () => {
    const cover01 = createDisguisePackage("data:image/png;base64,COVER01", "bug-out-305", undefined, undefined, "COVER//01");
    const cover02 = createDisguisePackage("data:image/png;base64,COVER02", "clearwater-pool", undefined, undefined, "COVER//02");
    const snap = fakeSnapshot(82, undefined, cover01.vehicleLivery);
    const receipts = generateReceipts(snap, "clean");

    expect(receipts[0].vehicleLivery).toEqual(cover01.vehicleLivery);
    expect(receipts[0].vehicleLivery).not.toEqual(cover02.vehicleLivery);
    expect(receipts[1].vehicleLivery?.templateId).toBe("bug-out-305");
  });

  it("is completely deterministic: same mission state produces identical receipt outputs", () => {
    const snap = fakeSnapshot(82);
    const r1 = generateReceipts(snap, "secondary");
    const r2 = generateReceipts(snap, "secondary");
    expect(r1).toEqual(r2);
  });

  it("confidence correlates to checkpoint outcome (clean < secondary < manual)", () => {
    const confClean = confidenceForCamera("CAM//01", "clean", 82);
    const confSecondary = confidenceForCamera("CAM//01", "secondary", 82);
    const confManual = confidenceForCamera("CAM//01", "manual", 82);

    expect(confClean).toBeLessThan(confSecondary);
    expect(confSecondary).toBeLessThan(confManual);
    expect(confClean).toBeGreaterThanOrEqual(70);
    expect(confManual).toBeGreaterThanOrEqual(90);
  });

  it("confidence decreases realistically across camera distances (gate > yard > causeway)", () => {
    const gate = confidenceForCamera("CAM//01", "secondary", 82);
    const yard = confidenceForCamera("CAM//02", "secondary", 82);
    const causeway = confidenceForCamera("CAM//03", "secondary", 82);

    expect(gate).toBeGreaterThan(yard);
    expect(yard).toBeGreaterThan(causeway);
  });
});

describe("burn state persistence and idempotency", () => {
  it("persists cameraReceiptsSeen and cover01Burned flags", () => {
    const fresh = loadReceiptState();
    expect(fresh.cameraReceiptsSeen).toBe(false);
    expect(fresh.cover01Burned).toBe(false);
    expect(fresh.burnHeatPaid).toBe(false);

    const reviewed = withReceiptsReviewed(fresh, "2026-09-23T02:00:00.000Z");
    expect(saveReceiptState(reviewed)).toBe(true);

    const reloaded = loadReceiptState();
    expect(reloaded.cameraReceiptsSeen).toBe(true);
    expect(reloaded.cover01Burned).toBe(true);
    expect(reloaded.burnedAt).toBe("2026-09-23T02:00:00.000Z");
  });

  it("HEAT consequence (+10) applies once and cannot double-credit on reopen/refresh", () => {
    expect(BURN_HEAT_CONSEQUENCE).toBe(10);

    let state = withReceiptsReviewed(loadReceiptState());
    expect(shouldPayBurnHeat(state)).toBe(true);

    // Pay heat
    state = withBurnHeatPaid(state);
    expect(shouldPayBurnHeat(state)).toBe(false);

    // Persist and reload
    saveReceiptState(state);
    const reloaded = loadReceiptState();
    expect(shouldPayBurnHeat(reloaded)).toBe(false);

    // Reviewing again or reopening terminal changes nothing
    const reviewedAgain = withReceiptsReviewed(reloaded);
    expect(shouldPayBurnHeat(reviewedAgain)).toBe(false);
  });

  it("clearReceiptState resets receipt and burn flags cleanly", () => {
    saveReceiptState({
      cameraReceiptsSeen: true,
      cover01Burned: true,
      burnHeatPaid: true,
      burnedAt: "2026-09-23T02:00:00.000Z",
    });

    clearReceiptState();
    const loaded = loadReceiptState();
    expect(loaded.cameraReceiptsSeen).toBe(false);
    expect(loaded.cover01Burned).toBe(false);
    expect(loaded.burnHeatPaid).toBe(false);
  });

  it("legacy saves with missing or corrupt receipt slot load default empty state without crashing", () => {
    window.localStorage.setItem("crewmark:r:job01receipts", "corrupt-json{{{");
    const loaded = loadReceiptState();
    expect(loaded.cameraReceiptsSeen).toBe(false);
    expect(loaded.cover01Burned).toBe(false);
  });
});

describe("hub report and objective transitions", () => {
  it("reports CHECK THE TERMINAL when completed before receipts are reviewed", () => {
    const obj = jobObjective(true, true, false, false);
    expect(obj).toBe("VICE COUNTY WATCH ALERT — CHECK THE TERMINAL");
  });

  it("reports ROTATE COVER when cover01 is burned", () => {
    const obj = jobObjective(true, true, true, true);
    expect(obj).toBe("COVER//01 BURNED — ROTATE COVER");
  });

  it("vehicle inspect reports COVER//01 BURNED", () => {
    const report = vehicleReport(82, true);
    expect(report.title).toBe("Vehicle");
    expect(report.line).toBe("VEHICLE // COVER//01 BURNED");
  });

  it("print shop reports ROTATE COVER when burned", () => {
    const report = printShopReport(true, true);
    expect(report.title).toBe("Print shop");
    expect(report.line).toBe("COVER//02 // NEW WORK ORDER REQUIRED");
  });

  it("exit gate blocks departure when cover is burned", () => {
    const report = exitGateReport(true, true, true);
    expect(report.title).toBe("Exit gate");
    expect(report.line).toBe("GATE // COVER BURNED — ACCESS REVOKED");
  });
});
