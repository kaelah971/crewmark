import { useState } from "react";
import {
  type FrontId,
  type ChosenFrontRecord,
  type CustomFrontProfile,
  FRONT_OPTIONS,
  chooseFront,
  saveChosenFront,
  loadChosenFront,
} from "../lib/fronts";
import {
  Sparkles,
  Briefcase,
  Droplets,
  Flower2,
  Bug,
  Wine,
  Sparkle,
  PenTool,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export interface FrontTerminalProps {
  onSelectFront: (front: ChosenFrontRecord) => void;
  onBack?: () => void;
  initialFront?: ChosenFrontRecord | null;
}

const FRONT_ICONS: Record<FrontId, typeof Briefcase> = {
  "pool-service": Droplets,
  "flower-delivery": Flower2,
  "pest-control": Bug,
  "nightlife-supply": Wine,
  "mobile-detailing": Sparkle,
  "make-your-own": PenTool,
  "surprise-me": Sparkles,
};

const FRONT_ACCENTS: Record<FrontId, string> = {
  "pool-service": "#00d2ff",
  "flower-delivery": "#ff6b8b",
  "pest-control": "#ffd000",
  "nightlife-supply": "#e040fb",
  "mobile-detailing": "#448aff",
  "make-your-own": "#d8ff3e",
  "surprise-me": "#ffffff",
};

export default function FrontTerminal({
  onSelectFront,
  onBack,
  initialFront,
}: FrontTerminalProps) {
  const saved = initialFront ?? loadChosenFront();
  const [selectedId, setSelectedId] = useState<FrontId>(
    saved?.requestedFrontId ?? "pool-service",
  );

  // Custom front form state
  const [customName, setCustomName] = useState(
    saved?.customProfile?.businessName ?? "APEX MECHANICAL",
  );
  const [customTagline, setCustomTagline] = useState(
    saved?.customProfile?.tagline ?? "Industrial HVAC & Cold Storage",
  );
  const [customBg, setCustomBg] = useState(
    saved?.customProfile?.palette?.background ?? "#1e2229",
  );
  const [customAccent, setCustomAccent] = useState(
    saved?.customProfile?.palette?.accent ?? "#ff7a29",
  );
  const [customInk, setCustomInk] = useState(
    saved?.customProfile?.palette?.ink ?? "#f5f5f0",
  );

  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handleConfirm = () => {
    setErrorNotice(null);

    let customProfile: CustomFrontProfile | null = null;
    if (selectedId === "make-your-own") {
      const trimmed = customName.trim();
      if (!trimmed) {
        setErrorNotice("Please enter a business name for your custom front.");
        return;
      }
      customProfile = {
        businessName: trimmed,
        tagline: customTagline.trim() || undefined,
        palette: {
          background: customBg,
          accent: customAccent,
          ink: customInk,
        },
      };
    }

    const record = chooseFront(selectedId, { customProfile });
    saveChosenFront(record);
    onSelectFront(record);
  };

  return (
    <section
      className="cm-screen cm-front-terminal"
      aria-label="Front Selection Terminal"
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        paddingBottom: "48px",
      }}
    >
      <div style={{ marginBottom: "28px" }}>
        <p className="cm-kicker">305 PRINT &amp; SIGN // CONTRACTOR DISPATCH</p>
        <h1 className="cm-title" style={{ fontSize: "clamp(32px, 5vw, 56px)" }}>
          SELECT YOUR <span className="accent">FRONT COMPANY.</span>
        </h1>
        <p className="cm-lede" style={{ maxWidth: "70ch" }}>
          Every cover tells a story before the guard asks a question. Choose a
          plausible service business for your vehicle or invent your own commercial fiction.
        </p>
      </div>

      {errorNotice && (
        <div
          className="cm-alert cm-alert--fatal"
          role="alert"
          style={{ marginBottom: "20px" }}
        >
          <span>{errorNotice}</span>
        </div>
      )}

      {/* Front Options Grid */}
      <div
        role="radiogroup"
        aria-label="Front business options"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {FRONT_OPTIONS.map((option) => {
          const isSelected = selectedId === option.id;
          const Icon = FRONT_ICONS[option.id] ?? Briefcase;
          const accentColor = FRONT_ACCENTS[option.id] ?? "var(--cm-lime)";

          return (
            <div
              key={option.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => setSelectedId(option.id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setSelectedId(option.id);
                }
              }}
              style={{
                backgroundColor: isSelected ? "#1c1c1a" : "#141413",
                border: isSelected
                  ? "2px solid var(--cm-lime, #d8ff3e)"
                  : "1px solid var(--cm-line, #2a2a27)",
                borderRadius: "8px",
                padding: "18px 20px",
                cursor: "pointer",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "14px",
                transition: "all 0.15s ease",
                boxShadow: isSelected
                  ? "0 0 20px rgba(216, 255, 62, 0.12)"
                  : "none",
              }}
            >
              <div>
                {/* Header line with icon, label, and selection indicator */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: `1px solid ${accentColor}44`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: accentColor,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--cm-display, sans-serif)",
                        fontSize: "17px",
                        fontWeight: 700,
                        color: isSelected
                          ? "var(--cm-lime, #d8ff3e)"
                          : "var(--cm-paper, #f2ebdd)",
                        textTransform: "uppercase",
                      }}
                    >
                      {option.label}
                    </span>
                  </div>

                  {isSelected ? (
                    <CheckCircle2 size={18} color="var(--cm-lime, #d8ff3e)" />
                  ) : (
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: "1px solid var(--cm-line, #2a2a27)",
                      }}
                    />
                  )}
                </div>

                {/* Inspiration */}
                <p
                  style={{
                    fontFamily: "var(--cm-body, sans-serif)",
                    fontSize: "13px",
                    color: "#d0d0c8",
                    lineHeight: "1.4",
                    margin: "0 0 10px",
                  }}
                >
                  {option.inspiration}
                </p>

                {/* Personality */}
                <div
                  style={{
                    fontFamily: "var(--cm-mono, monospace)",
                    fontSize: "11px",
                    color: "#9ca3af",
                    backgroundColor: "rgba(0, 0, 0, 0.25)",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    borderLeft: `2px solid ${accentColor}`,
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ color: "#e5e7eb" }}>PERSONA: </strong>
                  {option.personality}
                </div>
              </div>

              {/* Visual vibe footer */}
              <div
                style={{
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "10px",
                  letterSpacing: "0.5px",
                  color: "var(--cm-grey, #70706b)",
                  borderTop: "1px solid var(--cm-line, #2a2a27)",
                  paddingTop: "10px",
                }}
              >
                VIBE: <span style={{ color: "#d1d5db" }}>{option.visualVibe}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Make Your Own Customizer Panel */}
      {selectedId === "make-your-own" && (
        <div
          style={{
            backgroundColor: "#171716",
            border: "1px solid var(--cm-line, #2a2a27)",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--cm-mono, monospace)",
              fontSize: "11px",
              color: "var(--cm-lime, #d8ff3e)",
              letterSpacing: "2px",
              marginBottom: "12px",
            }}
          >
            CUSTOM FRONT IDENTITY PROFILE
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label
                htmlFor="custom-front-name"
                style={{
                  display: "block",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "11px",
                  color: "var(--cm-paper, #f2ebdd)",
                  marginBottom: "6px",
                }}
              >
                BUSINESS / CONTRACTOR NAME *
              </label>
              <input
                id="custom-front-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={40}
                placeholder="e.g. METRO ELECTRICAL CORP"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "#0d0d0c",
                  border: "1px solid var(--cm-line, #2a2a27)",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  color: "var(--cm-paper, #f2ebdd)",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "14px",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="custom-front-tagline"
                style={{
                  display: "block",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "11px",
                  color: "var(--cm-paper, #f2ebdd)",
                  marginBottom: "6px",
                }}
              >
                SERVICE TAGLINE (OPTIONAL)
              </label>
              <input
                id="custom-front-tagline"
                type="text"
                value={customTagline}
                onChange={(e) => setCustomTagline(e.target.value)}
                maxLength={60}
                placeholder="e.g. 24/7 Industrial & Commercial Maintenance"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "#0d0d0c",
                  border: "1px solid var(--cm-line, #2a2a27)",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  color: "var(--cm-paper, #f2ebdd)",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          {/* Palette pickers */}
          <div>
            <span
              style={{
                display: "block",
                fontFamily: "var(--cm-mono, monospace)",
                fontSize: "11px",
                color: "var(--cm-grey, #70706b)",
                marginBottom: "8px",
              }}
            >
              IDENTITY COLOR PALETTE
            </span>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "12px",
                  color: "var(--cm-paper, #f2ebdd)",
                }}
              >
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    backgroundColor: "transparent",
                  }}
                />
                <span>Panel Base: {customBg}</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "12px",
                  color: "var(--cm-paper, #f2ebdd)",
                }}
              >
                <input
                  type="color"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    backgroundColor: "transparent",
                  }}
                />
                <span>Accent Color: {customAccent}</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "var(--cm-mono, monospace)",
                  fontSize: "12px",
                  color: "var(--cm-paper, #f2ebdd)",
                }}
              >
                <input
                  type="color"
                  value={customInk}
                  onChange={(e) => setCustomInk(e.target.value)}
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    backgroundColor: "transparent",
                  }}
                />
                <span>Ink / Text: {customInk}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Surprise Me Notice */}
      {selectedId === "surprise-me" && (
        <div
          style={{
            backgroundColor: "#171716",
            border: "1px dashed var(--cm-lime, #d8ff3e)",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <Sparkles size={24} color="var(--cm-lime, #d8ff3e)" />
          <p
            style={{
              margin: 0,
              fontFamily: "var(--cm-mono, monospace)",
              fontSize: "12px",
              color: "var(--cm-paper, #f2ebdd)",
            }}
          >
            DISPATCH PROTOCOL // A random verified house front preset will be
            assigned and rendered when you open the forgery garage. Plausible, untraceable, and ready to print.
          </p>
        </div>
      )}

      {/* Confirmation CTA Row */}
      <div
        className="cm-cta-row"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {onBack ? (
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back to Yard
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirm}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px",
            fontSize: "14px",
          }}
        >
          <span>Confirm Front &amp; Open Garage</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
