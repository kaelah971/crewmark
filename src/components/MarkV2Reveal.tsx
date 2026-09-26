import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Pencil, RotateCcw } from "lucide-react";
import { formatAlpha, type AlphaReport } from "../lib/markAlpha";

interface MarkV2RevealProps {
  /** The exact saved MARK//001 — preserved, shown for comparison only. */
  markV1: string;
  /** The exact saved MARK//002. */
  markV2: string;
  /** Runtime pixel-level alpha analysis of MARK//002 (null while analyzing). */
  alphaV2: AlphaReport | null;
  /** Return to the evolution editor (MARK//002 preserved in the editor input). */
  onRetake: () => void;
  onReset: () => void;
}

/**
 * MARK//002 REVEAL — cinematic V1 vs V2 comparison (P4A).
 *
 * No environmental scenes here per the visual rules: live React/CSS on the
 * asphalt system — heat red for compromised MARK//001, signal lime for
 * active MARK//002. Both panels render the actual saved data URLs on a
 * transparency checker so alpha stays visible.
 */
export default function MarkV2Reveal({ markV1, markV2, alphaV2, onRetake, onReset }: MarkV2RevealProps) {
  const [p4bLocked, setP4bLocked] = useState(false);

  return (
    <motion.section
      className="cm-screen"
      aria-label="Mark 002 reveal"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <p className="cm-kicker">Identity recovery // comparison</p>
      <h1 className="cm-title">
        Old name.
        <br />
        <span className="accent">New meaning.</span>
      </h1>
      <p className="cm-lede">
        The city hasn&apos;t seen this one yet.
      </p>

      <div className="cm-compare">
        <figure className="cm-compare-panel is-compromised">
          <div className="cm-compare-frame">
            <img src={markV1} alt="Your saved MARK//001 artwork" draggable={false} />
          </div>
          <figcaption>
            <span className="cm-compare-name">Mark//001</span>
            <span className="cm-compare-status bad">Status: Compromised</span>
          </figcaption>
        </figure>
        <figure className="cm-compare-panel is-active">
          <div className="cm-compare-frame">
            <img src={markV2} alt="Your saved MARK//002 artwork" draggable={false} />
          </div>
          <figcaption>
            <span className="cm-compare-name">Mark//002</span>
            <span className="cm-compare-status good">Status: Active</span>
          </figcaption>
        </figure>
      </div>

      <p className="cm-hint" aria-live="polite">
        {alphaV2 === null
          ? "Mark//002 · Alpha: analyzing…"
          : `Mark//002 · Alpha: ${alphaV2.hasTransparency ? "preserved" : "opaque"} · ${formatAlpha(alphaV2)}`}
      </p>

      <div className="cm-cta-row">
        {p4bLocked ? (
          <p className="cm-locked" role="status">
            Next phase locked // P4B — taking it back is not built yet.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setP4bLocked(true)}
            aria-label="Take it back"
          >
            Take it back
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onRetake} aria-label="Edit Mark 002 again">
          <Pencil size={16} aria-hidden="true" />
          Edit Mark//002
        </button>
        <button type="button" className="btn btn-danger" onClick={onReset} aria-label="Reset, clearing both marks">
          <RotateCcw size={16} aria-hidden="true" />
          Reset
        </button>
      </div>
      <p className="cm-hint">
        Edit returns to the evolution editor with MARK//001 reloaded.
        MARK//001 stays preserved for evidence either way.
      </p>
    </motion.section>
  );
}
