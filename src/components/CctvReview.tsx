import { useEffect, useState } from "react";
import type { CameraReceipt } from "../world/receipts";
import checkpointPlate from "../assets/world/port-vice-checkpoint.png";
import serviceVehicleCutout from "../assets/world/service-vehicle.png";

interface CctvReviewProps {
  receipts: readonly [CameraReceipt, CameraReceipt, CameraReceipt];
  alreadyBurned: boolean;
  onCompleteReview: () => void;
  onClose: () => void;
}

export default function CctvReview({
  receipts,
  alreadyBurned,
  onCompleteReview,
  onClose,
}: CctvReviewProps) {
  const [index, setIndex] = useState(0);
  const [maxViewed, setMaxViewed] = useState(0);
  const [inReveal, setInReveal] = useState(false);
  const [firstBurn, setFirstBurn] = useState(false);
  const current = receipts[index];
  const cameraLabels = ["CAM 04 // VEHICLE", "CAM 11 // GATE", "CAM 19 // DOCK"] as const;
  const currentCameraLabel = cameraLabels[index] ?? cameraLabels[0];

  const handleNext = () => {
    if (index < receipts.length - 1) {
      const next = index + 1;
      setIndex(next);
      setMaxViewed((prev) => Math.max(prev, next));
    } else {
      setInReveal(true);
      if (!alreadyBurned) {
        setFirstBurn(true);
        onCompleteReview();
      }
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="cm-cctv-modal" role="dialog" aria-modal="true" aria-label="Vice County Watch Visual Trace">
      <div className="cm-cctv-shell">
        <header className="cm-cctv-header">
          <div>
            <p className="cm-kicker">COVER//01 // evidence correlation</p>
            <h2 className="cm-cctv-title">Three Matches. One Visual Signature.</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close surveillance trace"
          >
            Esc // Close
          </button>
        </header>

        {!inReveal ? (
          <div className="cm-cctv-body">
            <div className="cm-cctv-frame-container">
              {/* Camera Plate View with CCTV Post-Processing */}
              <div
                className={`cm-cctv-frame cm-cctv-frame--${current.cameraAngle}`}
                style={{ backgroundImage: `url(${checkpointPlate})` }}
              >
                {/* CCTV HUD scanline & reticle overlay */}
                <div className="cm-cctv-hud-overlay">
                  <div className="cm-cctv-reticle" />
                  <div className="cm-cctv-rec-badge">
                    <span className="cm-rec-dot" /> REC [LIVE FEED]
                  </div>
                  <div className="cm-cctv-id-tag">{currentCameraLabel}</div>
                  <div className="cm-cctv-time-tag">{current.timestamp}</div>
                </div>

                {/* Composited Vehicle with exact mission COVER//01 snapshot */}
                <div className={`cm-cctv-vehicle cm-cctv-vehicle--${current.cameraAngle}`}>
                  <img
                    src={serviceVehicleCutout}
                    alt="Target vehicle"
                    className="cm-cctv-vehicle-img"
                    draggable={false}
                  />
                  <div className="cm-cctv-vehicle-cover">
                    <img src={current.coverImage} alt="Vehicle disguise" draggable={false} />
                  </div>
                </div>
              </div>

              {/* Navigation Indicators */}
              <div className="cm-cctv-pips">
                {receipts.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`cm-cctv-pip ${i === index ? "is-active" : i <= maxViewed ? "is-seen" : ""}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to ${cameraLabels[i]}`}
                  >
                    {cameraLabels[i]}
                  </button>
                ))}
              </div>
            </div>

            {/* Metadata Sidebar */}
            <aside className="cm-cctv-meta">
              <div className="cm-cctv-meta-card">
                <span className="cm-meta-label">Source</span>
                <p className="cm-meta-value">{current.source}</p>
              </div>

              <div className="cm-cctv-meta-card">
                <span className="cm-meta-label">Location</span>
                <p className="cm-meta-value">{current.location}</p>
              </div>

              <div className="cm-cctv-meta-card">
                <span className="cm-meta-label">Match Confidence</span>
                <div className="cm-meta-confidence-row">
                  <span className="cm-meta-value accent">{current.confidence}%</span>
                  <span className="cm-meta-status">{current.status}</span>
                </div>
                <div className="cm-meta-meter">
                  <div
                    className="cm-meta-meter-fill"
                    style={{ width: `${current.confidence}%` }}
                  />
                </div>
              </div>

              <div className="cm-cctv-meta-card">
                <span className="cm-meta-label">Visual Profile</span>
                <ul className="cm-meta-list">
                  <li>{current.visualProfile.colorMatch}</li>
                  <li>{current.visualProfile.identitySignal}</li>
                  <li>{current.visualProfile.serviceDetail}</li>
                  <li>{current.visualProfile.surfaceAge}</li>
                </ul>
              </div>

              <div className="cm-cctv-action-row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handlePrev}
                  disabled={index === 0}
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNext}
                >
                  {index === receipts.length - 1 ? "Correlate Signature ▶" : "Next Match ▶"}
                </button>
              </div>
            </aside>
          </div>
        ) : (
          /* The Reveal: COVER//01 STATUS // BURNED */
          <div className="cm-cctv-reveal">
            <div className="cm-reveal-content">
              <div className="cm-reveal-badge">
                <span className="cm-reveal-dot" /> MATCH FOUND // EXPOSURE CONFIRMED
              </div>
              <h3 className="cm-reveal-heading">
                COVER//01 <span className="accent-red">— BURNED</span>
              </h3>

              <div className="cm-reveal-quote">
                <p className="cm-quote-main">IT WORKED ONCE.</p>
                <p className="cm-quote-sub">USE IT AGAIN AND THEY'LL KNOW WHAT TO LOOK FOR.</p>
              </div>

              <p className="cm-reveal-watchlist">
                {alreadyBurned && !firstBurn
                  ? "VISUAL SIGNATURE ON WATCHLIST."
                  : "VISUAL SIGNATURE ADDED TO WATCHLIST. HEAT +10 APPLIED."}
              </p>

              <div className="cm-reveal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setInReveal(false)}
                >
                  Review Matches
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                >
                  Acknowledge // Return to 305
                </button>
              </div>
            </div>

            <div className="cm-reveal-evidence">
              <span className="cm-meta-label">Compromised Disguise Artifact</span>
              <div className="cm-reveal-cover-frame">
                <img src={current.coverImage} alt="Burned cover graphic" />
                <div className="cm-burned-stamp">BURNED</div>
              </div>
              <span className="cm-meta-sub">Historical capture // Checkpoint analysis: {current.analysisScore}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
