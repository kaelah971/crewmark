import type { CoverTemplateId } from "./coverTemplates";
import { COVER_TEMPLATES } from "./coverTemplates";
import type { FrontId } from "./fronts";
import type { VehicleLivery, VehicleStripePattern } from "./vehicleLivery";
import { deriveVehicleLivery } from "./vehicleLivery";

/**
 * P9.2 Linked Disguise Package Domain Contract.
 *
 * ONE chosen disguise identity controls BOTH:
 * 1. The supporting identity package (pass, crate, jacket, credentials)
 * 2. The vehicle livery (body spray, secondary paint, accent stripes, door branding, hood mark, unit markings)
 */

export interface VehicleCustomization {
  readonly bodyBaseColor?: string;
  readonly secondaryColor?: string;
  readonly accentColor?: string;
  readonly stripePattern?: VehicleStripePattern | "none";
  readonly logoScale?: number;            // 0.7 to 1.5, default 1.0
  readonly logoPlacement?: "center" | "forward" | "rearward";
  readonly showHoodMark?: boolean;        // default true
  readonly showRearMarking?: boolean;     // default true
}

export interface DisguisePackage {
  readonly id: string;                    // e.g. "pkg-bug-out-305" or "pkg-custom-..."
  readonly templateId: CoverTemplateId | null;
  readonly companyName: string;
  readonly tagline: string;
  readonly identityArtwork: string;       // Primary 16:7 vinyl cover data URL
  readonly identityMetadata: {
    readonly frontId?: FrontId;
    readonly personality?: string;
    readonly palette?: string;
    readonly unitCode?: string;
  };
  readonly vehicleLivery: VehicleLivery;
  readonly customization?: VehicleCustomization;
  readonly createdAt: string;
}

/**
 * DEFAULT STATE: Clean, undisguised factory black sedan.
 * When no disguise is chosen:
 * - Crew sedan is plain black (#111214)
 * - Deep satin black lower trim (#0C0D0E)
 * - Subdued dark graphite accents (#2A2B2E)
 * - No fake company branding, no logos, no stripes.
 * User understands: BLACK CAR = CLEAN / UNDISGUISED STATE.
 */
export const DEFAULT_CLEAN_VEHICLE_LIVERY: VehicleLivery = {
  sourceCoverDataUrl: "",
  bodyBaseColor: "#111214",               // Factory black gloss
  secondaryColor: "#0C0D0E",              // Deep satin black
  accentColor: "#2A2B2E",                 // Dark metallic graphite
  doorGraphicDataUrl: "",
  hoodGraphicDataUrl: "",
  rearGraphicDataUrl: "",
  stripePattern: "service",
  companyLabel: "UNDISGUISED // FACTORY FLEET",
  unitLabel: "CLEAN STATE",
  badgeWidth: 0,
  badgeHeight: 0,
};

/**
 * Storage keys for disguise packages
 */
const PACKAGE_KEY_V1 = "crewmark:r:package01";
const PACKAGE_KEY_V2 = "crewmark:r:package02";
const ACTIVE_PACKAGE_KEY = "crewmark:r:active_package";

/**
 * Applies fine-grained user vehicle customization over a base vehicle livery.
 */
export function applyVehicleCustomization(
  baseLivery: VehicleLivery,
  custom?: VehicleCustomization,
): VehicleLivery {
  if (!custom) return baseLivery;

  const bW = (baseLivery.badgeWidth || 0.65) * (custom.logoScale ?? 1.0);
  const bH = (baseLivery.badgeHeight || 0.42) * (custom.logoScale ?? 1.0);

  return {
    ...baseLivery,
    bodyBaseColor: custom.bodyBaseColor ?? baseLivery.bodyBaseColor,
    secondaryColor: custom.secondaryColor ?? baseLivery.secondaryColor,
    accentColor: custom.accentColor ?? baseLivery.accentColor,
    stripePattern: custom.stripePattern === "none" ? "service" : (custom.stripePattern ?? baseLivery.stripePattern),
    doorGraphicDataUrl: baseLivery.doorGraphicDataUrl,
    hoodGraphicDataUrl: custom.showHoodMark === false ? "" : baseLivery.hoodGraphicDataUrl,
    rearGraphicDataUrl: custom.showRearMarking === false ? "" : baseLivery.rearGraphicDataUrl,
    badgeWidth: bW,
    badgeHeight: bH,
  };
}

/**
 * Creates a fully synchronized DisguisePackage from a template or custom artwork.
 */
export function createDisguisePackage(
  artworkDataUrl: string,
  templateId?: CoverTemplateId | null,
  frontId?: FrontId,
  customization?: VehicleCustomization,
): DisguisePackage {
  const template = templateId
    ? COVER_TEMPLATES.find((t) => t.id === templateId)
    : null;

  const baseLivery = deriveVehicleLivery(artworkDataUrl, templateId ?? frontId);
  const vehicleLivery = applyVehicleCustomization(baseLivery, customization);

  const companyName = template?.company ?? vehicleLivery.companyLabel;
  const tagline = template?.personality ?? "Commercial contractor vehicle disguise.";

  return {
    id: `pkg-${templateId ?? "custom"}-${Date.now().toString(36)}`,
    templateId: templateId ?? null,
    companyName,
    tagline,
    identityArtwork: artworkDataUrl,
    identityMetadata: {
      frontId,
      personality: template?.personality,
      palette: template?.palette,
      unitCode: vehicleLivery.unitLabel,
    },
    vehicleLivery,
    customization,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Saves a disguise package to localStorage (V1 or V2).
 */
export function saveDisguisePackage(
  pkg: DisguisePackage,
  version: "COVER//01" | "COVER//02" = "COVER//01",
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = version === "COVER//02" ? PACKAGE_KEY_V2 : PACKAGE_KEY_V1;
    window.localStorage.setItem(key, JSON.stringify(pkg));
    window.localStorage.setItem(ACTIVE_PACKAGE_KEY, JSON.stringify(pkg));
    return true;
  } catch (err) {
    console.warn("[crewmark] Failed to save disguise package:", err);
    return false;
  }
}

/**
 * Loads a frozen disguise package from localStorage.
 */
export function loadDisguisePackage(
  version: "COVER//01" | "COVER//02" = "COVER//01",
): DisguisePackage | null {
  if (typeof window === "undefined") return null;
  try {
    const key = version === "COVER//02" ? PACKAGE_KEY_V2 : PACKAGE_KEY_V1;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.vehicleLivery) return null;
    return parsed as DisguisePackage;
  } catch {
    return null;
  }
}

/**
 * Loads the active disguise package (V2 over V1, or null if clean).
 */
export function loadActiveDisguisePackage(cover01Burned = false): DisguisePackage | null {
  const pkg02 = loadDisguisePackage("COVER//02");
  if (pkg02) return pkg02;
  const pkg01 = loadDisguisePackage("COVER//01");
  if (pkg01 && !cover01Burned) return pkg01;
  return pkg01; // Can still be viewed as burned
}

/**
 * Clears disguise package storage on reset.
 */
export function clearDisguisePackages(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PACKAGE_KEY_V1);
    window.localStorage.removeItem(PACKAGE_KEY_V2);
    window.localStorage.removeItem(ACTIVE_PACKAGE_KEY);
  } catch {
    // Ignored
  }
}
