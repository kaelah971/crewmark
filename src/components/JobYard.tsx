import { useEffect, useRef, useState } from "react";
import WorldScene from "./world/WorldScene";
import InteractionZone from "./world/InteractionZone";
import WorldHud from "./world/WorldHud";
import CctvReview from "./CctvReview";
import type { CameraReceipt } from "../world/receipts";
import type { VehicleLivery } from "../lib/vehicleLivery";
import type { DisguisePackage } from "../lib/disguisePackage";
import { DEFAULT_CLEAN_VEHICLE_LIVERY } from "../lib/disguisePackage";
import {
  JOB_YARD_BOUNDS,
  JOB_YARD_HOTSPOTS,
  JOB_YARD_SPAWN,
  JOB_YARD_SPEED,
} from "../world/jobYard";
import {
  JOB_01,
  exitGateReport,
  jobObjective,
  printShopReport,
} from "../world/jobs";
import { clampToBounds, nearestInRange, stepPosition } from "../world/movement";
import type { PlayerState, Vec2 } from "../world/types";
import yardPlate from "../assets/world/yard-wide.png";
import playerSprite from "../assets/world/player-idle.png";
import SurfaceMockup from "./SurfaceMockup";
import { type SurfaceId } from "../lib/multiSurfacePreview";
import { VehicleLiveryProjection } from "./VehicleLiveryProjection";

interface JobYardProps {
  hud: { rep: number; heat: number; territory: number };
  jobAccepted: boolean;
  onAcceptJob: () => void;
  /** Active COVER//01 or COVER//02 vehicle livery projection. */
  cover: { image: string; score: number } | null;
  disguisePackage?: DisguisePackage | null;
  vehicleLivery?: VehicleLivery | null;
  onEditCover: () => void;
  onEditVehicle?: () => void;
  onStartJob?: () => void;
  /** A started but incomplete mission freezes the package. */
  missionActive?: boolean;
  /** P7C: Open 3D vehicle inspection mode */
  onInspect3DCover?: () => void;
  /** P6: View final run receipt */
  onViewReceipt?: () => void;
  hasReceipt?: boolean;
  /** Whether JOB//01 was completed in this run. */
  completed?: boolean;
  /** P3.5A-R.4: surveillance camera receipts derived from mission snapshot */
  receipts?: readonly [CameraReceipt, CameraReceipt, CameraReceipt] | null;
  receiptsSeen?: boolean;
  coverBurned?: boolean;
  onCompleteReceiptReview?: () => void;
  coverVersion?: "COVER//01" | "COVER//02";
  cityMatch?: number;
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

interface FocusMessage {
  title: string;
  line: string;
}

/**
 * JOB YARD — 305 PRINT & SIGN // AFTER HOURS (P3.5A-R).
 *
 * Playable preparation hub on the dedicated yard plate. Walk with
 * WASD/arrows, press E (or activate a marker) at the job terminal, print
 * shop, vehicle, or exit gate. Accepting JOB//01 flips the objective and
 * unlocks the print-shop handoff; the exit gate stays blocked and no
 * district/tagging flow can start from here. Once COVER//01 is locked, the
 * exact saved source is derived into the active full-panel livery, the print
 * shop becomes the re-edit entry, and the gate offers a locked mission-ready handoff.
 */
export default function JobYard({
  hud,
  jobAccepted,
  onAcceptJob,
  cover,
  onEditCover,
  onStartJob,
  onInspect3DCover,
  onViewReceipt,
  hasReceipt = false,
  completed = false,
  receipts,
  receiptsSeen = false,
  coverBurned = false,
  onCompleteReceiptReview,
  coverVersion = "COVER//01",
  cityMatch: _cityMatch,
  disguisePackage,
  vehicleLivery,
  onEditVehicle,
  missionActive = false,
}: JobYardProps) {
  const [_player, setPlayer] = useState<PlayerState>({
    pos: { ...JOB_YARD_SPAWN },
    facing: "right",
    moving: false,
    spriteSrc: playerSprite,
  });
  const [camera, setCamera] = useState<Vec2>({ ...JOB_YARD_SPAWN });
  const [nearId, setNearId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusMessage | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [cctvOpen, setCctvOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [alertActive, setAlertActive] = useState(() => completed && !receiptsSeen);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("crewmark:yard-intro-seen") === "true";
    } catch {
      return false;
    }
  });
  const resolvedVehicleLivery = disguisePackage?.vehicleLivery ?? vehicleLivery ?? DEFAULT_CLEAN_VEHICLE_LIVERY;
  const [inspectSurface, setInspectSurface] = useState<SurfaceId | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    try {
      sessionStorage.setItem("crewmark:yard-intro-seen", "true");
    } catch {}
  };

  useEffect(() => {
    if (completed && !receiptsSeen) {
      const timer = window.setTimeout(() => setAlertActive(true), 1200);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setAlertActive(false), 0);
    return () => window.clearTimeout(timer);
  }, [completed, receiptsSeen]);
  const posRef = useRef<Vec2>({ ...JOB_YARD_SPAWN });
  const keysRef = useRef<Set<string>>(new Set());
  const focusTimer = useRef(0);

  const showFocus = (message: FocusMessage) => {
    window.clearTimeout(focusTimer.current);
    setFocus(message);
    focusTimer.current = window.setTimeout(() => setFocus(null), 2600);
  };

  const interact = (id: string) => {
    // Overlays capture interaction first: E dismisses them.
    if (cctvOpen || rotateOpen || boardOpen || handoffOpen || missionOpen || inspectSurface || vehicleModalOpen) {
      if (missionOpen && onStartJob) {
        setMissionOpen(false);
        onStartJob();
        return;
      }
      setCctvOpen(false);
      setRotateOpen(false);
      setBoardOpen(false);
      setHandoffOpen(false);
      setMissionOpen(false);
      setVehicleModalOpen(false);
      setInspectSurface(null);
      return;
    }
    if (id === "job-terminal") {
      if (coverVersion === "COVER//02" && onViewReceipt && hasReceipt) {
        onViewReceipt();
        return;
      }
      if (receipts) {
        setCctvOpen(true);
        return;
      }
      setBoardOpen(true);
      return;
    }
    if (id === "print-shop") {
      if (missionActive) {
        showFocus({ title: "RUN ACTIVE", line: "DISGUISE FROZEN // RESUME TEST FROM THE VEHICLE" });
        return;
      }
      if (coverVersion === "COVER//02") {
        onEditCover();
        return;
      }
      if (coverBurned) {
        setRotateOpen(true);
        return;
      }
      if (completed) {
        showFocus({ title: "Print shop", line: "COVER//01 // MISSION COMPLETE — ARCHIVED" });
      } else if (cover) {
        onEditCover();
      } else if (jobAccepted) {
        setHandoffOpen(true);
      } else {
        const report = printShopReport(false);
        showFocus({ title: report.title, line: report.line });
      }
      return;
    }
    if (id === "vehicle") {
      setVehicleModalOpen(true);
      return;
    }
    if (id === "exit-gate") {
      if (coverVersion === "COVER//02") {
        const report = exitGateReport(true, true, false);
        showFocus({ title: report.title, line: `COVER//02 ACTIVE — ${report.line}` });
        return;
      }
      if (coverBurned) {
        const report = exitGateReport(true, true, true);
        showFocus({ title: report.title, line: report.line });
        return;
      }
      if (completed) {
        const report = exitGateReport(true);
        showFocus({ title: report.title, line: report.line });
        return;
      }
      if (cover) {
        setMissionOpen(true);
        return;
      }
      const report = exitGateReport();
      showFocus({ title: report.title, line: `${report.line} — prep the cover first` });
    }
  };

  const interactRef = useRef(interact);

  const inspectSurfaceRef = useRef(inspectSurface);
  useEffect(() => {
    interactRef.current = interact;
    inspectSurfaceRef.current = inspectSurface;
  });
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lerp = reduceMotion ? 1 : 1 - Math.exp(-3 * (1 / 60));
    let raf = 0;
    let last = performance.now();

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.isComposing) return;
      if (HANDLED_KEYS.has(e.key)) e.preventDefault();

      // Auto-dismiss onboarding modal on WASD / arrow movement
      const keyLower = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (
        keyLower === "w" ||
        keyLower === "a" ||
        keyLower === "s" ||
        keyLower === "d" ||
        keyLower === "arrowup" ||
        keyLower === "arrowdown" ||
        keyLower === "arrowleft" ||
        keyLower === "arrowright"
      ) {
        setOnboardingDismissed((prev) => {
          if (!prev) {
            try {
              sessionStorage.setItem("crewmark:yard-intro-seen", "true");
            } catch {}
            return true;
          }
          return prev;
        });
      }

      if (e.key === "Escape") {
        if (inspectSurfaceRef.current) {
          setInspectSurface(null);
          return;
        }
        setBoardOpen(false);
        setHandoffOpen(false);
        setMissionOpen(false);
        setVehicleModalOpen(false);
        return;
      }
      if (e.key === "e" || e.key === "E") {
        const target = nearestInRange(posRef.current, JOB_YARD_HOTSPOTS);
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
      const next = clampToBounds(stepPosition(posRef.current, dir, JOB_YARD_SPEED, dt), JOB_YARD_BOUNDS);
      posRef.current = next;
      const nearHotspot = nearestInRange(next, JOB_YARD_HOTSPOTS);
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

  const nearHotspot = JOB_YARD_HOTSPOTS.find((h) => h.id === nearId) ?? null;
  const isCover02 = coverVersion === "COVER//02";
  const prompt = nearHotspot
    ? nearHotspot.id === "job-terminal"
      ? isCover02 && hasReceipt
        ? "VIEW RECEIPT"
        : completed && !receiptsSeen
          ? "CHECK ALERT"
          : completed && receipts
            ? "REVIEW TRACE"
            : "CHECK TERMINAL"
      : nearHotspot.id === "print-shop"
        ? missionActive
          ? "RUN ACTIVE"
          : isCover02
            ? "EDIT COVER//02"
            : coverBurned
              ? "ROTATE COVER"
              : cover
                ? "EDIT IDENTITY"
                : jobAccepted
                  ? "WORK ORDER"
                  : "ENTER PRINT SHOP"
        : nearHotspot.id === "vehicle"
          ? missionActive
            ? "RESUME TEST"
            : isCover02
              ? "INSPECT COVER//02"
              : coverBurned
                ? "INSPECT BURNED COVER"
                : cover
                  ? "TEST THE COVER"
                  : "INSPECT VEHICLE"
          : nearHotspot.id === "exit-gate"
            ? isCover02
              ? "COVER//02 ACTIVE"
              : coverBurned
                ? "INSPECT GATE"
                : cover
                  ? "MISSION READY"
                  : "EXIT YARD"
            : null
    : null;

  const displayedObjective = !jobAccepted && !completed
    ? "CHECK THE JOB TERMINAL"
    : jobObjective(jobAccepted, completed, receiptsSeen, coverBurned, isCover02);

  const acceptAndClose = () => {
    onAcceptJob();
    setBoardOpen(false);
  };

  return (
    <section className="cm-screen cm-screen--yard" aria-label="305 Print and Sign yard">
      <header className="cm-yard-header">
        <p className="cm-kicker">305 PRINT &amp; SIGN // AFTER HOURS</p>
        <h1 className="cm-yard-title">
          GET THE JOB. <span className="accent">PREP THE COVER.</span>
        </h1>
      </header>
      <WorldScene
        plateSrc={yardPlate}
        plateAlt="Nighttime industrial yard: print shop garage, parked crew sedan, crates and exit gate under city lights"
        camera={camera}
        label="Point-and-explore 305 yard. Click hotspots or props to interact."
        screenChildren={
          <>
            <WorldHud
              rep={hud.rep}
              heat={hud.heat}
              territory={hud.territory}
              prompt={prompt}
              progressNote={displayedObjective}
              hideTerritory={true}
            />
            {cover && (
              <div className="cm-yard-surfaces-hud" role="toolbar" aria-label="Cover surfaces inspection">
                <span className="cm-yard-surfaces-title">INSPECT SURFACES:</span>
                <button
                  type="button"
                  className="cm-surface-pill"
                  onClick={() => setInspectSurface("CAR")}
                  title="Inspect Vehicle Livery"
                >
                  VEHICLE
                </button>
                <button
                  type="button"
                  className="cm-surface-pill"
                  onClick={() => setInspectSurface("CRATE")}
                  title="Inspect Cargo Crate Stencil"
                >
                  CRATE
                </button>
                <button
                  type="button"
                  className="cm-surface-pill"
                  onClick={() => setInspectSurface("JACKET")}
                  title="Inspect Crew Jacket Insignia"
                >
                  JACKET
                </button>
                <button
                  type="button"
                  className="cm-surface-pill"
                  onClick={() => setInspectSurface("PASS")}
                  title="Inspect Gate Security Pass"
                >
                  PASS
                </button>
              </div>
            )}
          </>
        }
      >
        {JOB_YARD_HOTSPOTS.map((h) => {
          const marker =
            h.id === "job-terminal" && !jobAccepted && !completed
              ? "objective"
              : h.id === "print-shop" && jobAccepted && !cover
                ? "objective"
                : h.id === "vehicle" && cover && !coverBurned && !completed
                  ? "objective"
                  : h.id === "exit-gate" && cover && !coverBurned && !completed
                    ? "objective"
                    : h.id === "exit-gate" && !cover
                      ? "locked"
                      : h.id === "job-terminal" && jobAccepted
                        ? "done"
                        : "normal";
          return (
            <InteractionZone
              key={h.id}
              hotspot={h}
              state={h.id === "job-terminal" && jobAccepted ? "done" : nearId === h.id ? "near" : "idle"}
              marker={marker}
              onActivate={interact}
              label={h.id === "job-terminal"
                ? { title: "JOB TERMINAL", action: "CLICK TO CHECK JOBS" }
                : h.id === "print-shop"
                  ? { title: "FORGERY GARAGE", action: coverBurned ? "CLICK TO ROTATE COVER" : "CLICK TO BUILD / EDIT COVER" }
                  : h.id === "vehicle"
                    ? { title: "VEHICLE", action: disguisePackage ? "INSPECT / TEST COVER" : "NO COVER APPLIED" }
                    : h.id === "exit-gate"
                      ? { title: "EXIT / GATE", action: disguisePackage ? "CLICK TO DEPART" : "PREP THE COVER FIRST" }
                      : { title: h.label, action: "CLICK TO INSPECT" }}
            />
          );
        })}
        {/* Parked crew sedan: clean factory black when undisguised, transformed into fleet vehicle when disguised */}
        <div
          className="cm-vehicle-cover cm-vehicle-hitbox"
          role="button"
          tabIndex={0}
          title={disguisePackage ? "Parked crew sedan — Click to inspect disguise or edit vehicle" : "Parked crew sedan — Clean / Undisguised State"}
          onClick={() => interact("vehicle")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") interact("vehicle");
          }}
          style={{ cursor: "pointer", pointerEvents: "auto" }}
        >
          <VehicleLiveryProjection livery={resolvedVehicleLivery} angle="yard" className="cm-vehicle-livery--yard" />
        </div>

        {disguisePackage ? (
          <>
            {/* 2. In-world shipping crate/package payoff */}
            <div
              className="cm-crate-cover"
              role="button"
              tabIndex={0}
              title="Shipping crate with stenciled cargo manifest — Click to inspect"
              onClick={() => setInspectSurface("CRATE")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setInspectSurface("CRATE");
              }}
            >
              <div className="cm-crate-marking">
                <img src={disguisePackage.identityArtwork} alt="Crate manifest" draggable={false} />
              </div>
              <span className="cm-crate-tag">CRATE // MANIFEST</span>
            </div>

            {/* 3. In-world Jacket prop payoff */}
            <div
              className="cm-yard-prop-jacket"
              role="button"
              tabIndex={0}
              title="Contractor utility work jacket on hook — Click to inspect"
              onClick={() => setInspectSurface("JACKET")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setInspectSurface("JACKET");
              }}
            >
              <div className="cm-jacket-hanger-badge">
                <span className="cm-prop-label">CREW JACKET</span>
                <div className="cm-jacket-mini-patch">
                  <img src={disguisePackage.identityArtwork} alt="Jacket patch" draggable={false} />
                </div>
              </div>
            </div>

            {/* 4. In-world Security Pass / Lanyard prop payoff */}
            <div
              className="cm-yard-prop-pass"
              role="button"
              tabIndex={0}
              title="Contractor gate pass clipboard & lanyard — Click to inspect"
              onClick={() => setInspectSurface("PASS")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setInspectSurface("PASS");
              }}
            >
              <div className="cm-pass-badge">
                <span className="cm-prop-label">GATE PASS</span>
                <div className="cm-pass-mini-card">
                  <img src={disguisePackage.identityArtwork} alt="Gate badge" draggable={false} />
                </div>
              </div>
            </div>
          </>
        ) : null}
        {/* WorldPlayer removed per P7C: canonical 305 yard is now a point-and-explore cinematic environment */}
      </WorldScene>

      {focus && !boardOpen && !handoffOpen && !missionOpen ? (
        <div className="cm-world-focus" role="status">
          <p className="cm-world-focus-label">{focus.title}</p>
          <p className="cm-world-focus-sys">{focus.line}</p>
        </div>
      ) : null}

      {boardOpen ? (
        <div className="cm-workorder" role="dialog" aria-modal="false" aria-label="Job board work order">
          <p className="cm-kicker">Work order // terminal 02</p>
          <h2 className="cm-workorder-title">
            {JOB_01.id} <span>{JOB_01.title}</span>
          </h2>
          <dl className="cm-workorder-rows">
            <div>
              <dt>Client</dt>
              <dd>{JOB_01.client}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{JOB_01.target}</dd>
            </div>
            <div>
              <dt>Window</dt>
              <dd>{JOB_01.window}</dd>
            </div>
          </dl>
          <p className="cm-workorder-objective">{JOB_01.objective}</p>
          <ul className="cm-workorder-reqs">
            {JOB_01.requirements.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
          <p className="cm-workorder-warning">{JOB_01.warning}</p>
          <div className="cm-cta-row">
            {completed ? (
              <p className="cm-workorder-accepted" role="status">
                Work order completed — payment received.
              </p>
            ) : jobAccepted ? (
              <p className="cm-workorder-accepted" role="status">
                Work order accepted — enter the print shop.
              </p>
            ) : (
              <button type="button" className="btn btn-primary" onClick={acceptAndClose}>
                Accept job
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setBoardOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {handoffOpen ? (
        <div className="cm-workorder" role="dialog" aria-modal="false" aria-label="Cover work order handoff">
          <p className="cm-kicker">Print shop // work order ready</p>
          <h2 className="cm-workorder-title">
            Cover//01 <span>Work order ready</span>
          </h2>
          <p className="cm-workorder-objective">Next: build the contractor cover.</p>
          <div className="cm-cta-row">
            <button type="button" className="btn btn-primary" onClick={onEditCover}>
              Open print bay
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setHandoffOpen(false)}
            >
              Back to yard
            </button>
          </div>
        </div>
      ) : null}

      {vehicleModalOpen ? (
        <div className="cm-workorder" role="dialog" aria-modal="true" aria-label="Vehicle disguise status">
          <p className="cm-kicker">305 Yard // Crew Sedan</p>
          <h2 className="cm-workorder-title">
            {cover ? (
              <>{coverVersion === "COVER//02" ? "Cover//02 Active" : "Cover//01 Active"} <span>Disguise Mounted</span></>
            ) : (
              <>CLEAN STATE <span>// UNDISGUISED</span></>
            )}
          </h2>
          <p className="cm-workorder-objective">
            {missionActive ? "RUN ACTIVE // DISGUISE FROZEN. Resume the same mission run; editing is locked." : cover
              ? (coverVersion === "COVER//02"
                  ? "Rotated signature livery is active on vehicle."
                  : "Contractor cover livery is mounted and ready for inspection.")
              : "Sedan is currently in its factory black state. Choose and mount a fake-company disguise at the Forgery Garage before attempting the Port Vice gate run."}
          </p>
          <div className="cm-cover-frame cm-cover-frame--livery" style={{ maxWidth: "520px", margin: "14px 0" }}>
            <VehicleLiveryProjection livery={resolvedVehicleLivery} angle="yard" className="cm-vehicle-livery--yard cm-vehicle-livery--modal" />
          </div>
          <div className="cm-cta-row">
            {cover ? (
              <>
                {onInspect3DCover && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setVehicleModalOpen(false);
                      onInspect3DCover();
                    }}
                  >
                    INSPECT COVER (3D)
                  </button>
                )}
                {!missionActive && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => { setVehicleModalOpen(false); onEditCover(); }}>
                      EDIT IDENTITY
                    </button>
                    {onEditVehicle && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setVehicleModalOpen(false);
                          onEditVehicle();
                        }}
                      >
                        EDIT VEHICLE
                      </button>
                    )}
                  </>
                )}
                {onStartJob && !completed && !coverBurned && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setVehicleModalOpen(false);
                      onStartJob();
                    }}
                  >
                    {missionActive ? "RESUME TEST" : "TEST THE COVER"}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setVehicleModalOpen(false);
                  onEditCover();
                }}
              >
                OPEN PRINT BAY / GARAGE
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setVehicleModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {missionOpen ? (
        <div className="cm-workorder" role="dialog" aria-modal="false" aria-label="Mission-ready handoff">
          <p className="cm-kicker">Port Vice // standby</p>
          <h2 className="cm-workorder-title">
            Job//01 <span>Ready — gate run locked</span>
          </h2>
          <dl className="cm-workorder-rows">
            <div>
              <dt>Target</dt>
              <dd>PORT VICE SERVICE GATE</dd>
            </div>
            <div>
              <dt>Disguise</dt>
              <dd>COVER//01 ({cover ? `${cover.score}% check` : "active"})</dd>
            </div>
          </dl>
          <p className="cm-workorder-objective">Departure ready for Port Vice service gate.</p>
          <p className="cm-hint">Vehicle disguise applied. Security will scan the vehicle at the gate.</p>
          <div className="cm-cta-row">
            {onStartJob ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setMissionOpen(false);
                  onStartJob();
                }}
              >
                START JOB
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMissionOpen(false)}
            >
              Back to yard
            </button>
          </div>
        </div>
      ) : null}
      {alertActive && !cctvOpen && (
        <div className="cm-radio-alert" role="status">
          <span className="cm-radio-dot" />
          <p className="cm-radio-title">VICE COUNTY WATCH // VISUAL MATCH DETECTED</p>
          <p className="cm-radio-sub">DISGUISE COMPROMISED — CHECK THE TERMINAL</p>
        </div>
      )}

      {cctvOpen && receipts ? (
        <CctvReview
          receipts={receipts}
          alreadyBurned={coverBurned ?? false}
          onCompleteReview={() => {
            onCompleteReceiptReview?.();
          }}
          onClose={() => setCctvOpen(false)}
        />
      ) : null}

      {rotateOpen ? (
        <div className="cm-workorder" role="dialog" aria-modal="false" aria-label="Rotate cover work order">
          <p className="cm-kicker">Print shop // Cover rotation</p>
          <h2 className="cm-workorder-title">
            Cover//02 <span>New work order required</span>
          </h2>
          <p className="cm-workorder-objective">Next: change the visual signature.</p>
          <p className="cm-workorder-warning">
            COVER//01 signature is compromised on city cameras. Change the visual signature in the next work order.
          </p>
          <div className="cm-cta-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setRotateOpen(false);
                onEditCover();
              }}
            >
              Open print bay
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setRotateOpen(false)}
            >
              Back to yard
            </button>
          </div>
        </div>
      ) : null}

      {inspectSurface && disguisePackage && cover && (
        <div
          className="cm-surface-detail-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setInspectSurface(null)}
        >
          <div
            className="cm-surface-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-surface-detail-header">
              <div>
                <p className="cm-kicker" style={{ margin: 0 }}>SURFACE INSPECTOR // 305 QUALITY CONTROL</p>
                <h2 className="cm-workorder-title" style={{ margin: "4px 0 0" }}>
                  {inspectSurface} // <span>DETAIL VIEW</span>
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setInspectSurface(null)}
              >
                CLOSE [ESC]
              </button>
            </div>

            <div className="cm-surface-detail-body">
              <SurfaceMockup
                surfaceId={inspectSurface}
                coverDataUrl={disguisePackage.identityArtwork}
                vehicleLivery={disguisePackage.vehicleLivery}
                detailed={true}
                showInspectorButton={false}
              />
            </div>

            <div className="cm-cta-row" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setInspectSurface(null)}
              >
                RETURN TO YARD
              </button>
            </div>
          </div>
        </div>
      )}

      {!onboardingDismissed && (
        <div
          className="cm-yard-onboarding-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="305 Print and Sign Introduction"
        >
          <div className="cm-yard-onboarding-modal">
            <div className="cm-yard-onboarding-header">
              <span className="cm-yard-onboarding-tag">AFTER HOURS // DIEGETIC ONBOARDING</span>
              <p className="cm-kicker" style={{ margin: "6px 0 0" }}>305 PRINT &amp; SIGN // AFTER HOURS</p>
            </div>

            <div className="cm-yard-onboarding-body">
              <p className="cm-yard-onboarding-lead">
                Build a fake front.
                <br />
                Print the cover.
                <br />
                Put it on the vehicle.
                <br />
                See if the city believes you.
              </p>
            </div>

            <div className="cm-yard-onboarding-brief">
              <div className="cm-yard-onboarding-row">
                <span className="cm-yard-onboarding-lbl">CONTROLS:</span>
                <span className="cm-yard-onboarding-val">CLICK OBJECTS TO INTERACT // ESC CLOSES MENUS</span>
              </div>
              <div className="cm-yard-onboarding-row">
                <span className="cm-yard-onboarding-lbl">OBJECTIVE:</span>
                <span className="cm-yard-onboarding-val accent">CHECK THE JOB TERMINAL</span>
              </div>
            </div>

            <div className="cm-cta-row" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={dismissOnboarding}
                autoFocus
              >
                ENTER THE YARD
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="cm-hint">
        Click a marked object to interact // Esc closes active menus.
      </p>
    </section>
  );
}
