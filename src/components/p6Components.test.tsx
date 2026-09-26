import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import FrontTerminal from "./FrontTerminal";
import SurfaceMockup from "./SurfaceMockup";
import MultiSurfacePreview from "./MultiSurfacePreview";
import ForgeryBay from "./ForgeryBay";
import { FRONT_OPTIONS } from "../lib/fronts";

describe("P6 UI Components SSR / Rendering", () => {
  const dummyCoverUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  describe("FrontTerminal", () => {
    it("renders all front options and their details", () => {
      const html = renderToString(
        <FrontTerminal onSelectFront={vi.fn()} />,
      );

      // Verify screen header
      expect(html).toContain("305 PRINT &amp; SIGN // CONTRACTOR DISPATCH");
      expect(html).toContain("SELECT YOUR");
      expect(html).toContain("FRONT COMPANY.");

      // Verify each front option is present in the markup
      for (const option of FRONT_OPTIONS) {
        expect(html).toContain(option.label);
        expect(html).toContain(option.inspiration);
        expect(html).toContain(option.personality);
      }

      // Verify CTA button
      expect(html).toContain("Confirm Front &amp; Open Garage");
    });
  });

  describe("SurfaceMockup", () => {
    it("renders CAR mockup with exact cover image", () => {
      const html = renderToString(
        <SurfaceMockup surfaceId="CAR" coverDataUrl={dummyCoverUrl} />,
      );
      expect(html).toContain('data-surface-id="CAR"');
      expect(html).toContain("UNIT 305 // VICE CONTRACTOR FLEET");
      expect(html).toContain("FLEET");
      expect(html).toContain("VEHICLE DOOR");
      expect(html).toContain(dummyCoverUrl);
    });

    it("renders CRATE mockup with freight details", () => {
      const html = renderToString(
        <SurfaceMockup surfaceId="CRATE" coverDataUrl={dummyCoverUrl} />,
      );
      expect(html).toContain('data-surface-id="CRATE"');
      expect(html).toContain("PORT VICE // FREIGHT BAY 04");
      expect(html).toContain("MANIFEST ATTACHED");
      expect(html).toContain(dummyCoverUrl);
    });

    it("renders JACKET mockup with uniform details", () => {
      const html = renderToString(
        <SurfaceMockup surfaceId="JACKET" coverDataUrl={dummyCoverUrl} />,
      );
      expect(html).toContain('data-surface-id="JACKET"');
      expect(html).toContain("CREW ISSUE // VICE CONTRACTOR STANDARD");
      expect(html).toContain("CREW");
      expect(html).toContain("CREW JACKET");
      expect(html).toContain(dummyCoverUrl);
    });

    it("renders PASS mockup with credential details", () => {
      const html = renderToString(
        <SurfaceMockup surfaceId="PASS" coverDataUrl={dummyCoverUrl} />,
      );
      expect(html).toContain('data-surface-id="PASS"');
      expect(html).toContain("PORT VICE HARBOR SECURITY");
      expect(html).toContain("CONTRACTOR CREDENTIAL");
      expect(html).toContain("ZONE 2 ACCESS // SERVICE GATE PASS");
      expect(html).toContain(dummyCoverUrl);
    });

    it("renders detailed inspection overlay when detailed=true", () => {
      const html = renderToString(
        <SurfaceMockup surfaceId="CAR" coverDataUrl={dummyCoverUrl} detailed={true} />,
      );
      expect(html).toContain("cm-surface-inspector-overlay");
      expect(html).toContain("+ INSPECTION:");
      expect(html).toContain("FLEET VEHICLE // DOOR PANEL");
      expect(html).toContain("100% REGISTRATION");
    });
  });

  describe("MultiSurfacePreview", () => {
    it("renders navigation tabs for all 4 surfaces and action CTAs", () => {
      const html = renderToString(
        <MultiSurfacePreview
          coverDataUrl={dummyCoverUrl}
          frontName="Pool Service"
          readinessScore={84}
          cityAttention="HIGH"
          reaction="LOOKS OFFICIAL. TOO LOUD FOR A CITY THAT REMEMBERS."
          onClose={vi.fn()}
          onLockAndPrint={vi.fn()}
          onContinueTo305={vi.fn()}
        />
      );

      // Verify header and title
      expect(html).toContain("MULTI-SURFACE FIDELITY CHECK");
      expect(html).toContain("Real-World");
      expect(html).toContain("Disguise Surfaces");

      // Verify tabs
      expect(html).toContain("VEHICLE DOOR");
      expect(html).toContain("CARGO CRATE");
      expect(html).toContain("CREW JACKET");
      expect(html).toContain("GATE PASS");

      // Verify metrics
      expect(html).toContain("POOL SERVICE");
      expect(html).toContain("84");
      expect(html).toContain("/ 100");
      expect(html).toContain("HIGH");
      expect(html).toContain("LOOKS OFFICIAL. TOO LOUD FOR A CITY THAT REMEMBERS.");

      // Verify CTAs
      expect(html).toContain("Back to Bay");
      expect(html).toContain("Continue to 305");
      expect(html).toContain("Lock &amp; Print");
    });
  });

  describe("ForgeryBay", () => {
    it("renders header, headline, start options, and metrics bar", () => {
      const html = renderToString(
        <ForgeryBay
          initialImage={dummyCoverUrl}
          hasExistingCover={false}
          onCommit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Header and title
      expect(html).toContain("305 PRINT &amp; SIGN // FORGERY GARAGE //");
      expect(html).toContain("COVER//01");
      expect(html).toContain("BUILD SOMETHING");
      expect(html).toContain("THE CITY WON&#x27;T QUESTION.");

      // P8: gallery-first — template cards carry the remix path
      expect(html).toContain("REMIX A COVER");
      expect(html).toContain("START FROM BLANK");
      expect(html).toContain("USE YOUR IMAGE");
      expect(html).toContain("REMIX THIS");
    });
  });
});
