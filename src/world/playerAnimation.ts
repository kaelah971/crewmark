import idleFrame from "../assets/world/player-idle.png";
import walkFrame01 from "../assets/world/player-walk-01.png";
import walkFrame02 from "../assets/world/player-walk-02.png";
import walkFrame03 from "../assets/world/player-walk-03.png";
import walkFrame04 from "../assets/world/player-walk-04.png";

/**
 * P5.0A — production player walk cycle.
 *
 * Five production frames, one consistent character identity, transparent
 * backgrounds, shared 1024x1536 canvas with the feet baseline at the same
 * row (~1490/1536). The walk cycle runs at ~8fps while moving and resets
 * to the idle frame on stop. No SVG/cartoon stand-ins anywhere.
 */

/** Milliseconds per walk frame (~8fps). */
export const WALK_FRAME_MS = 125;

/** Idle frame: standing pose, feet together. */
export const PLAYER_IDLE_FRAME = idleFrame;

/** Walk cycle in stride order: push-off, stride, passing, landing. */
export const PLAYER_WALK_FRAMES: readonly [string, string, string, string] = [
  walkFrame01,
  walkFrame02,
  walkFrame03,
  walkFrame04,
] as const;

/** All frames, for preloading before gameplay. */
export const PLAYER_ALL_FRAMES: readonly string[] = [
  idleFrame,
  walkFrame01,
  walkFrame02,
  walkFrame03,
  walkFrame04,
] as const;

/**
 * Pure frame selector: idle frame when stopped, cycling walk frames while
 * moving. Elapsed time drives the cycle so the animation never restarts
 * on React re-render — only on actual movement transitions.
 */
export function selectPlayerFrame(moving: boolean, elapsedMs: number): string {
  if (!moving) return PLAYER_IDLE_FRAME;
  const index =
    Math.floor(elapsedMs / WALK_FRAME_MS) % PLAYER_WALK_FRAMES.length;
  return PLAYER_WALK_FRAMES[index];
}

/** Preload every player frame so gameplay never flashes a missing sprite. */
export function preloadPlayerFrames(): void {
  if (typeof Image === "undefined") return;
  for (const src of PLAYER_ALL_FRAMES) {
    const img = new Image();
    img.src = src;
  }
}
