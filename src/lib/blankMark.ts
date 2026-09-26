// Clean transparent 1024x1024 working canvas for MARK//001.
//
// The Unlayer ImageEditor requires an `image` (URL or data URL); it has no
// "empty document" mode. To avoid any remote fetch / CORS risk AND to keep
// the saved mark a reusable emblem, the starter image is generated locally
// at runtime as a fully transparent PNG data URL.
//
// Deliberately ZERO baked-in pixels: no background fill, no frame, no text,
// no crosshairs, no registration ticks. Guidance lives in the surrounding
// React UI / CSS only, so none of it can leak into the saved output.
//
// Transparency basis (verified, not guessed):
// - @unlayer/react-image-editor@1.0.2 typings expose no canvas-background
//   option for the standalone editor — nothing forces an opaque composite.
// - Official docs describe save as flattening the live vector layers onto
//   "the photo underneath", i.e. standard canvas compositing over the source
//   raster, which preserves the source alpha channel.
// - The editor ships a `shapes.transparent` fill, so transparency is a
//   first-class concept in its model.
// Runtime proof is produced per-save by lib/markAlpha.ts (pixel-level alpha
// analysis of the returned data URL) and surfaced in the reveal screen.

export const BLANK_MARK_SIZE = 1024;

export function createBlankMarkDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = BLANK_MARK_SIZE;
  canvas.height = BLANK_MARK_SIZE;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    throw new Error(
      "[crewmark] 2D canvas context unavailable; cannot build the transparent MARK//001 canvas.",
    );
  }

  // A fresh canvas is already all-zero (transparent black); clearRect makes
  // the intent explicit. Nothing else is drawn — ever.
  ctx.clearRect(0, 0, BLANK_MARK_SIZE, BLANK_MARK_SIZE);

  // Synchronous honesty check: every pixel must be fully transparent.
  // If this throws, we fail loudly instead of shipping baked-in pixels.
  const pixels = ctx.getImageData(0, 0, BLANK_MARK_SIZE, BLANK_MARK_SIZE).data;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 0) {
      throw new Error(
        "[crewmark] Blank canvas is not fully transparent; refusing to use it as a clean source.",
      );
    }
  }

  return canvas.toDataURL("image/png");
}
