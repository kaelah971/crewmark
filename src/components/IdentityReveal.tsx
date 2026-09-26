import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FastForward, Megaphone, Pencil, Play, RotateCcw } from "lucide-react";
import MarkPlacement, { type MarkPlacementSpec } from "./MarkPlacement";
import Hud from "./Hud";
import { formatAlpha, type AlphaReport } from "../lib/markAlpha";
import vehicleArt from "../assets/p1-vehicle.svg";
import jacketArt from "../assets/p1-jacket.svg";
import safehouseArt from "../assets/p1-safehouse.svg";
import contrabandArt from "../assets/p1-contraband.svg";

/** Cinematic beats: 0 = cold open, 1-4 = propagation scenes, 5 = board. */
export type RevealBeat = 0 | 1 | 2 | 3 | 4 | 5;

const BEAT_MS: Record<Exclude<RevealBeat, 5>, number> = {
  0: 2100,
  1: 2400,
  2: 2300,
  3: 2300,
  4: 2300,
};

interface SceneDef {
  key: string;
  label: string;
  sys: string;
  art: string;
  alt: string;
  placement: MarkPlacementSpec;
}

// Placement percentages are fractions of each scene's 1200x675 viewBox,
// measured against the diegetic surface in the artwork (door panel, back
// patch, banner board, crate tape). Every scene consumes the same mark.
const SCENES: SceneDef[] = [
  {
    key: "vehicle",
    label: "01 / Vehicle",
    sys: "Identity applied",
    art: vehicleArt,
    alt: "Sports coupe on a wet night street with your mark on its door",
    placement: { left: "39.1667%", top: "53.3333%", width: "25%", height: "23.7037%" },
  },
  {
    key: "jacket",
    label: "02 / Colors",
    sys: "Crew colors updated",
    art: jacketArt,
    alt: "Crew jacket with your mark stitched on its back patch",
    placement: { left: "42.5%", top: "37.037%", width: "15%", height: "26.6667%" },
  },
  {
    key: "safehouse",
    label: "03 / Home",
    sys: "Home base updated",
    art: safehouseArt,
    alt: "Safehouse shutter with your mark painted on its banner",
    placement: { left: "31.6667%", top: "29.6296%", width: "36.6667%", height: "29.6296%" },
  },
  {
    key: "contraband",
    label: "04 / Product",
    sys: "Distribution identity updated",
    art: contrabandArt,
    alt: "Warehouse crate with your mark on its shipping label",
    placement: { left: "41.6667%", top: "53.3333%", width: "16.6667%", height: "20.7407%", rotate: -3 },
  },
];

interface IdentityRevealProps {
  /** The exact saved MARK//001 data URL — the single source for all scenes. */
  mark: string;
  alpha: AlphaReport | null;
  /** Live crew values for the HUD (zeros until the first claim pays out). */
  hud: { rep: number; heat: number; territory: number };
  initialBeat?: RevealBeat;
  /** P1 board CTA now advances into district select (P2). */
  onAdvance: () => void;
  onEdit: () => void;
  onReset: () => void;
}

function SceneShot({
  scene,
  mark,
  hud,
  compact = false,
}: {
  scene: SceneDef;
  mark: string;
  hud: { rep: number; heat: number; territory: number };
  compact?: boolean;
}) {
  return (
    <figure className={compact ? "cm-shot cm-shot-mini" : "cm-shot"}>
      <div className="cm-shot-frame">
        <img className="cm-shot-img" src={scene.art} alt="" aria-hidden={true} />
        <MarkPlacement
          src={mark}
          alt={scene.alt}
          placement={scene.placement}
        />
        {!compact && <Hud rep={hud.rep} heat={hud.heat} territory={hud.territory} variant="overlay" />}
      </div>
      <figcaption className="cm-shot-cap">
        <span className="cm-shot-label">{scene.label}</span>
        <span className="cm-shot-sys">{scene.sys}</span>
      </figcaption>
    </figure>
  );
}

export default function IdentityReveal({
  mark,
  alpha,
  hud,
  initialBeat = 0,
  onAdvance,
  onEdit,
  onReset,
}: IdentityRevealProps) {
  const [beat, setBeat] = useState<RevealBeat>(initialBeat);

  // Cinematic auto-advance. Cleared on beat change / unmount / skip.
  useEffect(() => {
    if (beat >= 5) return;
    const t = window.setTimeout(() => {
      setBeat((b) => Math.min(5, b + 1) as RevealBeat);
    }, BEAT_MS[beat as Exclude<RevealBeat, 5>]);
    return () => window.clearTimeout(t);
  }, [beat]);

  const skipToBoard = () => setBeat(5);
  const replay = () => {
    setBeat(0);
  };

  return (
    <section className="cm-screen" aria-label="Identity reveal">
      {beat < 5 && (
        <div className="cm-reveal-bar">
          <p className="cm-kicker">Identity propagation // live</p>
          <button type="button" className="btn btn-skip" onClick={skipToBoard}>
            <FastForward size={15} aria-hidden={true} />
            Skip reveal
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {beat === 0 && (
          <motion.div
            key="beat-0"
            className="cm-coldopen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3 }}
          >
            <motion.p
              className="cm-coldopen-copy"
              initial={{ y: 22, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              A mark means nothing
              <br />
              if <span className="accent">nobody sees it.</span>
            </motion.p>
          </motion.div>
        )}

        {beat >= 1 && beat <= 4 && (
          <motion.div
            key={`beat-${beat}`}
            initial={{ opacity: 0, scale: 1.045 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <motion.div
              key={`flash-${beat}`}
              className="cm-flash"
              aria-hidden={true}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
            />
            <motion.div
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.22, delay: 0.1 }}
            >
              <SceneShot scene={SCENES[beat - 1]} mark={mark} hud={hud} />
            </motion.div>
          </motion.div>
        )}

        {beat === 5 && (
          <motion.div
            key="beat-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <p className="cm-kicker">Identity board // all sightings confirmed</p>
            <h1 className="cm-title">
              Now they can <span className="accent">recognize</span> you.
            </h1>

            <div className="cm-board-hud">
              <Hud rep={hud.rep} heat={hud.heat} territory={hud.territory} variant="strip" />
              <span
                className={
                  alpha === null
                    ? "cm-alpha-chip"
                    : alpha.hasTransparency
                      ? "cm-alpha-chip cm-alpha-ok"
                      : "cm-alpha-chip cm-alpha-bad"
                }
              >
                {alpha === null
                  ? "Mark//001 · Alpha: analyzing…"
                  : `Mark//001 · Alpha: ${alpha.hasTransparency ? "preserved" : "opaque"} · ${formatAlpha(alpha)}`}
              </span>
            </div>

            <div className="cm-board">
              {SCENES.map((scene) => (
                <SceneShot key={scene.key} scene={scene} mark={mark} hud={hud} compact={true} />
              ))}
            </div>

            <div className="cm-cta-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onAdvance}
                aria-label="Make yourself known"
              >
                <Megaphone size={16} aria-hidden={true} />
                Make yourself known
              </button>
              <button type="button" className="btn btn-ghost" onClick={replay}>
                <Play size={16} aria-hidden={true} />
                Replay reveal
              </button>
              <button type="button" className="btn btn-ghost" onClick={onEdit} aria-label="Edit mark, returning to the studio">
                <Pencil size={16} aria-hidden={true} />
                Edit mark
              </button>
              <button type="button" className="btn btn-danger" onClick={onReset} aria-label="Reset, clearing the saved mark">
                <RotateCcw size={16} aria-hidden={true} />
                Reset
              </button>
            </div>
            <p className="cm-hint">
              Make yourself known to pick a district wall. Edit mark returns
              to the studio with this exact artwork reloaded. Reset clears the
              saved mark and all progress.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
