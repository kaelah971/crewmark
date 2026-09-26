// P8.1: Template-first creative system — approved production cover identities.
//
// Maps the 8 approved production cover artworks from public/templates/covers/
// using the exact discovered on-disk filenames.
// The image files are the approved visual source of truth.
// Format is canonical 1600x700 (16:7 aspect ratio).

import type { CityAttention } from "./creativeMetrics";

export const COVER_TEMPLATE_W = 1600;
export const COVER_TEMPLATE_H = 700;

export type CoverTemplateId =
  | "clearwater-pool"
  | "bug-out-305"
  | "coral-bloom"
  | "nightshift-supply"
  | "vice-mobile-detail"
  | "palm-state-utilities"
  | "sunset-septic"
  | "paradise-cold-chain";

export interface CoverTemplate {
  readonly id: CoverTemplateId;
  readonly company: string;
  readonly palette: string;
  readonly personality: string;
  readonly attention: CityAttention;
  readonly whyItWorks: string;
  readonly guidance: string;
  /** Exact production artwork asset path matching discovered on-disk filename */
  readonly assetUrl: string;
}

export const COVER_TEMPLATES: readonly CoverTemplate[] = [
  {
    id: "clearwater-pool",
    company: "CLEARWATER POOL CO.",
    palette: "aqua / cream / safety orange",
    personality: "Sun-faded resort-service van. Chlorinated competence since 2014.",
    attention: "BALANCED",
    whyItWorks: "Sun-faded resort livery reads as long-term local fleet.",
    guidance: "Make it feel like the van has been servicing pools since 2014.",
    assetUrl: "/templates/covers/publictemplatescoversclearwater-pool-co.png.png",
  },
  {
    id: "bug-out-305",
    company: "BUG OUT 305",
    palette: "off-white / black / signal lime",
    personality: "Heritage pest-control work van. Grim cheer, guaranteed results.",
    attention: "HIGH",
    whyItWorks: "Hazard yellow grabs the eye — readable from ten metres, memorable to cameras.",
    guidance: "Boring enough for a gated property. Loud enough to read from ten metres.",
    assetUrl: "/templates/covers/publictemplatescoversbug-out-305.png.png",
  },
  {
    id: "coral-bloom",
    company: "CORAL BLOOM FLORISTS",
    palette: "dusty coral / cream / forest green",
    personality: "Elegant neighborhood florist sprinter. Polite urgency, perishable cargo.",
    attention: "BALANCED",
    whyItWorks: "Friendly florist van; bright but expected on residential streets.",
    guidance: "Bright enough to belong. Normal enough to ignore.",
    assetUrl: "/templates/covers/publictemplatescoverscoral-bloom.png.png",
  },
  {
    id: "nightshift-supply",
    company: "NIGHTSHIFT SUPPLY",
    palette: "charcoal / violet / amber",
    personality: "Unmarked nightlife wholesaler. Nocturnal, discreet, cash-preferred.",
    attention: "LOW",
    whyItWorks: "Dark industrial livery disappears at night; only the manifest number talks.",
    guidance: "Nocturnal and discreet — let the paperwork do the talking.",
    assetUrl: "/templates/covers/publictemplatescoversnightshift-supply.png.png",
  },
  {
    id: "vice-mobile-detail",
    company: "VICE MOBILE DETAIL",
    palette: "black / chrome / electric blue",
    personality: "Motorsport-grade mobile detailing. Mirror-finish pride, we come to you.",
    attention: "HIGH",
    whyItWorks: "Motorsport chrome and electric blue demand a second look.",
    guidance: "Mirror-finish pride. Loud is the point — just be ready to be remembered.",
    assetUrl: "/templates/covers/publictemplatescoversvice-mobile-detail.png.png",
  },
  {
    id: "palm-state-utilities",
    company: "PALM STATE UTILITIES",
    palette: "municipal blue / cream",
    personality: "Deliberately boring municipal contractor. Forms, numbers, dull colors.",
    attention: "LOW",
    whyItWorks: "The city trusts forms, numbers, and dull colors.",
    guidance: "Be deliberately boring. Forms, numbers, dull colors.",
    assetUrl: "/templates/covers/publictemplatescoverspalm-state-utilities.png.png",
  },
  {
    id: "sunset-septic",
    company: "SUNSET SEPTIC",
    palette: "tan / brown / faded cream",
    personality: "Old family service company. Badge pride, pump and repair since 1987.",
    attention: "LOW",
    whyItWorks: "Nobody looks twice at a septic truck.",
    guidance: "Old, tan, and unbothered — that's the disguise.",
    assetUrl: "/templates/covers/publictemplatescoverssunset-septic.png.png",
  },
  {
    id: "paradise-cold-chain",
    company: "PARADISE COLD CHAIN",
    palette: "ice blue / white / navy",
    personality: "Industrial refrigeration transport. Cold, clean, procedural.",
    attention: "BALANCED",
    whyItWorks: "Refrigeration units are everywhere; the snowflake earns the gate.",
    guidance: "Cold, clean, and procedural — keep it frosty.",
    assetUrl: "/templates/covers/publictemplatescoversparadise-cold-chain.png (2).png",
  },
];

const TEMPLATE_IDS: readonly string[] = COVER_TEMPLATES.map((t) => t.id);

export function isCoverTemplateId(value: unknown): value is CoverTemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

export function getCoverTemplate(id: CoverTemplateId): CoverTemplate {
  const found = COVER_TEMPLATES.find((t) => t.id === id);
  if (!found) throw new Error(`[crewmark] Unknown cover template: ${id}`);
  return found;
}

/** In-memory cache for loaded template data URLs */
const templateDataUrlCache = new Map<CoverTemplateId, string>();

/**
 * Load an approved template image asset and scale/fit it into the canonical
 * 1600x700 canvas format (aspect ratio ~2.286), returning a PNG data URL.
 * Preserves original artwork without distortion or text stretching.
 */
export async function loadCoverTemplateDataUrl(id: CoverTemplateId): Promise<string> {
  const cached = templateDataUrlCache.get(id);
  if (cached) return cached;

  const template = getCoverTemplate(id);

  if (typeof Image === "undefined" || typeof document === "undefined") {
    // In node/test environments without HTMLImageElement
    return `data:image/png;base64,mockTemplate_${id}`;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(new Error(`Failed to load template asset: ${template.assetUrl}, error: ${String(e)}`));
    img.src = template.assetUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = COVER_TEMPLATE_W;
  canvas.height = COVER_TEMPLATE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("[crewmark] 2D canvas context unavailable; cannot draw cover template.");
  }

  // Source aspect: 1896x829 = 2.2871. Target: 1600x700 = 2.2857.
  // Fit image into 1600x700 with minimal centered crop preserving exact composition.
  const srcAspect = img.naturalWidth / img.naturalHeight;
  const targetAspect = COVER_TEMPLATE_W / COVER_TEMPLATE_H;

  let sx = 0;
  let sy = 0;
  let sWidth = img.naturalWidth;
  let sHeight = img.naturalHeight;

  if (srcAspect > targetAspect) {
    sWidth = Math.round(img.naturalHeight * targetAspect);
    sx = Math.round((img.naturalWidth - sWidth) / 2);
  } else if (srcAspect < targetAspect) {
    sHeight = Math.round(img.naturalWidth / targetAspect);
    sy = Math.round((img.naturalHeight - sHeight) / 2);
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, COVER_TEMPLATE_W, COVER_TEMPLATE_H);
  const dataUrl = canvas.toDataURL("image/png");
  templateDataUrlCache.set(id, dataUrl);
  return dataUrl;
}

/** Synchronous fallback / test renderer returning data URL or mock */
export function renderCoverTemplateDataUrl(id: CoverTemplateId): string {
  const cached = templateDataUrlCache.get(id);
  if (cached) return cached;
  const template = getCoverTemplate(id);
  return template.assetUrl;
}
