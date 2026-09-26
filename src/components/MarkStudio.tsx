import { useRef, useState } from "react";
import ImageEditor, {
  type ImageEditorRef,
  type ImageEditorSaveResult,
} from "@unlayer/react-image-editor";
import { ArrowRight, Lock, TriangleAlert } from "lucide-react";
import { isOutputDataUrl } from "../lib/markOutput";

interface MarkStudioProps {
  /** Data URL the editor loads: blank starter canvas, or the saved mark when re-editing. */
  startImage: string;
  /** True when a saved MARK//001 already exists (offers a shortcut to reveal). */
  hasSavedMark: boolean;
  /** P5 canonical path: hide the legacy identity-board shortcut entirely. Defaults false for compat. */
  hideIdentityBoard?: boolean;
  /** Called with the REAL saved output (PNG data URL from the editor). */
  onCommit: (dataUrl: string) => void;
  onViewVehicle: () => void;
}

/**
 * MARK STUDIO — embeds the real @unlayer/react-image-editor.
 *
 * Verified API surface (package v1.0.2 + skill references/react.md):
 * - required `image` prop (URL or base64 data URL)
 * - `options={{ theme: "dark" }}` (all 8 manual tools on by default)
 * - `onSave({ dataUrl, blob })` fires from the editor's own Save action
 * - ref `{ editor }` exposes `getImage(): string | null`
 * - `onLoad` / `onError` (wrapper failures) vs `onLoadError` (image decode/CORS)
 */
export default function MarkStudio({
  startImage,
  hasSavedMark,
  hideIdentityBoard = false,
  onCommit,
  onViewVehicle,
}: MarkStudioProps) {
  const editorRef = useRef<ImageEditorRef>(null);
  const [ready, setReady] = useState(false);
  const [locking, setLocking] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Single commit path: validate the real output, then hand it to App. */
  const commitOutput = (dataUrl: unknown, source: "toolbar-save" | "lock-button") => {
    console.info(`[crewmark] save via ${source}`, {
      type: typeof dataUrl,
      length: typeof dataUrl === "string" ? dataUrl.length : 0,
    });
    if (!isOutputDataUrl(dataUrl)) {
      setFatal(
        "The editor returned no usable image output. Nothing was stored — no placeholder was substituted. Try editing again, then save.",
      );
      return;
    }
    onCommit(dataUrl);
  };

  /** Native Save button inside the Unlayer toolbar. */
  const handleNativeSave = (result: ImageEditorSaveResult) => {
    commitOutput(result.dataUrl, "toolbar-save");
  };

  /** LOCK MARK//001 CTA — pulls the flattened canvas through the real API. */
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
      console.error("[crewmark] getImage() threw:", err);
      setFatal(
        `Could not read the edited image (${err instanceof Error ? err.message : String(err)}). Nothing was stored.`,
      );
    } finally {
      setLocking(false);
    }
  };

  return (
    <section className="cm-screen" aria-label="Mark studio">
      <p className="cm-kicker">305 Print &amp; Sign // After-hours terminal</p>
      <h1 className="cm-title">
        Mark<span className="accent">//</span>001
      </h1>
      <p className="cm-lede">
        Make something they recognize before they know your name.{" "}
        <span className="cm-dim">
          Work the canvas below — then lock it. The exact pixels you save get
          put on the car.
        </span>
      </p>

      <div className="cm-editor-frame">
        {!ready && !fatal && (
          <div className="cm-loading" aria-live="polite">
            <div className="bar" aria-hidden="true">
              <i />
            </div>
            <span>Loading print terminal…</span>
          </div>
        )}
        <div className="cm-editor-inner">
          <ImageEditor
            ref={editorRef}
            image={startImage}
            minHeight="700px"
            options={{ theme: "dark" }}
            onLoad={() => {
              console.info("[crewmark] Unlayer editor mounted and ready.");
              setReady(true);
            }}
            onSave={handleNativeSave}
            onCancel={() => {
              console.info("[crewmark] Editor cancel pressed; nothing committed.");
              setNotice("Cancel pressed inside the editor — nothing was committed.");
            }}
            onLoadError={() => {
              console.error("[crewmark] Editor could not load the source image (decode/CORS/404).");
              setLoadError(
                "The source image failed to load into the canvas (decode, CORS, or missing data). " +
                  "This is the editor reporting onLoadError — no fake canvas was substituted.",
              );
            }}
            onError={(error) => {
              console.error("[crewmark] Editor wrapper failure:", error);
              setFatal(
                `Print terminal failed to initialize: ${error.message}. ` +
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

      <div className="cm-cta-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleLockClick}
          disabled={!ready || locking}
          aria-label="Lock Mark 001 and reveal it on the vehicle"
        >
          <Lock size={16} aria-hidden="true" />
          {locking ? "Locking…" : "Lock Mark//001"}
        </button>
        {hasSavedMark && !hideIdentityBoard && (
          <button type="button" className="btn btn-ghost" onClick={onViewVehicle}>
            View identity board
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="cm-hint">
        Working area 1024 × 1024 — the checker behind the editor means
        transparent, and transparency is what gets exported. Lock pulls the
        real flattened canvas via the editor&apos;s getImage() API; the
        editor&apos;s own toolbar Save commits through onSave — same pixels,
        same reveal. Nothing in the guides is baked into your mark.
      </p>
    </section>
  );
}
