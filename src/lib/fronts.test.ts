import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHOSEN_FRONT_STORAGE_KEY,
  FRONT_OPTIONS,
  PRESET_FRONT_IDS,
  STARTER_TEMPLATE_HEIGHT,
  STARTER_TEMPLATE_WIDTH,
  chooseFront,
  clearChosenFront,
  createStarterTemplate,
  isChosenFrontRecord,
  isPresetFrontId,
  isStarterTemplateInput,
  loadChosenFront,
  resolveFrontId,
  saveChosenFront,
  type ChosenFrontRecord,
} from "./fronts";

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
  vi.unstubAllGlobals();
  vi.stubGlobal("window", { localStorage: memoryLocalStorage() });
});

/** Minimal canvas stand-in so starter painting runs under node (no DOM). */
interface StubContext {
  fillRect: { mock: { calls: unknown[][] } };
  fillText: { mock: { calls: unknown[][] } };
  fillStyle: string;
  font: string;
  textBaseline: string;
}

function stubDocumentCanvas() {
  const contexts: StubContext[] = [];
  const canvases: { width: number; height: number; toDataURL: () => string }[] = [];
  const fakeCtx = () => {
    const ctx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      fillStyle: "",
      font: "",
      textBaseline: "",
    };
    contexts.push(ctx);
    return ctx;
  };
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(`unexpected element ${tag}`);
      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => fakeCtx()),
        toDataURL: () => "data:image/png;base64,ZmFrZQ==",
      };
      canvases.push(canvas);
      return canvas;
    },
  });
  return { contexts, canvases };
}

describe("FRONT_OPTIONS catalogue", () => {
  it("defines all seven fronts with labels and copy", () => {
    expect(FRONT_OPTIONS.map((o) => o.id)).toEqual([
      "pool-service",
      "flower-delivery",
      "pest-control",
      "nightlife-supply",
      "mobile-detailing",
      "make-your-own",
      "surprise-me",
    ]);
    for (const option of FRONT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.inspiration.length).toBeGreaterThan(0);
      expect(option.personality.length).toBeGreaterThan(0);
      expect(option.visualVibe.length).toBeGreaterThan(0);
    }
  });

  it("gives presets a starter template id and withholds it from custom fronts", () => {
    for (const id of PRESET_FRONT_IDS) {
      const option = FRONT_OPTIONS.find((o) => o.id === id);
      expect(option?.starterTemplateId).toMatch(/^starter:/);
    }
    expect(FRONT_OPTIONS.find((o) => o.id === "make-your-own")?.starterTemplateId).toBeUndefined();
    expect(FRONT_OPTIONS.find((o) => o.id === "surprise-me")?.starterTemplateId).toBeUndefined();
  });

  it("lists exactly the five presets", () => {
    expect([...PRESET_FRONT_IDS]).toEqual([
      "pool-service",
      "flower-delivery",
      "pest-control",
      "nightlife-supply",
      "mobile-detailing",
    ]);
    expect(isPresetFrontId("pool-service")).toBe(true);
    expect(isPresetFrontId("make-your-own")).toBe(false);
    expect(isPresetFrontId("surprise-me")).toBe(false);
  });
});

describe("isChosenFrontRecord", () => {
  const valid: ChosenFrontRecord = {
    schemaVersion: 1,
    requestedFrontId: "pool-service",
    resolvedFrontId: "pool-service",
    customProfile: null,
    selectedAt: "2026-09-24T00:00:00.000Z",
  };

  it("accepts a valid record", () => {
    expect(isChosenFrontRecord(valid)).toBe(true);
  });

  it("accepts a custom profile on make-your-own", () => {
    expect(
      isChosenFrontRecord({
        ...valid,
        requestedFrontId: "make-your-own",
        resolvedFrontId: "make-your-own",
        customProfile: { businessName: "ACME NIGHT PARKING" },
      }),
    ).toBe(true);
  });

  it("rejects wrong schema, unknown fronts, bad timestamps, and empty profiles", () => {
    expect(isChosenFrontRecord({ ...valid, schemaVersion: 2 })).toBe(false);
    expect(isChosenFrontRecord({ ...valid, requestedFrontId: "taco-truck" })).toBe(false);
    expect(isChosenFrontRecord({ ...valid, resolvedFrontId: "taco-truck" })).toBe(false);
    expect(isChosenFrontRecord({ ...valid, selectedAt: 123 })).toBe(false);
    expect(isChosenFrontRecord({ ...valid, customProfile: { businessName: "" } })).toBe(false);
    expect(isChosenFrontRecord({ ...valid, customProfile: 42 })).toBe(false);
    expect(isChosenFrontRecord(null)).toBe(false);
    expect(isChosenFrontRecord("pool-service")).toBe(false);
  });
});

describe("isStarterTemplateInput", () => {
  it("accepts blank and starter requests", () => {
    expect(isStarterTemplateInput({ kind: "blank" })).toBe(true);
    expect(isStarterTemplateInput({ kind: "starter", frontId: "pest-control" })).toBe(true);
  });

  it("requires a data URL image for user-image requests", () => {
    expect(
      isStarterTemplateInput({ kind: "user-image", imageDataUrl: "data:image/png;base64,eA==" }),
    ).toBe(true);
    expect(isStarterTemplateInput({ kind: "user-image" })).toBe(false);
    expect(isStarterTemplateInput({ kind: "user-image", imageDataUrl: "not-a-url" })).toBe(false);
  });

  it("rejects unknown kinds and front ids", () => {
    expect(isStarterTemplateInput({ kind: "oil-change" })).toBe(false);
    expect(isStarterTemplateInput({ kind: "blank", frontId: "taco-truck" })).toBe(false);
    expect(isStarterTemplateInput(null)).toBe(false);
  });
});

describe("resolveFrontId / chooseFront", () => {
  it("passes presets and make-your-own through untouched", () => {
    expect(resolveFrontId("pest-control")).toBe("pest-control");
    expect(resolveFrontId("make-your-own")).toBe("make-your-own");
  });

  it("resolves surprise-me deterministically from the random value", () => {
    expect(resolveFrontId("surprise-me", 0)).toBe("pool-service");
    expect(resolveFrontId("surprise-me", 0.999)).toBe("mobile-detailing");
    expect(resolveFrontId("surprise-me", 0.4)).toBe("pest-control");
    // Out-of-range draws clamp instead of escaping the preset list.
    expect(resolveFrontId("surprise-me", -3)).toBe("pool-service");
    expect(resolveFrontId("surprise-me", 99)).toBe("mobile-detailing");
  });

  it("builds a versioned record with resolved front and timestamp", () => {
    const record = chooseFront("surprise-me", {
      randomValue: 0,
      selectedAt: "2026-09-24T00:00:00.000Z",
    });
    expect(record).toEqual({
      schemaVersion: 1,
      requestedFrontId: "surprise-me",
      resolvedFrontId: "pool-service",
      customProfile: null,
      selectedAt: "2026-09-24T00:00:00.000Z",
    });
  });

  it("carries a custom profile for make-your-own", () => {
    const record = chooseFront("make-your-own", {
      customProfile: { businessName: "ACME" },
      selectedAt: "2026-09-24T00:00:00.000Z",
    });
    expect(record.resolvedFrontId).toBe("make-your-own");
    expect(record.customProfile).toEqual({ businessName: "ACME" });
  });
});

describe("chosen front storage", () => {
  it("uses its own storage key", () => {
    expect(CHOSEN_FRONT_STORAGE_KEY).toBe("crewmark:p6:chosenFront");
  });

  it("round-trips the record exactly", () => {
    const record = chooseFront("pest-control", { selectedAt: "2026-09-24T00:00:00.000Z" });
    expect(saveChosenFront(record)).toBe(true);
    expect(loadChosenFront()).toEqual(record);
  });

  it("returns null when empty, corrupt, or schema-mismatched", () => {
    expect(loadChosenFront()).toBeNull();
    window.localStorage.setItem(CHOSEN_FRONT_STORAGE_KEY, "not json{");
    expect(loadChosenFront()).toBeNull();
    window.localStorage.setItem(
      CHOSEN_FRONT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, requestedFrontId: "pool-service" }),
    );
    expect(loadChosenFront()).toBeNull();
  });

  it("clears only its own slot", () => {
    window.localStorage.setItem("crewmark:other", "keep");
    saveChosenFront(chooseFront("pool-service"));
    clearChosenFront();
    expect(loadChosenFront()).toBeNull();
    expect(window.localStorage.getItem("crewmark:other")).toBe("keep");
  });
});

describe("createStarterTemplate", () => {
  it("rejects invalid requests before touching the DOM", async () => {
    await expect(createStarterTemplate({ kind: "user-image" })).rejects.toThrow(
      /invalid starter template/i,
    );
    await expect(
      createStarterTemplate({ kind: "starter", frontId: "taco-truck" as never }),
    ).rejects.toThrow(/invalid starter template/i);
  });

  it("paints a blank vinyl panel at cover size", async () => {
    stubDocumentCanvas();
    const result = await createStarterTemplate({ kind: "blank" });
    expect(result.kind).toBe("blank");
    expect(result.width).toBe(STARTER_TEMPLATE_WIDTH);
    expect(result.height).toBe(STARTER_TEMPLATE_HEIGHT);
    expect(result.dataUrl.startsWith("data:image/png")).toBe(true);
  });

  it("paints each preset with its own template", async () => {
    stubDocumentCanvas();
    for (const frontId of PRESET_FRONT_IDS) {
      const result = await createStarterTemplate({ kind: "starter", frontId });
      expect(result.kind).toBe("starter");
      expect(result.frontId).toBe(frontId);
      expect(result.width).toBe(STARTER_TEMPLATE_WIDTH);
      expect(result.height).toBe(STARTER_TEMPLATE_HEIGHT);
    }
  });

  it("each preset paints a distinct headline", async () => {
    const { contexts } = stubDocumentCanvas();
    for (const frontId of PRESET_FRONT_IDS) {
      await createStarterTemplate({ kind: "starter", frontId });
    }
    const headlines = contexts.map((ctx) => ctx.fillText.mock.calls[0]?.[0]);
    expect(new Set(headlines).size).toBe(PRESET_FRONT_IDS.length);
  });

  it("resolves surprise-me starters through the random draw", async () => {
    stubDocumentCanvas();
    const result = await createStarterTemplate(
      { kind: "starter", frontId: "surprise-me" },
      { randomValue: 0 },
    );
    expect(result.frontId).toBe("pool-service");
  });

  it("refuses starter art for custom fronts", async () => {
    stubDocumentCanvas();
    await expect(createStarterTemplate({ kind: "starter", frontId: "make-your-own" })).rejects.toThrow(
      /preset/i,
    );
  });

  it("passes user artwork through untouched", async () => {
    const imageDataUrl = "data:image/png;base64,Y3VzdG9t";
    const result = await createStarterTemplate({
      kind: "user-image",
      frontId: "make-your-own",
      imageDataUrl,
    });
    expect(result.kind).toBe("user-image");
    expect(result.frontId).toBe("make-your-own");
    expect(result.dataUrl).toBe(imageDataUrl);
    expect(result.width).toBe(STARTER_TEMPLATE_WIDTH);
    expect(result.height).toBe(STARTER_TEMPLATE_HEIGHT);
  });
});
