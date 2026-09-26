import type { CSSProperties } from "react";

/**
 * Placement of the saved mark inside one world scene, expressed as
 * percentages of the scene frame (the frames keep a fixed aspect ratio,
 * so percentage placement stays glued to the artwork at any width).
 */
export interface MarkPlacementSpec {
  left: string;
  top: string;
  width: string;
  height: string;
  /** Degrees of rotation to sit the mark into the scene (default 0). */
  rotate?: number;
}

interface MarkPlacementProps {
  /** The exact saved MARK//001 data URL — rendered as-is, never mutated. */
  src: string;
  alt: string;
  placement: MarkPlacementSpec;
}

/**
 * Reusable decal applicator. object-fit: contain preserves every pixel of
 * the saved artwork; transparent alpha is preserved (no background, no
 * border, no outline on the element — only a grounding drop-shadow).
 */
export default function MarkPlacement({ src, alt, placement }: MarkPlacementProps) {
  const style: CSSProperties = {
    left: placement.left,
    top: placement.top,
    width: placement.width,
    height: placement.height,
    transform: placement.rotate ? `rotate(${placement.rotate}deg)` : undefined,
  };
  return (
    <div className="cm-mark" style={style} aria-hidden={false}>
      <img src={src} alt={alt} draggable={false} />
    </div>
  );
}
