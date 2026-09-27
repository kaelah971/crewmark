import { useEffect, useRef, useState } from "react";
import WorldScene from "./world/WorldScene";
import WorldHud from "./world/WorldHud";
import MissionVehicle3D from "./MissionVehicle3D";
import CheckpointBluff from "./CheckpointBluff";
import checkpointPlate from "../assets/world/port-vice-checkpoint.png";
import {
  CHECKPOINT_HEAT,
  MISSION_REP_REWARD,
  classifyCheckpoint,
  classifyCreativeCheckpoint,
  type CheckpointBranch,
  type CoverAnchor,
  DEFAULT_COVER_ANCHOR,
  type MissionSnapshot,
} from "../world/mission";
import {
  VEHICLE_TUNING,
  createVehicleState,
  inDeliveryZone,
  inSecondaryZone,
  inStopZone,
  isStopped,
  stepVehicle,
  type VehicleState,
} from "../world/vehicle";
import type { VehicleLivery } from "../lib/vehicleLivery";
import { emitGameSound } from "../lib/audio";
import {
  activateCheckpointBluff,
  branchForBluffOutcome,
  createCheckpointBluffState,
  type CheckpointBluffState,
} from "../world/checkpointBluff";

/**
 * PENDING-PLATE — do not mount until src/assets/world/port-vice-checkpoint.png
 * lands (see P3.5A-R.3 report). This component is complete mission
 * architecture: phase machine, drive loop, scan beats from the frozen
 * snapshot, deterministic branches, recovery, delivery, and result. It
 * takes the plate as a prop so no fake environment is baked in.
 *
 * Mounted assets:
 * 1. port-vice-checkpoint.png — the checkpoint raster.
 * 2. public/models/sedan.glb — the real production sedan rendered by a
 *    transparent Three.js vehicle layer.
 */

export type MissionPhase =
  | "departure"
  | "approach"
  | "scan"
  | "bluff"
  | "gate"
  | "yard"
  | "delivery"
  | "result";

interface MissionProps {
  /** Realistic checkpoint plate (defaults to port-vice-checkpoint.png). */
  plateSrc?: string;
  /** Legacy source-cover prop retained for callers; snapshot remains canonical. */
  coverImage?: string;
  /** Shared full-panel vehicle livery derived from the frozen source cover. */
  livery: VehicleLivery;
  /** Frozen snapshot from START JOB. Re-edits cannot touch this. */
  snapshot: MissionSnapshot;
  heat: number;
  /** Cover anchor on the vehicle side panel. */
  anchor?: CoverAnchor;
  /** Initial phase (e.g. for resume). */
  initialPhase?: MissionPhase;
  /** Saved route position used when an aborted run resumes. */
  routeState?: VehicleState;
  /** Stable run identity used to select bluff questions. */
  missionRunId?: string;
  /** Persisted bluff checks from the mission lifecycle. */
  checkpointBluff?: CheckpointBluffState;
  /** Saves every bluff response without changing the frozen disguise. */
  onBluffStateChange?: (state: CheckpointBluffState) => void;
  /** Fired once when the gate outcome is determined (App pays heat). */
  onCheckpoint: (branch: CheckpointBranch, bluffState?: CheckpointBluffState, routeState?: VehicleState) => void;
  /** Fired once on delivery (App pays REP). */
  onComplete: () => void;
  /** RETURN TO 305, carrying the current route state for durable resume. */
  onExit: (routeState?: VehicleState) => void;
}

const SCAN_BEATS = ["Color profile", "Identity signal", "Service detail", "Surface age"] as const;
const SCAN_MS = 900;
const STOP_HOLD_MS = 1000;
const QUESTIONABLE_LINGER_MS = 3500;

const HANDLED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function branchLabel(branch: CheckpointBranch): string {
  if (branch === "clean") return "CLEAN";
  if (branch === "secondary" || (branch as string) === "questionable") return "SECONDARY";
  return "MANUAL";
}

export default function Mission({
  plateSrc = checkpointPlate,
  coverImage: _coverImage,
  livery,
  snapshot,
  heat,
  anchor: _anchor = DEFAULT_COVER_ANCHOR,
  initialPhase,
  routeState: persistedRouteState,
  onCheckpoint,
  onBluffStateChange,
  onComplete,
  onExit,
  missionRunId,
  checkpointBluff: persistedBluff,
}: MissionProps) {
  const checkpointVerdict = snapshot.metrics
    ? classifyCreativeCheckpoint(snapshot.metrics)
    : classifyCheckpoint(snapshot.analysis);
  const verdict = checkpointVerdict.branch;
  const runIdentity = missionRunId ?? `legacy-${snapshot.coverLockedAt}`;
  const fallbackAttention = snapshot.metrics?.cityAttention ?? (snapshot.score >= 45 ? "BALANCED" : "LOW");
  const initialBluff = persistedBluff ?? createCheckpointBluffState(
    runIdentity,
    snapshot.metrics?.coverReadiness ?? snapshot.score,
    fallbackAttention,
  );
  const [phase, setPhase] = useState<MissionPhase>(() => initialPhase ?? "departure");
  const [bluffState, setBluffState] = useState<CheckpointBluffState>(initialBluff);
  const [resolvedBranch, setResolvedBranch] = useState<CheckpointBranch | null>(() =>
    initialBluff.outcome ? branchForBluffOutcome(initialBluff.outcome) : null,
  );
  const [vehicle, setVehicle] = useState<VehicleState>(() => {
    if (persistedRouteState) return persistedRouteState;
    if (initialPhase === "bluff") return createVehicleState(VEHICLE_TUNING.checkpointProgress);
    if (initialPhase === "yard" || initialPhase === "delivery" || initialPhase === "result") {
      return createVehicleState(94);
    }
    return createVehicleState(0);
  });
  const [scanBeat, setScanBeat] = useState(0);
  const [gateOpen, setGateOpen] = useState(() => initialPhase === "yard" || initialPhase === "delivery" || initialPhase === "result");

  const gateVerdict = resolvedBranch ?? verdict;
  const isClean = gateVerdict === "clean";
  const isSecondary = gateVerdict === "secondary" || (gateVerdict as string) === "questionable";
  const isManual = gateVerdict === "manual" || (gateVerdict as string) === "weak";

  const vehicleRef = useRef(vehicle);
  const phaseRef = useRef(phase);
  const checkpointFired = useRef(false);
  const completeFired = useRef(false);
  const stopTimer = useRef(0);
  const bluffOutcomeTimer = useRef(0);
  const bluffStateRef = useRef(bluffState);
  const keysRef = useRef<Set<string>>(new Set());
  // Mirror latest render values for event-loop consumers (never read
  // refs during render — synced here, post-commit).
  useEffect(() => {
    vehicleRef.current = vehicle;
    phaseRef.current = phase;
    bluffStateRef.current = bluffState;
  });

  const endProgress = gateOpen || phase === "yard" || phase === "delivery" ? VEHICLE_TUNING.routeLength : VEHICLE_TUNING.barrierProgress;

  // Departure cinematic → approach.
  useEffect(() => {
    if (phase !== "departure") return;
    emitGameSound("engine-idle");
    emitGameSound("rain-ambience");
    const t = window.setTimeout(() => setPhase("approach"), 2400);
    return () => window.clearTimeout(t);
  }, [phase]);

  // ESC and the visible abort control always return before completion without
  // mutating the frozen snapshot or awarding any completion-side effects.
  useEffect(() => {
    if (phase === "result") return;
    const onAbortKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isTypingTarget(event.target)) return;
      event.preventDefault();
      keysRef.current.clear();
      onExit(vehicleRef.current);
    };
    window.addEventListener("keydown", onAbortKeyDown);
    return () => window.removeEventListener("keydown", onAbortKeyDown);
  }, [phase, onExit]);

  // Drive loop (approach + yard + gate for manual-branch recovery).
  // Scan/delivery/result park the vehicle.
  useEffect(() => {
    if (phase !== "approach" && phase !== "yard" && phase !== "gate") return;
    let raf = 0;
    let last = performance.now();
    const completeDelivery = () => {
      const v = vehicleRef.current;
      if (phaseRef.current === "delivery" && inDeliveryZone(v.routeProgress) && isStopped(v.speed)) {
        if (!completeFired.current) {
          completeFired.current = true;
          emitGameSound("mission-complete");
          onComplete();
        }
        setPhase("result");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.isComposing) return;
      if (HANDLED_KEYS.has(e.key)) e.preventDefault();
      if (e.key === "e" || e.key === "E") {
        completeDelivery();
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
      const next = stepVehicle(
        vehicleRef.current,
        {
          throttle:
            (k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0),
          steer:
            (k.has("d") || k.has("ArrowRight") ? 1 : 0) - (k.has("a") || k.has("ArrowLeft") ? 1 : 0),
        },
        dt,
        endProgress,
      );
      vehicleRef.current = next;
      setVehicle(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [phase, endProgress, onComplete]);
  // Delivery key listener: mounted only in delivery phase so keyboard E
  // completes delivery exactly like the [E] DELIVER PACKAGE button.
  useEffect(() => {
    if (phase !== "delivery") return;
    const onDeliveryKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.isComposing) return;
      if (e.key !== "e" && e.key !== "E") return;
      const v = vehicleRef.current;
      if (inDeliveryZone(v.routeProgress) && isStopped(v.speed)) {
        if (!completeFired.current) {
          completeFired.current = true;
          emitGameSound("mission-complete");
          onComplete();
        }
        setPhase("result");
      }
    };
    window.addEventListener("keydown", onDeliveryKey);
    return () => window.removeEventListener("keydown", onDeliveryKey);
  }, [phase, onComplete]);

  // Approach → bluff: correctly stopped inside the checkpoint stop zone.
  useEffect(() => {
    if (phase !== "approach") return;
    if (inStopZone(vehicle.routeProgress) && isStopped(vehicle.speed)) {
      stopTimer.current = window.setTimeout(() => {
        const active = activateCheckpointBluff(bluffStateRef.current);
        bluffStateRef.current = active;
        setBluffState(active);
        onBluffStateChange?.(active);
        setPhase("bluff");
      }, STOP_HOLD_MS);
    } else {
      window.clearTimeout(stopTimer.current);
    }
    return () => window.clearTimeout(stopTimer.current);
  }, [phase, vehicle.routeProgress, vehicle.speed, onBluffStateChange]);
  // Resolve the cinematic result into the existing checkpoint branch, then
  // hand the player back to the existing gate/recovery flow.
  useEffect(() => {
    if (phase !== "bluff" || bluffState.status !== "resolved" || !bluffState.outcome) return;
    if (!checkpointFired.current) {
      checkpointFired.current = true;
      const branch = branchForBluffOutcome(bluffState.outcome);
      emitGameSound(branch === "manual" ? "alert-tone" : "checkpoint-beep");
      onCheckpoint(branch, bluffState, vehicleRef.current);
    }
    window.clearTimeout(bluffOutcomeTimer.current);
    bluffOutcomeTimer.current = window.setTimeout(() => setPhase("gate"), bluffState.outcome === "busted" ? 2400 : 1900);
    return () => window.clearTimeout(bluffOutcomeTimer.current);
  }, [phase, bluffState.status, bluffState.outcome, bluffState, onCheckpoint]);

  // Scan beats → gate outcome (fires the checkpoint callback exactly once).
  // The final beat stays readable briefly before the transition fires.
  useEffect(() => {
    if (phase !== "scan") return;
    emitGameSound("scanner");
    if (scanBeat < SCAN_BEATS.length) {
      const t = window.setTimeout(() => setScanBeat((b) => b + 1), SCAN_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      emitGameSound("checkpoint-beep");
      if (!checkpointFired.current) {
        checkpointFired.current = true;
        onCheckpoint(verdict, bluffState, vehicleRef.current);
      }
      setPhase("gate");
    }, 500);
    return () => window.clearTimeout(t);
  }, [phase, scanBeat, onCheckpoint, verdict, bluffState]);

  // Gate outcome timing per branch.
  useEffect(() => {
    if (phase !== "gate") return;
    if (isClean) {
      emitGameSound("barrier-motor");
      const t = window.setTimeout(() => {
        setGateOpen(true);
        setPhase("yard");
      }, 1200);
      return () => window.clearTimeout(t);
    }
    if (isSecondary) {
      const t = window.setTimeout(() => {
        emitGameSound("barrier-motor");
        setGateOpen(true);
        setPhase("yard");
      }, QUESTIONABLE_LINGER_MS);
      return () => window.clearTimeout(t);
    }
    emitGameSound("alert-tone");
    return undefined;
  }, [phase, isClean, isSecondary]);

  // Manual / weak-branch recovery: stopped in the secondary zone → temporary grant.
  useEffect(() => {
    if (phase !== "gate" || !isManual) return;
    if (inSecondaryZone(vehicle.routeProgress) && isStopped(vehicle.speed)) {
      emitGameSound("checkpoint-beep");
      const t = window.setTimeout(() => {
        emitGameSound("barrier-motor");
        setGateOpen(true);
        setPhase("yard");
      }, 1500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, isManual, vehicle.routeProgress, vehicle.speed]);

  // Yard → delivery prompt when parked in the delivery zone.
  useEffect(() => {
    if (phase !== "yard") return;
    if (inDeliveryZone(vehicle.routeProgress) && isStopped(vehicle.speed)) {
      const t = window.setTimeout(() => setPhase("delivery"), 800);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, vehicle.routeProgress, vehicle.speed]);
  const handleBluffStateChange = (next: CheckpointBluffState) => {
    setBluffState(next);
    onBluffStateChange?.(next);
  };

  const handleBluffResolve = (branch: CheckpointBranch, resolved: CheckpointBluffState) => {
    setResolvedBranch(branch);
    setBluffState(resolved);
    if (!checkpointFired.current) {
      checkpointFired.current = true;
      emitGameSound(branch === "manual" ? "alert-tone" : "checkpoint-beep");
      onCheckpoint(branch, resolved, vehicleRef.current);
    }
  };

  const objective =
    phase === "departure"
      ? "JOB//01 — ROLLING OUT"
      : phase === "approach"
        ? "JOB//01 — REACH THE SERVICE CHECKPOINT"
        : phase === "scan"
          ? "JOB//01 — HOLD FOR SCAN"
          : phase === "bluff"
            ? "JOB//01 — SECURITY CHECK // BLUFF THE GUARD"
            : phase === "gate"
            ? isManual && !gateOpen
              ? "JOB//01 — SERVICE LANE: REVERSE TO SECONDARY MARKER"
              : "JOB//01 — AWAITING GATE"
            : phase === "yard"
              ? "JOB//01 — DELIVER THE PACKAGE"
              : phase === "delivery"
                ? "JOB//01 — DELIVER THE PACKAGE"
                : "JOB//01 — COMPLETE";

  const prompt =
    phase === "approach" && inStopZone(vehicle.routeProgress) && !isStopped(vehicle.speed)
      ? "STOP AT SECURITY LINE"
      : phase === "delivery"
        ? "DELIVER PACKAGE"
        : null;

  const scanChecks = [
    { label: "Color profile", check: snapshot.analysis.checks.find((c) => c.id === "orange") },
    { label: "Identity signal", check: snapshot.analysis.checks.find((c) => c.id === "identity") },
    { label: "Service detail", check: snapshot.analysis.checks.find((c) => c.id === "detail") },
    { label: "Surface age", check: snapshot.analysis.checks.find((c) => c.id === "weathering") },
  ];
  /* routeProgress is rendered by the fixed-camera Three.js vehicle layer. */
  // The photograph and transparent GLB layer share one fixed scene camera.
  // Route progress changes the car in Three.js, never the plate or CSS pixels.
  const camera = { x: 50, y: 50 };
  return (
    <section className="cm-screen" aria-label="Port Vice night delivery">
      <p className="cm-kicker">Job//01 // Port Vice // night delivery</p>
      {phase !== "result" && (
        <div className="cm-mission-abort">
          <button type="button" className="btn btn-ghost" onClick={() => onExit(vehicleRef.current)}>
            BACK TO 305 / ABORT RUN <span aria-hidden="true">[ESC]</span>
          </button>
        </div>
      )}
      <WorldScene
        plateSrc={plateSrc}
        plateAlt="Port Vice cargo service entrance at night"
        camera={camera}
        label="Port Vice checkpoint approach. Drive with W A S D or arrow keys."
        screenChildren={
          <WorldHud
            rep={0}
            heat={heat}
            territory={0}
            prompt={prompt}
            progressNote={objective}
          />
        }
      >
        {/* Production GLB vehicle rendered from the frozen COVER//01 mission source */}
        <MissionVehicle3D livery={livery} state={vehicle} />
        {/* Booth stop-line marker tuned for Port Vice service lane */}
        <div className="cm-stopline" aria-hidden={true} />
        {/* Secondary inspection stop-line marker for weak/manual branch */}
        {isManual && phase === "gate" && !gateOpen && (
          <div className="cm-secondary-marker" aria-hidden={true} />
        )}
        {/* Delivery zone marker in restricted service yard */}
        {(phase === "yard" || phase === "delivery") && (
          <div className="cm-delivery-marker" aria-hidden={true} />
        )}
        {phase === "scan" ? (
          <div className="cm-scanframe" aria-hidden={true}>
            <p style={{ margin: "0 0 6px 0", fontSize: "10px", letterSpacing: "1px", color: "var(--cm-grey)" }}>
              PORT VICE ACCESS CONTROL // VISUAL PROFILE SCAN
            </p>
            <ol>
              {scanChecks.map((item, i) => {
                const status = item.check?.status ?? "REVIEW";
                const isDone = i < scanBeat;
                const isLive = i === scanBeat;
                return (
                  <li key={item.label} className={isDone ? "is-done" : isLive ? "is-live" : ""}>
                    <span>{item.label}</span>
                    {isDone && <span style={{ marginLeft: "8px", fontWeight: "bold" }}>// {status}</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
        {/* Booth light + barrier + camera states driven by the live branch. */}
        <div
          className={`cm-boothlight is-${gateOpen ? "green" : isManual && phase !== "departure" && phase !== "approach" ? "red" : phase === "scan" || phase === "gate" ? "amber" : "idle"}`}
          aria-hidden={true}
        />
        <div className={`cm-barrier${gateOpen ? " is-open" : ""}`} aria-hidden={true} />
        {phase === "delivery" && (
          <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!completeFired.current) {
                  completeFired.current = true;
                  emitGameSound("mission-complete");
                  onComplete();
                }
                setPhase("result");
              }}
            >
              [E] DELIVER PACKAGE
            </button>
          </div>
        )}
      </WorldScene>

      {phase === "bluff" && (
        <CheckpointBluff
          snapshot={snapshot}
          livery={livery}
          state={bluffState}
          heat={heat}
          onStateChange={handleBluffStateChange}
          onResolve={handleBluffResolve}
          onAbort={() => onExit(vehicleRef.current)}
        />
      )}

      {phase === "gate" && (
        <div className="cm-world-focus" role="status">
          <p className="cm-world-focus-label">
            {isClean && "Access profile // accepted"}
            {isSecondary && "Secondary visual check"}
            {isManual && "Profile mismatch"}
          </p>
          <p className="cm-world-focus-sys">
            {isClean && "Gate opening. Low scrutiny."}
            {isSecondary && "Camera holds. Barrier opening after inspection."}
            {isManual && "Barrier holding. Reverse to the secondary marker and stop."}
          </p>
        </div>
      )}

      {phase === "result" && (
        <div className="cm-workorder" role="status" aria-label="Mission result">
          <p className="cm-kicker">Job//01 // complete</p>
          <h2 className="cm-workorder-title">
            Cover//01 <span>Visual check // {snapshot.score}%</span>
          </h2>
          <dl className="cm-workorder-rows">
            <div>
              <dt>Checkpoint</dt>
              <dd>{branchLabel(gateVerdict)}</dd>
            </div>
            <div>
              <dt>Heat gain</dt>
              <dd>+{CHECKPOINT_HEAT[gateVerdict]}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>Rep +{MISSION_REP_REWARD}</dd>
            </div>
          </dl>
          <p className="cm-workorder-objective">The cover got you inside.</p>
          <p className="cm-hint">But cameras keep receipts.</p>
          <div className="cm-cta-row">
            <button type="button" className="btn btn-primary" onClick={() => onExit(vehicleRef.current)}>
              Return to 305
            </button>
          </div>
        </div>
      )}

      <p className="cm-hint">
        W accelerate · S brake/reverse · A/D steer. Stop inside marked zones.
        {isManual ? " Weak profile: use the secondary lane." : ""}
      </p>
    </section>
  );
}
