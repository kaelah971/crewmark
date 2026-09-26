import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMark,
  clearMarkV2,
  loadMark,
  loadMarkV2,
  saveMark,
  saveMarkV2,
  STORAGE_KEY,
  STORAGE_KEY_V2,
} from "./markStorage";
import { isOutputDataUrl } from "./markOutput";
import { resolveResumeTarget } from "./resume";

const V1 = "data:image/png;base64,VjE=";
const V2 = "data:image/png;base64,VjI=";

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

describe("markStorage V1 slot (backward compatibility)", () => {
  it("round-trips MARK//001 exactly", () => {
    expect(saveMark(V1)).toBe(true);
    expect(loadMark()).toBe(V1);
  });

  it("returns null when nothing valid is stored", () => {
    expect(loadMark()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, "not-an-image");
    expect(loadMark()).toBeNull();
  });

  it("clears only its own slot", () => {
    saveMark(V1);
    saveMarkV2(V2);
    clearMark();
    expect(loadMark()).toBeNull();
    expect(loadMarkV2()).toBe(V2);
  });
});

describe("markStorage V2 slot (P4A)", () => {
  it("uses a storage key independent of the V1 slot", () => {
    expect(STORAGE_KEY_V2).not.toBe(STORAGE_KEY);
  });

  it("persists MARK//002 and restores it (refresh path)", () => {
    expect(saveMarkV2(V2)).toBe(true);
    expect(loadMarkV2()).toBe(V2);
  });

  it("returns null for older sessions without MARK//002", () => {
    saveMark(V1);
    expect(loadMarkV2()).toBeNull();
  });

  it("saving MARK//002 leaves MARK//001 byte-identical", () => {
    saveMark(V1);
    const before = loadMark();
    saveMarkV2(V2);
    saveMarkV2("data:image/png;base64,VjItdGFrZQ==");
    expect(loadMark()).toBe(before);
    expect(loadMark()).toBe(V1);
  });

  it("clears only its own slot", () => {
    saveMark(V1);
    saveMarkV2(V2);
    clearMarkV2();
    expect(loadMarkV2()).toBeNull();
    expect(loadMark()).toBe(V1);
  });
});

describe("isOutputDataUrl (lock-action validator)", () => {
  it("accepts genuine editor output", () => {
    expect(isOutputDataUrl("data:image/png;base64,AAA")).toBe(true);
    expect(isOutputDataUrl(V2)).toBe(true);
  });

  it("rejects empty/invalid output so invalid saves never advance", () => {
    expect(isOutputDataUrl(null)).toBe(false);
    expect(isOutputDataUrl(undefined)).toBe(false);
    expect(isOutputDataUrl("")).toBe(false);
    expect(isOutputDataUrl("data:text/plain,hello")).toBe(false);
    expect(isOutputDataUrl(42)).toBe(false);
  });
});

describe("resolveResumeTarget (story-aware resume)", () => {
  it("resumes to the MARK//002 reveal when V2 exists", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: true,
        surveillanceTriggered: true,
        identityTheftTriggered: true,
        hasClaims: true,
      }),
    ).toBe("mark-v2-reveal");
  });

  it("resumes into mark-evolution when P4 was reached but V2 is missing", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: true,
        identityTheftTriggered: true,
        hasClaims: true,
      }),
    ).toBe("mark-evolution");
  });

  it("keeps older P2.3 checkpoints unchanged", () => {
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: true,
        identityTheftTriggered: false,
        hasClaims: true,
      }),
    ).toBe("surveillance");
    expect(
      resolveResumeTarget({
        hasMarkV1: true,
        hasMarkV2: false,
        surveillanceTriggered: false,
        identityTheftTriggered: false,
        hasClaims: true,
      }),
    ).toBe("district-select");
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
});
