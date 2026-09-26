import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCoverAssets,
  deleteCoverAsset,
  getCoverAsset,
  getCoverAssetStats,
  hasCoverAsset,
  putCoverAsset,
  type CoverAssetRef,
} from "./coverAssetStore";

const FIRST_DATA_URL = "data:image/png;base64,AAEC";
const SECOND_DATA_URL = "data:image/png;base64,AwQF";

async function expectEmptyStore(): Promise<void> {
  await clearCoverAssets();
  await expect(getCoverAssetStats()).resolves.toEqual({ count: 0, bytes: 0 });
}

describe("cover asset store", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expectEmptyStore();
  });

  it("deduplicates equivalent data URLs and Blobs by content", async () => {
    const dataUrlRef = await putCoverAsset(FIRST_DATA_URL);
    const blobRef = await putCoverAsset(new Blob([new Uint8Array([0, 1, 2])], { type: "image/png" }));

    expect(blobRef).toEqual(dataUrlRef);
    expect(blobRef.mimeType).toBe("image/png");
    expect(blobRef.bytes).toBe(3);
    await expect(getCoverAssetStats()).resolves.toEqual({ count: 1, bytes: 3 });
    await expect(getCoverAsset(blobRef)).resolves.toBe(FIRST_DATA_URL);
    await expect(hasCoverAsset(dataUrlRef)).resolves.toBe(true);
  });

  it("creates distinct refs for distinct content and tracks byte totals", async () => {
    const first = await putCoverAsset(FIRST_DATA_URL);
    const second = await putCoverAsset(SECOND_DATA_URL);

    expect(second.id).not.toBe(first.id);
    expect(second.mimeType).toBe(first.mimeType);
    await expect(getCoverAssetStats()).resolves.toEqual({ count: 2, bytes: 6 });
    await expect(getCoverAsset(second)).resolves.toBe(SECOND_DATA_URL);
  });

  it("handles missing and repeated deletes without throwing", async () => {
    const missing: CoverAssetRef = { id: "cover-v1-missing", mimeType: "image/png" };

    await expect(getCoverAsset(missing)).resolves.toBeNull();
    await expect(hasCoverAsset(missing)).resolves.toBe(false);
    await expect(deleteCoverAsset(missing)).resolves.toBeUndefined();
    await expect(hasCoverAsset(missing)).resolves.toBe(false);
  });

  it("clears stored assets and reports reset stats", async () => {
    const first = await putCoverAsset(FIRST_DATA_URL);
    await putCoverAsset(SECOND_DATA_URL);
    await expect(getCoverAssetStats()).resolves.toEqual({ count: 2, bytes: 6 });

    await clearCoverAssets();

    await expect(getCoverAssetStats()).resolves.toEqual({ count: 0, bytes: 0 });
    await expect(getCoverAsset(first)).resolves.toBeNull();
    await expect(hasCoverAsset(first)).resolves.toBe(false);
  });

  it("rejects malformed input without leaving partial state", async () => {
    await expect(putCoverAsset("not-a-data-url")).rejects.toThrow(/data URL or Blob/);
    await expect(putCoverAsset("data:image/png;base64,%%%"))
      .rejects.toThrow(/invalid base64/);
    await expect(getCoverAsset({ id: "", mimeType: "image/png" })).resolves.toBeNull();
    await expect(hasCoverAsset({ id: "", mimeType: "image/png" })).resolves.toBe(false);
    await expect(getCoverAssetStats()).resolves.toEqual({ count: 0, bytes: 0 });
  });

  it("keeps state unchanged when Blob reads fail", async () => {
    const brokenBlob = {
      type: "image/png",
      arrayBuffer: vi.fn().mockRejectedValue(new Error("read failed")),
    } as unknown as Blob;

    await expect(putCoverAsset(brokenBlob)).rejects.toThrow("read failed");
    await expect(getCoverAssetStats()).resolves.toEqual({ count: 0, bytes: 0 });
  });
});
