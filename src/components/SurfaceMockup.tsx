import { useState } from "react";
import {
  type SurfaceId,
  getSurfaceDefinition,
} from "../lib/multiSurfacePreview";
import type { VehicleLivery } from "../lib/vehicleLivery";
import { ZoomIn, ZoomOut, ShieldCheck, CheckCircle2 } from "lucide-react";

export interface SurfaceMockupProps {
  surfaceId: SurfaceId;
  coverDataUrl: string;
  vehicleLivery?: VehicleLivery;
  detailed?: boolean;
  className?: string;
  onToggleInspect?: () => void;
  showInspectorButton?: boolean;
}

export default function SurfaceMockup({
  surfaceId,
  coverDataUrl,
  vehicleLivery,
  detailed: externalDetailed,
  className = "",
  onToggleInspect,
  showInspectorButton = true,
}: SurfaceMockupProps) {
  const [internalDetailed, setInternalDetailed] = useState(false);
  const def = getSurfaceDefinition(surfaceId);
  const isDetailed = externalDetailed !== undefined ? externalDetailed : internalDetailed;
  const activeLivery = vehicleLivery ?? null;
  const handleToggle = () => {
    if (onToggleInspect) {
      onToggleInspect();
    } else {
      setInternalDetailed(!internalDetailed);
    }
  };

  return (
    <div
      className={`cm-surface-mockup cm-surface-mockup--${surfaceId.toLowerCase()} ${
        isDetailed ? "is-detailed" : ""
      } ${className}`}
      data-surface-id={surfaceId}
      style={{
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "#0d0d0c",
        border: "1px solid var(--cm-line, #2a2a27)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {/* Mockup Surface Presentation Area */}
      <div
        className="cm-surface-canvas-area"
        style={{
          position: "relative",
          width: "100%",
          paddingTop: surfaceId === "PASS" ? "120%" : "56.25%", // 16:9 for vehicles/crates, taller for badge
          overflow: "hidden",
          background: surfaceId === "CAR"
            ? "radial-gradient(circle at 50% 30%, #202226 0%, #111214 70%, #0a0a0b 100%)"
            : surfaceId === "CRATE"
            ? "linear-gradient(180deg, #3d2c1c 0%, #291c10 50%, #1e140b 100%)"
            : surfaceId === "JACKET"
            ? "radial-gradient(circle at 50% 50%, #1e2229 0%, #14171c 70%, #0d0f12 100%)"
            : "linear-gradient(135deg, #181a1f 0%, #0e1014 100%)",
        }}
      >
        {/* Surface Specific Rendering */}
        {surfaceId === "CAR" && (
          <div
            className="cm-mockup-car-layer"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4%",
            }}
          >
            {/* Vehicle Door Frame */}
            <div
              style={{
                position: "relative",
                width: "92%",
                height: "82%",
                background: activeLivery
                  ? `linear-gradient(165deg, ${activeLivery.bodyBaseColor} 0%, ${activeLivery.secondaryColor} 100%)`
                  : "linear-gradient(165deg, #2c3038 0%, #1a1c22 45%, #121418 100%)",
                border: "2px solid #3c424e",
                boxShadow: "inset 0 2px 8px rgba(255,255,255,0.1), 0 12px 32px rgba(0,0,0,0.8)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* Window frame at top */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "6%",
                  right: "6%",
                  height: "22%",
                  background: "linear-gradient(180deg, #090a0d 0%, #161b24 100%)",
                  borderBottom: "3px solid #20242c",
                  borderRadius: "8px 20px 0 0",
                  opacity: 0.9,
                }}
              >
                {/* Window reflection */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)",
                  }}
                />
              </div>

              {/* Door handle */}
              <div
                style={{
                  position: "absolute",
                  top: "30%",
                  right: "8%",
                  width: "14%",
                  height: "8%",
                  background: "#0d0e12",
                  borderRadius: "4px",
                  border: "1px solid #383e4a",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.1)",
                }}
              />

              {/* Side molding seam */}
              <div
                style={{
                  position: "absolute",
                  bottom: "16%",
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: "#090a0c",
                  borderBottom: "1px solid #323842",
                }}
              />

              {/* The Applied Decal / Emblem */}
              <div
                style={{
                  position: "relative",
                  width: "84%",
                  height: "52%",
                  marginTop: "6%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {activeLivery?.doorGraphicDataUrl ? (
                  <img
                    src={activeLivery.doorGraphicDataUrl}
                    alt="Vehicle door badge"
                    style={{
                      maxHeight: "95%",
                      maxWidth: "95%",
                      objectFit: "contain",
                      filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))",
                    }}
                  />
                ) : activeLivery ? (
                  <img
                    src={coverDataUrl}
                    alt="Vehicle decal"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : null}
                {/* Surface lighting overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 45%, rgba(0,0,0,0.2) 100%)",
                    pointerEvents: "none",
                  }}
                />
              </div>

              {/* Fleet Spec Label */}
              <div
                style={{
                  position: "absolute",
                  bottom: "6%",
                  left: "12%",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "10px",
                  color: "#6b7280",
                  letterSpacing: "1px",
                }}
              >
                UNIT 305 // VICE CONTRACTOR FLEET
              </div>
            </div>
          </div>
        )}

        {surfaceId === "CRATE" && (
          <div
            className="cm-mockup-crate-layer"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4%",
            }}
          >
            {/* Wooden Crate Panel */}
            <div
              style={{
                position: "relative",
                width: "90%",
                height: "86%",
                backgroundColor: "#2e2114",
                backgroundImage: `repeating-linear-gradient(
                  180deg,
                  #362719 0px,
                  #362719 32px,
                  #1c130b 33px,
                  #2a1e12 34px,
                  #2a1e12 66px,
                  #1c130b 67px
                )`,
                border: "4px solid #1a1209",
                boxShadow: "inset 0 0 40px rgba(0,0,0,0.7), 0 10px 28px rgba(0,0,0,0.7)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Corner metal braces */}
              <div style={{ position: "absolute", top: 0, left: 0, width: "32px", height: "32px", borderTop: "6px solid #5a5f69", borderLeft: "6px solid #5a5f69" }} />
              <div style={{ position: "absolute", top: 0, right: 0, width: "32px", height: "32px", borderTop: "6px solid #5a5f69", borderRight: "6px solid #5a5f69" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "32px", height: "32px", borderBottom: "6px solid #5a5f69", borderLeft: "6px solid #5a5f69" }} />
              <div style={{ position: "absolute", bottom: 0, right: 0, width: "32px", height: "32px", borderBottom: "6px solid #5a5f69", borderRight: "6px solid #5a5f69" }} />

              {/* Stenciled cargo header */}
              <div
                style={{
                  position: "absolute",
                  top: "10%",
                  left: "8%",
                  right: "8%",
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "11px",
                  color: "#d8c4a8",
                  letterSpacing: "2px",
                  opacity: 0.75,
                }}
              >
                <span>PORT VICE // FREIGHT BAY 04</span>
                <span>LOT 884-A</span>
              </div>

              {/* The Manifest Label carrying the cover */}
              <div
                style={{
                  position: "relative",
                  width: "72%",
                  height: "54%",
                  backgroundColor: "#ebe3d5",
                  padding: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.6), inset 0 0 10px rgba(0,0,0,0.1)",
                  transform: "rotate(-0.5deg)",
                  border: "1px dashed #7a6e5d",
                }}
              >
                <div style={{ width: "100%", height: "82%", overflow: "hidden" }}>
                  <img
                    src={coverDataUrl}
                    alt="Crate Manifest Label"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      filter: "contrast(1.08) sepia(0.08)",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "4px",
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "9px",
                    color: "#3a342c",
                    letterSpacing: "1px",
                  }}
                >
                  <span>MANIFEST ATTACHED</span>
                  <span>BARCODE |||| | ||||| |||</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {surfaceId === "JACKET" && (
          <div
            className="cm-mockup-jacket-layer"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4%",
            }}
          >
            {/* Utility Work Jacket Back Panel */}
            <div
              style={{
                position: "relative",
                width: "88%",
                height: "88%",
                backgroundColor: "#16191f",
                borderRadius: "20px 20px 8px 8px",
                border: "2px solid #232832",
                boxShadow: "inset 0 0 30px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.7)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* Jacket collar line */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  width: "40%",
                  height: "16px",
                  borderBottom: "3px solid #2a313d",
                  borderRadius: "0 0 16px 16px",
                  background: "#1c212a",
                }}
              />

              {/* High-visibility reflective band */}
              <div
                style={{
                  position: "absolute",
                  top: "22%",
                  left: 0,
                  right: 0,
                  height: "22px",
                  background: "linear-gradient(90deg, #d8ff3e 0%, #eafc7e 50%, #d8ff3e 100%)",
                  boxShadow: "0 0 12px rgba(216,255,62,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderTop: "1px dashed rgba(0,0,0,0.4)",
                  borderBottom: "1px dashed rgba(0,0,0,0.4)",
                }}
              >
                <div
                  style={{
                    height: "6px",
                    width: "100%",
                    background: "#c2c7cc",
                    opacity: 0.85,
                  }}
                />
              </div>

              {/* The Embroidered Back Patch carrying the cover */}
              <div
                style={{
                  position: "relative",
                  width: "74%",
                  height: "48%",
                  marginTop: "16%",
                  borderRadius: "6px",
                  border: "4px solid #101216",
                  outline: "2px dashed #404958",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
                  overflow: "hidden",
                  backgroundColor: "#0d0f13",
                }}
              >
                <img
                  src={coverDataUrl}
                  alt="Jacket Embroidered Patch"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "contrast(1.05)",
                  }}
                />
                {/* Fabric stitch weave texture overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: "radial-gradient(#ffffff 0.5px, transparent 0.5px)",
                    backgroundSize: "4px 4px",
                    opacity: 0.12,
                    pointerEvents: "none",
                  }}
                />
              </div>

              {/* Crew serial mark at hem */}
              <div
                style={{
                  position: "absolute",
                  bottom: "6%",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "9px",
                  color: "#545e70",
                  letterSpacing: "2px",
                }}
              >
                CREW ISSUE // VICE CONTRACTOR STANDARD
              </div>
            </div>
          </div>
        )}

        {surfaceId === "PASS" && (
          <div
            className="cm-mockup-pass-layer"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: "4% 6%",
            }}
          >
            {/* Lanyard Top Strap & Clip */}
            <div
              style={{
                width: "28px",
                height: "36px",
                background: "linear-gradient(180deg, #1f2228 0%, #111317 100%)",
                border: "1px solid #333945",
                borderRadius: "3px",
                marginBottom: "-4px",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingBottom: "4px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "8px",
                  border: "2px solid #8e95a5",
                  borderRadius: "2px",
                  background: "#4b5160",
                }}
              />
            </div>

            {/* Badge Card Body */}
            <div
              style={{
                position: "relative",
                width: "86%",
                flex: 1,
                maxHeight: "84%",
                backgroundColor: "#f5f3ec",
                borderRadius: "10px",
                border: "1px solid #c8c2b4",
                boxShadow: "0 12px 28px rgba(0,0,0,0.65)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                color: "#1a1918",
              }}
            >
              {/* Badge Slot Punch */}
              <div
                style={{
                  position: "absolute",
                  top: "6px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "26px",
                  height: "6px",
                  borderRadius: "3px",
                  backgroundColor: "#0d0e11",
                }}
              />

              {/* Badge Header Header */}
              <div
                style={{
                  padding: "16px 12px 6px",
                  borderBottom: "2px solid #1a1918",
                  background: "#1c212b",
                  color: "#f2ebdd",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "8px",
                    letterSpacing: "1.5px",
                    color: "var(--cm-lime, #d8ff3e)",
                  }}
                >
                  PORT VICE HARBOR SECURITY
                </div>
                <div
                  style={{
                    fontFamily: "var(--cm-display, sans-serif)",
                    fontSize: "12px",
                    fontWeight: 900,
                    letterSpacing: "0.5px",
                  }}
                >
                  CONTRACTOR CREDENTIAL
                </div>
              </div>

              {/* Badge Cover Area */}
              <div
                style={{
                  margin: "10px 10px 6px",
                  height: "38%",
                  borderRadius: "4px",
                  overflow: "hidden",
                  border: "1px solid #2a2a28",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
                  position: "relative",
                }}
              >
                <img
                  src={coverDataUrl}
                  alt="Badge Cover Crest"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>

              {/* Badge Details & RFID Barcode */}
              <div
                style={{
                  padding: "4px 10px 8px",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--cm-mono, monospace)",
                      fontSize: "9px",
                      fontWeight: 700,
                      color: "#1f2228",
                    }}
                  >
                    STATUS: AUTHORIZED VENDOR
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--cm-mono, monospace)",
                      fontSize: "8px",
                      color: "#6b7280",
                    }}
                  >
                    ZONE 2 ACCESS // SERVICE GATE PASS
                  </div>
                </div>

                {/* Hologram security simulation strip */}
                <div
                  style={{
                    height: "10px",
                    borderRadius: "2px",
                    background: "linear-gradient(90deg, #d8ff3e, #88b8ff, #ff4338, #d8ff3e)",
                    opacity: 0.65,
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                />

                {/* Barcode & Issue ID */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "8px",
                    color: "#222",
                  }}
                >
                  <span style={{ letterSpacing: "1px" }}>|||| | ||| |||| |</span>
                  <span>EXP: 02:00 HRS</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Inspector Overlay (Crosshairs & Telemetry) */}
        {isDetailed && (
          <div
            className="cm-surface-inspector-overlay"
            style={{
              position: "absolute",
              inset: 0,
              border: "2px solid var(--cm-lime, #d8ff3e)",
              backgroundColor: "rgba(16, 16, 15, 0.45)",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "12px",
              boxSizing: "border-box",
            }}
          >
            {/* Top diagnostic bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "var(--cm-mono, monospace)",
                fontSize: "11px",
                color: "var(--cm-lime, #d8ff3e)",
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
              }}
            >
              <span>+ INSPECTION: {def.name}</span>
              <span>DIM: {def.dimensionsLabel}</span>
            </div>

            {/* Center crosshair */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "36px",
                height: "36px",
                border: "1px dashed rgba(216,255,62,0.45)",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "-6px",
                  right: "-6px",
                  height: "1px",
                  background: "rgba(216,255,62,0.6)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "-6px",
                  bottom: "-6px",
                  width: "1px",
                  background: "rgba(216,255,62,0.6)",
                }}
              />
            </div>

            {/* Bottom telemetry status */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                fontFamily: "var(--cm-mono, monospace)",
                fontSize: "10px",
                color: "#e5e7eb",
                backgroundColor: "rgba(10, 10, 10, 0.75)",
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid var(--cm-line, #2a2a27)",
              }}
            >
              <div>
                <span style={{ color: "var(--cm-lime, #d8ff3e)" }}>CLEARANCE:</span> {def.clearanceLevel}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--cm-lime, #d8ff3e)" }}>
                <CheckCircle2 size={12} />
                <span>100% REGISTRATION</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Surface Caption / Metadata Card Footer */}
      <div
        style={{
          padding: "12px 14px",
          backgroundColor: "#131312",
          borderTop: "1px solid var(--cm-line, #2a2a27)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--cm-mono, monospace)",
              fontSize: "10px",
              color: "var(--cm-grey, #70706b)",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ShieldCheck size={12} color="var(--cm-lime, #d8ff3e)" />
            {def.category} // {def.shortName}
          </div>
          <div
            style={{
              fontFamily: "var(--cm-display, sans-serif)",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--cm-paper, #f2ebdd)",
              marginTop: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {def.tagline}
          </div>
        </div>

        {showInspectorButton && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleToggle}
            aria-pressed={isDetailed}
            style={{
              padding: "6px 10px",
              fontSize: "11px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {isDetailed ? (
              <>
                <ZoomOut size={13} aria-hidden={true} />
                <span>Standard</span>
              </>
            ) : (
              <>
                <ZoomIn size={13} aria-hidden={true} />
                <span>Inspect</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
