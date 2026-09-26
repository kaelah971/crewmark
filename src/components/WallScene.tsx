import type { CSSProperties } from "react";
import wallArt from "../assets/p2-wall.svg";

/**
 * Adjustable wall placement. x/y are the mark CENTER in percent of the
 * scene frame; scale is percent of the base size; rotate is degrees.
 * markV1 itself is never mutated — this only positions its rendering.
 */
export interface WallPlacement {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

export const DEFAULT_WALL_PLACEMENT: WallPlacement = {
  x: 50,
  y: 52,
  scale: 100,
  rotate: 0,
};

/** Base decal width (% of frame width); height derives from the 16:9 frame. */
const BASE_WIDTH_PCT = 26;

export function wallMarkStyle(p: WallPlacement): CSSProperties {
  const width = BASE_WIDTH_PCT * (p.scale / 100);
  const height = width * (16 / 9);
  return {
    left: `${p.x - width / 2}%`,
    top: `${p.y - height / 2}%`,
    width: `${width}%`,
    height: `${height}%`,
    transform: `rotate(${p.rotate}deg)`,
  };
}

interface WallSceneProps {
  mark: string;
  placement: WallPlacement;
  alt: string;
}

/** The claim wall with the exact saved mark composited at `placement`. */
export default function WallScene({ mark, placement, alt }: WallSceneProps) {
  return (
    <div className="cm-shot-frame">
      <img className="cm-shot-img" src={wallArt} alt="" aria-hidden={true} />
      <div className="cm-mark" style={wallMarkStyle(placement)}>
        <img src={mark} alt={alt} draggable={false} />
      </div>
    </div>
  );
}
