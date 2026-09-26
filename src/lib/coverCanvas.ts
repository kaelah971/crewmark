// Purpose-built COVER//01 starter visual (P3.5A-R.2).
//
// Not another logo canvas: a wide 1600x700 blank commercial vinyl panel —
// the physical decal format that will wrap the sedan's side. The base is a
// plain off-white stock fill only: no wording, no logos, no frames, no
// guides baked in (guides live in the surrounding React UI so they can
// never leak into the saved artifact). Generated locally at runtime, so
// there is zero network fetch and zero CORS risk, mirroring blankMark.ts.

export const COVER_W = 1600;
export const COVER_H = 700;

/** Blank vinyl stock color. Also the analysis background reference. */
export const COVER_BASE = "#F2EBDD";

/** Build the blank 1600x700 vinyl panel as a PNG data URL. */
export function createCoverStarterDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = COVER_W;
  canvas.height = COVER_H;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error(
      "[crewmark] 2D canvas context unavailable; cannot build the COVER//01 starter panel.",
    );
  }

  ctx.fillStyle = COVER_BASE;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  return canvas.toDataURL("image/png");
}
