import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Camera, FastForward } from "lucide-react";
import MarkPlacement, { type MarkPlacementSpec } from "./MarkPlacement";
import Hud from "./Hud";
import warehouseArt from "../assets/p3-warehouse.svg";
import haloArt from "../assets/p3-halo.svg";

type TheftStep = 0 | 1 | 2 | 3;

const STEP_MS: Record<0 | 1 | 2, number> = {
  0: 5200,
  1: 3400,
  2: 3400,
};

// Fixed counterfeit composition on the warehouse roller door (1200x675):
// the player's exact mark plus a separate rival signature beside it.
const WAREHOUSE_MARK: MarkPlacementSpec = {
  left: "35%",
  top: "34.07%",
  width: "30%",
  height: "53.33%",
};
const HALO_MARK: MarkPlacementSpec = {
  left: "66.67%",
  top: "48.89%",
  width: "6%",
  height: "11.85%",
};

interface Message {
  from: "unknown" | "player";
  text: string;
}

const SCRIPT: Message[] = [
  { from: "unknown", text: "nice logo." },
  { from: "unknown", text: "shame about the warehouse." },
  { from: "player", text: "what warehouse?" },
];

interface IdentityTheftProps {
  /** The exact saved MARK//001 — counterfeited on the warehouse wall. Never altered. */
  mark: string;
  rep: number;
  heat: number;
  territory: number;
  /** Pays HEAT +12 exactly once (App guards on the persisted event flag). */
  onApplyHeat: () => void;
  /** CHANGE WHAT THE NAME MEANS — enter mark evolution (P4A). */
  onAdvance: () => void;
}

/**
 * IDENTITY THEFT — minimal phone scene, then the warehouse photo proving a
 * counterfeit use of the player's mark next to a NULL SAINTS slashed halo.
 * Ends on the compromised handoff to P4 (no MARK//002 implementation here).
 */
export default function IdentityTheft({
  mark,
  rep,
  heat,
  territory,
  onApplyHeat,
  onAdvance,
}: IdentityTheftProps) {
  const [step, setStep] = useState<TheftStep>(0);
  const [visibleMsgs, setVisibleMsgs] = useState(0);
  const heatQueued = useRef(false);

  // Message script timing on step 0.
  useEffect(() => {
    if (step !== 0) return;
    const timers = [
      window.setTimeout(() => setVisibleMsgs(1), 700),
      window.setTimeout(() => setVisibleMsgs(2), 2200),
      window.setTimeout(() => setVisibleMsgs(3), 3600),
      window.setTimeout(() => setStep(1), STEP_MS[0]),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [step]);

  // Photo + realization auto-advance.
  useEffect(() => {
    if (step !== 1 && step !== 2) return;
    const t = window.setTimeout(() => {
      setStep((s) => Math.min(3, s + 1) as TheftStep);
    }, STEP_MS[step as 1 | 2]);
    return () => window.clearTimeout(t);
  }, [step]);

  // Queue the +12 the moment the realization beat is reached.
  useEffect(() => {
    if (step >= 2 && !heatQueued.current) {
      heatQueued.current = true;
      onApplyHeat();
    }
  }, [step, onApplyHeat]);

  const skipToEnd = () => {
    if (!heatQueued.current) {
      heatQueued.current = true;
      onApplyHeat();
    }
    setVisibleMsgs(SCRIPT.length);
    setStep(3);
  };

  return (
    <section className="cm-screen cm-theft" aria-label="Identity theft">
      {step < 3 && (
        <div className="cm-reveal-bar">
          <p className="cm-kicker">Unknown contact // encrypted</p>
          <button type="button" className="btn btn-skip" onClick={skipToEnd}>
            <FastForward size={15} aria-hidden={true} />
            Skip thread
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="theft-0"
            className="cm-thread"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3 }}
          >
            <p className="cm-thread-head">Unknown // no caller ID</p>
            {SCRIPT.slice(0, visibleMsgs).map((m, i) => (
              <motion.p
                key={i}
                className={m.from === "unknown" ? "cm-bubble" : "cm-bubble me"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {m.text}
              </motion.p>
            ))}
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="theft-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3 }}
          >
            <p className="cm-kicker">
              <Camera size={13} aria-hidden={true} style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
              Incoming photo // unknown
            </p>
            <motion.div
              className="cm-shot-frame cm-develop"
              initial={{ opacity: 0.15, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              <img className="cm-shot-img" src={warehouseArt} alt="" aria-hidden={true} />
              <MarkPlacement
                src={mark}
                alt="Your mark counterfeited on a warehouse roller door"
                placement={WAREHOUSE_MARK}
              />
              <MarkPlacement
                src={haloArt}
                alt="Slashed-halo rival signature beside your mark"
                placement={HALO_MARK}
              />
            </motion.div>
            <p className="cm-hint">
              Bay 07 // loading dock // that wall is not yours.
            </p>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="theft-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="cm-title">
              That wasn&apos;t <span className="accent">your job.</span>
            </h1>
            <p className="cm-lede" style={{ marginTop: "12px" }}>
              Someone is wearing your name.
            </p>
            <div className="cm-board-hud">
              <Hud rep={rep} heat={heat} territory={territory} variant="strip" />
              <span className="cm-alpha-chip cm-alpha-bad">Heat +12 // counterfeit</span>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="theft-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <p className="cm-kicker">Mark//001 // status: compromised</p>
            <h1 className="cm-title">
              They stole your mark.
              <br />
              <span className="accent">Not your crew.</span>
            </h1>
            <div className="cm-board-hud">
              <Hud rep={rep} heat={heat} territory={territory} variant="strip" />
            </div>
            <div className="cm-cta-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onAdvance}
                aria-label="Change what the name means"
              >
                Change what the name means
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  heatQueued.current = true;
                  setVisibleMsgs(0);
                  setStep(0);
                }}
              >
                Replay incident
              </button>
            </div>
            <p className="cm-hint">
              Replay restarts the thread visuals only — the +12 heat was already
              recorded and cannot pay again.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
