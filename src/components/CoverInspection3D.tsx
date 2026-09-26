import { useEffect, useRef, useState } from "react";
import {
  initCoverInspection3D,
  type CoverInspection3DSceneResult,
} from "../lib/coverInspection3dScene";
import type { VehicleLivery } from "../lib/vehicleLivery";
import type { VisualSignatureComparison } from "../lib/signatureComparison";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
export interface CoverInspection3DProps {
  cover01Image: string | null;
  cover02Image: string | null;
  vehicleLivery01: VehicleLivery | null;
  vehicleLivery02: VehicleLivery | null;
  signature?: VisualSignatureComparison | null;
  onBackToYard: () => void;
  onTestCover?: () => void;
  onViewReceipt?: () => void;
  isRunComplete?: boolean;
}

export default function CoverInspection3D({
  cover01Image,
  cover02Image,
  vehicleLivery01,
  vehicleLivery02,
  signature,
  onBackToYard,
  onTestCover,
  onViewReceipt,
  isRunComplete = false,
}: CoverInspection3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CoverInspection3DSceneResult | null>(null);

  // Active cover selection: defaults to Cover 02 if available, else Cover 01
  const [selectedSlot, setSelectedSlot] = useState<"cover01" | "cover02">(() =>
    cover02Image ? "cover02" : "cover01",
  );
  const [activePreset, setActivePreset] = useState<"hero" | "side" | "rear" | "detail">("hero");
  const [loading, setLoading] = useState(true);

  const activeImage = selectedSlot === "cover02" && cover02Image ? cover02Image : cover01Image;
  const activeLivery = selectedSlot === "cover02" ? vehicleLivery02 : vehicleLivery01;
  const initialImageRef = useRef(activeImage);
  const initialLiveryRef = useRef(activeLivery);
  const onBackRef = useRef(onBackToYard);
  useEffect(() => {
    onBackRef.current = onBackToYard;
  }, [onBackToYard]);

  useEffect(() => {
    if (!containerRef.current) return;
    const result = initCoverInspection3D(containerRef.current, initialImageRef.current, () => {
      setLoading(false);
    }, initialLiveryRef.current);
    sceneRef.current = result;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBackRef.current();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      result.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Update texture when toggling between Cover 01 and Cover 02
  const handleToggleCover = (slot: "cover01" | "cover02") => {
    setSelectedSlot(slot);
    const targetUrl = slot === "cover02" ? cover02Image : cover01Image;
    if (targetUrl && sceneRef.current) {
      sceneRef.current.setCoverTexture(targetUrl);
      const targetLivery = slot === "cover02" ? vehicleLivery02 : vehicleLivery01;
      if (targetLivery) sceneRef.current.setVehicleLivery(targetLivery);
    }
  };

  const handleSelectPreset = (preset: "hero" | "side" | "rear" | "detail") => {
    setActivePreset(preset);
    sceneRef.current?.setCameraPreset(preset);
  };

  return (
    <section
      className="cm-screen cm-cover-inspection-screen"
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        background: "#060709",
        color: "#F2EBDD",
      }}
      aria-label="3D Cover Inspection Studio"
    >
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading indicator */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(6, 7, 9, 0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
          }}
        >
          <Loader2 size={32} className="cm-spin" style={{ color: "var(--cm-cyan, #06B6D4)", marginBottom: "12px" }} />
          <p className="cm-kicker" style={{ color: "var(--cm-cyan, #06B6D4)", margin: "0 0 4px 0" }}>
            CREW//MARK STUDIO
          </p>
          <h2 style={{ fontSize: "20px", margin: 0 }}>LOADING 3D VEHICLE...</h2>
        </div>
      )}

      {/* Top Header / Status bar */}
      <header
        style={{
          position: "absolute",
          top: "16px",
          left: "24px",
          right: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <p className="cm-kicker" style={{ margin: "0 0 2px 0", color: "var(--cm-cyan, #06B6D4)" }}>
            CREW//MARK // VEHICLE INSPECTION
          </p>
          <h1 className="cm-title" style={{ fontSize: "22px", margin: 0 }}>
            {selectedSlot === "cover02" ? (
              <>
                COVER//02 <span style={{ color: "var(--cm-lime, #10B981)" }}>// ACTIVE</span>
              </>
            ) : cover02Image ? (
              <>
                COVER//01 <span style={{ color: "var(--cm-red, #E11D48)" }}>// BURNED</span>
              </>
            ) : (
              <>
                COVER//01 <span style={{ color: "var(--cm-lime, #10B981)" }}>// ACTIVE</span>
              </>
            )}
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", fontFamily: "monospace", color: "#9AA3AD" }}>
            DRAG MOUSE TO ORBIT &bull; SCROLL TO ZOOM &bull; FULL PANEL LIVERY
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", pointerEvents: "auto" }}>
          {isRunComplete && onViewReceipt && (
            <button type="button" className="btn btn-secondary" onClick={onViewReceipt}>
              VIEW RUN RECEIPT
            </button>
          )}
          {onTestCover && !isRunComplete && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onTestCover}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Play size={14} fill="currentColor" /> TEST THE COVER
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onBackToYard}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={14} /> BACK TO 305
          </button>
        </div>
      </header>

      {/* Cover Comparison Toggle (when Cover 02 exists) */}
      {cover02Image && (
        <aside
          style={{
            position: "absolute",
            top: "80px",
            right: "24px",
            width: "320px",
            background: "rgba(10, 13, 18, 0.88)",
            border: "1px solid var(--cm-border, #2A2F36)",
            borderRadius: "6px",
            padding: "16px",
            backdropFilter: "blur(12px)",
            zIndex: 10,
          }}
          aria-label="Cover comparison metrics"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#9AA3AD" }}>
              DISGUISE COMPARISON
            </span>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                color: signature?.canLock ? "var(--cm-lime, #10B981)" : "#9AA3AD",
              }}
            >
              {signature?.status ?? "SIGNATURE ROTATED"}
            </span>
          </div>

          {/* Toggle buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              className={`btn ${selectedSlot === "cover01" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => handleToggleCover("cover01")}
              style={{ fontSize: "11px", padding: "8px 6px" }}
            >
              COVER//01 [BURNED]
            </button>
            <button
              type="button"
              className={`btn ${selectedSlot === "cover02" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => handleToggleCover("cover02")}
              style={{ fontSize: "11px", padding: "8px 6px" }}
            >
              COVER//02 [ACTIVE]
            </button>
          </div>

          {/* Signature metrics display */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9AA3AD" }}>CITY MATCH:</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--cm-cyan, #06B6D4)" }}>
                {signature?.cityMatchEstimate ?? 18}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9AA3AD" }}>VISUAL DISTANCE:</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--cm-lime, #10B981)" }}>
                {signature?.signatureDistance ?? 78}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9AA3AD" }}>COLOR SHIFT:</span>
              <span style={{ fontFamily: "monospace" }}>{signature?.colorShift ?? 82}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9AA3AD" }}>LAYOUT SHIFT:</span>
              <span style={{ fontFamily: "monospace" }}>{signature?.layoutShift ?? 65}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9AA3AD" }}>COMPLEXITY SHIFT:</span>
              <span style={{ fontFamily: "monospace" }}>{signature?.complexityShift ?? 22}%</span>
            </div>
          </div>
        </aside>
      )}

      {/* Quick Camera Presets Dock at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "8px",
          background: "rgba(10, 13, 18, 0.88)",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
          zIndex: 10,
        }}
        role="toolbar"
        aria-label="Camera preset angles"
      >
        <button
          type="button"
          className={`btn ${activePreset === "hero" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => handleSelectPreset("hero")}
          style={{ fontSize: "11px", padding: "6px 12px" }}
        >
          FRONT 3/4
        </button>
        <button
          type="button"
          className={`btn ${activePreset === "side" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => handleSelectPreset("side")}
          style={{ fontSize: "11px", padding: "6px 12px" }}
        >
          SIDE (DOOR)
        </button>
        <button
          type="button"
          className={`btn ${activePreset === "rear" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => handleSelectPreset("rear")}
          style={{ fontSize: "11px", padding: "6px 12px" }}
        >
          REAR 3/4
        </button>
        <button
          type="button"
          className={`btn ${activePreset === "detail" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => handleSelectPreset("detail")}
          style={{ fontSize: "11px", padding: "6px 12px", color: "var(--cm-cyan, #06B6D4)" }}
        >
          COVER DETAIL
        </button>
      </div>
    </section>
  );
}
