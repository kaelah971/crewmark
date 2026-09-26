import { useRef, useState, useEffect, type ChangeEvent } from "react";
import ImageEditor, {
  type ImageEditorRef,
  type ImageEditorSaveResult,
} from "@unlayer/react-image-editor";
import {
  Car,
  Lock,
  TriangleAlert,
  Eye,
  Upload,
  Sparkles,
  FileX,
} from "lucide-react";
import { isOutputDataUrl } from "../lib/markOutput";
import {
  analyzeCoverImage,
  canLockCover,
  type CoverAnalysis,
} from "../lib/coverAnalysis";
import {
  analyzeCreativeMetrics,
  type CreativeMetrics,
} from "../lib/creativeMetrics";
import {
  compareCoverImages,
  type VisualSignatureComparison,
  MIN_ROTATION_LOCK_DISTANCE,
} from "../lib/signatureComparison";
import MultiSurfacePreview from "./MultiSurfacePreview";
import TemplateGallery from "./TemplateGallery";
import { loadCoverTemplateDataUrl, type CoverTemplateId } from "../lib/coverTemplates";
import type { DisguisePackageSlot } from "../lib/disguisePackage";
import {
  createStarterTemplate,
  loadChosenFront,
  FRONT_OPTION_BY_ID,
  type ChosenFrontRecord,
} from "../lib/fronts";

const RECOMMENDED_TEMPLATE_BY_FRONT: Partial<Record<string, CoverTemplateId>> = {
  "pool-service": "clearwater-pool",
  "flower-delivery": "coral-bloom",
  "pest-control": "bug-out-305",
  "nightlife-supply": "nightshift-supply",
  "mobile-detailing": "vice-mobile-detail",
};
export interface ForgeryBayProps {
  /**
   * Editable starting image: the saved COVER//01 when re-editing or rotating,
   * otherwise the blank vinyl starter panel.
   */
  initialImage: string;
  /** True when an existing cover is being reworked (copy only). */
  hasExistingCover: boolean;
  /** Called with validated output + its fresh analysis on LOCK COVER//01. */
  onCommit: (
    dataUrl: string,
    analysis: CoverAnalysis,
    creativeMetrics?: CreativeMetrics,
  ) => void;
  /** Return to the yard without saving. */
  onBack: () => void;
  /** P3.5A-R.5: rotation mode flag (first-time rotation from burned Cover01) */
  isRotationMode?: boolean;
  /** Editing an already-locked active Cover02 */
  isEditingCover02?: boolean;
  /** Historical burned COVER//01 reference for visual signature comparison */
  burnedCover01?: { image: string; score: number } | null;
  /** Called with validated output + fresh analysis + signature comparison on LOCK COVER//02. */
  onCommitRotation?: (
    dataUrl: string,
    analysis: CoverAnalysis,
    signature: VisualSignatureComparison,
    creativeMetrics?: CreativeMetrics,
  ) => void;
  chosenFront?: ChosenFrontRecord | null;
  startInGallery?: boolean;
  packageSlot?: DisguisePackageSlot;
  onSelectArtwork?: (dataUrl: string, templateId: CoverTemplateId | null, slot: DisguisePackageSlot) => void;
  onOpenVehicleEditor?: () => void;

}

/**
 * FORGERY BAY / FORGERY GARAGE — visual-forgery editor for COVER//01 and COVER//02.
 *
 * Real @unlayer/react-image-editor remains the central editor.
 * Features:
 * - Start options: START BLANK, USE STARTER, USE YOUR IMAGE
 * - Dynamic headline and front inspiration subline
 * - Live Creative Metrics: Cover Readiness, City Attention, and authored reaction
 * - Soft inspiration guidance instead of rigid requirement locks
 * - Multi-surface preview modal across CAR, CRATE, JACKET, PASS
 * - Visual signature rotation checking for COVER//02
 */
export default function ForgeryBay({
  initialImage,
  hasExistingCover,
  onCommit,
  onBack,
  isRotationMode = false,
  isEditingCover02 = false,
  burnedCover01 = null,
  onCommitRotation,
  chosenFront: initialChosenFront,
  startInGallery,
  packageSlot,
  onSelectArtwork,
  onOpenVehicleEditor,
}: ForgeryBayProps) {
  const isV2 = isRotationMode || isEditingCover02;
  const activePackageSlot = packageSlot ?? (isV2 ? "COVER//02" : "COVER//01");
  // P8: gallery-first for fresh COVER//01; rotation/editing flows keep the editor-first layout.
  const [galleryOpen, setGalleryOpen] = useState(
    () => (startInGallery ?? (!isV2 && !hasExistingCover)),
  );
  const [referenceTemplate, setReferenceTemplate] = useState<{ id: string; dataUrl: string } | null>(null);
  const editorRef = useRef<ImageEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentImage, setCurrentImage] = useState(initialImage);
  const [editorKey, setEditorKey] = useState(0);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<CoverAnalysis | null>(null);
  const [metrics, setMetrics] = useState<CreativeMetrics | null>(null);
  const [comparison, setComparison] = useState<VisualSignatureComparison | null>(null);
  const [candidateImage, setCandidateImage] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Front resolution
  const [chosenFrontRecord] = useState<ChosenFrontRecord | null>(
    initialChosenFront ?? loadChosenFront(),
  );

  const frontOption = chosenFrontRecord
    ? FRONT_OPTION_BY_ID[chosenFrontRecord.resolvedFrontId] ??
      FRONT_OPTION_BY_ID[chosenFrontRecord.requestedFrontId]
    : null;

  const frontName =
    chosenFrontRecord?.customProfile?.businessName ??
    frontOption?.label ??
    "Contractor Fleet";

  const dynamicSubline = frontOption
    ? `${frontName.toUpperCase()} — ${frontOption.inspiration}`
    : "Build a maintenance contractor disguise on blank vinyl stock. The service gate only lets the right vehicle through.";

  // Initial check on mount
  useEffect(() => {
    if (initialImage) {
      void (async () => {
        try {
          const rep = await analyzeCoverImage(initialImage);
          if (rep) {
            setAnalysis(rep);
            const cm = await analyzeCreativeMetrics(initialImage, rep);
            if (cm) setMetrics(cm);
          }
        } catch {
          // ignore initial probe failure
        }
      })();
    }
  }, [initialImage]);

  /** Pull the live canvas and validate it is usable editor output. */
  const pullCanvas = (): string | null => {
    const editor = editorRef.current?.editor;
    let dataUrl: string | null = null;
    try {
      if (editor && typeof editor.getImage === "function") {
        dataUrl = editor.getImage();
      }
    } catch (err) {
      console.warn("[crewmark] getImage() threw synchronously:", err);
    }
    if (!isOutputDataUrl(dataUrl)) {
      const canvas = (document.querySelector(".cm-editor-inner canvas.lower-canvas") ||
        document.querySelector(".cm-editor-inner canvas")) as HTMLCanvasElement | null;
      if (canvas) {
        dataUrl = canvas.toDataURL("image/png");
      }
    }
    if (!isOutputDataUrl(dataUrl)) {
      setFatal("The editor returned an invalid image payload.");
      return null;
    }
    return dataUrl;
  };

  /** Shared check runner: validate, decode, analyze, display. Never locks. */
  const runCheckOnDataUrl = async (dataUrl: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const rep = await analyzeCoverImage(dataUrl);
      if (!rep) {
        setNotice("Could not analyze cover pixels — canvas decode failed.");
        return;
      }
      setAnalysis(rep);

      const cm = await analyzeCreativeMetrics(dataUrl, rep);
      if (cm) {
        setMetrics(cm);
      }

      if (isV2 && burnedCover01) {
        const sig = await compareCoverImages(burnedCover01.image, dataUrl);
        if (sig) {
          setComparison(sig);
          setCandidateImage(dataUrl);
          setComparisonOpen(true);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  /** Load an approved template raster and replace the active package identity. */
  const loadTemplateIntoEditor = async (dataUrl: string, label: string) => {
    setGalleryOpen(false);
    setReady(false);
    setNotice(null);
    setReferenceTemplate(null);
    try {
      const templateId = label as CoverTemplateId;
      const canonicalDataUrl = dataUrl.startsWith("data:image/")
        ? dataUrl
        : await loadCoverTemplateDataUrl(templateId);
      setCurrentImage(canonicalDataUrl);
      setEditorKey((k) => k + 1);
      onSelectArtwork?.(canonicalDataUrl, templateId, activePackageSlot);
      void runCheckOnDataUrl(canonicalDataUrl);
      setNotice(`${label} loaded onto canvas. Remix it.`);
    } catch {
      setNotice(`Could not load ${label}.`);
    }
  };

  /** Start options */
  const handleStartBlank = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await createStarterTemplate({
        kind: "blank",
        frontId: chosenFrontRecord?.resolvedFrontId,
      });
      setCurrentImage(res.dataUrl);
      onSelectArtwork?.(res.dataUrl, null, activePackageSlot);
      setEditorKey((k) => k + 1);
      setReady(false);
      setNotice("Blank vinyl stock loaded onto canvas.");
      void runCheckOnDataUrl(res.dataUrl);
    } catch {
      setNotice("Could not generate blank starter canvas.");
    } finally {
      setBusy(false);
    }
  };

  const handleUseStarter = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await createStarterTemplate({
        kind: "starter",
        frontId: chosenFrontRecord?.resolvedFrontId,
      });
      setCurrentImage(res.dataUrl);
      setEditorKey((k) => k + 1);
      onSelectArtwork?.(res.dataUrl, null, activePackageSlot);
      setReady(false);
      setNotice(`Loaded ${frontName} starter template.`);
      void runCheckOnDataUrl(res.dataUrl);
    } catch {
      setNotice("Could not generate preset starter template.");
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      setBusy(true);
      setNotice(null);
      try {
        const res = await createStarterTemplate({
          kind: "user-image",
          frontId: chosenFrontRecord?.resolvedFrontId,
          imageDataUrl: rawDataUrl,
        });
        setCurrentImage(res.dataUrl);
        onSelectArtwork?.(res.dataUrl, null, activePackageSlot);
        setEditorKey((k) => k + 1);
        setReady(false);
        setNotice(`Imported image: ${file.name}`);
        void runCheckOnDataUrl(res.dataUrl);
      } catch {
        setNotice("Could not process uploaded image file.");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be reselected
    e.target.value = "";
  };

  /** RUN VISUAL CHECK / RUN SIGNATURE CHECK */
  const handleCheck = async () => {
    setFatal(null);
    setNotice(null);
    const dataUrl = pullCanvas();
    if (!dataUrl) return;
    await runCheckOnDataUrl(dataUrl);
  };

  /** PREVIEW COVER — open MultiSurfacePreview modal with current canvas */
  const handlePreviewCover = async () => {
    setFatal(null);
    setNotice(null);
    const dataUrl = pullCanvas();
    if (!dataUrl) return;
    setCandidateImage(dataUrl);
    await runCheckOnDataUrl(dataUrl);
    setPreviewOpen(true);
  };

  /** LOCK COVER//01 or LOCK COVER//02 */
  const handleLock = async () => {
    setFatal(null);
    setNotice(null);
    const dataUrl = pullCanvas();
    if (!dataUrl) return;
    setBusy(true);
    try {
      const fresh = await analyzeCoverImage(dataUrl);
      if (!fresh) {
        setNotice("Could not analyze cover pixels before locking.");
        return;
      }
      if (!canLockCover(fresh)) {
        setNotice(
          "Untouched vinyl stock cannot be locked as a contractor disguise. Add contractor markings first.",
        );
        return;
      }
      setAnalysis(fresh);

      const cm = await analyzeCreativeMetrics(dataUrl, fresh);
      if (cm) setMetrics(cm);

      if (isV2 && burnedCover01 && onCommitRotation) {
        const sig = await compareCoverImages(burnedCover01.image, dataUrl);
        if (!sig) {
          setNotice("Could not compute visual signature distance.");
          return;
        }
        if (!sig.canLock) {
          setNotice(
            `Visual signature distance (${sig.signatureDistance}%) is below minimum rotation threshold (${MIN_ROTATION_LOCK_DISTANCE}%). Change the layout, colors, or marks further.`,
          );
          setComparison(sig);
          setCandidateImage(dataUrl);
          setComparisonOpen(true);
          return;
        }
        onCommitRotation(dataUrl, fresh, sig, cm ?? undefined);
        return;
      }

      onCommit(dataUrl, fresh, cm ?? undefined);
    } finally {
      setBusy(false);
    }
  };

  /** Native toolbar Save runs check */
  const handleNativeSave = (result: ImageEditorSaveResult) => {
    setFatal(null);
    setNotice(null);
    if (!isOutputDataUrl(result.dataUrl)) {
      setFatal("The editor returned an invalid image payload on save.");
      return;
    }
    void runCheckOnDataUrl(result.dataUrl);
  };

  return (
    <section
      className={`cm-screen cm-forgery-garage${!isV2 && galleryOpen ? " cm-forgery-garage--gallery" : ""}`}
      aria-label={
        isEditingCover02
          ? "Edit Cover 02"
          : isRotationMode
            ? "Signature rotation bay"
            : "Forgery garage"
      }
    >
      {/* Header & Subline */}
      <p className="cm-kicker">
        305 PRINT &amp; SIGN // FORGERY GARAGE // {isV2 ? "COVER//02" : "COVER//01"}
      </p>
      <h1 className="cm-title">
        {!isV2 && galleryOpen ? (
          <>
            <span className="cm-gallery-hero-line">BUILD A COVER</span>
            <span className="accent cm-gallery-hero-line">THE CITY WON&apos;T QUESTION.</span>
          </>
        ) : (
          <>
            BUILD SOMETHING <span className="accent">THE CITY WON&apos;T QUESTION.</span>
          </>
        )}
      </h1>
      <p className="cm-lede">
        {!isV2 && galleryOpen
          ? "Pick a disguise, make it yours, then see it on the vehicle."
          : dynamicSubline}
      </p>

      {/* P8: template-first gallery for fresh COVER//01 */}
      {!isV2 && galleryOpen ? (
        <TemplateGallery
          recommendedTemplateId={
            chosenFrontRecord
              ? RECOMMENDED_TEMPLATE_BY_FRONT[chosenFrontRecord.resolvedFrontId]
              : undefined
          }
          onRemix={(templateId, dataUrl) =>
            void loadTemplateIntoEditor(dataUrl, templateId)
          }
          onUseAsReference={(templateId, dataUrl) => {
            setReferenceTemplate({ id: templateId, dataUrl });
            setGalleryOpen(false);
          }}
          onStartBlank={() => {
            setGalleryOpen(false);
            void handleStartBlank();
          }}
          onUseImage={() => {
            setGalleryOpen(false);
            handleTriggerUpload();
          }}
        />
      ) : (
        <>
      {/* P8: template reference beside the editor */}
      {referenceTemplate && !isV2 && (
        <div
          className="cm-template-reference"
          style={{
            marginBottom: "12px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
            padding: "8px 12px",
            backgroundColor: "#131312",
            border: "1px solid var(--cm-line, #2a2a27)",
            borderRadius: "6px",
          }}
        >
          <img
            src={referenceTemplate.dataUrl}
            alt={`${referenceTemplate.id} reference`}
            draggable={false}
            style={{ width: "180px", aspectRatio: "1600 / 700", objectFit: "cover", borderRadius: "4px" }}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--cm-mono, monospace)", fontSize: "10px", color: "var(--cm-grey, #70706b)", letterSpacing: "1.5px" }}>
              REFERENCE: {referenceTemplate.id.toUpperCase()}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "4px 10px", fontSize: "11px" }}
              onClick={() => void loadTemplateIntoEditor(referenceTemplate.dataUrl, referenceTemplate.id)}
            >
              REMIX THIS
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "4px 10px", fontSize: "11px" }}
              onClick={() => setGalleryOpen(true)}
            >
              BROWSE TEMPLATES
            </button>
          </div>
        </div>
      )}
      {/* Front Inspiration Box (Soft Inspiration) */}
      <div
        className="cm-front-inspiration-banner"
        style={{
          marginTop: "14px",
          marginBottom: "18px",
          padding: "10px 14px",
          backgroundColor: "#161615",
          borderLeft: "3px solid var(--cm-lime, #d8ff3e)",
          borderRadius: "0 4px 4px 0",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div style={{ fontFamily: "var(--cm-mono, monospace)", fontSize: "11px" }}>
          <span style={{ color: "var(--cm-grey, #70706b)" }}>DISGUISE IDENTITY: </span>
          <strong style={{ color: "var(--cm-paper, #f2ebdd)" }}>{frontName.toUpperCase()}</strong>
        </div>
        <div style={{ fontFamily: "var(--cm-mono, monospace)", fontSize: "11px" }}>
          <span style={{ color: "var(--cm-grey, #70706b)" }}>VIBE: </span>
          <span style={{ color: "#d1d5db" }}>
            {frontOption?.visualVibe ?? "High contrast service livery"}
          </span>
        </div>
        <div style={{ fontFamily: "var(--cm-mono, monospace)", fontSize: "11px" }}>
          <span style={{ color: "var(--cm-grey, #70706b)" }}>PERSONA: </span>
          <span style={{ color: "#9ca3af" }}>
            {frontOption?.personality ?? "Plausible contractor presence"}
          </span>
        </div>
      </div>

      {/* Burned reference for rotation mode */}
      {isV2 && burnedCover01 && (
        <div className="cm-rotation-ref" style={{ marginBottom: "16px" }}>
          <div className="cm-rotation-ref-thumb">
            <img src={burnedCover01.image} alt="Burned Cover 01" />
          </div>
          <div>
            <span
              className="cm-meta-label"
              style={{ color: "var(--cm-red, #ff4338)" }}
            >
              COVER//01 // STATUS: BURNED
            </span>
            <p
              style={{
                margin: "2px 0 0 0",
                fontFamily: "var(--cm-mono, monospace)",
                fontSize: "12px",
                color: "var(--cm-paper, #f2ebdd)",
              }}
            >
              WATCHLIST MATCH: ACTIVE · HISTORICAL CHECK: {burnedCover01.score}%
            </p>
          </div>
        </div>
      )}

      {fatal && (
        <div className="cm-alert cm-alert--fatal" role="alert">
          <TriangleAlert size={18} aria-hidden={true} />
          <span>{fatal}</span>
        </div>
      )}

      {loadError && !fatal && (
        <div className="cm-alert" role="alert">
          <TriangleAlert size={18} aria-hidden={true} />
          <span>{loadError}</span>
        </div>
      )}

      {notice && !fatal && (
        <p className="cm-notice" role="status" style={{ margin: "10px 0" }}>
          {notice}
        </p>
      )}

      {/* Start Options Toolbar */}
      <div
        className="cm-start-options-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "10px",
          padding: "8px 12px",
          backgroundColor: "#131312",
          border: "1px solid var(--cm-line, #2a2a27)",
          borderRadius: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--cm-mono, monospace)",
              fontSize: "10px",
              color: "var(--cm-grey, #70706b)",
              letterSpacing: "1.5px",
            }}
          >
            CANVAS BASE:
          </span>
          {!isV2 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setGalleryOpen(true)}
                disabled={busy}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                title="Browse the template gallery"
              >
              <Sparkles size={13} />
              TEMPLATES
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleStartBlank}
            disabled={busy}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Start from clean blank vinyl stock"
          >
            <FileX size={13} />
            START BLANK
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleUseStarter}
            disabled={busy}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Load preset front starter artwork"
          >
            <Sparkles size={13} />
            USE STARTER
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleTriggerUpload}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Upload custom reference or logo image"
          >
            <Upload size={13} />
            USE YOUR IMAGE
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
          />
        </div>

        <div
          style={{
            fontFamily: "var(--cm-mono, monospace)",
            fontSize: "10px",
            color: "var(--cm-grey, #70706b)",
          }}
        >
          TARGET: 1600 × 700 PX CAST VINYL
        </div>
      </div>

      {/* Editor Frame */}
      <div className="cm-editor-frame">
        <div className="cm-editor-inner">
          <ImageEditor
            key={editorKey}
            ref={editorRef}
            image={currentImage}
            onLoad={() => {
              setReady(true);
              setLoadError(null);
            }}
            onError={(err) => {
              console.warn("[crewmark] ImageEditor error event:", err);
              setLoadError(
                err?.message ?? "The visual editor reported a non-fatal error.",
              );
            }}
            onLoadError={() => {
              setLoadError(
                "The starter panel could not be rendered by the editor engine.",
              );
            }}
            onSave={handleNativeSave}
          />
        </div>
        {!ready && !fatal && (
          <div className="cm-loading" role="status" aria-live="polite">
            <p className="cm-kicker">Initializing print engine</p>
            <div className="bar" aria-hidden={true}>
              <i />
            </div>
          </div>
        )}
      </div>

      {/* Live Creative Metrics Readout */}
      <div
        className="cm-metrics-readout"
        style={{
          marginTop: "16px",
          padding: "14px 18px",
          backgroundColor: "#161615",
          border: "1px solid var(--cm-line, #2a2a27)",
          borderRadius: "6px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", gap: "24px", alignItems: "baseline", flexWrap: "wrap" }}>
            <div>
              <span
                style={{
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "10px",
                  color: "var(--cm-grey, #70706b)",
                  letterSpacing: "1.5px",
                }}
              >
                COVER READINESS
              </span>
              <p
                style={{
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "22px",
                  fontWeight: 900,
                  color: "var(--cm-lime, #d8ff3e)",
                  margin: "2px 0 0",
                }}
              >
                // {metrics ? metrics.coverReadiness : analysis ? analysis.score : "--"}
              </p>
            </div>

            <div>
              <span
                style={{
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "10px",
                  color: "var(--cm-grey, #70706b)",
                  letterSpacing: "1.5px",
                }}
              >
                CITY ATTENTION
              </span>
              <p
                style={{
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "22px",
                  fontWeight: 900,
                  margin: "2px 0 0",
                  color:
                    metrics?.cityAttention === "HIGH"
                      ? "var(--cm-red, #ff4338)"
                      : metrics?.cityAttention === "BALANCED"
                      ? "var(--cm-lime, #d8ff3e)"
                      : metrics?.cityAttention === "LOW"
                      ? "var(--cm-blue, #88b8ff)"
                      : "var(--cm-paper, #f2ebdd)",
                }}
              >
                // {metrics ? metrics.cityAttention : "STANDBY"}
              </p>
            </div>
          </div>

          <div
            style={{
              fontFamily: "var(--cm-mono, monospace)",
              fontSize: "11px",
              color: "var(--cm-grey, #70706b)",
            }}
          >
            STATUS:{" "}
            <span
              style={{
                color:
                  analysis && !analysis.blank
                    ? "var(--cm-lime, #d8ff3e)"
                    : "var(--cm-grey, #70706b)",
              }}
            >
              {analysis ? (analysis.blank ? "BLANK VINYL" : "PLAUSIBLE LIVERY") : "UNSCANNED"}
            </span>
          </div>
        </div>

        {metrics?.reaction && (
          <div
            style={{
              borderTop: "1px solid var(--cm-line, #2a2a27)",
              paddingTop: "8px",
              fontFamily: "var(--cm-mono, monospace)",
              fontSize: "11px",
              color: "var(--cm-paper, #f2ebdd)",
            }}
          >
            <span style={{ color: "var(--cm-lime, #d8ff3e)" }}>REACTION: </span>
            "{metrics.reaction}"
          </div>
        )}
      </div>

      {/* CTA Row */}
      <div className="cm-cta-row" style={{ marginTop: "18px" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onBack}
          disabled={busy}
        >
          Back to yard
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleCheck}
          disabled={!ready || busy}
        >
          {isV2 ? "Run signature check" : "Run visual check"}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={handlePreviewCover}
          disabled={!ready || busy}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Eye size={14} aria-hidden={true} />
          Preview Cover
        </button>

        {onOpenVehicleEditor && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onOpenVehicleEditor}
            title="Open 3D Vehicle Customization Bay"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Car size={14} aria-hidden="true" />
            Edit Vehicle
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleLock}
          disabled={!ready || busy}
        >
          <Lock size={14} aria-hidden={true} />
          {isV2 ? "Lock Cover//02" : "Lock Cover//01"}
        </button>
      </div>

      {/* Multi-Surface Preview Modal */}
      {previewOpen && (
        <MultiSurfacePreview
          coverDataUrl={candidateImage ?? currentImage}
          frontName={frontName}
          readinessScore={metrics?.coverReadiness ?? analysis?.score}
          cityAttention={metrics?.cityAttention}
          reaction={metrics?.reaction}
          onClose={() => setPreviewOpen(false)}
          onLockAndPrint={() => {
            setPreviewOpen(false);
            void handleLock();
          }}
          onContinueTo305={onBack}
          canLock={!analysis?.blank && (analysis?.score ?? 0) > 0}
          isCover02={isV2}
        />
      )}

      {/* Diegetic Signature Comparison Modal for Cover 02 */}
      {comparisonOpen && comparison && candidateImage && burnedCover01 && (
        <div
          className="cm-signature-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Visual signature comparison"
        >
          <div className="cm-signature-shell">
            <header className="cm-signature-header">
              <div>
                <p className="cm-kicker">305 Print &amp; Sign // Visual Trace</p>
                <h2 className="cm-title" style={{ fontSize: "20px" }}>
                  Signature Check // Cover//02
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setComparisonOpen(false)}
              >
                Close
              </button>
            </header>

            <div className="cm-signature-compare-grid">
              <div className="cm-signature-panel">
                <span
                  className="cm-meta-label"
                  style={{ color: "var(--cm-red, #ff4338)" }}
                >
                  Old Signature // Cover//01 [Burned]
                </span>
                <div
                  className="cm-signature-thumb"
                  style={{ borderLeft: "3px solid var(--cm-red, #ff4338)" }}
                >
                  <img src={burnedCover01.image} alt="Burned Cover 01" />
                </div>
                <span className="cm-meta-sub">
                  Historical capture score: {burnedCover01.score}%
                </span>
              </div>

              <div className="cm-signature-panel">
                <span
                  className="cm-meta-label"
                  style={{ color: "var(--cm-lime, #d8ff3e)" }}
                >
                  New Signature // Cover//02 [Candidate]
                </span>
                <div
                  className="cm-signature-thumb"
                  style={{ borderLeft: "3px solid var(--cm-lime, #d8ff3e)" }}
                >
                  <img src={candidateImage} alt="Candidate Cover 02" />
                </div>
                <span className="cm-meta-sub">
                  Believability score: {analysis?.score ?? 0}%
                </span>
              </div>
            </div>

            <div className="cm-signature-metrics">
              <div className="cm-sig-metric-box">
                <span className="cm-meta-label">Visual Distance</span>
                <p className="cm-meta-value accent">
                  {comparison.signatureDistance}%
                </p>
              </div>
              <div className="cm-sig-metric-box">
                <span className="cm-meta-label">Color Shift</span>
                <p className="cm-meta-value">{comparison.colorShift}%</p>
              </div>
              <div className="cm-sig-metric-box">
                <span className="cm-meta-label">Layout Shift</span>
                <p className="cm-meta-value">{comparison.layoutShift}%</p>
              </div>
              <div className="cm-sig-metric-box">
                <span className="cm-meta-label">Complexity Shift</span>
                <p className="cm-meta-value">{comparison.complexityShift}%</p>
              </div>
            </div>

            <div className="cm-sig-match-banner">
              <div>
                <span className="cm-meta-label">City Match Estimate</span>
                <p
                  className="cm-meta-value"
                  style={{
                    fontSize: "18px",
                    color:
                      comparison.correlationLevel === "CRITICAL"
                        ? "var(--cm-red, #ff4338)"
                        : comparison.correlationLevel === "HIGH"
                        ? "#ffb13e"
                        : "var(--cm-lime, #d8ff3e)",
                  }}
                >
                  {comparison.cityMatchEstimate}% correlation — {comparison.status}
                </p>
              </div>
              <span
                className={`cm-meta-status ${
                  comparison.canLock ? "good" : "bad"
                }`}
                style={{
                  color: comparison.canLock
                    ? "var(--cm-lime, #d8ff3e)"
                    : "var(--cm-red, #ff4338)",
                }}
              >
                {comparison.canLock
                  ? "READY TO ROTATE"
                  : `NEEDS >= ${MIN_ROTATION_LOCK_DISTANCE}% DISTANCE`}
              </span>
            </div>

            <div className="cm-cta-row" style={{ marginTop: "8px" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setComparisonOpen(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLock}
                disabled={
                  !comparison.canLock ||
                  !analysis ||
                  !canLockCover(analysis) ||
                  busy
                }
              >
                <Lock size={14} aria-hidden={true} />
                Lock Cover//02
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </section>
  );
}
