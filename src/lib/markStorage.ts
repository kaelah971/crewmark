// MARK//001 persistence for the P0 spike.
//
// The saved mark is a PNG data URL produced by the real Unlayer editor
// (via onSave or getImage()). It is kept in React state as the source of
// truth and mirrored to localStorage so a refresh does not destroy the
// technical proof. No backend, no database for P0.
//
// P4A adds a second, independent slot for the evolved MARK//002. The V1
// slot is never written by the V2 flow and is never cleared except by an
// explicit full reset, so V1 remains available for counterfeit/evidence
// scenes permanently.

const STORAGE_KEY = "crewmark:p0:markV1";

/** Independent localStorage slot for the evolved MARK//002 (P4A). */
const STORAGE_KEY_V2 = "crewmark:p4:markV2";

function isPlausibleMark(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

/** Read the persisted mark, or null when nothing valid was stored. */
export function loadMark(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isPlausibleMark(raw) ? raw : null;
  } catch (err) {
    console.warn("[crewmark] localStorage read failed; mark will be session-only.", err);
    return null;
  }
}

/**
 * Persist the mark. Returns false when the write failed (e.g. quota) —
 * callers keep the in-memory copy and continue.
 */
export function saveMark(dataUrl: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, dataUrl);
    return true;
  } catch (err) {
    console.warn("[crewmark] localStorage write failed; mark will be session-only.", err);
    return false;
  }
}

/** Clear the persisted mark (RESET SPIKE). */
export function clearMark(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[crewmark] localStorage clear failed.", err);
  }
}

/** Read the persisted MARK//002, or null when nothing valid was stored. */
export function loadMarkV2(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_V2);
    return isPlausibleMark(raw) ? raw : null;
  } catch (err) {
    console.warn("[crewmark] localStorage read failed; MARK//002 will be session-only.", err);
    return null;
  }
}

/**
 * Persist MARK//002 in its own slot. Never touches the MARK//001 slot.
 * Returns false when the write failed (e.g. quota).
 */
export function saveMarkV2(dataUrl: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY_V2, dataUrl);
    return true;
  } catch (err) {
    console.warn("[crewmark] localStorage write failed; MARK//002 will be session-only.", err);
    return false;
  }
}

/** Clear the persisted MARK//002. */
export function clearMarkV2(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY_V2);
  } catch (err) {
    console.warn("[crewmark] localStorage clear failed.", err);
  }
}

export { STORAGE_KEY, STORAGE_KEY_V2 };
