import { useEffect, useRef, useState } from "react";
import { Vector3 } from "three";
import {
  initProduction3DYardScene,
  type ProductionYard3DSceneResult,
  type ProductionYardLoadingProgress,
} from "../lib/yard3dProductionScene";
import { resolveActiveCover, loadCoverRecord, loadCover02Record } from "../lib/coverStorage";
import { loadReceiptState } from "../lib/receiptStorage";
import { X, Box, Car, Monitor, RotateCcw, Loader2 } from "lucide-react";

export interface Prototype3DYardProps {
  onBackToHub?: () => void;
  onOpenTerminal?: () => void;
  onOpenPrintBay?: () => void;
}

export default function Prototype3DYard({
  onBackToHub,
  onOpenTerminal,
  onOpenPrintBay,
}: Prototype3DYardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ProductionYard3DSceneResult | null>(null);

  // Active cover resolution from real crewmark storage
  const [activeCoverUrl] = useState<string | null>(() => {
    const c1 = loadCoverRecord();
    const c2 = loadCover02Record();
    const receipts = loadReceiptState();
    const active = resolveActiveCover(c1, c2, receipts.cover01Burned);
    return active ? active.image : null;
  });

  const [activeModal, setActiveModal] = useState<"terminal" | "print-bay" | "vehicle" | "crate" | null>(null);
  const [cameraMode, setCameraMode] = useState<"orbit" | "focus-vehicle" | "focus-crate" | "focus-terminal">("orbit");
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<ProductionYardLoadingProgress>({
    totalItems: 2,
    loadedItems: 0,
    percent: 0,
    item: "Initializing scene assets...",
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const result = initProduction3DYardScene(
      containerRef.current,
      activeCoverUrl,
      (objectName) => {
        setActiveModal(objectName);
      },
      (progress) => {
        setLoadingProgress(progress);
        if (progress.percent >= 100) {
          window.setTimeout(() => setLoading(false), 300);
        }
      },
    );
    sceneRef.current = result;

    // Timeout safety fallback for loading overlay in case cache avoids progress events
    const timer = window.setTimeout(() => setLoading(false), 2500);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModal(null);
        sceneRef.current?.resetCamera();
        setCameraMode("orbit");
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      result.dispose();
      sceneRef.current = null;
    };
  }, [activeCoverUrl]);

  const handleFocusVehicle = () => {
    setActiveModal("vehicle");
    setCameraMode("focus-vehicle");
    if (sceneRef.current) {
      sceneRef.current.focusTarget(
        new Vector3(0, 0.8, 0.6),
        new Vector3(2.4, 1.2, 3.2),
      );
    }
  };

  const handleFocusCrate = () => {
    setActiveModal("crate");
    setCameraMode("focus-crate");
    if (sceneRef.current) {
      sceneRef.current.focusTarget(
        new Vector3(2.4, 0.9, -2.5),
        new Vector3(1.8, 1.2, 2.0),
      );
    }
  };

  const handleFocusTerminal = () => {
    setActiveModal("terminal");
    setCameraMode("focus-terminal");
    if (sceneRef.current) {
      sceneRef.current.focusTarget(
        new Vector3(4.2, 1.2, 1.8),
        new Vector3(1.5, 1.0, 2.2),
      );
    }
  };

  const handleResetCamera = () => {
    setActiveModal(null);
    setCameraMode("orbit");
    sceneRef.current?.resetCamera();
  };

  return (
    <section className="cm-screen cm-3d-yard-screen" style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "#06080B" }}>
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading Overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(6, 8, 11, 0.96)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            color: "#F2EBDD",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <Loader2 size={36} className="cm-spin" style={{ color: "var(--cm-cyan, #06B6D4)", marginBottom: "16px" }} />
          <p className="cm-kicker" style={{ color: "var(--cm-cyan, #06B6D4)", margin: "0 0 4px 0" }}>
            305 PRINT &amp; SIGN // PRODUCTION 3D YARD
          </p>
          <h2 style={{ fontSize: "22px", margin: "0 0 12px 0", letterSpacing: "0.05em" }}>
            STREAMING PRODUCTION ASSETS...
          </h2>
          <div style={{ width: "280px", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
            <div
              style={{
                width: `${loadingProgress.percent}%`,
                height: "100%",
                background: "var(--cm-lime, #10B981)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <p style={{ fontSize: "11px", color: "#9AA3AD", fontFamily: "monospace", marginTop: "8px" }}>
            {loadingProgress.item ? loadingProgress.item.slice(0, 45) : "Loading environment meshes..."}
          </p>
        </div>
      )}

      {/* Top HUD overlay */}
      <header
        style={{
          position: "absolute",
          top: "16px",
          left: "20px",
          right: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <p className="cm-kicker" style={{ margin: 0, color: "var(--cm-cyan, #06B6D4)" }}>
            PRODUCTION ASSET PASS // P7B
          </p>
          <h1 className="cm-title" style={{ fontSize: "20px", margin: "4px 0 0 0", color: "#F2EBDD" }}>
            305 PRINT &amp; SIGN // PRODUCTION 3D DIORAMA
          </h1>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#9AA3AD", fontFamily: "monospace" }}>
            LEFT MOUSE: ORBIT &bull; WHEEL: ZOOM &bull; CLICK OBJECTS IN 3D TO INTERACT
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", pointerEvents: "auto" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetCamera}
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px" }}
          >
            <RotateCcw size={14} /> RESET CAMERA
          </button>
          {onBackToHub && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onBackToHub}
              style={{ fontSize: "12px", padding: "6px 14px" }}
            >
              RETURN TO CANONICAL HUB
            </button>
          )}
        </div>
      </header>

      {/* Quick Camera Focus Dock at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "10px",
          background: "rgba(13, 15, 18, 0.85)",
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          className={`btn ${cameraMode === "focus-vehicle" ? "btn-primary" : "btn-secondary"}`}
          onClick={handleFocusVehicle}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
        >
          <Car size={15} /> VEHICLE (COVER)
        </button>
        <button
          type="button"
          className={`btn ${cameraMode === "focus-crate" ? "btn-primary" : "btn-secondary"}`}
          onClick={handleFocusCrate}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
        >
          <Box size={15} /> CRATE (MANIFEST)
        </button>
        <button
          type="button"
          className={`btn ${cameraMode === "focus-terminal" ? "btn-primary" : "btn-secondary"}`}
          onClick={handleFocusTerminal}
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
        >
          <Monitor size={15} /> TERMINAL KIOSK
        </button>
      </div>

      {/* Interactive Object Modals / Overlays */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "absolute",
            top: "80px",
            right: "24px",
            width: "360px",
            background: "rgba(13, 15, 18, 0.94)",
            border: "1px solid var(--cm-border, #2A2F36)",
            borderRadius: "6px",
            padding: "20px",
            boxShadow: "0 16px 36px rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
            zIndex: 20,
            color: "#F2EBDD",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--cm-cyan, #06B6D4)" }}>
              INTERACTION // 3D FOCUS
            </span>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{ background: "none", border: "none", color: "#9AA3AD", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
          </div>

          {activeModal === "vehicle" && (
            <div>
              <h2 style={{ fontSize: "18px", margin: "0 0 8px 0" }}>FLEET SERVICE SEDAN</h2>
              <p style={{ fontSize: "13px", color: "#9AA3AD", margin: "0 0 14px 0", lineHeight: 1.4 }}>
                The vehicle is wearing the exact live cover texture created in the Forgery Bay editor.
              </p>
              {activeCoverUrl && (
                <div style={{ border: "1px solid #334155", borderRadius: "4px", overflow: "hidden", marginBottom: "14px" }}>
                  <img src={activeCoverUrl} alt="Active cover texture" style={{ width: "100%", display: "block" }} />
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => alert("3D Prototype: In canonical game, this launches Port Vice night delivery.")}
                >
                  TEST THE COVER
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Close
                </button>
              </div>
            </div>
          )}

          {activeModal === "crate" && (
            <div>
              <h2 style={{ fontSize: "18px", margin: "0 0 8px 0" }}>UTILITY CARGO CRATE</h2>
              <p style={{ fontSize: "13px", color: "#9AA3AD", margin: "0 0 14px 0", lineHeight: 1.4 }}>
                The shipping crate manifest label reflects the exact same contractor livery texture.
              </p>
              {activeCoverUrl && (
                <div style={{ border: "1px solid #334155", borderRadius: "4px", overflow: "hidden", marginBottom: "14px" }}>
                  <img src={activeCoverUrl} alt="Active cover on crate" style={{ width: "100%", display: "block" }} />
                </div>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)} style={{ width: "100%" }}>
                Dismiss
              </button>
            </div>
          )}

          {activeModal === "terminal" && (
            <div>
              <h2 style={{ fontSize: "18px", margin: "0 0 8px 0" }}>JOB TERMINAL KIOSK</h2>
              <p style={{ fontSize: "13px", color: "#9AA3AD", margin: "0 0 14px 0", lineHeight: 1.4 }}>
                Interactive kiosk where contract work orders and company front selections occur.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {onOpenTerminal && (
                  <button type="button" className="btn btn-primary" onClick={onOpenTerminal}>
                    PICK A FRONT
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {activeModal === "print-bay" && (
            <div>
              <h2 style={{ fontSize: "18px", margin: "0 0 8px 0" }}>PRINT &amp; FORGERY BAY</h2>
              <p style={{ fontSize: "13px", color: "#9AA3AD", margin: "0 0 14px 0", lineHeight: 1.4 }}>
                Commercial grade cast vinyl cutting &amp; digital printing facility.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {onOpenPrintBay && (
                  <button type="button" className="btn btn-primary" onClick={onOpenPrintBay}>
                    OPEN FORGERY BAY
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
