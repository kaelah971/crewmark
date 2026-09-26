// P6 Domain: playable business fronts ("what company is this car working for?").
//
// A front is the fictional service business the sedan's cover advertises.
// Five presets ship a starter canvas (each with its own palette and
// wordmark); `make-your-own` carries a custom profile instead, and
// `surprise-me` resolves to a random preset at selection time.
//
// Selection state persists in its own localStorage slot so old saves load
// with no front and RESET simply removes the key.

export type FrontId =
  | "pool-service"
  | "flower-delivery"
  | "pest-control"
  | "nightlife-supply"
  | "mobile-detailing"
  | "make-your-own"
  | "surprise-me";

export type PresetFrontId = Exclude<FrontId, "make-your-own" | "surprise-me">;

export type StarterTemplateKind = "blank" | "starter" | "user-image";

export interface FrontOption {
  readonly id: FrontId;
  readonly label: string;
  readonly inspiration: string;
  readonly personality: string;
  readonly visualVibe: string;
  /** Present for presets only; `make-your-own` / `surprise-me` have none. */
  readonly starterTemplateId?: string;
}

export const FRONT_OPTIONS: readonly FrontOption[] = [
  {
    id: "pool-service",
    label: "Pool Service",
    inspiration: "Sun-bleached vans parked outside gated subdivisions.",
    personality: "Friendly, chlorinated competence. Shows up every Tuesday.",
    visualVibe: "Aqua panels, safety-orange stripe, bold white wordmark.",
    starterTemplateId: "starter:pool-service",
  },
  {
    id: "flower-delivery",
    label: "Flower Delivery",
    inspiration: "Refrigerated sprinters double-parked outside reception halls.",
    personality: "Polite urgency. Always carrying something perishable.",
    visualVibe: "Blush panels, leaf-green stripe, soft dark wordmark.",
    starterTemplateId: "starter:flower-delivery",
  },
  {
    id: "pest-control",
    label: "Pest Control",
    inspiration: "Heritage exterminators with thirty years of door hangers.",
    personality: "Grim cheer. Guarantees you will never see the problem.",
    visualVibe: "Hazard-yellow panels, black band, heavy black wordmark.",
    starterTemplateId: "starter:pest-control",
  },
  {
    id: "nightlife-supply",
    label: "Nightlife Supply",
    inspiration: "Unmarked wholesalers restocking clubs at 4 AM.",
    personality: "Nocturnal, discreet, cash-preferred.",
    visualVibe: "Near-black violet panels, neon magenta band, pale wordmark.",
    starterTemplateId: "starter:nightlife-supply",
  },
  {
    id: "mobile-detailing",
    label: "Mobile Detailing",
    inspiration: "Water-tank trailers working office lots at lunch hour.",
    personality: "Mirror-finish pride. We come to you.",
    visualVibe: "Deep navy panels, silver stripe with an orange edge.",
    starterTemplateId: "starter:mobile-detailing",
  },
  {
    id: "make-your-own",
    label: "Make Your Own",
    inspiration: "A blank invoice and your best fiction.",
    personality: "Whatever you can sell at the gate.",
    visualVibe: "Your palette, your wording — validated, never judged.",
  },
  {
    id: "surprise-me",
    label: "Surprise Me",
    inspiration: "The dispatcher picks. No take-backs.",
    personality: "Whoever needed a driver tonight.",
    visualVibe: "One of the house presets, chosen at random.",
  },
];

export const PRESET_FRONT_IDS: readonly PresetFrontId[] = [
  "pool-service",
  "flower-delivery",
  "pest-control",
  "nightlife-supply",
  "mobile-detailing",
];

export const FRONT_OPTION_BY_ID: Readonly<Record<FrontId, FrontOption>> =
  Object.fromEntries(FRONT_OPTIONS.map((option) => [option.id, option])) as Readonly<
    Record<FrontId, FrontOption>
  >;

export interface CustomFrontProfile {
  readonly businessName: string;
  readonly tagline?: string;
  readonly palette?: {
    readonly background: string;
    readonly accent: string;
    readonly ink: string;
  };
}

export interface ChosenFrontRecord {
  readonly schemaVersion: 1;
  readonly requestedFrontId: FrontId;
  readonly resolvedFrontId: FrontId;
  readonly customProfile: CustomFrontProfile | null;
  readonly selectedAt: string;
}

export const CHOSEN_FRONT_STORAGE_KEY = "crewmark:p6:chosenFront";

export interface StarterTemplateRequest {
  readonly kind: StarterTemplateKind;
  readonly frontId?: FrontId;
  readonly imageDataUrl?: string;
}

export interface StarterTemplateResult {
  readonly kind: StarterTemplateKind;
  readonly frontId: FrontId | null;
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

export const STARTER_TEMPLATE_WIDTH = 1600;
export const STARTER_TEMPLATE_HEIGHT = 700;

/** Blank vinyl stock, matching COVER_BASE in coverCanvas.ts. */
const BLANK_STOCK = "#F2EBDD";

interface PresetArt {
  readonly background: string;
  readonly accent: string;
  readonly ink: string;
  readonly headline: string;
  readonly sub: string;
}

const PRESET_ART: Readonly<Record<PresetFrontId, PresetArt>> = {
  "pool-service": {
    background: "#17A8C6",
    accent: "#F2762E",
    ink: "#FFFFFF",
    headline: "CLEARWATER POOL SERVICE",
    sub: "24HR \u2022 CHEMICALS \u2022 REPAIRS",
  },
  "flower-delivery": {
    background: "#F6E7EE",
    accent: "#2E7D4F",
    ink: "#402030",
    headline: "PETAL & STEM",
    sub: "SAME-DAY DELIVERY",
  },
  "pest-control": {
    background: "#F5C518",
    accent: "#141414",
    ink: "#141414",
    headline: "APEX PEST CONTROL",
    sub: "LICENSED \u2022 DISCREET \u2022 GUARANTEED",
  },
  "nightlife-supply": {
    background: "#14101F",
    accent: "#C86BFF",
    ink: "#F2ECFF",
    headline: "AFTERHOURS SUPPLY",
    sub: "WHOLESALE \u2022 NIGHTS",
  },
  "mobile-detailing": {
    background: "#16283F",
    accent: "#F2762E",
    ink: "#E8EEF4",
    headline: "MIRROR MOBILE DETAILING",
    sub: "WE COME TO YOU",
  },
};

const ALL_FRONT_IDS: readonly FrontId[] = FRONT_OPTIONS.map((option) => option.id);

export function isFrontId(value: unknown): value is FrontId {
  return typeof value === "string" && (ALL_FRONT_IDS as readonly string[]).includes(value);
}

export function isPresetFrontId(value: unknown): value is PresetFrontId {
  return typeof value === "string" && (PRESET_FRONT_IDS as readonly string[]).includes(value);
}

function isPlausibleImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function isCustomProfile(value: unknown): value is CustomFrontProfile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.businessName === "string" && v.businessName.length > 0;
}

export function isChosenFrontRecord(value: unknown): value is ChosenFrontRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    isFrontId(v.requestedFrontId) &&
    isFrontId(v.resolvedFrontId) &&
    (v.customProfile === null || isCustomProfile(v.customProfile)) &&
    typeof v.selectedAt === "string"
  );
}

export function isStarterTemplateInput(value: unknown): value is StarterTemplateRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== "blank" && v.kind !== "starter" && v.kind !== "user-image") return false;
  if (v.frontId !== undefined && !isFrontId(v.frontId)) return false;
  if (v.kind === "user-image" && !isPlausibleImage(v.imageDataUrl)) return false;
  return true;
}

/**
 * Resolve the requested front to the front actually painted. Presets and
 * `make-your-own` resolve to themselves; `surprise-me` resolves to a random
 * preset. `randomValue` defaults to Math.random() and exists so tests can
 * pin the draw without stubbing globals.
 */
export function resolveFrontId(requested: FrontId, randomValue: number = Math.random()): FrontId {
  if (requested !== "surprise-me") return requested;
  const index = Math.min(
    PRESET_FRONT_IDS.length - 1,
    Math.max(0, Math.floor(randomValue * PRESET_FRONT_IDS.length)),
  );
  return PRESET_FRONT_IDS[index];
}

export function chooseFront(
  requested: FrontId,
  options: {
    readonly customProfile?: CustomFrontProfile | null;
    readonly selectedAt?: string;
    readonly randomValue?: number;
  } = {},
): ChosenFrontRecord {
  return {
    schemaVersion: 1,
    requestedFrontId: requested,
    resolvedFrontId: resolveFrontId(requested, options.randomValue),
    customProfile: options.customProfile ?? null,
    selectedAt: options.selectedAt ?? new Date().toISOString(),
  };
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Load the chosen front, or null when absent/invalid (old saves). */
export function loadChosenFront(): ChosenFrontRecord | null {
  try {
    const store = storage();
    if (!store) return null;
    const raw = store.getItem(CHOSEN_FRONT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isChosenFrontRecord(parsed) ? parsed : null;
  } catch (err) {
    console.warn("[crewmark] Failed to load chosen front; treating as none.", err);
    return null;
  }
}

/** Persist the chosen front. Callers keep in-memory copies on failure. */
export function saveChosenFront(record: ChosenFrontRecord): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(CHOSEN_FRONT_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch (err) {
    console.warn("[crewmark] Failed to save chosen front.", err);
    return false;
  }
}

/** Clear the chosen front (RESET). */
export function clearChosenFront(): void {
  try {
    storage()?.removeItem(CHOSEN_FRONT_STORAGE_KEY);
  } catch (err) {
    console.warn("[crewmark] Failed to clear chosen front.", err);
  }
}

function starterCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = STARTER_TEMPLATE_WIDTH;
  canvas.height = STARTER_TEMPLATE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("[crewmark] 2D canvas context unavailable; cannot build the starter template.");
  }
  return { canvas, ctx };
}

function paintPreset(ctx: CanvasRenderingContext2D, frontId: PresetFrontId): void {
  const art = PRESET_ART[frontId];
  const bandH = Math.round(STARTER_TEMPLATE_HEIGHT * 0.22);
  ctx.fillStyle = art.background;
  ctx.fillRect(0, 0, STARTER_TEMPLATE_WIDTH, STARTER_TEMPLATE_HEIGHT);
  ctx.fillStyle = art.accent;
  ctx.fillRect(0, STARTER_TEMPLATE_HEIGHT - bandH, STARTER_TEMPLATE_WIDTH, bandH);
  ctx.fillStyle = art.ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 120px system-ui, sans-serif";
  ctx.fillText(art.headline, 120, 320);
  ctx.font = "500 54px system-ui, sans-serif";
  ctx.fillText(art.sub, 124, 430);
}

function resolveStarterFront(frontId: FrontId | undefined, randomValue: number): PresetFrontId {
  const resolved = resolveFrontId(frontId ?? "pool-service", randomValue);
  if (!isPresetFrontId(resolved)) {
    throw new Error(
      "[crewmark] Starter templates need a preset front; custom fronts use a blank canvas or their own image.",
    );
  }
  return resolved;
}

async function decodeImageSize(
  imageDataUrl: string,
): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof Image === "undefined") return null;
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("undecodable"));
      img.src = imageDataUrl;
    });
    if (size.width <= 0 || size.height <= 0) return null;
    return size;
  } catch {
    return null;
  }
}

/**
 * Build the starter canvas for a front selection.
 *
 * - `blank`: untouched vinyl stock (same fill as coverCanvas.ts).
 * - `starter`: preset palette + wordmark painted on the 1600x700 panel.
 * - `user-image`: the caller's photo, validated and used as-is so customer
 *   artwork is never re-rendered or degraded.
 */
export async function createStarterTemplate(
  request: StarterTemplateRequest,
  options: { readonly randomValue?: number } = {},
): Promise<StarterTemplateResult> {
  if (!isStarterTemplateInput(request)) {
    throw new Error("[crewmark] Invalid starter template request.");
  }
  const randomValue = options.randomValue ?? Math.random();

  if (request.kind === "blank") {
    const { canvas, ctx } = starterCanvas();
    ctx.fillStyle = BLANK_STOCK;
    ctx.fillRect(0, 0, STARTER_TEMPLATE_WIDTH, STARTER_TEMPLATE_HEIGHT);
    return {
      kind: "blank",
      frontId: request.frontId ?? null,
      dataUrl: canvas.toDataURL("image/png"),
      width: STARTER_TEMPLATE_WIDTH,
      height: STARTER_TEMPLATE_HEIGHT,
    };
  }

  if (request.kind === "starter") {
    const frontId = resolveStarterFront(request.frontId, randomValue);
    const { canvas, ctx } = starterCanvas();
    paintPreset(ctx, frontId);
    return {
      kind: "starter",
      frontId,
      dataUrl: canvas.toDataURL("image/png"),
      width: STARTER_TEMPLATE_WIDTH,
      height: STARTER_TEMPLATE_HEIGHT,
    };
  }

  const imageDataUrl = request.imageDataUrl as string;
  const size = await decodeImageSize(imageDataUrl);
  return {
    kind: "user-image",
    frontId: request.frontId ?? null,
    dataUrl: imageDataUrl,
    width: size?.width ?? STARTER_TEMPLATE_WIDTH,
    height: size?.height ?? STARTER_TEMPLATE_HEIGHT,
  };
}
