import { describe, expect, it } from "vitest";
import {
  PLAYER_ALL_FRAMES,
  PLAYER_IDLE_FRAME,
  PLAYER_WALK_FRAMES,
  WALK_FRAME_MS,
  selectPlayerFrame,
} from "./playerAnimation";

describe("playerAnimation (P5.0A walk cycle)", () => {
  it("stopped player always shows the idle frame", () => {
    expect(selectPlayerFrame(false, 0)).toBe(PLAYER_IDLE_FRAME);
    expect(selectPlayerFrame(false, 99999)).toBe(PLAYER_IDLE_FRAME);
  });

  it("walk frames advance one step per frame interval (~8fps)", () => {
    expect(selectPlayerFrame(true, 0)).toBe(PLAYER_WALK_FRAMES[0]);
    expect(selectPlayerFrame(true, WALK_FRAME_MS - 1)).toBe(
      PLAYER_WALK_FRAMES[0],
    );
    expect(selectPlayerFrame(true, WALK_FRAME_MS)).toBe(
      PLAYER_WALK_FRAMES[1],
    );
    expect(selectPlayerFrame(true, WALK_FRAME_MS * 2)).toBe(
      PLAYER_WALK_FRAMES[2],
    );
    expect(selectPlayerFrame(true, WALK_FRAME_MS * 3)).toBe(
      PLAYER_WALK_FRAMES[3],
    );
  });

  it("walk cycle wraps cleanly after the fourth frame", () => {
    expect(selectPlayerFrame(true, WALK_FRAME_MS * 4)).toBe(
      PLAYER_WALK_FRAMES[0],
    );
    expect(selectPlayerFrame(true, WALK_FRAME_MS * 9)).toBe(
      PLAYER_WALK_FRAMES[1],
    );
  });

  it("stopping the player resets to idle regardless of elapsed time", () => {
    expect(selectPlayerFrame(false, WALK_FRAME_MS * 3 + 40)).toBe(
      PLAYER_IDLE_FRAME,
    );
  });

  it("exposes exactly one idle frame plus four distinct walk frames", () => {
    expect(PLAYER_WALK_FRAMES).toHaveLength(4);
    expect(new Set(PLAYER_WALK_FRAMES).size).toBe(4);
    expect(PLAYER_ALL_FRAMES).toHaveLength(5);
    expect(PLAYER_ALL_FRAMES[0]).toBe(PLAYER_IDLE_FRAME);
    for (const frame of PLAYER_WALK_FRAMES) {
      expect(PLAYER_ALL_FRAMES).toContain(frame);
    }
  });
});
