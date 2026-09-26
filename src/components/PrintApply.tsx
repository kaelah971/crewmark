import { useEffect, useState } from "react";
import type { CoverAnalysis } from "../lib/coverAnalysis";
import type { VisualSignatureComparison } from "../lib/signatureComparison";

interface PrintApplyProps {
  /** The exact locked cover image. */
  cover: string;
  /** The analysis persisted with it. */
  analysis: CoverAnalysis;
  /** BACK TO THE YARD. */
  onDone: () => void;
  /** P6: View final run receipt after signature rotation */
  onViewReceipt?: () => void;
  /** P3.5A-R.5: rotation mode flag */
  isRotation?: boolean;
  /** Signature comparison against burned COVER//01 */
  signature?: VisualSignatureComparison | null;
}

const BEATS_V1 = [
  "Print queue // 01",
  "Ink profile // ready",
  "Vinyl // cutting",
  "Application // complete",
] as const;

const BEATS_V2 = [
  "Old vinyl // stripping",
  "New profile // printing",
  "Signature // rotated",
  "Application // complete",
] as const;

const BEAT_MS = 850;

/**
 * PRINT/APPLY — short post-lock sequence (P3.5A-R.2 & P3.5A-R.5).
 */
export default function PrintApply({
  cover,
  analysis,
  onDone,
  onViewReceipt,
  isRotation = false,
  signature = null,
}: PrintApplyProps) {
  const [beat, setBeat] = useState(0);
  const beats = isRotation ? BEATS_V2 : BEATS_V1;
  useEffect(() => {
    if (beat >= beats.length) return;
    const timer = window.setTimeout(() => setBeat((b) => b + 1), BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [beat, beats.length]);

  const done = beat >= beats.length;

  return (
    <section className="cm-screen" aria-label={isRotation ? "Signature rotation print and apply" : "Print and apply"}>
      {!done ? (
        <>
          <p className="cm-kicker">Print bay // {isRotation ? "Cover//02 // Rotation" : "Cover//01"}</p>
          <ol className="cm-beats" aria-live="polite">
            {beats.map((label, index) => (
              <li
                key={label}
                className={index < beat ? "is-done" : index === beat ? "is-live" : "is-queued"}
                aria-current={index === beat ? "step" : undefined}
              >
                {label}
              </li>
            ))}
          </ol>
        </>
      ) : isRotation ? (
        <>
          <p className="cm-kicker">
            <span style={{ color: "var(--cm-lime)" }}>Cover//02 // active</span> ·{" "}
            <span style={{ color: "var(--cm-red)" }}>Cover//01 // burned</span>
          </p>
          <h1 className="cm-title">
            Same vehicle.
            <br />
            <span className="accent">Different story.</span>
          </h1>
          <div className="cm-cover-frame">
            <img src={cover} alt="Your locked Cover//02 disguise" draggable={false} />
          </div>
          <p className="cm-hint" aria-live="polite">
            Visual check // {analysis.score}% · City match estimate // {signature?.cityMatchEstimate ?? 35}% (
            {signature?.status ?? "SIGNATURE BROKEN // READY TO ROTATE"})
          </p>
          <div className="cm-cta-row">
            {onViewReceipt && (
              <button type="button" className="btn btn-primary" onClick={onViewReceipt}>
                View Run Receipt
              </button>
            )}
            <button type="button" className={onViewReceipt ? "btn btn-secondary" : "btn btn-primary"} onClick={onDone}>
              Back to the yard
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="cm-kicker">Cover//01 // active</p>
          <h1 className="cm-title">
            Looks legit
            <br />
            <span className="accent">from ten meters.</span>
          </h1>
          <div className="cm-cover-frame">
            <img src={cover} alt="Your locked contractor cover" draggable={false} />
          </div>
          <p className="cm-hint" aria-live="polite">
            Visual check // {analysis.score}% —{" "}
            {analysis.blank
              ? "untouched vinyl reads blank at the gate."
              : "this score travels with the artifact and matters at the gate."}
          </p>
          <div className="cm-cta-row">
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Back to the yard
            </button>
          </div>
        </>
      )}
    </section>
  );
}
