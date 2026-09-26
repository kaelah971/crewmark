import type { CoverTemplateId } from "./coverTemplates";
import type { FrontId } from "./fronts";

export type VehicleStripePattern =
  | "hazard"
  | "wave"
  | "logistics"
  | "municipal"
  | "service"
  | "cold"
  | "heritage"
  | "detail";

export interface VehicleLivery {
  readonly sourceCoverDataUrl: string;
  readonly templateId?: CoverTemplateId;
  readonly bodyBaseColor: string;       // Primary paint (hood, pillars, upper doors, rear quarters)
  readonly secondaryColor: string;      // Secondary paint (rockers, skirts, lower door trim, roof)
  readonly accentColor: string;         // Calipers, highlights, stripes
  readonly doorGraphicDataUrl: string;  // Transparent emblem for driver/passenger doors
  readonly hoodGraphicDataUrl: string;  // Transparent crest for hood
  readonly rearGraphicDataUrl: string;  // Transparent markings for rear quarters
  readonly sideStripeDataUrl?: string;  // Transparent rocker stripe
  readonly stripePattern: VehicleStripePattern;
  readonly companyLabel: string;
  readonly unitLabel: string;
  readonly badgeWidth: number;
  readonly badgeHeight: number;
}

interface AuthoredLiveryConfig {
  readonly bodyBaseColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
  readonly stripePattern: VehicleStripePattern;
  readonly companyLabel: string;
  readonly unitLabel: string;
  readonly badgeWidth: number;
  readonly badgeHeight: number;
}

const TEMPLATE_CONFIGS: Record<CoverTemplateId, AuthoredLiveryConfig> = {
  "bug-out-305": {
    bodyBaseColor: "#E8E4D5",       // Warm off-white / cream
    secondaryColor: "#171817",     // Deep satin black (lower trim, roof, skirts)
    accentColor: "#D8FF3E",        // Signal lime
    stripePattern: "hazard",
    companyLabel: "BUG OUT 305",
    unitLabel: "UNIT 05 // PEST",
    badgeWidth: 0.65,
    badgeHeight: 0.42,
  },
  "clearwater-pool": {
    bodyBaseColor: "#ECE5D5",       // Resort cream
    secondaryColor: "#0A6B88",     // Deep aquatic blue
    accentColor: "#F97316",        // Safety orange
    stripePattern: "wave",
    companyLabel: "CLEARWATER POOL CO.",
    unitLabel: "SVC // 305-0147",
    badgeWidth: 0.68,
    badgeHeight: 0.44,
  },
  "coral-bloom": {
    bodyBaseColor: "#F5EBE6",       // Soft antique cream
    secondaryColor: "#1E3A2B",     // Deep forest green
    accentColor: "#E07A5F",        // Dusty coral
    stripePattern: "service",
    companyLabel: "CORAL BLOOM FLORISTS",
    unitLabel: "CBF-017 // MIAMI",
    badgeWidth: 0.66,
    badgeHeight: 0.42,
  },
  "nightshift-supply": {
    bodyBaseColor: "#1C1C22",       // Deep matte charcoal
    secondaryColor: "#2E1B42",     // Midnight violet
    accentColor: "#F59E0B",        // Amber logistics
    stripePattern: "logistics",
    companyLabel: "NIGHTSHIFT SUPPLY",
    unitLabel: "MN-2210 // DOCK 7",
    badgeWidth: 0.70,
    badgeHeight: 0.38,
  },
  "vice-mobile-detail": {
    bodyBaseColor: "#0C0E12",       // Gloss obsidian black
    secondaryColor: "#8E99A5",     // Metallic silver
    accentColor: "#00A3FF",        // Electric cyan
    stripePattern: "detail",
    companyLabel: "VICE MOBILE DETAIL",
    unitLabel: "UNIT 01 // 305",
    badgeWidth: 0.68,
    badgeHeight: 0.42,
  },
  "palm-state-utilities": {
    bodyBaseColor: "#EFECE4",       // Municipal cream
    secondaryColor: "#1B4D7E",     // State utility blue
    accentColor: "#60A5FA",        // Light reflex blue
    stripePattern: "municipal",
    companyLabel: "PALM STATE UTILITIES",
    unitLabel: "DISTRICT 7 // UNIT 12",
    badgeWidth: 0.65,
    badgeHeight: 0.42,
  },
  "sunset-septic": {
    bodyBaseColor: "#E2D7C5",       // Weathered tan
    secondaryColor: "#3D2617",     // Deep heritage brown
    accentColor: "#C25920",        // Sunset burnt orange
    stripePattern: "heritage",
    companyLabel: "SUNSET SEPTIC",
    unitLabel: "EST. 1987 // UNIT 03",
    badgeWidth: 0.68,
    badgeHeight: 0.44,
  },
  "paradise-cold-chain": {
    bodyBaseColor: "#F1F5F9",       // Glacier white
    secondaryColor: "#0F2942",     // Deep maritime navy
    accentColor: "#38BDF8",        // Frost cyan
    stripePattern: "cold",
    companyLabel: "PARADISE COLD CHAIN",
    unitLabel: "UNIT 08 // -20°F",
    badgeWidth: 0.68,
    badgeHeight: 0.42,
  },
};

const FRONT_TO_TEMPLATE: Partial<Record<FrontId, CoverTemplateId>> = {
  "pool-service": "clearwater-pool",
  "flower-delivery": "coral-bloom",
  "pest-control": "bug-out-305",
  "nightlife-supply": "nightshift-supply",
  "mobile-detailing": "vice-mobile-detail",
};

/**
 * Creates an in-memory transparent canvas or fallback if window/document is unavailable.
 */
function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement | null; ctx: CanvasRenderingContext2D | null } {
  if (typeof document === "undefined") {
    return { canvas: null, ctx: null };
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

// Transparent 1x1 fallback PNG
const TRANSPARENT_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// Cache generated badges so canvases are created only once per template
const BADGE_CACHE = new Map<string, { door: string; hood: string; rear: string; stripe: string }>();

/**
 * Generates authored transparent vector-quality badges for the 8 templates.
 * Every badge has a completely transparent outer background — no rectangular card.
 */
function generateTemplateBadges(id: CoverTemplateId): { door: string; hood: string; rear: string; stripe: string } {
  if (BADGE_CACHE.has(id)) {
    return BADGE_CACHE.get(id)!;
  }

  const { canvas: doorCanvas, ctx: dCtx } = createCanvas(512, 320);
  const { canvas: hoodCanvas, ctx: hCtx } = createCanvas(256, 256);
  const { canvas: rearCanvas, ctx: rCtx } = createCanvas(512, 160);
  const { canvas: stripeCanvas, ctx: sCtx } = createCanvas(512, 64);

  if (!doorCanvas || !dCtx || !hoodCanvas || !hCtx || !rearCanvas || !rCtx || !stripeCanvas || !sCtx) {
    const fallback = { door: TRANSPARENT_1PX, hood: TRANSPARENT_1PX, rear: TRANSPARENT_1PX, stripe: TRANSPARENT_1PX };
    return fallback;
  }

  switch (id) {
    case "bug-out-305": {
      // --- DOOR BADGE ---
      // Shield emblem
      dCtx.save();
      dCtx.translate(70, 160);
      dCtx.beginPath();
      dCtx.moveTo(0, -90);
      dCtx.lineTo(65, -60);
      dCtx.lineTo(65, 40);
      dCtx.quadraticCurveTo(0, 105, 0, 105);
      dCtx.quadraticCurveTo(-65, 40, -65, 40);
      dCtx.lineTo(-65, -60);
      dCtx.closePath();
      dCtx.fillStyle = "#152015";
      dCtx.fill();
      dCtx.lineWidth = 6;
      dCtx.strokeStyle = "#D8FF3E";
      dCtx.stroke();

      // Bug icon in lime
      dCtx.fillStyle = "#D8FF3E";
      dCtx.beginPath();
      dCtx.ellipse(0, 5, 20, 32, 0, 0, Math.PI * 2);
      dCtx.fill();
      // Head
      dCtx.beginPath();
      dCtx.arc(0, -32, 14, 0, Math.PI * 2);
      dCtx.fill();
      // Antennae
      dCtx.strokeStyle = "#D8FF3E";
      dCtx.lineWidth = 3;
      dCtx.beginPath();
      dCtx.moveTo(-6, -42);
      dCtx.quadraticCurveTo(-22, -60, -28, -50);
      dCtx.moveTo(6, -42);
      dCtx.quadraticCurveTo(22, -60, 28, -50);
      dCtx.stroke();
      // Legs
      for (let i = -1; i <= 1; i++) {
        dCtx.beginPath();
        dCtx.moveTo(-16, i * 16);
        dCtx.lineTo(-44, i * 18 - 8);
        dCtx.moveTo(16, i * 16);
        dCtx.lineTo(44, i * 18 - 8);
        dCtx.stroke();
      }
      dCtx.restore();

      // Lettering
      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 68px 'Arial Black', Impact, sans-serif";
      dCtx.fillStyle = "#171817";
      dCtx.fillText("BUG OUT", 160, 120);
      dCtx.fillStyle = "#D8FF3E";
      dCtx.fillText("305", 380, 120);

      dCtx.font = "800 24px 'Arial Black', sans-serif";
      dCtx.fillStyle = "#171817";
      dCtx.fillText("PEST CONTROL // 24HR RESPONSE", 164, 185);

      // --- HOOD EMBLEM ---
      hCtx.translate(128, 128);
      hCtx.beginPath();
      hCtx.moveTo(0, -80);
      hCtx.lineTo(55, -50);
      hCtx.lineTo(55, 35);
      hCtx.quadraticCurveTo(0, 90, 0, 90);
      hCtx.quadraticCurveTo(-55, 35, -55, 35);
      hCtx.lineTo(-55, -50);
      hCtx.closePath();
      hCtx.fillStyle = "#171817";
      hCtx.fill();
      hCtx.lineWidth = 5;
      hCtx.strokeStyle = "#D8FF3E";
      hCtx.stroke();
      hCtx.fillStyle = "#D8FF3E";
      hCtx.beginPath();
      hCtx.ellipse(0, 5, 18, 28, 0, 0, Math.PI * 2);
      hCtx.fill();
      hCtx.beginPath();
      hCtx.arc(0, -28, 12, 0, Math.PI * 2);
      hCtx.fill();

      // --- REAR QUARTER MARKINGS ---
      rCtx.font = "900 48px monospace";
      rCtx.fillStyle = "#D8FF3E";
      rCtx.fillText("UNIT 05", 20, 70);
      rCtx.font = "700 24px monospace";
      rCtx.fillStyle = "#F2EBDD";
      rCtx.fillText("GUARANTEED // 305-555-0305", 20, 115);

      // --- STRIPE ---
      // Lime hazard chevron pattern
      sCtx.fillStyle = "#D8FF3E";
      for (let x = 0; x < 512; x += 40) {
        sCtx.beginPath();
        sCtx.moveTo(x, 0);
        sCtx.lineTo(x + 20, 0);
        sCtx.lineTo(x, 64);
        sCtx.lineTo(x - 20, 64);
        sCtx.closePath();
        sCtx.fill();
      }
      break;
    }

    case "clearwater-pool": {
      // --- DOOR BADGE ---
      // Circular sun/wave crest
      dCtx.save();
      dCtx.translate(85, 160);
      dCtx.beginPath();
      dCtx.arc(0, 0, 68, 0, Math.PI * 2);
      dCtx.fillStyle = "#0A6B88";
      dCtx.fill();
      dCtx.lineWidth = 6;
      dCtx.strokeStyle = "#F97316";
      dCtx.stroke();

      // Sun rays
      dCtx.fillStyle = "#F97316";
      dCtx.beginPath();
      dCtx.arc(0, -10, 32, Math.PI, 0);
      dCtx.fill();

      // Waves
      dCtx.strokeStyle = "#FFFFFF";
      dCtx.lineWidth = 5;
      dCtx.beginPath();
      dCtx.moveTo(-45, 15);
      dCtx.quadraticCurveTo(-20, 5, 0, 15);
      dCtx.quadraticCurveTo(20, 25, 45, 15);
      dCtx.stroke();
      dCtx.beginPath();
      dCtx.moveTo(-40, 32);
      dCtx.quadraticCurveTo(-20, 22, 0, 32);
      dCtx.quadraticCurveTo(20, 42, 40, 32);
      dCtx.stroke();
      dCtx.restore();

      // Lettering
      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 52px 'Arial Black', sans-serif";
      dCtx.fillStyle = "#0A6B88";
      dCtx.fillText("CLEARWATER", 175, 120);
      dCtx.fillStyle = "#F97316";
      dCtx.fillText("POOL CO.", 175, 175);
      dCtx.font = "800 20px monospace";
      dCtx.fillStyle = "#334155";
      dCtx.fillText("COMMERCIAL & RESIDENTIAL // EST. 2014", 178, 225);

      // --- HOOD EMBLEM ---
      hCtx.translate(128, 128);
      hCtx.beginPath();
      hCtx.arc(0, 0, 64, 0, Math.PI * 2);
      hCtx.fillStyle = "#0A6B88";
      hCtx.fill();
      hCtx.lineWidth = 5;
      hCtx.strokeStyle = "#F97316";
      hCtx.stroke();
      hCtx.fillStyle = "#F97316";
      hCtx.beginPath();
      hCtx.arc(0, -10, 28, Math.PI, 0);
      hCtx.fill();

      // --- REAR MARKING ---
      rCtx.font = "900 44px monospace";
      rCtx.fillStyle = "#F97316";
      rCtx.fillText("SVC #305-0147", 20, 70);
      rCtx.font = "700 22px monospace";
      rCtx.fillStyle = "#0A6B88";
      rCtx.fillText("CHLORINATED COMPETENCE", 20, 115);

      // --- STRIPE ---
      sCtx.fillStyle = "#F97316";
      sCtx.fillRect(0, 16, 512, 16);
      sCtx.fillStyle = "#0A6B88";
      sCtx.fillRect(0, 36, 512, 12);
      break;
    }

    case "coral-bloom": {
      // --- DOOR BADGE ---
      dCtx.save();
      dCtx.translate(85, 160);
      dCtx.beginPath();
      dCtx.arc(0, 0, 66, 0, Math.PI * 2);
      dCtx.fillStyle = "#1E3A2B";
      dCtx.fill();
      dCtx.lineWidth = 5;
      dCtx.strokeStyle = "#E07A5F";
      dCtx.stroke();

      // 5-petal flower
      dCtx.fillStyle = "#E07A5F";
      for (let i = 0; i < 5; i++) {
        const ang = (i * Math.PI * 2) / 5;
        dCtx.beginPath();
        dCtx.ellipse(Math.cos(ang) * 25, Math.sin(ang) * 25, 18, 12, ang, 0, Math.PI * 2);
        dCtx.fill();
      }
      dCtx.beginPath();
      dCtx.arc(0, 0, 12, 0, Math.PI * 2);
      dCtx.fillStyle = "#F5EBE6";
      dCtx.fill();
      dCtx.restore();

      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 50px 'Arial Black', Georgia, serif";
      dCtx.fillStyle = "#1E3A2B";
      dCtx.fillText("CORAL BLOOM", 175, 125);
      dCtx.font = "800 36px 'Arial Black', sans-serif";
      dCtx.fillStyle = "#E07A5F";
      dCtx.fillText("FLORISTS", 175, 180);
      dCtx.font = "700 18px monospace";
      dCtx.fillStyle = "#2D3748";
      dCtx.fillText("PERISHABLE CARGO // DISPATCH 305", 178, 225);

      // --- HOOD EMBLEM ---
      hCtx.translate(128, 128);
      hCtx.beginPath();
      hCtx.arc(0, 0, 60, 0, Math.PI * 2);
      hCtx.fillStyle = "#1E3A2B";
      hCtx.fill();
      hCtx.strokeStyle = "#E07A5F";
      hCtx.lineWidth = 4;
      hCtx.stroke();
      hCtx.fillStyle = "#E07A5F";
      for (let i = 0; i < 5; i++) {
        const ang = (i * Math.PI * 2) / 5;
        hCtx.beginPath();
        hCtx.ellipse(Math.cos(ang) * 22, Math.sin(ang) * 22, 16, 10, ang, 0, Math.PI * 2);
        hCtx.fill();
      }

      // --- REAR ---
      rCtx.font = "900 44px monospace";
      rCtx.fillStyle = "#E07A5F";
      rCtx.fillText("CBF-017", 20, 70);
      rCtx.font = "700 20px monospace";
      rCtx.fillStyle = "#1E3A2B";
      rCtx.fillText("MIAMI • EXPRESS DELIVERY", 20, 115);

      // --- STRIPE ---
      sCtx.fillStyle = "#E07A5F";
      sCtx.fillRect(0, 24, 512, 16);
      break;
    }

    case "nightshift-supply": {
      // --- DOOR BADGE ---
      dCtx.save();
      dCtx.translate(85, 160);
      // Crescent Moon
      dCtx.fillStyle = "#F59E0B";
      dCtx.beginPath();
      dCtx.arc(0, 0, 50, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.globalCompositeOperation = "destination-out";
      dCtx.beginPath();
      dCtx.arc(20, -10, 42, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.globalCompositeOperation = "source-over";
      dCtx.restore();

      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 italic 54px 'Arial Black', Impact, sans-serif";
      dCtx.fillStyle = "#F3F4F6";
      dCtx.fillText("NIGHTSHIFT", 160, 115);
      dCtx.fillStyle = "#F59E0B";
      dCtx.fillText("SUPPLY", 160, 175);
      dCtx.font = "700 18px monospace";
      dCtx.fillStyle = "#9CA3AF";
      dCtx.fillText("WHOLESALE LOGISTICS // 02:00-06:00", 162, 225);

      // --- HOOD ---
      hCtx.translate(128, 128);
      hCtx.fillStyle = "#F59E0B";
      hCtx.beginPath();
      hCtx.arc(0, 0, 48, 0, Math.PI * 2);
      hCtx.fill();
      hCtx.globalCompositeOperation = "destination-out";
      hCtx.beginPath();
      hCtx.arc(18, -8, 40, 0, Math.PI * 2);
      hCtx.fill();
      hCtx.globalCompositeOperation = "source-over";

      // --- REAR ---
      rCtx.font = "900 42px monospace";
      rCtx.fillStyle = "#F59E0B";
      rCtx.fillText("MN-2210 // DOCK 7", 20, 70);
      rCtx.font = "700 22px monospace";
      rCtx.fillStyle = "#E5E7EB";
      rCtx.fillText("UNMARKED FLEET 04", 20, 115);

      // --- STRIPE ---
      sCtx.fillStyle = "#F59E0B";
      sCtx.fillRect(0, 20, 512, 14);
      sCtx.fillStyle = "#2E1B42";
      sCtx.fillRect(0, 36, 512, 10);
      break;
    }

    case "vice-mobile-detail": {
      // --- DOOR BADGE ---
      dCtx.save();
      dCtx.translate(85, 160);
      // Angled V badge
      dCtx.beginPath();
      dCtx.arc(0, 0, 64, 0, Math.PI * 2);
      dCtx.strokeStyle = "#8E99A5";
      dCtx.lineWidth = 5;
      dCtx.stroke();

      dCtx.fillStyle = "#00A3FF";
      dCtx.beginPath();
      dCtx.moveTo(-36, -30);
      dCtx.lineTo(0, 45);
      dCtx.lineTo(36, -30);
      dCtx.lineTo(16, -30);
      dCtx.lineTo(0, 18);
      dCtx.lineTo(-16, -30);
      dCtx.closePath();
      dCtx.fill();
      dCtx.restore();

      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 italic 62px 'Arial Black', Impact, sans-serif";
      dCtx.fillStyle = "#FFFFFF";
      dCtx.fillText("VICE", 175, 115);
      dCtx.font = "900 36px 'Arial Black', sans-serif";
      dCtx.fillStyle = "#00A3FF";
      dCtx.fillText("MOBILE DETAIL", 175, 175);
      dCtx.font = "700 20px monospace";
      dCtx.fillStyle = "#94A3B8";
      dCtx.fillText("305-555-2044 // 7 DAYS", 178, 225);

      // --- HOOD ---
      hCtx.translate(128, 128);
      hCtx.fillStyle = "#00A3FF";
      hCtx.beginPath();
      hCtx.moveTo(-44, -36);
      hCtx.lineTo(0, 52);
      hCtx.lineTo(44, -36);
      hCtx.lineTo(20, -36);
      hCtx.lineTo(0, 20);
      hCtx.lineTo(-20, -36);
      hCtx.closePath();
      hCtx.fill();

      // --- REAR ---
      rCtx.font = "900 48px monospace";
      rCtx.fillStyle = "#00A3FF";
      rCtx.fillText("UNIT 01", 20, 70);
      rCtx.font = "700 22px monospace";
      rCtx.fillStyle = "#E2E8F0";
      rCtx.fillText("MIRROR FINISH // CERAMIC", 20, 115);

      // --- STRIPE ---
      sCtx.fillStyle = "#00A3FF";
      sCtx.fillRect(0, 20, 512, 16);
      sCtx.fillStyle = "#8E99A5";
      sCtx.fillRect(0, 38, 512, 6);
      break;
    }

    case "palm-state-utilities": {
      // --- DOOR BADGE ---
      dCtx.save();
      dCtx.translate(85, 160);
      dCtx.beginPath();
      dCtx.arc(0, 0, 68, 0, Math.PI * 2);
      dCtx.fillStyle = "#1B4D7E";
      dCtx.fill();
      dCtx.lineWidth = 6;
      dCtx.strokeStyle = "#FFFFFF";
      dCtx.stroke();

      // Palm tree
      dCtx.fillStyle = "#FFFFFF";
      dCtx.beginPath();
      // Trunk
      dCtx.moveTo(-4, 38);
      dCtx.quadraticCurveTo(-8, 5, -2, -18);
      dCtx.lineTo(2, -18);
      dCtx.quadraticCurveTo(8, 5, 4, 38);
      dCtx.closePath();
      dCtx.fill();
      // Fronds
      for (const [x, y] of [[-25, -26], [25, -26], [-35, -12], [35, -12], [0, -36]]) {
        dCtx.beginPath();
        dCtx.ellipse(x, y, 16, 7, (x * 0.03), 0, Math.PI * 2);
        dCtx.fill();
      }
      dCtx.restore();

      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 46px 'Arial Black', sans-serif";
      dCtx.fillStyle = "#1B4D7E";
      dCtx.fillText("PALM STATE", 175, 120);
      dCtx.fillText("UTILITIES", 175, 175);
      dCtx.font = "800 20px monospace";
      dCtx.fillStyle = "#4B5563";
      dCtx.fillText("AUTHORIZED CONTRACTOR // UNIT 12", 178, 225);

      // --- HOOD ---
      hCtx.translate(128, 128);
      hCtx.beginPath();
      hCtx.arc(0, 0, 60, 0, Math.PI * 2);
      hCtx.fillStyle = "#1B4D7E";
      hCtx.fill();
      hCtx.lineWidth = 5;
      hCtx.strokeStyle = "#FFFFFF";
      hCtx.stroke();
      hCtx.fillStyle = "#FFFFFF";
      hCtx.fillRect(-3, -10, 6, 42);

      // --- REAR ---
      rCtx.font = "900 42px monospace";
      rCtx.fillStyle = "#1B4D7E";
      rCtx.fillText("DISTRICT 7 // METER", 20, 70);
      rCtx.font = "700 20px monospace";
      rCtx.fillStyle = "#4B5563";
      rCtx.fillText("WO-88412 • 305-555-0712", 20, 115);

      // --- STRIPE ---
      sCtx.fillStyle = "#1B4D7E";
      sCtx.fillRect(0, 18, 512, 18);
      break;
    }

    case "sunset-septic": {
      // --- DOOR BADGE ---
      dCtx.save();
      dCtx.translate(85, 160);
      dCtx.beginPath();
      dCtx.arc(0, 0, 68, 0, Math.PI * 2);
      dCtx.fillStyle = "#3D2617";
      dCtx.fill();
      dCtx.lineWidth = 6;
      dCtx.strokeStyle = "#C25920";
      dCtx.stroke();

      // SS Monogram
      dCtx.font = "900 64px 'Arial Black', Impact, sans-serif";
      dCtx.fillStyle = "#F5EBE6";
      dCtx.textAlign = "center";
      dCtx.textBaseline = "middle";
      dCtx.fillText("SS", 0, 2);
      dCtx.restore();

      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 52px 'Arial Black', sans-serif";
      dCtx.fillStyle = "#3D2617";
      dCtx.fillText("SUNSET", 175, 120);
      dCtx.fillStyle = "#C25920";
      dCtx.fillText("SEPTIC", 175, 175);
      dCtx.font = "800 20px monospace";
      dCtx.fillStyle = "#5C4033";
      dCtx.fillText("PUMP & REPAIR // EST. 1987", 178, 225);

      // --- HOOD ---
      hCtx.translate(128, 128);
      hCtx.beginPath();
      hCtx.arc(0, 0, 58, 0, Math.PI * 2);
      hCtx.fillStyle = "#3D2617";
      hCtx.fill();
      hCtx.lineWidth = 5;
      hCtx.strokeStyle = "#C25920";
      hCtx.stroke();
      hCtx.font = "900 54px 'Arial Black', sans-serif";
      hCtx.fillStyle = "#F5EBE6";
      hCtx.textAlign = "center";
      hCtx.textBaseline = "middle";
      hCtx.fillText("SS", 0, 2);

      // --- REAR ---
      rCtx.font = "900 42px monospace";
      rCtx.fillStyle = "#C25920";
      rCtx.fillText("LIC #SA-01234", 20, 70);
      rCtx.font = "700 20px monospace";
      rCtx.fillStyle = "#3D2617";
      rCtx.fillText("UNIT 03 • 305-555-1987", 20, 115);

      // --- STRIPE ---
      sCtx.fillStyle = "#C25920";
      sCtx.fillRect(0, 20, 512, 16);
      sCtx.fillStyle = "#3D2617";
      sCtx.fillRect(0, 38, 512, 8);
      break;
    }

    case "paradise-cold-chain": {
      // --- DOOR BADGE ---
      dCtx.save();
      dCtx.translate(85, 160);
      // Hexagon
      dCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const x = Math.cos(ang) * 62;
        const y = Math.sin(ang) * 62;
        if (i === 0) dCtx.moveTo(x, y);
        else dCtx.lineTo(x, y);
      }
      dCtx.closePath();
      dCtx.fillStyle = "#0F2942";
      dCtx.fill();
      dCtx.lineWidth = 5;
      dCtx.strokeStyle = "#38BDF8";
      dCtx.stroke();

      // Snowflake icon
      dCtx.strokeStyle = "#FFFFFF";
      dCtx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI) / 3;
        dCtx.beginPath();
        dCtx.moveTo(Math.cos(ang) * -38, Math.sin(ang) * -38);
        dCtx.lineTo(Math.cos(ang) * 38, Math.sin(ang) * 38);
        dCtx.stroke();
      }
      dCtx.restore();

      dCtx.textAlign = "left";
      dCtx.textBaseline = "middle";
      dCtx.font = "900 48px 'Arial Black', Impact, sans-serif";
      dCtx.fillStyle = "#0F2942";
      dCtx.fillText("PARADISE", 175, 120);
      dCtx.fillStyle = "#38BDF8";
      dCtx.fillText("COLD CHAIN", 175, 175);
      dCtx.font = "800 18px monospace";
      dCtx.fillStyle = "#334155";
      dCtx.fillText("REFRIGERATED TRANSPORT // -20°F", 178, 225);

      // --- HOOD ---
      hCtx.translate(128, 128);
      hCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const x = Math.cos(ang) * 52;
        const y = Math.sin(ang) * 52;
        if (i === 0) hCtx.moveTo(x, y);
        else hCtx.lineTo(x, y);
      }
      hCtx.closePath();
      hCtx.fillStyle = "#0F2942";
      hCtx.fill();
      hCtx.lineWidth = 4;
      hCtx.strokeStyle = "#38BDF8";
      hCtx.stroke();
      hCtx.strokeStyle = "#FFFFFF";
      hCtx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI) / 3;
        hCtx.beginPath();
        hCtx.moveTo(Math.cos(ang) * -30, Math.sin(ang) * -30);
        hCtx.lineTo(Math.cos(ang) * 30, Math.sin(ang) * 30);
        hCtx.stroke();
      }

      // --- REAR ---
      rCtx.font = "900 44px monospace";
      rCtx.fillStyle = "#38BDF8";
      rCtx.fillText("UNIT 08", 20, 70);
      rCtx.font = "700 20px monospace";
      rCtx.fillStyle = "#0F2942";
      rCtx.fillText("USDOT 4287091 // FL", 20, 115);

      // --- STRIPE ---
      sCtx.fillStyle = "#38BDF8";
      sCtx.fillRect(0, 20, 512, 16);
      sCtx.fillStyle = "#0F2942";
      sCtx.fillRect(0, 38, 512, 8);
      break;
    }
  }

  const result = {
    door: doorCanvas.toDataURL("image/png"),
    hood: hoodCanvas.toDataURL("image/png"),
    rear: rearCanvas.toDataURL("image/png"),
    stripe: stripeCanvas.toDataURL("image/png"),
  };
  BADGE_CACHE.set(id, result);
  return result;
}

/**
 * Creates a circular/oval masked door graphic from an arbitrary user cover canvas
 * so user designs sit naturally as a badge without outer rectangular cardboard edges.
 */
function createMaskedCustomBadge(sourceDataUrl: string): { door: string; hood: string; rear: string } {
  const { canvas: dCanvas, ctx: dCtx } = createCanvas(400, 400);
  const { canvas: hCanvas, ctx: hCtx } = createCanvas(200, 200);
  const { canvas: rCanvas, ctx: rCtx } = createCanvas(300, 100);

  if (!dCanvas || !dCtx || !hCanvas || !hCtx || !rCanvas || !rCtx) {
    return { door: sourceDataUrl, hood: TRANSPARENT_1PX, rear: TRANSPARENT_1PX };
  }

  // Draw circular crest with border
  dCtx.save();
  dCtx.beginPath();
  dCtx.arc(200, 200, 185, 0, Math.PI * 2);
  dCtx.clip();

  if (typeof Image !== "undefined") {
    const img = new Image();
    img.src = sourceDataUrl;
    if (img.complete && img.naturalWidth > 0) {
      // Draw centered square crop from cover
      const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
      const srcX = (img.naturalWidth - srcSize) / 2;
      const srcY = (img.naturalHeight - srcSize) / 2;
      dCtx.drawImage(img, srcX, srcY, srcSize, srcSize, 10, 10, 380, 380);
    }
  }
  dCtx.restore();

  // Add clean metallic ring around the custom badge
  dCtx.beginPath();
  dCtx.arc(200, 200, 185, 0, Math.PI * 2);
  dCtx.lineWidth = 8;
  dCtx.strokeStyle = "#D8FF3E";
  dCtx.stroke();

  // Hood badge: smaller circle
  hCtx.beginPath();
  hCtx.arc(100, 100, 90, 0, Math.PI * 2);
  hCtx.lineWidth = 6;
  hCtx.strokeStyle = "#D8FF3E";
  hCtx.fillStyle = "#171817";
  hCtx.fill();
  hCtx.stroke();

  // Rear marking
  rCtx.font = "900 36px monospace";
  rCtx.fillStyle = "#D8FF3E";
  rCtx.fillText("CUSTOM // 305", 20, 55);

  return {
    door: dCanvas.toDataURL("image/png"),
    hood: hCanvas.toDataURL("image/png"),
    rear: rCanvas.toDataURL("image/png"),
  };
}

/**
 * Resolves template ID from template or front selection or source URL.
 */
export function resolveTemplateId(
  identity?: CoverTemplateId | FrontId,
  sourceUrl?: string,
): CoverTemplateId | null {
  if (sourceUrl) {
    if (sourceUrl.includes("clearwater-pool-co") || sourceUrl.includes("clearwater")) return "clearwater-pool";
    if (sourceUrl.includes("bug-out-305") || sourceUrl.includes("bug-out")) return "bug-out-305";
    if (sourceUrl.includes("coral-bloom")) return "coral-bloom";
    if (sourceUrl.includes("nightshift-supply")) return "nightshift-supply";
    if (sourceUrl.includes("vice-mobile-detail")) return "vice-mobile-detail";
    if (sourceUrl.includes("palm-state-utilities")) return "palm-state-utilities";
    if (sourceUrl.includes("sunset-septic")) return "sunset-septic";
    if (sourceUrl.includes("paradise-cold-chain")) return "paradise-cold-chain";
  }

  // Template identity is explicit package data, never ambient localStorage.
  if (!identity) return null;
  if (identity in TEMPLATE_CONFIGS) return identity as CoverTemplateId;
  const fromFront = FRONT_TO_TEMPLATE[identity as FrontId];
  return fromFront ?? null;
}

export function deriveVehicleLivery(
  sourceCoverDataUrl: string,
  identity?: CoverTemplateId | FrontId,
): VehicleLivery {
  const templateId = resolveTemplateId(identity, sourceCoverDataUrl);

  if (templateId && templateId in TEMPLATE_CONFIGS) {
    const config = TEMPLATE_CONFIGS[templateId];
    const badges = generateTemplateBadges(templateId);
    return {
      sourceCoverDataUrl,
      templateId,
      bodyBaseColor: config.bodyBaseColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor,
      doorGraphicDataUrl: badges.door,
      hoodGraphicDataUrl: badges.hood,
      rearGraphicDataUrl: badges.rear,
      sideStripeDataUrl: badges.stripe,
      stripePattern: config.stripePattern,
      companyLabel: config.companyLabel,
      unitLabel: config.unitLabel,
      badgeWidth: config.badgeWidth,
      badgeHeight: config.badgeHeight,
    };
  }

  // Fallback for custom/user covers
  const customBadges = createMaskedCustomBadge(sourceCoverDataUrl);
  return {
    sourceCoverDataUrl,
    bodyBaseColor: "#3A3F45",
    secondaryColor: "#171817",
    accentColor: "#D8FF3E",
    doorGraphicDataUrl: customBadges.door,
    hoodGraphicDataUrl: customBadges.hood,
    rearGraphicDataUrl: customBadges.rear,
    stripePattern: "service",
    companyLabel: "VICE CONTRACTOR FLEET",
    unitLabel: "UNIT // 305",
    badgeWidth: 0.65,
    badgeHeight: 0.42,
  };
}
