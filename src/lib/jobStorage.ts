// Minimal JOB//01 acceptance flag (P3.5A-R).
//
// A dedicated localStorage key — never merged into progressStorage — so
// old saves load with the job unaccepted and RESET simply removes the key.
// No cover output is stored yet; that arrives with the cover editor slice.

const STORAGE_KEY = "crewmark:r:job01accepted";

export { STORAGE_KEY as JOB_01_STORAGE_KEY };

/** True only when JOB//01 was explicitly accepted in a previous session. */
export function loadJob01Accepted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch (err) {
    console.warn("[crewmark] Job flag read failed; treating JOB//01 as unaccepted.", err);
    return false;
  }
}

/** Persist JOB//01 acceptance. */
export function saveJob01Accepted(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch (err) {
    console.warn("[crewmark] Job flag write failed; acceptance is session-only.", err);
  }
}

/** Clear JOB//01 acceptance (RESET). */
export function clearJob01Accepted(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[crewmark] Job flag clear failed.", err);
  }
}
