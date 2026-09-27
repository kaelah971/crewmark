import { useEffect, useRef, useState } from "react";
import SurfaceMockup from "./SurfaceMockup";
import { VehicleLiveryProjection } from "./VehicleLiveryProjection";
import type { VehicleLivery } from "../lib/vehicleLivery";
import type { MissionSnapshot } from "../world/mission";
import {
  BLUFF_CHECK_MS,
  BLUFF_FEEDBACK_MS,
  applyBluffResponse,
  branchForBluffOutcome,
  classifyEvidence,
  evidenceChoices,
  evidenceLabel,
  evidenceSurface,
  markBluffResolved,
  questionForId,
  type BluffEvidenceId,
  type BluffResponse,
  type CheckpointBluffState,
} from "../world/checkpointBluff";

interface CheckpointBluffProps {
  snapshot: MissionSnapshot;
  livery: VehicleLivery;
  state: CheckpointBluffState;
  heat: number;
  onStateChange: (state: CheckpointBluffState) => void;
  onResolve: (branch: ReturnType<typeof branchForBluffOutcome>, state: CheckpointBluffState) => void;
  onAbort: () => void;
}

interface FeedbackState {
  readonly response: BluffResponse;
  readonly evidence?: BluffEvidenceId;
}

const OUTCOME_COPY = {
  "clean-pass": {
    title: "THE CITY BOUGHT IT.",
    className: "is-clean",
    line: "YOU GOT THROUGH. THE CAMERAS STILL REMEMBERED.",
    detail: "KEEP IT MOVING.",
  },
  "secondary-review": {
    title: "THE STORY ALMOST BROKE.",
    className: "is-secondary",
    line: "SECONDARY REVIEW CLEARED THE LIE — BARELY.",
    detail: "MATCHES THE WORK ORDER.",
  },
  busted: {
    title: "THE CITY DOESN'T BELIEVE YOU.",
    className: "is-busted",
    line: "COVER//01 CAPTURED. EVIDENCE ROUTED TO CITY CAMERAS.",
    detail: "PULL OVER.",
  },
} as const;

const FEEDBACK_COPY: Record<BluffResponse, { label: string; detail: string; className: string }> = {
  correct: { label: "CHECKS OUT.", detail: "KEEP IT MOVING.", className: "is-correct" },
  plausible: { label: "THAT'S NOT WHAT I ASKED FOR.", detail: "SUSPICION +1 // EXPLAIN YOURSELF.", className: "is-plausible" },
  wrong: { label: "WHY DOES THIS NOT MATCH?", detail: "PULL OVER.", className: "is-wrong" },
  timeout: { label: "ANSWER TOO SLOW.", detail: "THE GUARD WAVES THE NEXT CAR THROUGH.", className: "is-timeout" },
};

const SCAN_SURFACES = [
  { id: "CAR" as const, label: "VEHICLE" },
  { id: "PASS" as const, label: "PASS" },
  { id: "CRATE" as const, label: "CRATE" },
  { id: "JACKET" as const, label: "JACKET" },
];

function packageCompany(snapshot: MissionSnapshot): string {
  return snapshot.disguisePackage?.companyName ?? "VICE CONTRACTOR FLEET";
}

function packageArtwork(snapshot: MissionSnapshot): string {
  return snapshot.disguisePackage?.identityArtwork || snapshot.coverImage;
}

export default function CheckpointBluff({
  snapshot,
  livery,
  state,
  heat,
  onStateChange,
  onResolve,
  onAbort,
}: CheckpointBluffProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const resolveRef = useRef(onResolve);
  const changeRef = useRef(onStateChange);
  const responseLock = useRef(-1);
  const [timeLeft, setTimeLeft] = useState(BLUFF_CHECK_MS);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    resolveRef.current = onResolve;
    changeRef.current = onStateChange;
  }, [onResolve, onStateChange]);

  // This is a blocking cinematic dialog. Keep keyboard focus inside it and
  // restore the trigger focus when the bluff hands control back to the road.
  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusDialog = () => {
      const target = dialogRef.current?.querySelector<HTMLElement>("[data-bluff-choice]") ?? dialogRef.current;
      target?.focus();
    };
    const frame = window.requestAnimationFrame(focusDialog);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onAbort();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [tabindex]:not([tabindex=\"-1\"])",
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [onAbort]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), BLUFF_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (state.status !== "active" || feedback || state.currentIndex >= state.questionIds.length) return;
    const questionIndex = state.currentIndex;
    responseLock.current = -1;
    const deadline = Date.now() + BLUFF_CHECK_MS;
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0 && responseLock.current !== questionIndex) {
        respond("timeout");
      }
    };
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
    // respond is intentionally declared below; the current question index is
    // the guard that makes a late interval tick harmless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.currentIndex, feedback]);

  useEffect(() => {
    if (state.status !== "resolving" || !state.outcome) return;
    const timer = window.setTimeout(() => {
      const resolved = markBluffResolved(state);
      changeRef.current(resolved);
      resolveRef.current(branchForBluffOutcome(state.outcome!), resolved);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [state]);

  function respond(response: BluffResponse, evidence?: BluffEvidenceId) {
    if (state.status !== "active" || feedback || state.currentIndex >= state.questionIds.length) return;
    const questionIndex = state.currentIndex;
    if (responseLock.current === questionIndex) return;
    responseLock.current = questionIndex;
    const nextState = applyBluffResponse(state, response);
    setTimeLeft(BLUFF_CHECK_MS);
    setFeedback({ response, evidence });
    changeRef.current(nextState);
  }

  const isFinalScan = state.status === "resolving" || state.status === "resolved";
  const currentQuestion = questionForId(state.questionIds[Math.min(state.currentIndex, state.questionIds.length - 1)]);
  const choices = evidenceChoices(currentQuestion.id);
  const company = packageCompany(snapshot);
  const artwork = packageArtwork(snapshot);
  const feedbackCopy = feedback ? FEEDBACK_COPY[feedback.response] : null;
  const outcomeCopy = state.outcome ? OUTCOME_COPY[state.outcome] : null;
  const heatGain = state.outcome === "clean-pass" ? 3 : state.outcome === "secondary-review" ? 8 : 15;

  return (
    <div className="cm-bluff-overlay" role="presentation">
      <div
        ref={dialogRef}
        className={`cm-bluff-dialog${outcomeCopy ? ` ${outcomeCopy.className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-bluff-title"
        tabIndex={-1}
      >
        <header className="cm-bluff-header">
          <div>
            <p className="cm-kicker">Port Vice // security check</p>
            <h2 id="cm-bluff-title" className="cm-bluff-title">CHECKPOINT BLUFF</h2>
          </div>
          <button type="button" className="btn btn-ghost cm-bluff-abort" onClick={onAbort}>
            ABORT // RETURN TO 305
          </button>
        </header>

        <div className="cm-bluff-identity">
          <div className="cm-bluff-belief-block">
            <div className="cm-bluff-meter-label">
              <span>CITY BELIEF</span>
              <strong>{state.belief}<small> / 100</small></strong>
            </div>
            <div
              className="cm-bluff-belief-meter"
              role="meter"
              aria-label="City belief"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={state.belief}
            >
              <span style={{ transform: `scaleX(${state.belief / 100})` }} />
            </div>
          </div>
          <div className="cm-bluff-heat">
            <span>HEAT</span>
            <strong>{heat}</strong>
          </div>
          <div className="cm-bluff-company">
            <span>FRONT</span>
            <strong>{company}</strong>
          </div>
          <div className="cm-bluff-vehicle-thumb" aria-label={`${company} vehicle livery`}>
            <VehicleLiveryProjection livery={livery} angle="mission" className="cm-bluff-thumb-livery" />
          </div>
        </div>

        {isFinalScan ? (
          <section className="cm-bluff-final" aria-live="polite" aria-label="Final identity scan">
            <div className="cm-bluff-final-heading">
              <p className="cm-kicker">Identity correlation // last pass</p>
              <h3>FINAL IDENTITY SCAN</h3>
              <span>{state.currentIndex} / {state.questionIds.length} CHECKS RESOLVED</span>
            </div>
            <div className="cm-bluff-scan-grid">
              {SCAN_SURFACES.map((surface) => (
                <div className="cm-bluff-scan-surface" key={surface.id}>
                  <span>{surface.label}</span>
                  <SurfaceMockup
                    surfaceId={surface.id}
                    coverDataUrl={artwork}
                    vehicleLivery={livery}
                    showInspectorButton={false}
                    className="cm-bluff-mini-surface"
                  />
                </div>
              ))}
              <div className="cm-bluff-scan-line" aria-hidden="true" />
            </div>
            {outcomeCopy ? (
              <div className="cm-bluff-outcome" role="status">
                <p className="cm-bluff-outcome-kicker">SCAN RESULT // {state.outcome?.replace("-", " ")}</p>
                <h3>{outcomeCopy.title}</h3>
                <p>{outcomeCopy.line}</p>
                <div className="cm-bluff-consequences">
                  <span>BELIEF <strong>{state.belief}</strong></span>
                  <span>HEAT <strong>+{heatGain}</strong></span>
                  <span>REP <strong>+25 ON DELIVERY</strong></span>
                </div>
                <strong className="cm-bluff-outcome-detail">{outcomeCopy.detail}</strong>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="cm-bluff-check" aria-live="polite">
            <div className="cm-bluff-question-row">
              <div>
                <p className="cm-bluff-step">CHECK {state.currentIndex + 1} / {state.questionIds.length}</p>
                <p className="cm-bluff-guard">{currentQuestion.guard}:</p>
                <h3>{currentQuestion.prompt}</h3>
              </div>
              <div className="cm-bluff-countdown" aria-label={`${Math.ceil(timeLeft / 1000)} seconds remaining`}>
                <span>{Math.ceil(timeLeft / 1000).toString().padStart(2, "0")}</span>
                <div className="cm-bluff-countdown-bar" role="progressbar" aria-valuemin={0} aria-valuemax={BLUFF_CHECK_MS} aria-valuenow={timeLeft}>
                  <i style={{ transform: `scaleX(${timeLeft / BLUFF_CHECK_MS})` }} />
                </div>
              </div>
            </div>
            {feedbackCopy ? (
              <div className={`cm-bluff-feedback ${feedbackCopy.className}`} role="status">
                <strong>{feedbackCopy.label}</strong>
                <span>{feedbackCopy.detail}</span>
              </div>
            ) : (
              <p className="cm-bluff-instruction">PRESENT THE EVIDENCE THAT MAKES THE STORY HOLD.</p>
            )}
            <div className={`cm-bluff-evidence-grid${feedback ? " is-responding" : ""}`}>
              {choices.map((evidence) => {
                const selected = feedback?.evidence === evidence;
                return (
                  <button
                    key={evidence}
                    type="button"
                    className={`cm-bluff-evidence-card${selected ? " is-presented" : ""}`}
                    data-bluff-choice={true}
                    aria-label={`Present ${evidenceLabel(evidence)}`}
                    disabled={Boolean(feedback)}
                    onClick={() => respond(classifyEvidence(currentQuestion.id, evidence), evidence)}
                  >
                    <span className="cm-bluff-evidence-label">{evidenceLabel(evidence)}</span>
                    <SurfaceMockup
                      surfaceId={evidenceSurface(evidence)}
                      coverDataUrl={artwork}
                      vehicleLivery={livery}
                      showInspectorButton={false}
                      className="cm-bluff-evidence-surface"
                    />
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
