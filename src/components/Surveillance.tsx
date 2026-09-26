import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FastForward, PhoneIncoming, ScanLine } from "lucide-react";
import Hud from "./Hud";

export type SurveillanceBeat = 0 | 1 | 2 | 3 | 4;

const BEAT_MS: Record<0 | 1 | 2 | 3, number> = {
  0: 2300,
  1: 3200,
  2: 3000,
  3: 3400,
};

interface SurveillanceProps {
  /** The exact saved MARK//001 — shown inside the V.C.W. evidence frame. */
  mark: string;
  /** Claimed district names for the locations-of-interest lines. */
  locations: string[];
  rep: number;
  heat: number;
  territory: number;
  /** Pays HEAT +18 exactly once (App guards on the persisted event flag). */
  onApplyHeat: () => void;
  onAdvance: () => void;
}

/**
 * SURVEILLANCE — V.C.W. incident network. Cold blue/black authority
 * interface, deliberately unlike the crew terminal. Auto-advances with a
 * replay-safe heat consequence and hands off to the unknown contact.
 */
export default function Surveillance({
  mark,
  locations,
  rep,
  heat,
  territory,
  onApplyHeat,
  onAdvance,
}: SurveillanceProps) {
  const [beat, setBeat] = useState<SurveillanceBeat>(0);
  const heatQueued = useRef(false);

  useEffect(() => {
    if (beat >= 4) return;
    const t = window.setTimeout(() => {
      setBeat((b) => Math.min(4, b + 1) as SurveillanceBeat);
    }, BEAT_MS[beat as 0 | 1 | 2 | 3]);
    return () => window.clearTimeout(t);
  }, [beat]);

  // Queue the +18 the moment the consequence beat is reached. The App-level
  // flag makes this (and skip/replay) idempotent.
  useEffect(() => {
    if (beat >= 3 && !heatQueued.current) {
      heatQueued.current = true;
      onApplyHeat();
    }
  }, [beat, onApplyHeat]);

  const skipToContact = () => {
    if (!heatQueued.current) {
      heatQueued.current = true;
      onApplyHeat();
    }
    setBeat(4);
  };

  return (
    <section className="cm-screen cm-vcw" aria-label="Vice County Watch surveillance">
      {beat < 4 && (
        <div className="cm-reveal-bar">
          <p className="cm-kicker">V.C.W. incident network // feed 07</p>
          <button type="button" className="btn btn-skip" onClick={skipToContact}>
            <FastForward size={15} aria-hidden={true} />
            Skip scan
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {beat === 0 && (
          <motion.div
            key="vcw-0"
            className="cm-scanbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3 }}
          >
            <ScanLine size={28} aria-hidden={true} />
            <p className="cm-scan-copy">Scanning symbol database…</p>
            <div className="cm-scanline" aria-hidden={true} />
            <p className="cm-scan-hit">Mark match found</p>
          </motion.div>
        )}

        {beat === 1 && (
          <motion.div
            key="vcw-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3 }}
          >
            <p className="cm-vcw-head">
              V.C.W. <span>//</span> Vice County Watch <span>//</span> Incident network
            </p>
            <h1 className="cm-vcw-title">Public assistance requested</h1>
            <p className="cm-vcw-sub">
              Investigators are linking the unidentified symbol below to
              multiple locations of interest.
            </p>
            <div className="cm-evidence">
              <span className="cm-ev-tag">Evidence // exhibit M</span>
              <img
                src={mark}
                alt="Your mark as filed in the V.C.W. evidence frame"
                draggable={false}
              />
              <span className="cm-ev-corner tl" aria-hidden={true} />
              <span className="cm-ev-corner tr" aria-hidden={true} />
              <span className="cm-ev-corner bl" aria-hidden={true} />
              <span className="cm-ev-corner br" aria-hidden={true} />
            </div>
            <dl className="cm-meta">
              <div><dt>Object</dt><dd>M-742</dd></div>
              <div><dt>Class</dt><dd>Unknown crew identifier</dd></div>
              <div><dt>Matches</dt><dd>03</dd></div>
              <div><dt>Status</dt><dd className="alert">Active</dd></div>
            </dl>
          </motion.div>
        )}

        {beat === 2 && (
          <motion.div
            key="vcw-2"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28 }}
          >
            <p className="cm-vcw-head">Cross-reference // locations of interest</p>
            <ul className="cm-locations">
              {locations.map((name) => (
                <li key={name}>
                  <span className="cm-loc-dot" aria-hidden={true} />
                  {name}
                  <span className="cm-loc-tag">Match confirmed</span>
                </li>
              ))}
            </ul>
            <p className="cm-vcw-sub dim">
              Pattern consistent with a single crew identifier. Attribution
              pending.
            </p>
          </motion.div>
        )}

        {beat === 3 && (
          <motion.div
            key="vcw-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              key="vcw-flash"
              className="cm-flash cm-flash-blue"
              aria-hidden={true}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
            />
            <h1 className="cm-vcw-title">
              Recognition <span>works both ways.</span>
            </h1>
            <div className="cm-board-hud">
              <Hud rep={rep} heat={heat} territory={territory} variant="strip" />
              <span className="cm-alpha-chip cm-alpha-bad">Heat +18 // flagged</span>
            </div>
          </motion.div>
        )}

        {beat === 4 && (
          <motion.div
            key="vcw-4"
            className="cm-contact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="cm-phone cm-vibrate" role="status" aria-label="Incoming unknown contact">
              <PhoneIncoming size={22} aria-hidden={true} />
              <p>
                Unknown contact
                <span>Incoming // tap to view</span>
              </p>
            </div>
            <div className="cm-cta-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onAdvance}
                aria-label="View the unknown message"
              >
                View message
                <ArrowRight size={16} aria-hidden={true} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  heatQueued.current = true;
                  setBeat(0);
                }}
              >
                Replay incident
              </button>
            </div>
            <p className="cm-hint">
              Replay restarts the scan visuals only — the +18 heat was already
              recorded and cannot pay again.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
