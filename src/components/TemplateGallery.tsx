import { useEffect, useState } from "react";
import {
  COVER_TEMPLATES,
  loadCoverTemplateDataUrl,
  type CoverTemplate,
  type CoverTemplateId,
} from "../lib/coverTemplates";
import SurfaceMockup from "./SurfaceMockup";
import { VehicleLiveryProjection } from "./VehicleLiveryProjection";
import { deriveVehicleLivery } from "../lib/vehicleLivery";
import { Eye, X } from "lucide-react";
export interface TemplateGalleryProps {
  /** Remix the selected template raster into the editor. */
  onRemix: (templateId: CoverTemplateId, dataUrl: string) => void;
  /** Keep the template card as an editor-side reference. */
  onUseAsReference: (templateId: CoverTemplateId, dataUrl: string) => void;
  onStartBlank: () => void;
  onUseImage: () => void;
  /** The identity that best matches the chosen job/front. */
  recommendedTemplateId?: CoverTemplateId;
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

function TemplateCard({
  template,
  dataUrl,
  recommended,
  onRemix,
  onUseAsReference,
  onInspect,
}: {
  template: CoverTemplate;
  dataUrl: string;
  recommended: boolean;
  onRemix: (templateId: CoverTemplateId, dataUrl: string) => void;
  onUseAsReference: (templateId: CoverTemplateId, dataUrl: string) => void;
  onInspect: (template: CoverTemplate, dataUrl: string) => void;
}) {
  const livery = deriveVehicleLivery(dataUrl || template.assetUrl, template.id);

  return (
    <article className={`cm-template-card${recommended ? " is-recommended" : ""}`} aria-label={`${template.company} template`}>
      <div className="cm-template-card-art">
        <img
          src={dataUrl}
          alt={`${template.company} cover preview`}
          draggable={false}
        />
        {recommended && <span className="cm-template-recommended-tag">RECOMMENDED</span>}
      </div>

      {/* Linked 3D Vehicle Livery Preview */}
      <div className="cm-template-card-vehicle" aria-label={`${template.company} Vehicle Livery`}>
        <div className="cm-template-vehicle-thumb">
          <VehicleLiveryProjection livery={livery} angle="yard" className="cm-template-card-livery-img" />
        </div>
        <div className="cm-template-vehicle-meta">
          <span className="cm-template-vehicle-tag">FLEET VEHICLE</span>
          <div className="cm-template-vehicle-swatches">
            <span className="cm-swatch-dot" style={{ backgroundColor: livery.bodyBaseColor }} title={`Body: ${livery.bodyBaseColor}`} />
            <span className="cm-swatch-dot" style={{ backgroundColor: livery.secondaryColor }} title={`Trim: ${livery.secondaryColor}`} />
            <span className="cm-swatch-dot" style={{ backgroundColor: livery.accentColor }} title={`Accent: ${livery.accentColor}`} />
            <span className="cm-template-unit-code">{livery.unitLabel}</span>
          </div>
        </div>
      </div>
      <div className="cm-template-card-body">
        <div className="cm-template-card-heading">
          <h3>{template.company}</h3>
          <span style={{ color: ATTENTION_TONE[template.attention] ?? "var(--cm-paper)" }}>
            {ATTENTION_TENDENCY[template.attention] ?? template.attention}
          </span>
        </div>
        <p className="cm-template-card-description">{template.personality}</p>
        <div className="cm-template-card-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dataUrl}
            onClick={() => dataUrl && onRemix(template.id, dataUrl)}
          >
            REMIX THIS
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!dataUrl}
            onClick={() => dataUrl && onInspect(template, dataUrl)}
          >
            <Eye size={13} aria-hidden="true" />
            LARGE PREVIEW
          </button>
          <button
            type="button"
            className="btn btn-ghost cm-template-reference-action"
            disabled={!dataUrl}
            onClick={() => dataUrl && onUseAsReference(template.id, dataUrl)}
          >
            USE AS REFERENCE
          </button>
        </div>
      </div>
    </article>
  );
}

export default function TemplateGallery({
  onRemix,
  onUseAsReference,
  onStartBlank,
  onUseImage,
  recommendedTemplateId,
}: TemplateGalleryProps) {
  const [inspectingTemplate, setInspectingTemplate] = useState<{
    template: CoverTemplate;
    dataUrl: string;
  } | null>(null);

  const [previews, setPreviews] = useState<Map<CoverTemplateId, string>>(() => {
    const init = new Map<CoverTemplateId, string>();
    for (const template of COVER_TEMPLATES) init.set(template.id, template.assetUrl);
    return init;
  });

  useEffect(() => {
    let cancelled = false;
    for (const template of COVER_TEMPLATES) {
      void (async () => {
        try {
          const dataUrl = await loadCoverTemplateDataUrl(template.id);
          if (!cancelled) setPreviews((prev) => new Map(prev).set(template.id, dataUrl));
        } catch {
          // The approved asset URL remains available as the fallback.
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!inspectingTemplate) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectingTemplate(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectingTemplate]);

  const recommended = recommendedTemplateId
    ? COVER_TEMPLATES.find((template) => template.id === recommendedTemplateId)
    : undefined;
  const otherTemplates = COVER_TEMPLATES.filter((template) => template.id !== recommended?.id);
  const renderCard = (template: CoverTemplate, isRecommended = false) => (
    <TemplateCard
      key={template.id}
      template={template}
      dataUrl={previews.get(template.id) ?? template.assetUrl}
      recommended={isRecommended}
      onRemix={onRemix}
      onUseAsReference={onUseAsReference}
      onInspect={(selected, dataUrl) => setInspectingTemplate({ template: selected, dataUrl })}
    />
  );

  return (
    <section className="cm-template-gallery" aria-label="Cover template gallery">
      <div className="cm-template-gallery-intro">
        <div>
          <p className="cm-kicker">305 PRINT &amp; SIGN // COVER TEMPLATES</p>
          <h2 className="cm-template-gallery-title">REMIX A COVER</h2>
          <p className="cm-template-gallery-lede">Pick a disguise, make it yours, then see it on the vehicle.</p>
        </div>
        <span className="cm-template-gallery-count">8 APPROVED IDENTITIES</span>
      </div>

      {recommended && (
        <section className="cm-template-section" aria-labelledby="recommended-template-heading">
          <div className="cm-template-section-heading">
            <div>
              <p className="cm-kicker">MISSION FIT</p>
              <h3 id="recommended-template-heading">RECOMMENDED FOR THIS JOB</h3>
            </div>
            <span className="cm-template-section-note">{recommended.company}</span>
          </div>
          <div className="cm-template-grid cm-template-grid--recommended">
            {renderCard(recommended, true)}
          </div>
        </section>
      )}

      <section className="cm-template-section" aria-labelledby="other-identities-heading">
        <div className="cm-template-section-heading">
          <div>
            <p className="cm-kicker">CREATIVE FREEDOM</p>
            <h3 id="other-identities-heading">{recommended ? "OTHER IDENTITIES" : "CHOOSE YOUR IDENTITY"}</h3>
          </div>
          <span className="cm-template-section-note">LOOK CLOSE. PICK A LIFE.</span>
        </div>
        <div className="cm-template-grid">
          {otherTemplates.map((template) => renderCard(template))}
        </div>
      </section>

      <div className="cm-template-start-actions">
        <button type="button" className="btn btn-ghost" onClick={onStartBlank}>START FROM BLANK</button>
        <button type="button" className="btn btn-ghost" onClick={onUseImage}>USE YOUR IMAGE</button>
      </div>

      {inspectingTemplate && (
        <div
          className="cm-template-inspection-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${inspectingTemplate.template.company} Pre-selection Preview`}
        >
          <div className="cm-template-inspection-modal">
            <div className="cm-template-inspection-header">
              <div>
                <p className="cm-kicker">TEMPLATE INSPECTION</p>
                <h3 className="cm-template-inspection-title">{inspectingTemplate.template.company}</h3>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setInspectingTemplate(null)}>
                <X size={16} aria-hidden="true" /> CLOSE [ESC]
              </button>
            </div>

            <div className="cm-template-inspection-art">
              <span>FULL CAST VINYL DESIGN (1600 × 700 PX)</span>
              <img src={inspectingTemplate.dataUrl} alt={inspectingTemplate.template.company} />
            </div>

            {/* Prominent 3D Vehicle Livery Showcase */}
            {(() => {
              const inspectingLivery = deriveVehicleLivery(inspectingTemplate.dataUrl, inspectingTemplate.template.id);
              return (
                <div className="cm-template-inspection-vehicle-showcase">
                  <div className="cm-template-inspection-vehicle-header">
                    <span className="cm-kicker">3D FLEET VEHICLE PAYOFF</span>
                    <span className="cm-template-unit-badge">{inspectingLivery.unitLabel}</span>
                  </div>
                  <div className="cm-template-inspection-vehicle-body">
                    <div className="cm-template-inspection-vehicle-viewport">
                      <VehicleLiveryProjection livery={inspectingLivery} angle="yard" className="cm-template-modal-livery-img" />
                    </div>
                    <div className="cm-template-inspection-vehicle-specs">
                      <div className="cm-spec-row">
                        <span>PRIMARY BODY:</span>
                        <strong style={{ color: inspectingLivery.bodyBaseColor }}>{inspectingLivery.bodyBaseColor}</strong>
                      </div>
                      <div className="cm-spec-row">
                        <span>LOWER SILLS & ROOF:</span>
                        <strong style={{ color: inspectingLivery.secondaryColor }}>{inspectingLivery.secondaryColor}</strong>
                      </div>
                      <div className="cm-spec-row">
                        <span>ACCENT / CALIPERS:</span>
                        <strong style={{ color: inspectingLivery.accentColor }}>{inspectingLivery.accentColor}</strong>
                      </div>
                      <div className="cm-spec-row">
                        <span>DOOR CREST:</span>
                        <strong>SURFACE-CONFORMING DECAL</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <span className="cm-template-propagation-label">SUPPORTING EVIDENCE PACKAGE</span>
              <div className="cm-template-propagation-grid">
                {(["CRATE", "JACKET", "PASS"] as const).map((surfaceId) => (
                  <div key={surfaceId}>
                    <SurfaceMockup surfaceId={surfaceId} coverDataUrl={inspectingTemplate.dataUrl} showInspectorButton={false} />
                    <span className="cm-template-surface-label">{surfaceId}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cm-template-inspection-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const item = inspectingTemplate;
                  setInspectingTemplate(null);
                  onRemix(item.template.id, item.dataUrl);
                }}
              >
                REMIX THIS
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
