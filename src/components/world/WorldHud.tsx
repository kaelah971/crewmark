import Hud from "../Hud";

interface WorldHudProps {
  rep: number;
  heat: number;
  territory?: number;
  /** Bottom-center contextual prompt, e.g. "[E] INSPECT — CREW CAR". */
  prompt: string | null;
  /** Small progress readout, e.g. "SIGHTINGS 2/3". */
  progressNote: string | null;
  /** P7C.1: omit legacy territory stat from canonical product */
  hideTerritory?: boolean;
}

/**
 * Game HUD: live values top-left, contextual prompt bottom-center.
 * Reuses the canonical Hud — no parallel stat logic.
 */
export default function WorldHud({
  rep,
  heat,
  territory = 0,
  prompt,
  progressNote,
  hideTerritory = false,
}: WorldHudProps) {
  return (
    <>
      <div className="cm-world-hud">
        <Hud rep={rep} heat={heat} territory={territory} variant="overlay" hideTerritory={hideTerritory} />
        {progressNote ? (
          <span className="cm-world-progress" aria-live="polite">
            {progressNote}
          </span>
        ) : null}
      </div>
      {prompt ? (
        <p className="cm-world-prompt" aria-live="polite">
          <span className="cm-key" aria-hidden={true}>
            [E]
          </span>{" "}
          <span className="cm-prompt-label">{prompt}</span>
        </p>
      ) : null}
    </>
  );
}
