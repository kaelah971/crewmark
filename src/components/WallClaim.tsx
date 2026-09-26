import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Stamp } from "lucide-react";
import WallScene, {
  DEFAULT_WALL_PLACEMENT,
  type WallPlacement,
} from "./WallScene";
import { getDistrict, type DistrictId } from "../lib/districts";

interface WallClaimProps {
  mark: string;
  districtId: DistrictId;
  /** True when this wall already paid out — commit is then a no-op by design. */
  alreadyClaimed: boolean;
  existingPlacement: WallPlacement | null;
  onCommit: (placement: WallPlacement) => void;
  onBack: () => void;
}

interface ControlDef {
  key: keyof WallPlacement;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const CONTROLS: ControlDef[] = [
  { key: "x", label: "Horizontal", min: 15, max: 85, step: 1, format: (v) => `${v}%` },
  { key: "y", label: "Vertical", min: 15, max: 85, step: 1, format: (v) => `${v}%` },
  { key: "scale", label: "Scale", min: 40, max: 160, step: 1, format: (v) => `${v}%` },
  { key: "rotate", label: "Rotation", min: -30, max: 30, step: 1, format: (v) => `${v}°` },
];

/**
 * WALL CLAIM — position the exact saved mark on the wall with reliable
 * slider controls (no Unlayer reopen, no mark mutation, alpha preserved),
 * then commit. Commit freezes the placement, plays a stamp treatment, and
 * hands the frozen placement to App exactly once.
 */
export default function WallClaim({
  mark,
  districtId,
  alreadyClaimed,
  existingPlacement,
  onCommit,
  onBack,
}: WallClaimProps) {
  const district = getDistrict(districtId);
  const [placement, setPlacement] = useState<WallPlacement>(
    existingPlacement ?? DEFAULT_WALL_PLACEMENT,
  );
  const [stamped, setStamped] = useState(false);

  const set = (key: keyof WallPlacement, value: number) => {
    setPlacement((p) => ({ ...p, [key]: value }));
  };

  const handleClaim = () => {
    if (stamped || alreadyClaimed) return;
    setStamped(true);
    window.setTimeout(() => onCommit(placement), 950);
  };

  return (
    <section className="cm-screen" aria-label="Wall claim">
      <p className="cm-kicker">
        {district.name} // Wall//001{alreadyClaimed ? " // already claimed" : ""}
      </p>
      <h1 className="cm-title">
        {district.name} <span className="accent">Wall//001</span>
      </h1>
      <p className="cm-lede">
        Leave something they can&apos;t ignore.{" "}
        <span className="cm-dim">
          Set the placement, then claim. The wall pays out once.
        </span>
      </p>

      <div className="cm-wall-layout">
        <div className="cm-wall-preview">
          <WallScene
            mark={mark}
            placement={placement}
            alt={`Your MARK//001 placed on the ${district.name} claim wall`}
          />
          <AnimatePresence>
            {stamped && (
              <motion.div
                key="stamp"
                className="cm-stamp"
                aria-hidden={true}
                initial={{ opacity: 0, scale: 1.6, rotate: -14 }}
                animate={{ opacity: 1, scale: 1, rotate: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                Claimed
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {stamped && (
              <motion.div
                key="claim-flash"
                className="cm-flash"
                aria-hidden={true}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="cm-wall-controls">
          {alreadyClaimed ? (
            <p className="cm-notice" role="status">
              This wall is already claimed — placement frozen, no double
              reward. Pick another district to keep moving.
            </p>
          ) : (
            <fieldset className="cm-fieldset" disabled={stamped}>
              <legend>Placement</legend>
              {CONTROLS.map((c) => (
                <label key={c.key} className="cm-slider">
                  <span className="cm-slider-top">
                    <span>{c.label}</span>
                    <span className="cm-slider-val">{c.format(placement[c.key])}</span>
                  </span>
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={placement[c.key]}
                    onChange={(e) => set(c.key, Number(e.target.value))}
                    aria-label={`${c.label} position control`}
                  />
                </label>
              ))}
            </fieldset>
          )}

          <div className="cm-cta-row">
            {!alreadyClaimed && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleClaim}
                disabled={stamped}
              >
                <Stamp size={16} aria-hidden={true} />
                {stamped ? "Claiming…" : "Claim this wall"}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onBack} disabled={stamped}>
              <ArrowLeft size={16} aria-hidden={true} />
              Districts
            </button>
          </div>
          <p className="cm-hint">
            Rep +{district.repReward} · Heat +{district.heatRisk} · Territory +
            {district.territoryGain}% — paid once, on commit.
          </p>
        </div>
      </div>
    </section>
  );
}
