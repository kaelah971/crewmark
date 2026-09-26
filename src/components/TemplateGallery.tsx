import { useEffect, useState } from "react";
import {
  COVER_TEMPLATES,
  loadCoverTemplateDataUrl,
  type CoverTemplate,
  type CoverTemplateId,
} from "../lib/coverTemplates";
import SurfaceMockup from "./SurfaceMockup";
import { Eye, X } from "lucide-react";

export interface TemplateGalleryProps {
  /** Remix the selected template raster into the editor. */
  onRemix: (templateId: CoverTemplateId, dataUrl: string) => void;
  /** Keep the template card as an editor-side reference. */
  onUseAsReference: (templateId: CoverTemplateId, dataUrl: string) => void;
  onStartBlank: () => void;
  onUseImage: () => void;
}

const ATTENTION_TONE: Record<string, string> = {
  LOW: "var(--cm-blue, #88b8ff)",
  BALANCED: "var(--cm-lime, #d8ff3e)",
  HIGH: "var(--cm-red, #ff4338)",
};

const ATTENTION_TENDENCY: Record<string, string> = {
  LOW: "LOW PROFILE",
  BALANCED: "BALANCED PRESENCE",
  HIGH: "HIGH VISIBILITY",
};

export default function TemplateGallery({
  onRemix,
  onUseAsReference,
  onStartBlank,
  onUseImage,
}: TemplateGalleryProps) {
  const [inspectingTemplate, setInspectingTemplate] = useState<{
    template: CoverTemplate;
    dataUrl: string;
  } | null>(null);

  // Map of loaded canonical 1600x700 data URLs for each template
  const [previews, setPreviews] = useState<Map<CoverTemplateId, string>>(() => {
    const init = new Map<CoverTemplateId, string>();
    for (const t of COVER_TEMPLATES) {
      init.set(t.id, t.assetUrl);
    }
    return init;
  });

  useEffect(() => {
    let cancelled = false;
    for (const t of COVER_TEMPLATES) {
      void (async () => {
        try {
          const dataUrl = await loadCoverTemplateDataUrl(t.id);
          if (!cancelled) {
            setPreviews((prev) => new Map(prev).set(t.id, dataUrl));
          }
        } catch {
          // fallback remains assetUrl
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Scoped Escape listener when the large inspection modal is open
  useEffect(() => {
    if (!inspectingTemplate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInspectingTemplate(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectingTemplate]);

  return (
    <section aria-label="Cover template gallery">
      <p className="cm-kicker">305 PRINT &amp; SIGN // COVER TEMPLATES</p>
      <h2 className="cm-title" style={{ fontSize: "26px" }}>
        REMIX A COVER
      </h2>
      <p className="cm-lede">
        Pick a fictional Leonida identity. Remix it in the editor, keep it beside
        the canvas as reference, or start from blank vinyl.
      </p>

      <div
        className="cm-template-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "18px",
          marginTop: "18px",
        }}
      >
        {COVER_TEMPLATES.map((t) => {
          const dataUrl = previews.get(t.id) ?? t.assetUrl;
          return (
            <article
              key={t.id}
              className="cm-template-card"
              aria-label={`${t.company} template`}
              style={{
                backgroundColor: "#131312",
                border: "1px solid var(--cm-line, #2a2a27)",
                borderRadius: "8px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ position: "relative" }}>
                <img
                  src={dataUrl}
                  alt={`${t.company} cover preview`}
                  draggable={false}
                  style={{
                    width: "100%",
                    display: "block",
                    aspectRatio: "1600 / 700",
                    objectFit: "cover",
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setInspectingTemplate({ template: t, dataUrl })}
                  style={{
                    position: "absolute",
                    bottom: "8px",
                    right: "8px",
                    fontSize: "11px",
                    padding: "4px 8px",
                    backgroundColor: "rgba(10, 10, 9, 0.85)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Inspect propagation across Car, Crate, and Pass"
                >
                  <Eye size={12} aria-hidden="true" />
                  LARGE PREVIEW
                </button>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "var(--cm-display, sans-serif)",
                      fontSize: "18px",
                      color: "var(--cm-paper, #f2ebdd)",
                    }}
                  >
                    {t.company}
                  </h3>
                  <span
                    style={{
                      fontFamily: "var(--cm-mono, monospace)",
                      fontSize: "10px",
                      letterSpacing: "1.5px",
                      color:
                        ATTENTION_TONE[t.attention] ?? "var(--cm-paper, #f2ebdd)",
                    }}
                  >
                    {ATTENTION_TENDENCY[t.attention] ?? t.attention}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "11px",
                    color: "#9ca3af",
                  }}
                >
                  {t.palette} — {t.personality}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "11px",
                    color: "var(--cm-paper, #f2ebdd)",
                  }}
                >
                  WHY IT WORKS: {t.whyItWorks}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "11px",
                    color: "var(--cm-grey, #70706b)",
                  }}
                >
                  {t.guidance}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginTop: "4px",
                  }}
                >
                  <SurfaceMockup
                    surfaceId="CAR"
                    coverDataUrl={dataUrl}
                    showInspectorButton={false}
                  />
                  <SurfaceMockup
                    surfaceId="PASS"
                    coverDataUrl={dataUrl}
                    showInspectorButton={false}
                  />
                </div>

                <div
                  className="cm-cta-row"
                  style={{ marginTop: "auto", paddingTop: "8px" }}
                >
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!dataUrl}
                    onClick={() => dataUrl && onRemix(t.id, dataUrl)}
                  >
                    REMIX THIS
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!dataUrl}
                    onClick={() => dataUrl && onUseAsReference(t.id, dataUrl)}
                  >
                    USE AS REFERENCE
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="cm-cta-row" style={{ marginTop: "22px" }}>
        <button type="button" className="btn btn-ghost" onClick={onStartBlank}>
          START FROM BLANK
        </button>
        <button type="button" className="btn btn-ghost" onClick={onUseImage}>
          USE YOUR IMAGE
        </button>
      </div>

      {/* Large Pre-selection Propagation Preview Modal */}
      {inspectingTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${inspectingTemplate.template.company} Pre-selection Preview`}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(10, 10, 9, 0.94)",
            backdropFilter: "blur(8px)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              backgroundColor: "#161615",
              border: "1px solid var(--cm-line, #2a2a27)",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "1000px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p className="cm-kicker" style={{ margin: 0 }}>
                  TEMPLATE INSPECTION
                </p>
                <h3
                  className="cm-title"
                  style={{ fontSize: "24px", margin: "4px 0 0 0" }}
                >
                  {inspectingTemplate.template.company}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setInspectingTemplate(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <X size={16} aria-hidden="true" /> CLOSE [ESC]
              </button>
            </div>

            {/* 1. Full Cover Graphic */}
            <div>
              <span
                style={{
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "11px",
                  color: "var(--cm-grey, #70706b)",
                  letterSpacing: "1.5px",
                }}
              >
                FULL CAST VINYL DESIGN (1600 × 700 PX):
              </span>
              <img
                src={inspectingTemplate.dataUrl}
                alt={inspectingTemplate.template.company}
                style={{
                  width: "100%",
                  aspectRatio: "1600 / 700",
                  objectFit: "cover",
                  borderRadius: "4px",
                  marginTop: "6px",
                  display: "block",
                  border: "1px solid var(--cm-line, #2a2a27)",
                }}
              />
            </div>

            {/* 2. Physical World Propagation: CAR, CRATE, PASS */}
            <div>
              <span
                style={{
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "11px",
                  color: "var(--cm-grey, #70706b)",
                  letterSpacing: "1.5px",
                }}
              >
                PHYSICAL WORLD PROPAGATION (CAR DOOR, CRATE LABEL, CREW JACKET, ACCESS BADGE):
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "12px",
                  marginTop: "8px",
                }}
              >
                <div>
                  <SurfaceMockup
                    surfaceId="CAR"
                    coverDataUrl={inspectingTemplate.dataUrl}
                    showInspectorButton={false}
                  />
                  <span
                    style={{
                      display: "block",
                      textAlign: "center",
                      fontSize: "11px",
                      fontFamily: "var(--cm-mono, monospace)",
                      color: "var(--cm-paper, #f2ebdd)",
                      marginTop: "4px",
                    }}
                  >
                    CAR DOOR SPEC
                  </span>
                </div>
                <div>
                  <SurfaceMockup
                    surfaceId="CRATE"
                    coverDataUrl={inspectingTemplate.dataUrl}
                    showInspectorButton={false}
                  />
                  <span
                    style={{
                      display: "block",
                      textAlign: "center",
                      fontSize: "11px",
                      fontFamily: "var(--cm-mono, monospace)",
                      color: "var(--cm-paper, #f2ebdd)",
                      marginTop: "4px",
                    }}
                  >
                    CRATE STENCIL SPEC
                  </span>
                </div>
                <div>
                  <SurfaceMockup
                    surfaceId="JACKET"
                    coverDataUrl={inspectingTemplate.dataUrl}
                    showInspectorButton={false}
                  />
                  <span
                    style={{
                      display: "block",
                      textAlign: "center",
                      fontSize: "11px",
                      fontFamily: "var(--cm-mono, monospace)",
                      color: "var(--cm-paper, #f2ebdd)",
                      marginTop: "4px",
                    }}
                  >
                    CREW JACKET SPEC
                  </span>
                </div>
                <div>
                  <SurfaceMockup
                    surfaceId="PASS"
                    coverDataUrl={inspectingTemplate.dataUrl}
                    showInspectorButton={false}
                  />
                  <span
                    style={{
                      textAlign: "center",
                      fontSize: "11px",
                      fontFamily: "var(--cm-mono, monospace)",
                      color: "var(--cm-paper, #f2ebdd)",
                      marginTop: "4px",
                    }}
                  >
                    ACCESS BADGE SPEC
                  </span>
                </div>
              </div>
            </div>

            <div className="cm-cta-row" style={{ marginTop: "12px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const item = inspectingTemplate;
                  setInspectingTemplate(null);
                  onRemix(item.template.id, item.dataUrl);
                }}
              >
                REMIX THIS TEMPLATE
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const item = inspectingTemplate;
                  setInspectingTemplate(null);
                  onUseAsReference(item.template.id, item.dataUrl);
                }}
              >
                USE AS REFERENCE
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
