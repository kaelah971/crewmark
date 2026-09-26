import { useEffect, useRef, useState } from "react";
import WorldScene from "./world/WorldScene";
import WorldHud from "./world/WorldHud";
import checkpointPlate from "../assets/world/port-vice-checkpoint.png";
import serviceVehicleCutout from "../assets/world/service-vehicle.png";
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
  inDeliveryZone,
  inSecondaryZone,
  inStopZone,
  isStopped,
  stepVehicle,
  type VehicleState,
} from "../world/vehicle";
import { emitGameSound } from "../lib/audio";

/**
 * PENDING-PLATE — do not mount until src/assets/world/port-vice-checkpoint.png
 * lands (see P3.5A-R.3 report). This component is complete mission
 * architecture: phase machine, drive loop, scan beats from the frozen
 * snapshot, deterministic branches, recovery, delivery, and result. It
 * takes the plate as a prop so no fake environment is baked in.
 *
 * ASSET GAPS (both block mounting):
 * 1. port-vice-checkpoint.png — the checkpoint raster itself.
 * 2. Transparent player-sedan cutout (side view, night grade). Until it
 *    lands, the unit drives as an explicit position chevron (utility
 *    graphic, never a fake car), and the exact cover still renders on the
 *    side-panel anchor below.
 */

export type MissionPhase =
  | "departure"
  | "approach"
  | "scan"
  | "gate"
  | "yard"
  | "delivery"
  | "result";

interface MissionProps {
  /** Realistic checkpoint plate (defaults to port-vice-checkpoint.png). */
  plateSrc?: string;
  /** Exact saved COVER//01 image (defaults to snapshot.coverImage). */
  coverImage?: string;
  /** Frozen snapshot from START JOB. Re-edits cannot touch this. */
  snapshot: MissionSnapshot;
  heat: number;
  /** Cover anchor on the vehicle side panel. */
  anchor?: CoverAnchor;
  /** Initial phase (e.g. for resume). */
  initialPhase?: MissionPhase;
  /** Fired once when the gate outcome is determined (App pays heat). */
  onCheckpoint: (branch: CheckpointBranch) => void;
  /** Fired once on delivery (App pays REP). */
  onComplete: () => void;
  /** RETURN TO 305. */
  onExit: () => void;
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
  snapshot,
  heat,
  anchor = DEFAULT_COVER_ANCHOR,
  initialPhase,
  onCheckpoint,
  onComplete,
  onExit,
}: MissionProps) {
  const checkpointVerdict = snapshot.metrics
    ? classifyCreativeCheckpoint(snapshot.metrics)
    : classifyCheckpoint(snapshot.analysis);
  const verdict = checkpointVerdict.branch;
  const [phase, setPhase] = useState<MissionPhase>(() => initialPhase ?? "departure");
  const [vehicle, setVehicle] = useState<VehicleState>(() => {
    if (initialPhase === "yard" || initialPhase === "delivery") {
      return { dist: 94, lane: 0, speed: 0 };
    }
    return { dist: 0, lane: 0, speed: 0 };
  });
  const [scanBeat, setScanBeat] = useState(0);
  const [gateOpen, setGateOpen] = useState(() => initialPhase === "yard" || initialPhase === "delivery" || initialPhase === "result");

  const isClean = verdict === "clean";
  const isSecondary = verdict === "secondary" || (verdict as string) === "questionable";
  const isManual = verdict === "manual" || (verdict as string) === "weak";

  const vehicleRef = useRef(vehicle);
  const phaseRef = useRef(phase);
  const checkpointFired = useRef(false);
  const completeFired = useRef(false);
  const stopTimer = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  // Mirror latest render values for event-loop consumers (never read
  // refs during render — synced here, post-commit).
  useEffect(() => {
    vehicleRef.current = vehicle;
    phaseRef.current = phase;
  });

  const endDist = gateOpen || phase === "yard" || phase === "gate" ? VEHICLE_TUNING.yardEnd : VEHICLE_TUNING.barrierDist;

  // Departure cinematic → approach.
  useEffect(() => {
    if (phase !== "departure") return;
    emitGameSound("engine-idle");
    emitGameSound("rain-ambience");
    const t = window.setTimeout(() => setPhase("approach"), 2400);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Drive loop (approach + yard + gate for manual-branch recovery).
  // Scan/delivery/result park the vehicle.
  useEffect(() => {
    if (phase !== "approach" && phase !== "yard" && phase !== "gate") return;
    let raf = 0;
    let last = performance.now();
    const completeDelivery = () => {
      const v = vehicleRef.current;
      if (phaseRef.current === "delivery" && inDeliveryZone(v.dist) && isStopped(v.speed)) {
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
        endDist,
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
  }, [phase, endDist, onComplete]);

  // Delivery key listener: mounted only in delivery phase so keyboard E
  // completes delivery exactly like the [E] DELIVER PACKAGE button.
  useEffect(() => {
    if (phase !== "delivery") return;
    const onDeliveryKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.isComposing) return;
      if (e.key !== "e" && e.key !== "E") return;
      const v = vehicleRef.current;
      if (inDeliveryZone(v.dist) && isStopped(v.speed)) {
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

  // Approach → scan: correctly stopped inside the stop zone.
  useEffect(() => {
    if (phase !== "approach") return;
    if (inStopZone(vehicle.dist) && isStopped(vehicle.speed)) {
      stopTimer.current = window.setTimeout(() => setPhase("scan"), STOP_HOLD_MS);
    } else {
      window.clearTimeout(stopTimer.current);
    }
    return () => window.clearTimeout(stopTimer.current);
  }, [phase, vehicle.dist, vehicle.speed]);

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
        onCheckpoint(verdict);
      }
      setPhase("gate");
    }, 500);
    return () => window.clearTimeout(t);
  }, [phase, scanBeat, onCheckpoint, verdict]);

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
    if (inSecondaryZone(vehicle.dist) && isStopped(vehicle.speed)) {
      emitGameSound("checkpoint-beep");
      const t = window.setTimeout(() => {
        emitGameSound("barrier-motor");
        setGateOpen(true);
        setPhase("yard");
      }, 1500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, isManual, vehicle.dist, vehicle.speed]);
  // Yard → delivery prompt when parked in the delivery zone.
  useEffect(() => {
    if (phase !== "yard") return;
    if (inDeliveryZone(vehicle.dist) && isStopped(vehicle.speed)) {
      const t = window.setTimeout(() => setPhase("delivery"), 800);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, vehicle.dist, vehicle.speed]);

  const objective =
    phase === "departure"
      ? "JOB//01 — ROLLING OUT"
      : phase === "approach"
        ? "JOB//01 — REACH THE SERVICE CHECKPOINT"
        : phase === "scan"
          ? "JOB//01 — HOLD FOR SCAN"
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
    phase === "approach" && inStopZone(vehicle.dist) && !isStopped(vehicle.speed)
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
  const t = Math.min(1, Math.max(0, vehicle.dist / VEHICLE_TUNING.yardEnd));
  // Smooth 2.5D perspective positioning along the Port Vice approach lane
  const isPreGate = t <= 0.68;
  const progressNorm = isPreGate ? t / 0.68 : (t - 0.68) / 0.32;
  const baseY = isPreGate ? 74 - progressNorm * 18 : 56 - progressNorm * 10;
  const baseX = isPreGate ? 50 + progressNorm * 18 : 68 + progressNorm * 8;
  const scale = isPreGate ? 1.0 - progressNorm * 0.38 : 0.62 - progressNorm * 0.18;
  const laneSpan = 14 * (1 - t * 0.45);
  const vehicleX = baseX + vehicle.lane * laneSpan;
  const vehicleY = baseY + vehicle.lane * 1.5;
  const vehicleWidth = Math.round(240 * scale);

  // Camera smoothly frames approach → checkpoint booth → restricted yard
  const camera = { x: 50 + t * 18, y: 64 - t * 14 };
  return (
    <section className="cm-screen" aria-label="Port Vice night delivery">
      <p className="cm-kicker">Job//01 // Port Vice // night delivery</p>
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
        {/* Playable realistic service vehicle with exact COVER//01 disguise projected onto door panel */}
        <div
          className="cm-service-vehicle"
          style={{
            left: `${vehicleX}%`,
            top: `${vehicleY}%`,
            width: `${vehicleWidth}px`,
          }}
          aria-hidden={true}
        >
          <img
            src={serviceVehicleCutout}
            alt="Service vehicle"
            className="cm-service-vehicle-img"
            draggable={false}
          />
          <div
            className="cm-service-vehicle-cover"
            style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
          >
            <img src={snapshot.coverImage} alt="" draggable={false} />
          </div>
        </div>
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
              <dd>{branchLabel(verdict)}</dd>
            </div>
            <div>
              <dt>Heat gain</dt>
              <dd>+{CHECKPOINT_HEAT[verdict]}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>Rep +{MISSION_REP_REWARD}</dd>
            </div>
          </dl>
          <p className="cm-workorder-objective">The cover got you inside.</p>
          <p className="cm-hint">But cameras keep receipts.</p>
          <div className="cm-cta-row">
            <button type="button" className="btn btn-primary" onClick={onExit}>
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
