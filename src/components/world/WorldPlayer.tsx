import { useEffect, useRef, useState } from "react";
import type { PlayerState } from "../../world/types";
import {
  PLAYER_IDLE_FRAME,
  WALK_FRAME_MS,
  preloadPlayerFrames,
  selectPlayerFrame,
} from "../../world/playerAnimation";

interface WorldPlayerProps {
  player: PlayerState;
}

/**
 * In-world player character. Renders the production idle + walk-cycle
 * frames grounded to the pavement with a restrained contact shadow;
 * mirrors horizontally when facing left. While moving, frames cycle at
 * ~8fps on a wall-clock timer that resets on stop — never on React
 * re-render. Falls back to a dim ground dot only when no sprite asset
 * is available (asset failure), never the bright marker.
 */
export default function WorldPlayer({ player }: WorldPlayerProps) {
  const { pos, facing, moving, spriteSrc } = player;
  const [frameSrc, setFrameSrc] = useState<string>(
    () => spriteSrc ?? PLAYER_IDLE_FRAME,
  );
  const frameTimer = useRef(0);
  const cycleStart = useRef(0);

  useEffect(() => {
    preloadPlayerFrames();
  }, []);
  useEffect(() => {
    if (!moving) {
      window.clearInterval(frameTimer.current);
      frameTimer.current = 0;
      cycleStart.current = 0;
      const idle = spriteSrc ?? PLAYER_IDLE_FRAME;
      const t = window.setTimeout(() => setFrameSrc(idle), 0);
      return () => {
        window.clearInterval(frameTimer.current);
        window.clearTimeout(t);
      };
    }
    cycleStart.current = performance.now();
    const tick = () => {
      setFrameSrc(
        selectPlayerFrame(true, performance.now() - cycleStart.current),
      );
    };
    tick();
    frameTimer.current = window.setInterval(tick, WALK_FRAME_MS);
    return () => {
      window.clearInterval(frameTimer.current);
    };
  }, [moving, spriteSrc]);

  return (
    <div
      className={`cm-player${moving ? " is-moving" : ""}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      aria-hidden={true}
    >
      <span className="cm-player-shadow" />
      {frameSrc ? (
        <img
          className="cm-player-sprite"
          src={frameSrc}
          alt=""
          draggable={false}
          style={{ transform: facing === "left" ? "scaleX(-1)" : undefined }}
        />
      ) : (
        <span className="cm-player-fallback" />
      )}
    </div>
  );
}
