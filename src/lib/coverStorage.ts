import type { CoverAnalysis } from "./coverAnalysis";
import type { VisualSignatureComparison } from "./signatureComparison";

/**
 * P3.5A-R.2 & P3.5A-R.5: Persistent COVER//01 and COVER//02 states.
 *
 * Dedicated localStorage keys — never merged into markStorage,
 * progressStorage, or jobStorage. COVER//01 remains historical evidence
 * when burned; COVER//02 lives in independent slots.
 */

const IMAGE_KEY = "crewmark:r:cover01";
const ANALYSIS_KEY = "crewmark:r:cover01analysis";

const IMAGE_KEY_V2 = "crewmark:r:cover02";
const ANALYSIS_KEY_V2 = "crewmark:r:cover02analysis";
const SIGNATURE_KEY_V2 = "crewmark:r:cover02signature";

export {
  IMAGE_KEY as COVER_IMAGE_KEY,
  ANALYSIS_KEY as COVER_ANALYSIS_KEY,
  IMAGE_KEY_V2 as COVER_02_IMAGE_KEY,
  ANALYSIS_KEY_V2 as COVER_02_ANALYSIS_KEY,
  SIGNATURE_KEY_V2 as COVER_02_SIGNATURE_KEY,
};

export interface CoverRecord {
  readonly image: string;
  readonly analysis: CoverAnalysis;
  readonly lockedAt: string;
}

export interface Cover02Record {
  readonly image: string;
  readonly analysis: CoverAnalysis;
  readonly signature: VisualSignatureComparison;
  readonly lockedAt: string;
}

export type CoverVersion = "COVER//01" | "COVER//02";

export interface ActiveCover {
  readonly version: CoverVersion;
  readonly image: string;
  readonly score: number;
  readonly burned: boolean;
  readonly cityMatchEstimate?: number;
}

function isPlausibleImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function isPlausibleAnalysis(value: unknown): value is CoverAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === "number" &&
    typeof v.blank === "boolean" &&
    Array.isArray(v.checks) &&
    typeof v.width === "number" &&
    typeof v.height === "number"
  );
}

function isPlausibleSignature(value: unknown): value is VisualSignatureComparison {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.signatureDistance === "number" &&
    typeof v.cityMatchEstimate === "number" &&
    typeof v.canLock === "boolean" &&
    typeof v.status === "string"
  );
}

/** Load the locked COVER//01 record, or null when absent/invalid. */
export function loadCoverRecord(): CoverRecord | null {
  try {
    const image = window.localStorage.getItem(IMAGE_KEY);
    const rawAnalysis = window.localStorage.getItem(ANALYSIS_KEY);
    if (!isPlausibleImage(image) || rawAnalysis === null) return null;
    const analysis: unknown = JSON.parse(rawAnalysis);
    if (!isPlausibleAnalysis(analysis)) return null;
    const lockedAt = window.localStorage.getItem(`${IMAGE_KEY}:lockedAt`);
    return { image, analysis, lockedAt: typeof lockedAt === "string" ? lockedAt : "" };
  } catch (err) {
    console.warn("[crewmark] Cover01 load failed; treating as no cover.", err);
    return null;
  }
}

/** Persist locked COVER//01 + its analysis. */
export function saveCoverRecord(image: string, analysis: CoverAnalysis, lockedAt: string): boolean {
  try {
    window.localStorage.setItem(IMAGE_KEY, image);
    window.localStorage.setItem(ANALYSIS_KEY, JSON.stringify(analysis));
    window.localStorage.setItem(`${IMAGE_KEY}:lockedAt`, lockedAt);
    return true;
  } catch (err) {
    console.warn("[crewmark] Cover01 save failed; cover is session-only.", err);
    return false;
  }
}

/** Load the locked COVER//02 record, or null when absent/invalid. */
export function loadCover02Record(): Cover02Record | null {
  try {
    const image = window.localStorage.getItem(IMAGE_KEY_V2);
    const rawAnalysis = window.localStorage.getItem(ANALYSIS_KEY_V2);
    const rawSignature = window.localStorage.getItem(SIGNATURE_KEY_V2);
    if (!isPlausibleImage(image) || rawAnalysis === null || rawSignature === null) return null;
    const analysis: unknown = JSON.parse(rawAnalysis);
    const signature: unknown = JSON.parse(rawSignature);
    if (!isPlausibleAnalysis(analysis) || !isPlausibleSignature(signature)) return null;
    const lockedAt = window.localStorage.getItem(`${IMAGE_KEY_V2}:lockedAt`);
    return {
      image,
      analysis,
      signature,
      lockedAt: typeof lockedAt === "string" ? lockedAt : "",
    };
  } catch (err) {
    console.warn("[crewmark] Cover02 load failed; treating as no cover02.", err);
    return null;
  }
}

/** Persist locked COVER//02 + analysis + signature comparison atomically. */
export function saveCover02Record(
  image: string,
  analysis: CoverAnalysis,
  signature: VisualSignatureComparison,
  lockedAt: string,
): boolean {
  try {
    window.localStorage.setItem(IMAGE_KEY_V2, image);
    window.localStorage.setItem(ANALYSIS_KEY_V2, JSON.stringify(analysis));
    window.localStorage.setItem(SIGNATURE_KEY_V2, JSON.stringify(signature));
    window.localStorage.setItem(`${IMAGE_KEY_V2}:lockedAt`, lockedAt);
    return true;
  } catch (err) {
    console.warn("[crewmark] Cover02 save failed; cover02 is session-only.", err);
    return false;
  }
}

/** Clear COVER//02 slots only. */
export function clearCover02Record(): void {
  try {
    window.localStorage.removeItem(IMAGE_KEY_V2);
    window.localStorage.removeItem(ANALYSIS_KEY_V2);
    window.localStorage.removeItem(SIGNATURE_KEY_V2);
    window.localStorage.removeItem(`${IMAGE_KEY_V2}:lockedAt`);
  } catch (err) {
    console.warn("[crewmark] Cover02 clear failed.", err);
  }
}

/** Clear all cover records (RESET). */
export function clearCoverRecord(): void {
  try {
    window.localStorage.removeItem(IMAGE_KEY);
    window.localStorage.removeItem(ANALYSIS_KEY);
    window.localStorage.removeItem(`${IMAGE_KEY}:lockedAt`);
    clearCover02Record();
  } catch (err) {
    console.warn("[crewmark] Cover clear failed.", err);
  }
}

/**
 * Deterministic active cover resolver:
 * - When COVER//02 is locked, it outranks COVER//01 and is the active vehicle disguise.
 * - Otherwise COVER//01 is active (and may be burned).
 * - Null when no cover exists yet.
 */
export function resolveActiveCover(
  cover01: CoverRecord | null,
  cover02: Cover02Record | null,
  cover01Burned: boolean = false,
): ActiveCover | null {
  if (cover02 !== null) {
    return {
      version: "COVER//02",
      image: cover02.image,
      score: cover02.analysis.score,
      burned: false,
      cityMatchEstimate: cover02.signature.cityMatchEstimate,
    };
  }
  if (cover01 !== null) {
    return {
      version: "COVER//01",
      image: cover01.image,
      score: cover01.analysis.score,
      burned: cover01Burned,
    };
  }
  return null;
}
