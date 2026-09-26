import { useState } from "react";
import {
  type SurfaceId,
  SURFACE_IDS,
  getSurfaceDefinition,
} from "../lib/multiSurfacePreview";
import type { VehicleLivery } from "../lib/vehicleLivery";
import SurfaceMockup from "./SurfaceMockup";
import {
  Car,
  Package,
  Shirt,
  CreditCard,
  Grid,
  Layers,
  ZoomIn,
  ZoomOut,
  X,
  Lock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export interface MultiSurfacePreviewProps {
  coverDataUrl: string;
  identityArtwork?: string;
  frontName?: string;
  readinessScore?: number;
  cityAttention?: string;
  reaction?: string;
  onClose: () => void;
  onLockAndPrint?: () => void;
  onContinueTo305?: () => void;
  initialSurface?: SurfaceId;
  canLock?: boolean;
  isCover02?: boolean;
  vehicleLivery?: VehicleLivery;
}

const SURFACE_ICONS: Record<SurfaceId, typeof Car> = {
  CAR: Car,
  CRATE: Package,
  JACKET: Shirt,
  PASS: CreditCard,
};

export default function MultiSurfacePreview({
  coverDataUrl,
  identityArtwork,
  frontName,
  readinessScore,
  cityAttention,
  reaction,
  onClose,
  onLockAndPrint,
  onContinueTo305,
  initialSurface = "CAR",
  canLock = true,
  isCover02 = false,
  vehicleLivery,
}: MultiSurfacePreviewProps) {
  const [activeSurface, setActiveSurface] = useState<SurfaceId>(initialSurface);
  const [detailed, setDetailed] = useState(false);
  const [viewMode, setViewMode] = useState<"single" | "grid">("single");

  const currentDef = getSurfaceDefinition(activeSurface);

  return (
    <div
      className="cm-multi-surface-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Multi-surface cover preview"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10, 10, 9, 0.94)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <div
        className="cm-multi-surface-shell"
        style={{
          width: "100%",
          maxWidth: "1120px",
          backgroundColor: "#141413",
          border: "1px solid var(--cm-line, #2a2a27)",
          borderRadius: "8px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.85)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
          overflow: "hidden",
        }}
      >
        {/* Header Bar */}
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--cm-line, #2a2a27)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            backgroundColor: "#181817",
          }}
        >
          <div>
            <p
              className="cm-kicker"
              style={{
                margin: 0,
                fontSize: "11px",
                color: "var(--cm-grey, #70706b)",
                letterSpacing: "2px",
              }}
            >
              305 PRINT &amp; SIGN // MULTI-SURFACE FIDELITY CHECK // {isCover02 ? "COVER//02" : "COVER//01"}
            </p>
            <h2
              className="cm-title"
              style={{
                fontSize: "22px",
                margin: "4px 0 0",
                textTransform: "uppercase",
              }}
            >
              Real-World <span className="accent">Disguise Surfaces</span>
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* View Mode Toggle */}
            <div
              style={{
                display: "inline-flex",
                backgroundColor: "#0d0d0c",
                borderRadius: "4px",
                border: "1px solid var(--cm-line, #2a2a27)",
                padding: "2px",
              }}
            >
              <button
                type="button"
                className={`btn btn-ghost ${viewMode === "single" ? "is-active" : ""}`}
                onClick={() => setViewMode("single")}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  backgroundColor: viewMode === "single" ? "#2a2a27" : "transparent",
                  color: viewMode === "single" ? "var(--cm-lime, #d8ff3e)" : "var(--cm-paper, #f2ebdd)",
                }}
                title="Single Surface Tab View"
              >
                <Layers size={13} style={{ marginRight: "4px" }} />
                Tabs
              </button>
              <button
                type="button"
                className={`btn btn-ghost ${viewMode === "grid" ? "is-active" : ""}`}
                onClick={() => setViewMode("grid")}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  backgroundColor: viewMode === "grid" ? "#2a2a27" : "transparent",
                  color: viewMode === "grid" ? "var(--cm-lime, #d8ff3e)" : "var(--cm-paper, #f2ebdd)",
                }}
                title="Grid Overview of All 4 Surfaces"
              >
                <Grid size={13} style={{ marginRight: "4px" }} />
                4-Up Grid
              </button>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              aria-label="Close surface preview"
              style={{ padding: "6px" }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Live Surface Tabs Navigation (when in single mode) */}
        {viewMode === "single" && (
          <nav
            aria-label="Surfaces"
            style={{
              display: "flex",
              borderBottom: "1px solid var(--cm-line, #2a2a27)",
              backgroundColor: "#111110",
              overflowX: "auto",
            }}
          >
            {SURFACE_IDS.map((id) => {
              const def = getSurfaceDefinition(id);
              const Icon = SURFACE_ICONS[id];
              const isCurrent = activeSurface === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSurface(id)}
                  style={{
                    flex: "1 0 auto",
                    minWidth: "140px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: isCurrent ? "#1c1c1a" : "transparent",
                    border: "none",
                    borderBottom: isCurrent
                      ? "2px solid var(--cm-lime, #d8ff3e)"
                      : "2px solid transparent",
                    color: isCurrent
                      ? "var(--cm-paper, #f2ebdd)"
                      : "var(--cm-grey, #70706b)",
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "11px",
                    letterSpacing: "1px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon size={14} color={isCurrent ? "var(--cm-lime, #d8ff3e)" : "currentColor"} />
                  <span>{def.shortName}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Main Body Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {viewMode === "single" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
                gap: "24px",
                alignItems: "start",
              }}
            >
              {/* Left Column: Focused Surface Mockup */}
              <div>
                <SurfaceMockup
                  surfaceId={activeSurface}
                  coverDataUrl={identityArtwork ?? coverDataUrl}
                  vehicleLivery={vehicleLivery}
                  detailed={detailed}
                  onToggleInspect={() => setDetailed(!detailed)}
                />
              </div>

              {/* Right Column: Surface Telemetry & Verification */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {/* Surface Spec Card */}
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#181817",
                    border: "1px solid var(--cm-line, #2a2a27)",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--cm-mono, monospace)",
                      fontSize: "11px",
                      color: "var(--cm-lime, #d8ff3e)",
                      letterSpacing: "1.5px",
                    }}
                  >
                    SURFACE TELEMETRY // {currentDef.category}
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--cm-display, sans-serif)",
                      fontSize: "18px",
                      margin: "6px 0 10px",
                      color: "var(--cm-paper, #f2ebdd)",
                    }}
                  >
                    {currentDef.name}
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      lineHeight: "1.5",
                      color: "#b0b0a8",
                      margin: "0 0 12px",
                    }}
                  >
                    {currentDef.description}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontFamily: "var(--cm-mono, monospace)",
                      fontSize: "11px",
                      borderTop: "1px solid var(--cm-line, #2a2a27)",
                      paddingTop: "12px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--cm-grey, #70706b)" }}>MATERIAL: </span>
                      <span style={{ color: "var(--cm-paper, #f2ebdd)" }}>{currentDef.material}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--cm-grey, #70706b)" }}>CLEARANCE: </span>
                      <span style={{ color: "var(--cm-lime, #d8ff3e)" }}>{currentDef.clearanceLevel}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--cm-grey, #70706b)" }}>DIMENSIONS: </span>
                      <span style={{ color: "var(--cm-paper, #f2ebdd)" }}>{currentDef.dimensionsLabel}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--cm-grey, #70706b)" }}>NOTE: </span>
                      <span style={{ color: "#d1d5db" }}>{currentDef.detailNotes}</span>
                    </div>
                  </div>
                </div>

                {/* Metrics / Front Context (if supplied) */}
                {(readinessScore !== undefined || frontName || reaction) && (
                  <div
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "#181817",
                      border: "1px solid var(--cm-line, #2a2a27)",
                      borderRadius: "6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {frontName && (
                      <div
                        style={{
                          fontFamily: "var(--cm-mono, monospace)",
                          fontSize: "11px",
                          color: "var(--cm-grey, #70706b)",
                        }}
                      >
                        CHOSEN FRONT:{" "}
                        <strong style={{ color: "var(--cm-paper, #f2ebdd)" }}>
                          {frontName.toUpperCase()}
                        </strong>
                      </div>
                    )}
                    {readinessScore !== undefined && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontFamily: "var(--cm-mono, monospace)",
                          fontSize: "12px",
                        }}
                      >
                        <span>COVER READINESS:</span>
                        <strong style={{ color: "var(--cm-lime, #d8ff3e)" }}>
                          {readinessScore} / 100
                        </strong>
                      </div>
                    )}
                    {cityAttention && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontFamily: "var(--cm-mono, monospace)",
                          fontSize: "12px",
                        }}
                      >
                        <span>CITY ATTENTION:</span>
                        <strong
                          style={{
                            color:
                              cityAttention === "HIGH"
                                ? "var(--cm-red, #ff4338)"
                                : cityAttention === "BALANCED"
                                ? "var(--cm-lime, #d8ff3e)"
                                : "var(--cm-blue, #88b8ff)",
                          }}
                        >
                          {cityAttention}
                        </strong>
                      </div>
                    )}
                    {reaction && (
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontFamily: "var(--cm-mono, monospace)",
                          fontSize: "11px",
                          color: "var(--cm-paper, #f2ebdd)",
                          borderLeft: "2px solid var(--cm-lime, #d8ff3e)",
                          paddingLeft: "8px",
                        }}
                      >
                        "{reaction}"
                      </p>
                    )}
                  </div>
                )}

                {/* Inspect Toggle Quick Button */}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDetailed(!detailed)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px",
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "11px",
                  }}
                >
                  {detailed ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
                  {detailed ? "EXIT INSPECTOR MODE" : "INSPECT REGISTRATION CROSSHAIRS"}
                </button>
              </div>
            </div>
          ) : (
            /* 4-Up Grid Overview */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              {SURFACE_IDS.map((id) => (
                <div
                  key={id}
                  style={{
                    cursor: "pointer",
                    border: activeSurface === id ? "1px solid var(--cm-lime, #d8ff3e)" : "1px solid transparent",
                    borderRadius: "8px",
                    transition: "border 0.2s",
                  }}
                  onClick={() => {
                    setActiveSurface(id);
                    setViewMode("single");
                  }}
                >
                  <SurfaceMockup
                    surfaceId={id}
                    coverDataUrl={identityArtwork ?? coverDataUrl}
                    vehicleLivery={vehicleLivery}
                    detailed={false}
                    showInspectorButton={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--cm-line, #2a2a27)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "#181817",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontFamily: "var(--cm-mono, monospace)",
              fontSize: "11px",
              color: "var(--cm-grey, #70706b)",
            }}
          >
            <ShieldAlert size={14} color="var(--cm-lime, #d8ff3e)" />
            <span>APPLIES IDENTICAL IDENTITY ACROSS FLEET &amp; DOCKS</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
            >
              Back to Bay
            </button>

            {onContinueTo305 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onContinueTo305}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                Continue to 305
                <ArrowRight size={14} />
              </button>
            )}

            {onLockAndPrint && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onLockAndPrint}
                disabled={!canLock}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Lock size={14} />
                Lock &amp; Print
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
