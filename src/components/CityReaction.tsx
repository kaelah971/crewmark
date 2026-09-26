import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Camera,
  FastForward,
  MessageCircle,
  Radio,
} from "lucide-react";
import WallScene, { type WallPlacement } from "./WallScene";
import Hud from "./Hud";

type CityStep = 0 | 1 | 2 | 3;

const STEP_MS: Record<Exclude<CityStep, 3>, number> = {
  0: 3000,
  1: 2800,
  2: 3000,
};

interface CityReactionProps {
  /** The exact saved MARK//001 — every reaction card renders this, nothing else. */
  mark: string;
  districtName: string;
  /** Frozen wall placement from the claim commit (phone-photo evidence). */
  placement: WallPlacement;
  rep: number;
  heat: number;
  territory: number;
  /** REP reward the claimed district paid, shown as recognition. */
  recognition: number;
  /** P3: KEEP MOVING now enters surveillance instead of a lock screen. */
  onKeepMoving: () => void;
}

/**
 * CITY REACTION — lightweight fictional interfaces reacting to the claim.
 * Deliberately brighter and more chaotic than CREW mode (flash-paper cards,
 * tilted layering), but every image shown is the player's actual mark.
 */
export default function CityReaction({
  mark,
  districtName,
  placement,
  rep,
  heat,
  territory,
  recognition,
  onKeepMoving,
}: CityReactionProps) {
  const [step, setStep] = useState<CityStep>(0);
  const district = districtName.toUpperCase();

  useEffect(() => {
    if (step >= 3) return;
    const t = window.setTimeout(() => {
      setStep((s) => Math.min(3, s + 1) as CityStep);
    }, STEP_MS[step as Exclude<CityStep, 3>]);
    return () => window.clearTimeout(t);
  }, [step]);

  return (
    <section className="cm-screen cm-city" aria-label="City reaction">
      {step < 3 && (
        <div className="cm-reveal-bar">
          <p className="cm-kicker">City feed // reacting</p>
          <button type="button" className="btn btn-skip" onClick={() => setStep(3)}>
            <FastForward size={15} aria-hidden={true} />
            Skip feed
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.article
            key="city-0"
            className="cm-post"
            initial={{ opacity: 0, y: 26, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: -1 }}
            exit={{ opacity: 0, y: -14, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <span className="cm-tape" aria-hidden={true} />
            <header className="cm-post-head">
              <MessageCircle size={16} aria-hidden={true} />
              <span className="cm-post-app">Flashr</span>
              <span className="cm-post-handle">@vicewatcher89</span>
            </header>
            <p className="cm-post-text">
              anyone know who these people are?
              <br />
              seeing this symbol all over {district} 💀
            </p>
            <img
              className="cm-post-thumb"
              src={mark}
              alt="A witness photo of your mark as posted on Flashr"
              draggable={false}
            />
          </motion.article>
        )}

        {step === 1 && (
          <motion.article
            key="city-1"
            className="cm-wire"
            initial={{ opacity: 0, y: 26, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 1 }}
            exit={{ opacity: 0, y: -14, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <header className="cm-wire-head">
              <Radio size={16} aria-hidden={true} />
              <span>Vicewire // Trending</span>
              <span className="cm-live">Live</span>
            </header>
            <img
              className="cm-wire-mark"
              src={mark}
              alt="Your mark as broadcast on the Vicewire trending segment"
              draggable={false}
            />
            <p className="cm-wire-copy">
              Unknown symbol appears
              <br />
              across {district}
            </p>
          </motion.article>
        )}

        {step === 2 && (
          <motion.article
            key="city-2"
            className="cm-photo"
            initial={{ opacity: 0, y: 26, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: -1.5 }}
            exit={{ opacity: 0, y: -14, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <span className="cm-tape" aria-hidden={true} />
            <header className="cm-post-head">
              <Camera size={16} aria-hidden={true} />
              <span className="cm-post-app">Flashr</span>
              <span className="cm-post-handle">@305staysup</span>
            </header>
            <WallScene
              mark={mark}
              placement={placement}
              alt="Phone photo of your claimed wall as posted by a witness"
            />
            <p className="cm-post-text">
              saw them putting this up last night. flash on, nobody around.
            </p>
          </motion.article>
        )}

        {step === 3 && (
          <motion.div
            key="city-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <p className="cm-kicker">Aftermath // confirmed sightings</p>
            <h1 className="cm-title">
              The city <span className="accent">noticed.</span>
            </h1>
            <div className="cm-board-hud">
              <Hud rep={rep} heat={heat} territory={territory} variant="strip" />
              <span className="cm-alpha-chip cm-alpha-ok">
                Recognition +{recognition}
              </span>
            </div>
            <div className="cm-cta-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onKeepMoving}
                aria-label="Keep moving"
              >
                Keep moving
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
