import type { ReceiptState } from "../world/receipts";
import { EMPTY_RECEIPT_STATE } from "../world/receipts";

/**
 * P3.5A-R.4: "CAMERAS KEEP RECEIPTS / THE COVER BURNS"
 * Dedicated localStorage slot for receipt review and burn consequence.
 * Old saves load cleanly with default empty state.
 */

const STORAGE_KEY = "crewmark:r:job01receipts";

export { STORAGE_KEY as RECEIPTS_STORAGE_KEY };

function sanitize(raw: unknown): ReceiptState {
  if (typeof raw !== "object" || raw === null) return EMPTY_RECEIPT_STATE;
  const v = raw as Record<string, unknown>;
  return {
    cameraReceiptsSeen: v.cameraReceiptsSeen === true,
    cover01Burned: v.cover01Burned === true,
    burnHeatPaid: v.burnHeatPaid === true,
    burnedAt: typeof v.burnedAt === "string" ? v.burnedAt : undefined,
  };
}

export function loadReceiptState(): ReceiptState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_RECEIPT_STATE;
    return sanitize(JSON.parse(raw));
  } catch (err) {
    console.warn("[crewmark] Failed to load receipt state; using default empty state.", err);
    return EMPTY_RECEIPT_STATE;
  }
}

export function saveReceiptState(state: ReceiptState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn("[crewmark] Failed to save receipt state.", err);
    return false;
  }
}

export function clearReceiptState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[crewmark] Failed to clear receipt state.", err);
  }
}
