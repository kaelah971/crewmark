/**
 * Game-feedback sound hooks (P3.5A-R.3).
 *
 * No audio assets ship in this slice, so nothing plays yet. This module is
 * the single seam for all future sound: gameplay code calls emitGameSound()
 * with a catalogue name, which dispatches a window CustomEvent that a
 * future audio layer (or the current console, in dev) can subscribe to.
 * Safe to call anywhere — no-ops without a window, never throws, never
 * blocks rendering or gameplay.
 */

export const SOUND_NAMES = [
  "engine-idle",
  "rain-ambience",
  "checkpoint-beep",
  "barrier-motor",
  "scanner",
  "alert-tone",
  "mission-complete",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

export const SOUND_EVENT = "crewmark:sound";

export interface SoundPayload {
  readonly name: SoundName;
}

/** Fire-and-forget sound hook. Returns false when there is no dispatcher. */
export function emitGameSound(name: SoundName): boolean {
  try {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
      return false;
    }
    window.dispatchEvent(new CustomEvent<SoundPayload>(SOUND_EVENT, { detail: { name } }));
    return true;
  } catch (err) {
    console.warn("[crewmark] Sound hook failed; continuing silent.", err);
    return false;
  }
}
