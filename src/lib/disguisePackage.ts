import { getCoverAsset, putCoverAsset, type CoverAssetRef } from "./coverAssetStore";
import { getCoverTemplate, isCoverTemplateId, type CoverTemplateId } from "./coverTemplates";
import { isFrontId, type FrontId } from "./fronts";
import {
  deriveVehicleLivery,
  resolveTemplateId,
  type VehicleLivery,
  type VehicleStripePattern,
} from "./vehicleLivery";

export type DisguisePackageSlot = "COVER//01" | "COVER//02";
export const DISGUISE_PACKAGE_VERSION = 1 as const;

export interface VehicleCustomization {
  readonly bodyBaseColor?: string;
  readonly secondaryColor?: string;
  readonly accentColor?: string;
  readonly stripePattern?: VehicleStripePattern | "none";
  readonly logoScale?: number;
  readonly logoPlacement?: "center" | "forward" | "rearward";
  readonly showHoodMark?: boolean;
  readonly showRearMarking?: boolean;
}

export interface DisguisePackage {
  readonly version: typeof DISGUISE_PACKAGE_VERSION;
  readonly slot: DisguisePackageSlot;
  readonly id: string;
  readonly templateId: CoverTemplateId | null;
  readonly companyName: string;
  readonly tagline: string;
  readonly identityArtwork: string;
  /** Durable artwork ref; present after the IndexedDB persistence path hydrates. */
  readonly identityArtworkRef?: CoverAssetRef;
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

/** Clean, genuinely unbranded factory state. */
export const DEFAULT_CLEAN_VEHICLE_LIVERY: VehicleLivery = {
  sourceCoverDataUrl: "",
  bodyBaseColor: "#111214",
  secondaryColor: "#0C0D0E",
  accentColor: "#2A2B2E",
  doorGraphicDataUrl: "",
  hoodGraphicDataUrl: "",
  rearGraphicDataUrl: "",
  stripePattern: "detail",
  companyLabel: "UNDISGUISED // FACTORY FLEET",
  unitLabel: "CLEAN STATE",
  badgeWidth: 0,
  badgeHeight: 0,
};

const PACKAGE_KEY_V1 = "crewmark:r:package01";
const PACKAGE_KEY_V2 = "crewmark:r:package02";

function packageKey(slot: DisguisePackageSlot): string {
  return slot === "COVER//02" ? PACKAGE_KEY_V2 : PACKAGE_KEY_V1;
}


const VALID_STRIPE_PATTERNS: readonly string[] = [
  "hazard",
  "wave",
  "logistics",
  "municipal",
  "service",
  "cold",
  "heritage",
  "detail",
];

function validCustomization(value: unknown): value is VehicleCustomization | undefined {
  if (value === undefined) return true;
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    (c.bodyBaseColor === undefined || typeof c.bodyBaseColor === "string") &&
    (c.secondaryColor === undefined || typeof c.secondaryColor === "string") &&
    (c.accentColor === undefined || typeof c.accentColor === "string") &&
    (c.stripePattern === undefined || c.stripePattern === "none" || VALID_STRIPE_PATTERNS.includes(c.stripePattern as string)) &&
    (c.logoScale === undefined || (typeof c.logoScale === "number" && c.logoScale >= 0.7 && c.logoScale <= 1.5)) &&
    (c.logoPlacement === undefined || c.logoPlacement === "center" || c.logoPlacement === "forward" || c.logoPlacement === "rearward") &&
    (c.showHoodMark === undefined || typeof c.showHoodMark === "boolean") &&
    (c.showRearMarking === undefined || typeof c.showRearMarking === "boolean")
  );
}

/** Applies fine-grained user vehicle customization over an authored livery. */
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
    stripePattern: custom.stripePattern === "none" ? "detail" : (custom.stripePattern ?? baseLivery.stripePattern),
    doorGraphicDataUrl: baseLivery.doorGraphicDataUrl,
    hoodGraphicDataUrl: custom.showHoodMark === false ? "" : baseLivery.hoodGraphicDataUrl,
    rearGraphicDataUrl: custom.showRearMarking === false ? "" : baseLivery.rearGraphicDataUrl,
    badgeWidth: bW,
    badgeHeight: bH,
  };
}

/** Runtime invariant check. TypeScript casts are never sufficient for persisted packages. */
function validVehicleLivery(livery: VehicleLivery, pkg: Pick<DisguisePackage, "identityArtwork" | "templateId" | "identityMetadata" | "customization">): boolean {
  if (
    typeof livery.sourceCoverDataUrl !== "string" ||
    typeof livery.bodyBaseColor !== "string" ||
    typeof livery.secondaryColor !== "string" ||
    typeof livery.accentColor !== "string" ||
    typeof livery.doorGraphicDataUrl !== "string" ||
    typeof livery.hoodGraphicDataUrl !== "string" ||
    typeof livery.rearGraphicDataUrl !== "string" ||
    typeof livery.companyLabel !== "string" ||
    typeof livery.unitLabel !== "string" ||
    !VALID_STRIPE_PATTERNS.includes(livery.stripePattern) ||
    !Number.isFinite(livery.badgeWidth) ||
    !Number.isFinite(livery.badgeHeight) ||
    livery.badgeWidth < 0 ||
    livery.badgeHeight < 0
  ) return false;
  if ((livery.templateId ?? null) !== pkg.templateId) return false;
  const expected = applyVehicleCustomization(
    deriveVehicleLivery(pkg.identityArtwork, pkg.templateId ?? pkg.identityMetadata.frontId),
    pkg.customization,
  );
  return (
    livery.bodyBaseColor === expected.bodyBaseColor &&
    livery.secondaryColor === expected.secondaryColor &&
    livery.accentColor === expected.accentColor &&
    livery.stripePattern === expected.stripePattern &&
    livery.companyLabel === expected.companyLabel &&
    livery.unitLabel === expected.unitLabel &&
    livery.badgeWidth === expected.badgeWidth &&
    livery.badgeHeight === expected.badgeHeight
  );
}

export function validateDisguisePackage(value: unknown, expectedSlot?: DisguisePackageSlot): value is DisguisePackage {
  if (typeof value !== "object" || value === null) return false;
  const pkg = value as Record<string, unknown>;
  if (pkg.version !== DISGUISE_PACKAGE_VERSION) return false;
  if (pkg.slot !== "COVER//01" && pkg.slot !== "COVER//02") return false;
  if (expectedSlot && pkg.slot !== expectedSlot) return false;
  if (
    typeof pkg.id !== "string" ||
    !pkg.id ||
    typeof pkg.identityArtwork !== "string" ||
    !pkg.identityArtwork.startsWith("data:image/")
  ) return false;
  if (pkg.templateId !== null && !isCoverTemplateId(pkg.templateId)) return false;
  if (typeof pkg.companyName !== "string" || typeof pkg.tagline !== "string" || typeof pkg.createdAt !== "string") return false;
  if (typeof pkg.identityMetadata !== "object" || pkg.identityMetadata === null) return false;
  const metadata = pkg.identityMetadata as Record<string, unknown>;
  if (
    (metadata.frontId !== undefined && !isFrontId(metadata.frontId)) ||
    (metadata.personality !== undefined && typeof metadata.personality !== "string") ||
    (metadata.palette !== undefined && typeof metadata.palette !== "string") ||
    (metadata.unitCode !== undefined && typeof metadata.unitCode !== "string")
  ) return false;
  if (!validCustomization(pkg.customization)) return false;
  if (typeof pkg.vehicleLivery !== "object" || pkg.vehicleLivery === null) return false;
  const livery = pkg.vehicleLivery as VehicleLivery;
  if (livery.sourceCoverDataUrl !== pkg.identityArtwork) return false;
  const template = pkg.templateId ? getCoverTemplate(pkg.templateId) : null;
  const expectedCompany = template?.company ?? livery.companyLabel;
  const expectedTagline = template?.personality ?? "Commercial contractor vehicle disguise.";
  if (pkg.companyName !== expectedCompany || pkg.tagline !== expectedTagline) return false;
  return validVehicleLivery(
    livery,
    pkg as Pick<DisguisePackage, "identityArtwork" | "templateId" | "identityMetadata" | "customization">,
  );
}

/** Creates a complete package from one identity/artwork selection. */
export function createDisguisePackage(
  artworkDataUrl: string,
  templateId?: CoverTemplateId | null,
  frontId?: FrontId,
  customization?: VehicleCustomization,
  slot: DisguisePackageSlot = "COVER//01",
): DisguisePackage {
  if (!artworkDataUrl.startsWith("data:image/")) throw new Error("[crewmark] Disguise artwork must be an image data URL.");
  const resolvedTemplateId = templateId ?? resolveTemplateId(frontId, artworkDataUrl);
  const baseLivery = deriveVehicleLivery(artworkDataUrl, resolvedTemplateId ?? frontId);
  const vehicleLivery = applyVehicleCustomization(baseLivery, customization);
  const template = resolvedTemplateId ? getCoverTemplate(resolvedTemplateId) : null;
  const packageValue: DisguisePackage = {
    version: DISGUISE_PACKAGE_VERSION,
    slot,
    id: `pkg-${resolvedTemplateId ?? "custom"}-${Date.now().toString(36)}`,
    templateId: resolvedTemplateId,
    companyName: template?.company ?? baseLivery.companyLabel,
    tagline: template?.personality ?? "Commercial contractor vehicle disguise.",
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
  if (!validateDisguisePackage(packageValue, slot)) throw new Error("[crewmark] Created invalid disguise package.");
  return packageValue;
}

/** Normalizes old unversioned package payloads into the current slot-scoped contract. */
export function normalizeDisguisePackage(value: unknown, slot: DisguisePackageSlot): DisguisePackage | null {
  if (validateDisguisePackage(value, slot)) return value;
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if ("slot" in raw && raw.slot !== slot) return null;
  if (typeof raw.identityArtwork !== "string" || !raw.identityArtwork) return null;
  const metadata = typeof raw.identityMetadata === "object" && raw.identityMetadata !== null
    ? raw.identityMetadata as DisguisePackage["identityMetadata"]
    : {};
  const templateId = isCoverTemplateId(raw.templateId) ? raw.templateId : resolveTemplateId(metadata.frontId, raw.identityArtwork);
  const customization = validCustomization(raw.customization) ? raw.customization : undefined;
  try {
    return createDisguisePackage(raw.identityArtwork, templateId, metadata.frontId, customization, slot);
  } catch {
    return null;
  }
}

function storagePayload(pkg: DisguisePackage): DisguisePackage {
  // Generated badge PNGs are recreated from the canonical artwork on load.
  // Omitting their duplicate payload keeps approved 1600x700 covers under browser storage quotas.
  return {
    ...pkg,
    vehicleLivery: {
      ...pkg.vehicleLivery,
      sourceCoverDataUrl: "",
      doorGraphicDataUrl: "",
      hoodGraphicDataUrl: "",
      rearGraphicDataUrl: "",
      sideStripeDataUrl: "",
    },
  };
}

/** Validated single-source persistence for one independent cover slot. */
export function replaceDisguisePackage(slot: DisguisePackageSlot, pkg: DisguisePackage): boolean {
  if (!validateDisguisePackage(pkg, slot) || typeof window === "undefined") return false;
  const serialized = JSON.stringify(storagePayload(pkg));
  try {
    window.localStorage.setItem(packageKey(slot), serialized);
    return true;
  } catch (err) {
    try {
      window.sessionStorage?.setItem(packageKey(slot), serialized);
      return true;
    } catch {
      console.warn("[crewmark] Failed to save disguise package:", err instanceof Error ? err.message : String(err));
      return false;
    }
  }
}

interface PersistedDisguisePackage extends Omit<DisguisePackage, "identityArtwork" | "vehicleLivery"> {
  readonly identityArtwork?: string;
  readonly identityArtworkRef: CoverAssetRef;
  readonly vehicleLivery: Omit<VehicleLivery, "sourceCoverDataUrl" | "doorGraphicDataUrl" | "hoodGraphicDataUrl" | "rearGraphicDataUrl" | "sideStripeDataUrl"> & {
    readonly sourceCoverDataUrl?: string;
    readonly doorGraphicDataUrl?: string;
    readonly hoodGraphicDataUrl?: string;
    readonly rearGraphicDataUrl?: string;
    readonly sideStripeDataUrl?: string;
  };
}

function refStoragePayload(pkg: DisguisePackage, ref: CoverAssetRef): PersistedDisguisePackage {
  const payload = storagePayload(pkg);
  return {
    ...payload,
    identityArtwork: undefined,
    identityArtworkRef: ref,
  };
}

/** Durable package write: artwork bytes live in IndexedDB; local/session storage keeps metadata only. */
export async function replaceDisguisePackageAsync(slot: DisguisePackageSlot, pkg: DisguisePackage): Promise<boolean> {
  if (!validateDisguisePackage(pkg, slot) || typeof window === "undefined") return false;
  try {
    const ref = await putCoverAsset(pkg.identityArtwork);
    const serialized = JSON.stringify(refStoragePayload(pkg, ref));
    window.localStorage.setItem(packageKey(slot), serialized);
    try {
      window.sessionStorage?.removeItem(packageKey(slot));
    } catch {
      // Local storage is authoritative when available.
    }
    return true;
  } catch (err) {
    console.warn("[crewmark] Failed to save durable disguise package:", err);
    return false;
  }
}


function packageStorageCandidates(key: string): string[] {
  const values: string[] = [];
  try {
    const local = window.localStorage.getItem(key);
    if (local) values.push(local);
  } catch {
    // Try the session fallback below.
  }
  try {
    const session = window.sessionStorage?.getItem(key);
    if (session) values.push(session);
  } catch {
    // No available browser storage.
  }
  return values;
}

export function loadDisguisePackage(slot: DisguisePackageSlot): DisguisePackage | null {
  if (typeof window === "undefined") return null;
  for (const raw of packageStorageCandidates(packageKey(slot))) {
    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeDisguisePackage(parsed, slot);
      if (!normalized) continue;
      if (!validateDisguisePackage(parsed, slot)) replaceDisguisePackage(slot, normalized);
      return normalized;
    } catch {
      continue;
    }
  }
  return null;
}
export function clearDisguisePackage(slot: DisguisePackageSlot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(packageKey(slot));
  } catch {
    // Continue with the session fallback.
  }
  try {
    window.sessionStorage?.removeItem(packageKey(slot));
  } catch (err) {
    console.warn("[crewmark] Failed to clear disguise package:", err);
  }
}


export function clearDisguisePackages(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PACKAGE_KEY_V1);
    window.localStorage.removeItem(PACKAGE_KEY_V2);
    window.sessionStorage?.removeItem(PACKAGE_KEY_V1);
    window.sessionStorage?.removeItem(PACKAGE_KEY_V2);
  } catch (err) {
    console.warn("[crewmark] Failed to clear disguise packages:", err);
  }
}
/** Hydrates a ref-based package without exposing IndexedDB details to consumers. */
export async function loadDisguisePackageAsync(slot: DisguisePackageSlot): Promise<DisguisePackage | null> {
  if (typeof window === "undefined") return null;
  for (const raw of packageStorageCandidates(packageKey(slot))) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const ref = parsed.identityArtworkRef as CoverAssetRef | undefined;
      const artwork = ref ? await getCoverAsset(ref) : typeof parsed.identityArtwork === "string" ? parsed.identityArtwork : null;
      if (!artwork) continue;
      const normalized = normalizeDisguisePackage(
        {
          ...parsed,
          identityArtwork: artwork,
          vehicleLivery: {
            ...(typeof parsed.vehicleLivery === "object" && parsed.vehicleLivery !== null ? parsed.vehicleLivery : {}),
            sourceCoverDataUrl: artwork,
          },
        },
        slot,
      );
      if (!normalized) continue;
      const hydrated = { ...normalized, ...(ref ? { identityArtworkRef: ref } : {}) };
      if (!ref) await replaceDisguisePackageAsync(slot, hydrated);
      return hydrated;
    } catch {
      continue;
    }
  }
  return null;
}
