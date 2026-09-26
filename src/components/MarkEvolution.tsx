import { useRef, useState } from "react";
import ImageEditor, {
  type ImageEditorRef,
  type ImageEditorSaveResult,
} from "@unlayer/react-image-editor";
import { Lock, TriangleAlert } from "lucide-react";
import { isOutputDataUrl } from "../lib/markOutput";

interface MarkEvolutionProps {
  /** The exact saved MARK//001 data URL — the editable starting image. Never mutated. */
  markV1: string;
  /** Called with the REAL evolved output (PNG data URL from the editor). */
  onCommit: (dataUrl: string) => void;
  /** Return to the compromised ending without saving. */
  onBack: () => void;
}

/**
 * MARK EVOLUTION — second real @unlayer/react-image-editor interaction (P4A).
 *
 * Verified initialization mechanism (package v1.0.2 index.d.ts +
 * skill references/react.md): the required `image` prop accepts an
 * "Image URL or data URL to edit". MARK//001 is a PNG data URL, so it is
 * passed directly as the starting image — the same documented mechanism
 * the EDIT MARK flow has used since P0.1. No workaround, no fake editor.
 *
 * Save is the custom LOCK MARK//002 action via the documented
 * `editor.getImage()` instance method (canonical per the MARK//001 flow);
 * the native toolbar Save commits through `onSave` to the same validator.
 */
export default function MarkEvolution({ markV1, onCommit, onBack }: MarkEvolutionProps) {
  const editorRef = useRef<ImageEditorRef>(null);
  const [ready, setReady] = useState(false);
  const [locking, setLocking] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Single commit path: validate the real output, then hand it to App. */
  const commitOutput = (dataUrl: unknown, source: "toolbar-save" | "lock-button") => {
    console.info(`[crewmark] MARK//002 save via ${source}`, {
      type: typeof dataUrl,
      length: typeof dataUrl === "string" ? dataUrl.length : 0,
    });
    if (!isOutputDataUrl(dataUrl)) {
      setFatal(
        "The editor returned no usable image output. Nothing was stored — MARK//001 is untouched and no placeholder was substituted.",
      );
      return;
    }
    onCommit(dataUrl);
  };

  /** Native Save button inside the Unlayer toolbar. */
  const handleNativeSave = (result: ImageEditorSaveResult) => {
    commitOutput(result.dataUrl, "toolbar-save");
  };

  /** LOCK MARK//002 CTA — pulls the flattened canvas through the real API. */
  const handleLockClick = () => {
    setFatal(null);
    const editor = editorRef.current?.editor;
    if (!editor) {
      setFatal("Editor instance is not ready yet. Wait for the terminal to finish loading, then lock again.");
      return;
    }
    setLocking(true);
    try {
      const dataUrl = editor.getImage();
      commitOutput(dataUrl, "lock-button");
    } catch (err) {
      console.error("[crewmark] MARK//002 getImage() threw:", err);
      setFatal(
        `Could not read the evolved image (${err instanceof Error ? err.message : String(err)}). Nothing was stored.`,
      );
    } finally {
      setLocking(false);
    }
  };

  return (
    <section className="cm-screen" aria-label="Mark evolution">
      <p className="cm-kicker">Identity recovery // Mark//002</p>
      <h1 className="cm-title">
        They copied the symbol.
        <br />
        <span className="accent">Not what it means.</span>
      </h1>
      <p className="cm-lede">
        Evolve your mark. Make the counterfeit obsolete.{" "}
        <span className="cm-dim">
          MARK//001 // Compromised → MARK//002 // Undefined
        </span>
      </p>

      <div className="cm-editor-frame">
        {!ready && !fatal && (
          <div className="cm-loading" aria-live="polite">
            <div className="bar" aria-hidden="true">
              <i />
            </div>
            <span>Loading recovery terminal…</span>
          </div>
        )}
        <div className="cm-editor-inner">
          <ImageEditor
            ref={editorRef}
            image={markV1}
            minHeight="700px"
            options={{ theme: "dark" }}
            onLoad={() => {
              console.info("[crewmark] Unlayer evolution editor mounted and ready.");
              setReady(true);
            }}
            onSave={handleNativeSave}
            onCancel={() => {
              console.info("[crewmark] Evolution editor cancel pressed; nothing committed.");
              setNotice("Cancel pressed inside the editor — nothing was committed.");
            }}
            onLoadError={() => {
              console.error("[crewmark] Evolution editor could not load MARK//001 (decode/CORS/404).");
              setLoadError(
                "MARK//001 failed to load into the canvas (decode, CORS, or missing data). " +
                  "This is the editor reporting onLoadError — no fake canvas was substituted.",
              );
            }}
            onError={(error) => {
              console.error("[crewmark] Evolution editor wrapper failure:", error);
              setFatal(
                `Recovery terminal failed to initialize: ${error.message}. ` +
                  "Check your connection to the Unlayer CDN, then reload.",
              );
            }}
          />
        </div>
      </div>

      {fatal && (
        <div className="cm-alert" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{fatal}</span>
        </div>
      )}
      {loadError && !fatal && (
        <div className="cm-alert" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}
      {notice && !fatal && <p className="cm-notice">{notice}</p>}

      <h2 className="cm-evo-sub">Evolve the mark</h2>
      <p className="cm-hint">
        Change enough that the city can tell the difference. Try adding a
        shape, slash, symbol, text, or new color treatment.
      </p>

      <div className="cm-cta-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleLockClick}
          disabled={!ready || locking}
          aria-label="Lock Mark 002 and reveal the comparison"
        >
          <Lock size={16} aria-hidden="true" />
          {locking ? "Locking…" : "Lock Mark//002"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={locking}>
          Back to compromised
        </button>
      </div>
      <p className="cm-hint">
        Lock pulls the real flattened canvas via the editor&apos;s getImage()
        API into a separate MARK//002 slot. MARK//001 is never modified.
      </p>
    </section>
  );
}
