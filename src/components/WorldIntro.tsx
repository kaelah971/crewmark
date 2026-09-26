import { useEffect, useRef, useState } from "react";
import MarkPlacement from "./MarkPlacement";
import WorldScene from "./world/WorldScene";
import WorldPlayer from "./world/WorldPlayer";
import InteractionZone from "./world/InteractionZone";
import WorldHud from "./world/WorldHud";
import {
  buildYardMarkSurfaces,
  YARD_BOUNDS,
  YARD_HOTSPOTS,
  YARD_INSPECTABLE_IDS,
  YARD_SPAWN,
  YARD_SPEED,
} from "../world/afterHoursYard";
import { clampToBounds, nearestInRange, stepPosition } from "../world/movement";
import type { PlayerState, Vec2 } from "../world/types";
import yardPlate from "../assets/crewmark-landing-scene.png";
import playerSprite from "../assets/world/player-idle.png";

interface WorldIntroProps {
  /** The exact saved MARK//001 — the single source for every surface. */
  mark: string;
  hud: { rep: number; heat: number; territory: number };
  /** MAKE YOURSELF KNOWN / exit gate → existing district-select. */
  onAdvance: () => void;
}

const HANDLED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * WORLD INTRO — 305 PRINT & SIGN // AFTER-HOURS YARD.
 *
 * First playable hub: move with WASD/arrows, approach hotspots, press E
 * (or activate the marker) to inspect the real mark in-world, then leave
 * through the district gate. Inspection is session-local and replayable;
 * no progression state is written here — DistrictSelect still owns claims.
 */
export default function WorldIntro({ mark, hud, onAdvance }: WorldIntroProps) {
  const [player, setPlayer] = useState<PlayerState>({
    pos: { ...YARD_SPAWN },
    facing: "right",
    moving: false,
    spriteSrc: playerSprite,
  });
  const [camera, setCamera] = useState<Vec2>({ ...YARD_SPAWN });
  const [inspected, setInspected] = useState<readonly string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [nearId, setNearId] = useState<string | null>(null);

  const posRef = useRef<Vec2>({ ...YARD_SPAWN });
  const keysRef = useRef<Set<string>>(new Set());
  const focusTimer = useRef(0);

  const surfaces = buildYardMarkSurfaces(mark);
  const inspectedCount = YARD_INSPECTABLE_IDS.filter((id) => inspected.includes(id)).length;
  const allSeen = inspectedCount >= YARD_INSPECTABLE_IDS.length;

  const interact = (id: string) => {
    const hotspot = YARD_HOTSPOTS.find((h) => h.id === id);
    if (!hotspot) return;
    if (hotspot.isExit) {
      onAdvance();
      return;
    }
    window.clearTimeout(focusTimer.current);
    setInspected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setFocusId(id);
    focusTimer.current = window.setTimeout(() => setFocusId(null), 2400);
  };

  const interactRef = useRef(interact);

  useEffect(() => {
    interactRef.current = interact;
  });

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lerp = reduceMotion ? 1 : 1 - Math.exp(-3 * (1 / 60));
    let raf = 0;
    let last = performance.now();

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.isComposing) return;
      if (HANDLED_KEYS.has(e.key)) e.preventDefault();
      if (e.key === "e" || e.key === "E") {
        const target = nearestInRange(posRef.current, YARD_HOTSPOTS);
        if (target) interactRef.current(target.id);
        return;
      }
      keysRef.current.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      const dir = {
        x: (k.has("d") || k.has("ArrowRight") ? 1 : 0) - (k.has("a") || k.has("ArrowLeft") ? 1 : 0),
        y: (k.has("s") || k.has("ArrowDown") ? 1 : 0) - (k.has("w") || k.has("ArrowUp") ? 1 : 0),
      };
      const moving = dir.x !== 0 || dir.y !== 0;
      const next = clampToBounds(stepPosition(posRef.current, dir, YARD_SPEED, dt), YARD_BOUNDS);
      posRef.current = next;
      const nearHotspot = nearestInRange(next, YARD_HOTSPOTS);
      const nearHotspotId = nearHotspot ? nearHotspot.id : null;
      setNearId((prev) => (prev === nearHotspotId ? prev : nearHotspotId));
      setPlayer((prev) => ({
        ...prev,
        pos: next,
        facing: dir.x > 0 ? "right" : dir.x < 0 ? "left" : prev.facing,
        moving,
      }));
      setCamera((prev) => ({
        x: prev.x + (next.x - prev.x) * lerp,
        y: prev.y + (next.y - prev.y) * lerp,
      }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(focusTimer.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const focusHotspot = YARD_HOTSPOTS.find((h) => h.id === focusId) ?? null;
  const nearHotspot = YARD_HOTSPOTS.find((h) => h.id === nearId) ?? null;
  const prompt = nearHotspot
    ? nearHotspot.isExit
      ? `LEAVE — ${nearHotspot.label}`
      : `INSPECT — ${nearHotspot.label}`
    : null;

  return (
    <section className="cm-screen" aria-label="After-hours yard">
      <p className="cm-kicker">305 Print &amp; Sign // After-hours yard</p>
      <h1 className="cm-title">
        You made a symbol.
        <br />
        <span className="accent">Now it exists in the city.</span>
      </h1>

      <WorldScene
        plateSrc={yardPlate}
        plateAlt="Rain-wet night alley with a parked crew car, safehouse wall and supply crates"
        camera={camera}
        label="Playable yard. Move with W A S D or arrow keys. Press E near a marked hotspot."
        screenChildren={
          <WorldHud
            rep={hud.rep}
            heat={hud.heat}
            territory={hud.territory}
            prompt={prompt}
            progressNote={`Sightings ${inspectedCount}/${YARD_INSPECTABLE_IDS.length}`}
          />
        }
      >
        {surfaces.map((s) => (
          <MarkPlacement key={s.id} src={s.src} alt={s.alt} placement={s.placement} />
        ))}
        {YARD_HOTSPOTS.map((h) =>
          nearId === h.id ? (
            <InteractionZone
              key={h.id}
              hotspot={h}
              state={h.isExit ? "near" : inspected.includes(h.id) ? "done" : "near"}
              onActivate={interact}
            />
          ) : null,
        )}
        <WorldPlayer player={player} />
      </WorldScene>

      {focusHotspot && !focusHotspot.isExit ? (
        <div className="cm-world-focus" role="status">
          <p className="cm-world-focus-label">{focusHotspot.label}</p>
          <p className="cm-world-focus-sys">{focusHotspot.sysLine}</p>
        </div>
      ) : null}

      {allSeen ? (
        <div className="cm-cta-row">
          <button type="button" className="btn btn-primary" onClick={onAdvance} aria-label="Make yourself known">
            Make yourself known
          </button>
        </div>
      ) : null}
      <p className="cm-hint">
        Move with W A S D or arrows — approach a marker and press E, or activate
        the marker directly. The district gate is always open.
      </p>
    </section>
  );
}
