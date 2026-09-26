import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import JobYard from "./JobYard";
import FinalRunReceipt from "./FinalRunReceipt";
import { buildRunReceipt } from "../lib/runReceipt";
import { createDisguisePackage } from "../lib/disguisePackage";

describe("P6 JobYard and FinalRunReceipt UI", () => {
  const dummyCoverUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const burnedCoverUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("JobYard", () => {
    it("renders diegetic onboarding intro on first entry", () => {
      const html = renderToString(
        <JobYard
          hud={{ rep: 10, heat: 5, territory: 2 }}
          jobAccepted={false}
          onAcceptJob={vi.fn()}
          cover={null}
          onEditCover={vi.fn()}
          completed={false}
        />,
      );

      expect(html).toContain("305 PRINT &amp; SIGN // AFTER HOURS");
      expect(html).toContain("Build a fake front.");
      expect(html).toContain("CLICK OBJECTS TO INTERACT // ESC CLOSES MENUS");
      expect(html).toContain("CHECK THE JOB TERMINAL");
      expect(html).toContain("ENTER THE YARD");
    });

    it("displays initial objective 'CHECK THE JOB TERMINAL' before job is accepted", () => {
      const html = renderToString(
        <JobYard
          hud={{ rep: 10, heat: 5, territory: 2 }}
          jobAccepted={false}
          onAcceptJob={vi.fn()}
          cover={null}
          onEditCover={vi.fn()}
          completed={false}
        />,
      );

      expect(html).toContain("CHECK THE JOB TERMINAL");
    });

      const disguisePackage = createDisguisePackage(
        dummyCoverUrl,
        "bug-out-305",
        undefined,
        undefined,
        "COVER//01",
      );
    it("renders in-world payoffs (vehicle, crate, jacket, pass) when cover is active", () => {
      const html = renderToString(
        <JobYard
          hud={{ rep: 25, heat: 12, territory: 5 }}
          jobAccepted={true}
          onAcceptJob={vi.fn()}
          cover={{ image: dummyCoverUrl, score: 88 }}
          disguisePackage={disguisePackage}
          onEditCover={vi.fn()}
          completed={false}
        />,
      );

      // In-world vehicle cover
      expect(html).toContain("cm-vehicle-cover");
      // In-world shipping crate
      expect(html).toContain("cm-crate-cover");
      expect(html).toContain("CRATE // MANIFEST");
      // In-world jacket prop
      expect(html).toContain("cm-yard-prop-jacket");
      expect(html).toContain("CREW JACKET");
      // In-world pass prop
      expect(html).toContain("cm-yard-prop-pass");
      expect(html).toContain("GATE PASS");
      // Surface inspector toolbar
      expect(html).toContain("cm-yard-surfaces-hud");
      expect(html).toContain("VEHICLE");
      expect(html).toContain("CRATE");
      expect(html).toContain("JACKET");
      expect(html).toContain("PASS");
    });
  });

  describe("FinalRunReceipt", () => {
    it("renders complete run summary with dual covers, metrics, quote, and CTAs", () => {
      const sampleReceipt = buildRunReceipt({
        runId: "RUN//01",
        front: {
          schemaVersion: 1,
          requestedFrontId: "pool-service",
          resolvedFrontId: "pool-service",
          customProfile: null,
          selectedAt: "2026-09-24T00:00:00.000Z",
        },
        coverVersion: "COVER//02",
        coverDataUrl: dummyCoverUrl,
        checkpoint: "clean",
        signatureDistance: 78,
        missionStartedAt: "22:14:00",
        missionCompletedAt: "22:18:30",
        receiptsReviewedAt: "22:20:15",
      });

      const html = renderToString(
        <FinalRunReceipt
          receipt={sampleReceipt}
          cover01Image={burnedCoverUrl}
          cover02Image={dummyCoverUrl}
          visualDistance={78}
          checkpoint="clean"
          heat={30}
          onNewRun={vi.fn()}
          onReturnToYard={vi.fn()}
        />,
      );

      // Header and Kicker
      expect(html).toContain("CREW//MARK // RUN RECEIPT");
      expect(html).toContain("RUN LOGGED.");
      expect(html).toContain("IMMUTABLE RECEIPT.");

      // Diegetic quote
      expect(html).toContain(
        "THE FIRST LIE GOT YOU IN. THE SECOND ONE KEPT YOU MOVING.",
      );

      // Dual cover cards
      expect(html).toContain("COVER//01");
      expect(html).toContain("BURNED");
      expect(html).toContain("FLAGGED BY VCW");

      expect(html).toContain("COVER//02");
      expect(html).toContain("ACTIVE");
      expect(html).toContain("CLEARANCE SECURED");

      // Metrics strip
      expect(html).toContain("VISUAL DISTANCE");
      expect(html).toContain("78%");
      expect(html).toContain("PORT VICE");
      expect(html).toContain("CLEARED (CLEAN)");
      expect(html).toContain("HEAT");
      expect(html).toContain("30");

      // Actions
      expect(html).toContain("SAVE RUN RECEIPT");
      expect(html).toContain("NEW RUN");
      expect(html).toContain("BACK TO 305 YARD");
    });
  });
});
