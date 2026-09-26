// Shared validation for real Unlayer editor output (P4A).
//
// Both lock actions (MARK//001 in MarkStudio, MARK//002 in MarkEvolution)
// must commit only genuine editor output. Anything that is not an image
// data URL — null, empty, or a non-image string — must never advance the
// story and must never substitute placeholder data.

/** True only for a usable image data URL from the editor. */
export function isOutputDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}
