import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoverAnalysis } from "./coverAnalysis";
import { clearCoverAssets } from "./coverAssetStore";
import { loadCoverRecordAsync, saveCoverRecordAsync } from "./coverStorage";
import { createDisguisePackage } from "./disguisePackage";
import { loadMissionAsync, saveMissionAsync } from "./missionStorage";
import { loadRunReceiptAsync, saveRunReceiptAsync } from "./runReceipt";
import { startMissionState } from "../world/mission";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, String(value)),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
  };
}

const image = "data:image/png;base64,Q292ZXI=";
const analysis = { score: 91, blank: false, checks: [], width: 1600, height: 700 } as unknown as CoverAnalysis;

beforeEach(async () => {
  vi.stubGlobal("window", { localStorage: storage(), sessionStorage: storage() });
  await clearCoverAssets();
});

describe("ref-based cover persistence", () => {
  it("stores one asset and keeps cover, mission, and receipt payloads free of pixels", async () => {
    const pkg = createDisguisePackage(image, null, undefined, undefined, "COVER//01");
    expect(await saveCoverRecordAsync(image, analysis, "2026-01-01T00:00:00.000Z", pkg)).toBe(true);
    const cover = await loadCoverRecordAsync();
    expect(cover?.image).toBe(image);
    expect(window.localStorage.getItem("crewmark:r:cover01")).not.toContain("data:image/");
    expect(window.localStorage.getItem("crewmark:r:package01")).not.toContain("data:image/");

    const mission = startMissionState(cover!, cover!.disguisePackage);
    expect(await saveMissionAsync(mission)).toBe(true);
    expect(window.localStorage.getItem("crewmark:r:job01mission")).not.toContain("data:image/");
    expect((await loadMissionAsync())?.snapshot?.coverImage).toBe(image);

    const receipt = {
      receiptId: "RCT//TEST",
      runId: "run-test",
      front: { frontId: "dock", label: "DOCK", resolvedFrontId: "dock", selectedAt: "2026-01-01" } as never,
      coverVersion: "COVER//01" as const,
      coverDataUrl: image,
      cover01DataUrl: null,
      metrics: null,
      checkpoint: "clean" as const,
      signatureDistance: null,
      heat: 0,
      missionStartedAt: "2026-01-01",
      missionCompletedAt: "2026-01-01",
      receiptsReviewedAt: "2026-01-01",
      completedAt: "2026-01-01",
      shareText: "test",
    };
    expect(await saveRunReceiptAsync(receipt)).toBe(true);
    expect(window.localStorage.getItem("crewmark:p6:runReceipt")).not.toContain("data:image/");
    expect((await loadRunReceiptAsync())?.coverDataUrl).toBe(image);
  });
});
