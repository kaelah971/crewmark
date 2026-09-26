import { useEffect, useMemo, useRef, useState } from "react";
import {
  initCoverInspection3D,
  type CoverInspection3DSceneResult,
} from "../lib/coverInspection3dScene";
import type { DisguisePackage, VehicleCustomization } from "../lib/disguisePackage";
import { applyVehicleCustomization, saveDisguisePackage } from "../lib/disguisePackage";
import type { VehicleLivery } from "../lib/vehicleLivery";
import { deriveVehicleLivery } from "../lib/vehicleLivery";
import { ArrowLeft, RotateCcw, Save, Shield, SlidersHorizontal } from "lucide-react";

export interface VehicleEditorProps {
  currentPackage: DisguisePackage;
  onSave: (updatedPackage: DisguisePackage) => void;
  onBack: () => void;
}

const BODY_COLOR_PALETTE = [
  { label: "CREAM", hex: "#E8E4D5" },
  { label: "PEARL", hex: "#ECE5D5" },
  { label: "WHITE", hex: "#F1F5F9" },
  { label: "CHARCOAL", hex: "#1C1C22" },
  { label: "BLACK", hex: "#0C0E12" },
  { label: "SLATE", hex: "#3A3F45" },
  { label: "MUNI BLUE", hex: "#1B4D7E" },
  { label: "TAN", hex: "#E2D7C5" },
];

const SECONDARY_COLOR_PALETTE = [
  { label: "SATIN BLACK", hex: "#171817" },
  { label: "AQUA", hex: "#0A6B88" },
  { label: "FOREST", hex: "#1E3A2B" },
  { label: "MIDNIGHT", hex: "#2E1B42" },
  { label: "SILVER", hex: "#8E99A5" },
  { label: "NAVY", hex: "#0F2942" },
  { label: "BROWN", hex: "#3D2617" },
];

const ACCENT_COLOR_PALETTE = [
  { label: "LIME", hex: "#D8FF3E" },
  { label: "ORANGE", hex: "#F97316" },
  { label: "CYAN", hex: "#00A3FF" },
  { label: "CORAL", hex: "#E07A5F" },
  { label: "AMBER", hex: "#F59E0B" },
  { label: "FROST", hex: "#38BDF8" },
];

export default function VehicleEditor({
  currentPackage,
  onSave,
  onBack,
}: VehicleEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CoverInspection3DSceneResult | null>(null);

  // Authored base template livery without user modifications
  const baseTemplateLivery = useMemo(
    () => deriveVehicleLivery(currentPackage.identityArtwork, currentPackage.templateId ?? undefined),
    [currentPackage.identityArtwork, currentPackage.templateId],
  );

  // Working customizations state
  const [customization, setCustomization] = useState<VehicleCustomization>(() => ({
    bodyBaseColor: currentPackage.vehicleLivery.bodyBaseColor,
    secondaryColor: currentPackage.vehicleLivery.secondaryColor,
    accentColor: currentPackage.vehicleLivery.accentColor,
    stripePattern: currentPackage.vehicleLivery.stripePattern,
    logoScale: currentPackage.customization?.logoScale ?? 1.0,
    logoPlacement: currentPackage.customization?.logoPlacement ?? "center",
    showHoodMark: currentPackage.customization?.showHoodMark ?? true,
    showRearMarking: currentPackage.customization?.showRearMarking ?? true,
  }));

  const [activeLivery, setActiveLivery] = useState<VehicleLivery>(() =>
    applyVehicleCustomization(baseTemplateLivery, customization),
  );

  const [activeCameraPreset, setActiveCameraPreset] = useState<"hero" | "side" | "rear" | "detail">("side");

  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const initialLiveryRef = useRef(activeLivery);

  // Mount Three.js interactive 3D sedan in center viewport
  useEffect(() => {
    if (!containerRef.current) return;

    const result = initCoverInspection3D(
      containerRef.current,
      null,
      undefined,
      initialLiveryRef.current,
    );
    sceneRef.current = result;

    // Default to side view for livery editing
    result.setCameraPreset("side");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBackRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      result.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Update 3D scene whenever customizations change
  const handleUpdateCustomization = (patch: Partial<VehicleCustomization>) => {
    setCustomization((prev) => {
      const next = { ...prev, ...patch };
      const updatedLivery = applyVehicleCustomization(baseTemplateLivery, next);
      setActiveLivery(updatedLivery);
      sceneRef.current?.setVehicleLivery(updatedLivery);
      return next;
    });
  };

  const handleResetToTemplate = () => {
    const resetCustom: VehicleCustomization = {
      bodyBaseColor: baseTemplateLivery.bodyBaseColor,
      secondaryColor: baseTemplateLivery.secondaryColor,
      accentColor: baseTemplateLivery.accentColor,
      stripePattern: baseTemplateLivery.stripePattern,
      logoScale: 1.0,
      logoPlacement: "center",
      showHoodMark: true,
      showRearMarking: true,
    };
    setCustomization(resetCustom);
    setActiveLivery(baseTemplateLivery);
    sceneRef.current?.setVehicleLivery(baseTemplateLivery);
  };

  const handleSave = () => {
    const updatedPackage: DisguisePackage = {
      ...currentPackage,
      vehicleLivery: activeLivery,
      customization,
    };
    saveDisguisePackage(updatedPackage, "COVER//01");
    onSave(updatedPackage);
  };

  return (
    <section className="cm-vehicle-editor-screen" aria-label="Vehicle Customization Bay">
      {/* Top Header Bar */}
      <header className="cm-vehicle-editor-header">
        <div className="cm-vehicle-editor-brand">
          <p className="cm-kicker">305 PRINT & SIGN // FLEET CUSTOMIZATION BAY</p>
          <h1 className="cm-title">
            EDIT VEHICLE <span>// {currentPackage.companyName}</span>
          </h1>
        </div>
        <div className="cm-vehicle-editor-top-actions">
          <button type="button" className="btn btn-ghost" onClick={handleResetToTemplate} title="Restore authored template livery">
            <RotateCcw size={14} aria-hidden="true" /> RESET TO TEMPLATE
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Save size={15} aria-hidden="true" /> SAVE VEHICLE LIVERY
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack} title="Return to garage">
            <ArrowLeft size={14} aria-hidden="true" /> BACK
          </button>
        </div>
      </header>

      {/* Main 3-Column Customization Layout */}
      <div className="cm-vehicle-editor-workspace">
        {/* LEFT COLUMN: Livery Controls */}
        <aside className="cm-vehicle-editor-controls" aria-label="Livery parameters">
          <div className="cm-editor-section-header">
            <SlidersHorizontal size={14} className="accent" aria-hidden="true" />
            <span>FLEET LIVERY SPECIFICATIONS</span>
          </div>

          {/* Primary Paint */}
          <div className="cm-editor-control-group">
            <label className="cm-editor-label">
              PRIMARY BODY PAINT
              <span className="cm-editor-value-chip" style={{ background: customization.bodyBaseColor }}>
                {customization.bodyBaseColor}
              </span>
            </label>
            <div className="cm-editor-swatch-row">
              {BODY_COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`cm-editor-swatch ${customization.bodyBaseColor === c.hex ? "is-selected" : ""}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => handleUpdateCustomization({ bodyBaseColor: c.hex })}
                  title={c.label}
                  aria-label={`Body color ${c.label}`}
                />
              ))}
            </div>
          </div>

          {/* Secondary Paint (Trim, Rockers, Roof) */}
          <div className="cm-editor-control-group">
            <label className="cm-editor-label">
              SECONDARY SILLS & ROOF
              <span className="cm-editor-value-chip" style={{ background: customization.secondaryColor }}>
                {customization.secondaryColor}
              </span>
            </label>
            <div className="cm-editor-swatch-row">
              {SECONDARY_COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`cm-editor-swatch ${customization.secondaryColor === c.hex ? "is-selected" : ""}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => handleUpdateCustomization({ secondaryColor: c.hex })}
                  title={c.label}
                  aria-label={`Secondary color ${c.label}`}
                />
              ))}
            </div>
          </div>

          {/* Accent Color (Calipers, Stripes, Marks) */}
          <div className="cm-editor-control-group">
            <label className="cm-editor-label">
              ACCENT & CALIPERS
              <span className="cm-editor-value-chip" style={{ background: customization.accentColor }}>
                {customization.accentColor}
              </span>
            </label>
            <div className="cm-editor-swatch-row">
              {ACCENT_COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`cm-editor-swatch ${customization.accentColor === c.hex ? "is-selected" : ""}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => handleUpdateCustomization({ accentColor: c.hex })}
                  title={c.label}
                  aria-label={`Accent color ${c.label}`}
                />
              ))}
            </div>
          </div>

          {/* Stripe Pattern Selector */}
          <div className="cm-editor-control-group">
            <label className="cm-editor-label">ROCKER STRIPE PATTERN</label>
            <div className="cm-editor-btn-grid">
              {(["none", "service", "hazard", "wave", "logistics", "detail"] as const).map((pat) => (
                <button
                  key={pat}
                  type="button"
                  className={`cm-editor-pill-btn ${customization.stripePattern === pat ? "is-selected" : ""}`}
                  onClick={() => handleUpdateCustomization({ stripePattern: pat })}
                >
                  {pat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Door Logo Scale Slider */}
          <div className="cm-editor-control-group">
            <label className="cm-editor-label">
              DOOR EMBLEM SCALE
              <span className="cm-editor-val-text">{Math.round((customization.logoScale ?? 1.0) * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={customization.logoScale ?? 1.0}
              onChange={(e) => handleUpdateCustomization({ logoScale: parseFloat(e.target.value) })}
              className="cm-editor-slider"
            />
          </div>

          {/* Decal Toggles */}
          <div className="cm-editor-control-group">
            <label className="cm-editor-label">INSIGNIA & FLEET MARKINGS</label>
            <div className="cm-editor-toggles-row">
              <button
                type="button"
                className={`cm-editor-toggle-btn ${customization.showHoodMark !== false ? "is-active" : ""}`}
                onClick={() => handleUpdateCustomization({ showHoodMark: customization.showHoodMark === false })}
              >
                HOOD CREST: {customization.showHoodMark !== false ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                className={`cm-editor-toggle-btn ${customization.showRearMarking !== false ? "is-active" : ""}`}
                onClick={() => handleUpdateCustomization({ showRearMarking: customization.showRearMarking === false })}
              >
                REAR UNIT CODE: {customization.showRearMarking !== false ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Real-Time Interactive 3D Sedan Viewport */}
        <main className="cm-vehicle-editor-viewport" aria-label="3D Sedan Preview">
          <div ref={containerRef} className="cm-vehicle-editor-canvas-wrap" />

          {/* Camera Preset Toolbar */}
          <div className="cm-vehicle-editor-camera-bar" role="toolbar" aria-label="Camera angles">
            {(["hero", "side", "rear", "detail"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`cm-camera-pill ${activeCameraPreset === preset ? "is-active" : ""}`}
                onClick={() => {
                  setActiveCameraPreset(preset);
                  sceneRef.current?.setCameraPreset(preset);
                }}
              >
                {preset === "hero" ? "FRONT 3/4" : preset === "side" ? "SIDE (DOOR)" : preset === "rear" ? "REAR 3/4" : "EMBLEM ZOOM"}
              </button>
            ))}
          </div>

          <p className="cm-vehicle-editor-hint">
            ORBIT: DRAG MOUSE • ZOOM: SCROLL • DECALS SIT FLUSH WITH ZERO RECTANGLES
          </p>
        </main>

        {/* RIGHT COLUMN: Identity Reference / Current Cover Vinyl */}
        <aside className="cm-vehicle-editor-identity" aria-label="Identity reference">
          <div className="cm-editor-section-header">
            <Shield size={14} className="accent" aria-hidden="true" />
            <span>DISGUISE IDENTITY REFERENCE</span>
          </div>

          <div className="cm-identity-ref-card">
            <h3 className="cm-identity-company">{currentPackage.companyName}</h3>
            <p className="cm-identity-tagline">{currentPackage.tagline}</p>
            <div className="cm-identity-unit-badge">
              <span>ACTIVE FLEET CODE:</span>
              <strong>{activeLivery.unitLabel}</strong>
            </div>

            <div className="cm-identity-vinyl-wrap">
              <span className="cm-identity-vinyl-tag">SOURCE COVER ARTWORK (1600 × 700 PX)</span>
              <img
                src={currentPackage.identityArtwork}
                alt={`${currentPackage.companyName} source artwork`}
                className="cm-identity-vinyl-img"
              />
            </div>

            <div className="cm-identity-notice">
              <p>
                <strong>FLEET INTEGRITY INVARIANT:</strong> The vehicle livery remains linked to this chosen disguise package. Adjusting paint and badge scale updates both the 3D model and 2.5D yard manifestations identically.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
