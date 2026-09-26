import { describe, it, expect } from "vitest";
import {
  COVER_TEMPLATES,
  COVER_TEMPLATE_W,
  COVER_TEMPLATE_H,
  getCoverTemplate,
  isCoverTemplateId,
  renderCoverTemplateDataUrl,
} from "./coverTemplates";

describe("P8.1 approved cover templates", () => {
  it("ships all eight templates with production artwork asset paths", () => {
    expect(COVER_TEMPLATES).toHaveLength(8);
    for (const t of COVER_TEMPLATES) {
      expect(t.company.length).toBeGreaterThan(0);
      expect(t.palette.length).toBeGreaterThan(0);
      expect(t.personality.length).toBeGreaterThan(0);
      expect(["LOW", "BALANCED", "HIGH"]).toContain(t.attention);
      expect(t.whyItWorks.length).toBeGreaterThan(0);
      expect(t.guidance.length).toBeGreaterThan(0);
      expect(t.assetUrl).toMatch(/^\/templates\/covers\/.*\.png$/);
    }
  });

  it("targets 1600x700 canonical cover decal dimensions", () => {
    expect(COVER_TEMPLATE_W).toBe(1600);
    expect(COVER_TEMPLATE_H).toBe(700);
    const aspect = COVER_TEMPLATE_W / COVER_TEMPLATE_H;
    expect(Math.abs(aspect - 16 / 7)).toBeLessThan(0.01);
  });

  it("validates template ids and lookups", () => {
    expect(isCoverTemplateId("clearwater-pool")).toBe(true);
    expect(isCoverTemplateId("bug-out-305")).toBe(true);
    expect(isCoverTemplateId("coral-bloom")).toBe(true);
    expect(isCoverTemplateId("nightshift-supply")).toBe(true);
    expect(isCoverTemplateId("vice-mobile-detail")).toBe(true);
    expect(isCoverTemplateId("palm-state-utilities")).toBe(true);
    expect(isCoverTemplateId("sunset-septic")).toBe(true);
    expect(isCoverTemplateId("paradise-cold-chain")).toBe(true);
    expect(isCoverTemplateId("unknown-company")).toBe(false);

    expect(getCoverTemplate("bug-out-305").company).toBe("BUG OUT 305");
    expect(getCoverTemplate("clearwater-pool").assetUrl).toBe(
      "/templates/covers/clearwater-pool-co.png",
    );
    expect(() => getCoverTemplate("unknown-company" as never)).toThrow();
  });

  it("renderCoverTemplateDataUrl returns valid asset URL or data URL", () => {
    const url = renderCoverTemplateDataUrl("clearwater-pool");
    expect(url).toBe(
      "/templates/covers/clearwater-pool-co.png",
    );
  });
});
