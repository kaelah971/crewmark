/**
 * Deterministic first-mission data (P3.5A-R).
 *
 * JOB//01 is a fixed work order, not generated content: the same brief for
 * every player, every run. Copy lives here so the job board overlay, HUD
 * objective, tests, and the future cover editor all read one source.
 */

export interface JobBrief {
  readonly id: "JOB//01";
  readonly title: string;
  readonly client: string;
  readonly target: string;
  readonly window: string;
  readonly objective: string;
  readonly requirements: readonly string[];
  readonly warning: string;
}

export const JOB_01: JobBrief = {
  id: "JOB//01",
  title: "PORT VICE // NIGHT DELIVERY",
  client: "UNKNOWN",
  target: "PORT VICE SERVICE GATE",
  window: "01:20–02:00",
  objective: "GET THE VEHICLE THROUGH THE SERVICE GATE.",
  requirements: [
    "Maintenance contractor identity",
    "Orange lower stripe",
    "Service number",
    "Approved-looking symbol",
    "Weathered / used finish",
  ],
  warning: "THE GATE DOESN'T KNOW WHO YOU ARE. IT KNOWS WHAT BELONGS THERE.",
};

/** HUD objective line for the current job state. */
export function jobObjective(
  jobAccepted: boolean,
  completed: boolean = false,
  receiptsSeen: boolean = false,
  burned: boolean = false,
  cover02Active: boolean = false,
): string {
  if (cover02Active) return "COVER//02 ACTIVE — LAY LOW // NEW WORK PENDING";
  if (burned) return "COVER//01 BURNED — ROTATE COVER";
  if (completed && !receiptsSeen) return "VICE COUNTY WATCH ALERT — CHECK THE TERMINAL";
  if (completed) return "JOB//01 COMPLETE — 305 PRINT & SIGN HUB";
  return jobAccepted ? "JOB//01 — ENTER THE PRINT SHOP" : "JOB//01 — CHECK THE JOB BOARD";
}

/** Vehicle inspect result. With a locked cover, reports it plus its score. */
export function vehicleReport(
  coverScore: number | null = null,
  burned: boolean = false,
  coverVersion: "COVER//01" | "COVER//02" = "COVER//01",
  cityMatch?: number,
): { title: string; line: string } {
  if (coverVersion === "COVER//02") {
    const matchLine = typeof cityMatch === "number" ? ` — CITY MATCH // ${cityMatch}%` : "";
    return { title: "Vehicle", line: `VEHICLE // COVER//02 ACTIVE${matchLine}` };
  }
  if (burned) {
    return { title: "Vehicle", line: "VEHICLE // COVER//01 BURNED" };
  }
  if (coverScore === null) {
    return { title: "Vehicle", line: "VEHICLE // NO ACTIVE COVER" };
  }
  return { title: "Vehicle", line: `VEHICLE // COVER//01 ACTIVE — VISUAL CHECK // ${coverScore}%` };
}

/** Print shop response: work-order gate before/after accepting JOB//01. */
export function printShopReport(
  jobAccepted: boolean,
  burned: boolean = false,
  cover02Active: boolean = false,
): { title: string; line: string } {
  if (cover02Active) {
    return { title: "Print shop", line: "COVER//02 // DISGUISE ROTATED — ACTIVE" };
  }
  if (burned) {
    return { title: "Print shop", line: "COVER//02 // NEW WORK ORDER REQUIRED" };
  }
  if (jobAccepted) {
    return { title: "Print shop", line: "COVER//01 // WORK ORDER READY" };
  }
  return { title: "Print shop", line: "NO ACTIVE WORK ORDER" };
}

/** Exit gate response: departure is always blocked in this slice. */
export function exitGateReport(
  completed: boolean = false,
  hasCover: boolean = false,
  burned: boolean = false,
): { title: string; line: string } {
  if (burned) return { title: "Exit gate", line: "GATE // COVER BURNED — ACCESS REVOKED" };
  if (completed) return { title: "Exit gate", line: "JOB//01 COMPLETE — STANDBY FOR DISPATCH" };
  if (hasCover) return { title: "Exit gate", line: "PORT VICE // SERVICE RUN READY" };
  return { title: "Exit gate", line: "JOB PREP INCOMPLETE" };
}
