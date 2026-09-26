/**
 * P6 Domain: Multi-Surface Previews.
 *
 * Defines the real-world contractor surfaces that display the forged cover:
 * - CAR: Driver/passenger side magnetic vinyl door livery.
 * - CRATE: Industrial freight crate manifest label / warehouse stencil.
 * - JACKET: High-vis utility work crew jacket back patch / uniform insignia.
 * - PASS: Laminated RFID security lanyard gate pass credential.
 */

export type SurfaceId = "CAR" | "CRATE" | "JACKET" | "PASS";

export const SURFACE_IDS: readonly SurfaceId[] = [
  "CAR",
  "CRATE",
  "JACKET",
  "PASS",
] as const;

export interface SurfaceDefinition {
  readonly id: SurfaceId;
  readonly name: string;
  readonly shortName: string;
  readonly tagline: string;
  readonly category: "FLEET" | "LOGISTICS" | "CREW" | "CLEARANCE";
  readonly description: string;
  readonly detailNotes: string;
  readonly material: string;
  readonly clearanceLevel: string;
  readonly dimensionsLabel: string;
}

export const SURFACE_DEFINITIONS: Readonly<Record<SurfaceId, SurfaceDefinition>> = {
  CAR: {
    id: "CAR",
    name: "FLEET VEHICLE // DOOR PANEL",
    shortName: "VEHICLE DOOR",
    tagline: "Curbside plausibility at speed",
    category: "FLEET",
    description:
      "Magnetic vinyl service livery applied to the driver-side door of the contractor vehicle. Satisfies automated optical license and patrol vehicle scans.",
    detailNotes:
      "High visual contrast across panels ensures vehicle recognition at gate perimeter. Rated for highway speeds and rainy conditions.",
    material: "Heavy-duty cast vinyl with matte laminate",
    clearanceLevel: "TIER-1 FLEET PERMIT",
    dimensionsLabel: "1600 × 700 MM",
  },
  CRATE: {
    id: "CRATE",
    name: "SHIPPING CRATE // CARGO STENCIL",
    shortName: "CARGO CRATE",
    tagline: "Port Vice loading bay manifests",
    category: "LOGISTICS",
    description:
      "Direct industrial transfer and weatherproof adhesive manifest label adhered to heavy timber shipping crate. Matches legitimate yard cargo manifests.",
    detailNotes:
      "Subtle wear, ink bleed, and distress make the stencil appear legitimately staged in cargo holding bay 04.",
    material: "Weathered pine timber with moisture-resistant adhesive label",
    clearanceLevel: "DOCK RECEIVING // APPROVED",
    dimensionsLabel: "800 × 350 MM",
  },
  JACKET: {
    id: "JACKET",
    name: "CREW UNIFORM // WORK JACKET",
    shortName: "CREW JACKET",
    tagline: "Back patch & uniform insignia",
    category: "CREW",
    description:
      "Heavy embroidered twill insignia patch stitched onto the back of contractor utility work jackets. Keeps perimeter security from questioning personnel on foot.",
    detailNotes:
      "Reinforced merrowed border stitching and industrial thread texture. Visible under standard sodium warehouse lighting.",
    material: "Embroidered high-density polyester on heavy canvas jacket",
    clearanceLevel: "ON-SITE CONTRACTOR BADGE",
    dimensionsLabel: "380 × 165 MM",
  },
  PASS: {
    id: "PASS",
    name: "GATE PASS // SECURITY LANYARD",
    shortName: "GATE PASS",
    tagline: "Automated terminal RFID credential",
    category: "CLEARANCE",
    description:
      "Laminated contractor access badge on braided utility lanyard. Displayed at service gate checkpoints for secondary guard visual inspection and barcode scan.",
    detailNotes:
      "Includes optical barcode, contractor classification seal, and holographic security overlay simulation.",
    material: "30 Mil PVC composite card with matte UV overlaminate",
    clearanceLevel: "PORT VICE GATE // ZONE 2",
    dimensionsLabel: "85.6 × 54 MM (CR80)",
  },
};

export function isSurfaceId(value: unknown): value is SurfaceId {
  return typeof value === "string" && (SURFACE_IDS as readonly string[]).includes(value);
}

export function getSurfaceDefinition(id: SurfaceId): SurfaceDefinition {
  return SURFACE_DEFINITIONS[id] ?? SURFACE_DEFINITIONS.CAR;
}
