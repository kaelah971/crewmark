import type { CSSProperties, ReactNode } from "react";
import type { Vec2 } from "../../world/types";

interface WorldSceneProps {
  /** Realistic raster environment plate (never SVG scenery). */
  plateSrc: string;
  plateAlt: string;
  /** World-space focus point the camera centers on. */
  camera: Vec2;
  /** World-locked layer: player, zones, mark surfaces (glued to the plate). */
  children: ReactNode;
  /** Screen-locked layer: HUD, prompts, labels. */
  screenChildren?: ReactNode;
  label: string;
}

const ZOOM = 1.18;
/** Max camera travel in viewport % — layer always covers the frame. */
const MAX_SHIFT = ((ZOOM - 1) / 2) * 100;

function clampShift(v: number): number {
  return Math.min(MAX_SHIFT, Math.max(-MAX_SHIFT, v));
}

/**
 * Cinematic viewport: fixed-aspect frame, zoomed world layer translated so
 * the camera focus stays centered, screen-locked haze/vignette on top.
 * All motion inputs come from props — no internal animation state.
 */
export default function WorldScene({
  plateSrc,
  plateAlt,
  camera,
  children,
  screenChildren,
  label,
}: WorldSceneProps) {
  // Map world focus to a bounded viewport-% offset (gentle-follow feel).
  // The zoomed layer always covers the frame, so the plate never reveals
  // edges no matter where the clamped camera sits.
  const ox = clampShift((50 - camera.x) * 0.55);
  const oy = clampShift((50 - camera.y) * 0.55);
  const layerStyle: CSSProperties = {
    width: `${ZOOM * 100}%`,
    height: `${ZOOM * 100}%`,
    transform: `translate(${ox / ZOOM}% , ${oy / ZOOM}% )`,
  };

  return (
    <div className="cm-world" role="application" aria-label={label}>
      <div className="cm-world-cam" style={layerStyle}>
        <img className="cm-world-plate" src={plateSrc} alt="" aria-hidden={true} draggable={false} />
        {children}
      </div>
      <div className="cm-world-haze" aria-hidden={true} />
      <div className="cm-world-vignette" aria-hidden={true} />
      <span className="cm-world-plate-alt" role="img" aria-label={plateAlt} />
      {screenChildren}
    </div>
  );
}
