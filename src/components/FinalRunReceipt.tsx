import { useState, useMemo } from "react";
import {
  type RunReceipt,
  buildRunReceipt,
  downloadRunReceiptPng,
} from "../lib/runReceipt";
import type { CheckpointBranch } from "../world/mission";
import type { ChosenFrontRecord } from "../lib/fronts";
import type { CreativeMetrics } from "../lib/creativeMetrics";

export interface FinalRunReceiptProps {
  /** Optional pre-built immutable RunReceipt. */
  receipt?: RunReceipt | null;
  /** Cover 01 image data URL (burned). */
  cover01Image?: string | null;
  /** Cover 02 image data URL (active). */
  cover02Image?: string | null;
  /** Measured signature / visual distance between Cover 01 and Cover 02 (e.g. 78%). */
  visualDistance?: number | null;
  /** Port Vice gate checkpoint outcome. */
  checkpoint?: CheckpointBranch | string | null;
  /** Final heat level after all consequences. */
  heat?: number;
  /** Chosen front metadata if available. */
  front?: ChosenFrontRecord | null;
  /** Authored creative metrics if available. */
  metrics?: CreativeMetrics | null;
  /** Trigger a fresh run from 305 Print & Sign. */
  onNewRun?: () => void;
  /** Return to yard view. */
  onReturnToYard?: () => void;
}

export default function FinalRunReceipt({
  receipt,
  cover01Image,
  cover02Image,
  visualDistance,
  checkpoint = "clean",
  heat = 24,
  front,
  metrics,
  onNewRun,
  onReturnToYard,
}: FinalRunReceiptProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Synthesize or reuse the immutable receipt record for rendering and PNG download
  const effectiveReceipt: RunReceipt = useMemo(() => {
    if (receipt) return receipt;

    const primaryDataUrl = cover02Image || cover01Image || "";
    const resolvedFront: ChosenFrontRecord = front ?? {
      schemaVersion: 1,
      requestedFrontId: "pool-service",
      resolvedFrontId: "pool-service",
      customProfile: null,
      selectedAt: new Date().toISOString(),
    };

    return buildRunReceipt({
      runId: "RUN//01",
      front: resolvedFront,
      coverVersion: cover02Image ? "COVER//02" : "COVER//01",
      coverDataUrl: primaryDataUrl,
      metrics: metrics ?? null,
      checkpoint: (checkpoint as CheckpointBranch) ?? "clean",
      signatureDistance: visualDistance ?? 82,
      heat: heat ?? 24,
      missionStartedAt: "22:14:00",
      missionCompletedAt: "22:18:30",
      receiptsReviewedAt: "22:20:15",
    });
  }, [receipt, cover01Image, cover02Image, visualDistance, checkpoint, heat, front, metrics]);

  const activeCoverUrl = cover02Image || (effectiveReceipt.coverVersion === "COVER//02" ? effectiveReceipt.coverDataUrl : null);
  const burnedCoverUrl = cover01Image || effectiveReceipt.cover01DataUrl || (effectiveReceipt.coverVersion === "COVER//01" ? effectiveReceipt.coverDataUrl : null);
  const finalHeat = heat ?? effectiveReceipt.heat ?? 0;
  const displayDistance = visualDistance ?? (effectiveReceipt.signatureDistance ? Math.round(effectiveReceipt.signatureDistance) : 82);
  const checkpointRaw = checkpoint ?? effectiveReceipt.checkpoint ?? "clean";
  const checkpointNormalized = typeof checkpointRaw === "string" ? checkpointRaw.toUpperCase() : "CLEAN";
  const handleSave = async () => {
    setDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadRunReceiptPng(effectiveReceipt, {
        filename: `crewmark-receipt-${effectiveReceipt.receiptId.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}`,
      });
      setDownloadSuccess(true);
      window.setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error("[crewmark] Failed to download run receipt PNG:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyShare = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(effectiveReceipt.shareText);
        setCopyStatus("COPIED TO CLIPBOARD");
      } else {
        setCopyStatus("CLIPBOARD UNAVAILABLE");
      }
    } catch {
      setCopyStatus("FAILED TO COPY");
    }
    window.setTimeout(() => setCopyStatus(null), 2500);
  };

  return (
    <section className="cm-screen cm-final-receipt" aria-label="Final Run Receipt">
      <div className="cm-final-receipt-header">
        <p className="cm-kicker">CREW//MARK // RUN RECEIPT</p>
        <h1 className="cm-title">
          RUN LOGGED.
          <br />
          <span className="accent">IMMUTABLE RECEIPT.</span>
        </h1>
        <p className="cm-receipt-id-tag">
          {effectiveReceipt.receiptId} &bull; {effectiveReceipt.runId} &bull; {effectiveReceipt.front.resolvedFrontId.toUpperCase()}
        </p>
      </div>

      {/* Diegetic core theme quote */}
      <div className="cm-receipt-quote-banner" role="note">
        <p className="cm-receipt-quote-text">
          &ldquo;THE FIRST LIE GOT YOU IN. THE SECOND ONE KEPT YOU MOVING.&rdquo;
        </p>
        <span className="cm-receipt-quote-sub">305 PRINT &amp; SIGN // AFTER-HOURS LOG // RUN SUMMARY</span>
      </div>

      {/* Dual Cover Comparison Section */}
      <div className="cm-receipt-covers-grid">
        {/* Cover 01 - Burned */}
        <div className="cm-receipt-cover-card burned">
          <div className="cm-receipt-cover-header">
            <span className="cm-receipt-cover-label">COVER//01</span>
            <span className="cm-receipt-cover-badge burned">BURNED</span>
          </div>
          <div className="cm-receipt-thumb-wrap">
            {burnedCoverUrl ? (
              <img
                src={burnedCoverUrl}
                alt="Burned COVER//01 livery"
                className="cm-receipt-thumb-img burned"
                draggable={false}
              />
            ) : (
              <div className="cm-receipt-thumb-placeholder burned">
                <span>COVER//01 // BURNED</span>
                <span className="dim">COMPROMISED ON CITY CCTV</span>
              </div>
            )}
            <div className="cm-receipt-stamp burned">FLAGGED BY VCW</div>
          </div>
          <p className="cm-receipt-cover-note">
            Visual signature indexed by Vice County Watch surveillance. Compromised at Port Vice gate scan.
          </p>
        </div>

        {/* Cover 02 - Active */}
        <div className="cm-receipt-cover-card active">
          <div className="cm-receipt-cover-header">
            <span className="cm-receipt-cover-label">COVER//02</span>
            <span className="cm-receipt-cover-badge active">ACTIVE</span>
          </div>
          <div className="cm-receipt-thumb-wrap">
            {activeCoverUrl ? (
              <img
                src={activeCoverUrl}
                alt="Active COVER//02 livery"
                className="cm-receipt-thumb-img active"
                draggable={false}
              />
            ) : (
              <div className="cm-receipt-thumb-placeholder active">
                <span>COVER//02 // ACTIVE</span>
                <span className="dim">ROTATED REPLACEMENT</span>
              </div>
            )}
            <div className="cm-receipt-stamp active">CLEARANCE SECURED</div>
          </div>
          <p className="cm-receipt-cover-note">
            New contractor disguise printed at 305 Print &amp; Sign. Visual distance exceeds recognition threshold.
          </p>
        </div>
      </div>

      {/* Run Summary Metric Badges */}
      <div className="cm-receipt-metrics-grid">
        <div className="cm-receipt-stat">
          <span className="cm-receipt-stat-label">VISUAL DISTANCE</span>
          <span className="cm-receipt-stat-value accent">{`${displayDistance}%`}</span>
          <span className="cm-receipt-stat-sub">
            {displayDistance >= 55 ? "ROTATED BEYOND VCW THRESHOLD (>55%)" : "MARGINAL VARIANCE"}
          </span>
        </div>

        <div className="cm-receipt-stat">
          <span className="cm-receipt-stat-label">PORT VICE</span>
          <span className="cm-receipt-stat-value blue">
            {`CLEARED (${checkpointNormalized})`}
          </span>
          <span className="cm-receipt-stat-sub">
            {checkpointNormalized === "CLEAN"
              ? "AUTOMATED SCAN PASSED CLEANLY"
              : checkpointNormalized === "SECONDARY"
                ? "SECONDARY INSPECTION SURVIVED"
                : "MANUAL CLEARANCE LOGGED"}
          </span>
        </div>

        <div className="cm-receipt-stat">
          <span className="cm-receipt-stat-label">HEAT</span>
          <span className={`cm-receipt-stat-value ${finalHeat > 35 ? "hot" : ""}`}>
            {finalHeat}
          </span>
          <span className="cm-receipt-stat-sub">
            {finalHeat > 35 ? "ELEVATED METROPOLITAN ATTENTION" : "LOCALIZED PATROL LEVEL"}
          </span>
        </div>

        {effectiveReceipt.metrics && (
          <div className="cm-receipt-stat">
            <span className="cm-receipt-stat-label">COVER READINESS</span>
            <span className="cm-receipt-stat-value">
              {effectiveReceipt.metrics.coverReadiness}/100
            </span>
            <span className="cm-receipt-stat-sub">
              CITY ATTENTION: {effectiveReceipt.metrics.cityAttention}
            </span>
          </div>
        )}
      </div>

      {/* Shareable string preview */}
      <div className="cm-receipt-share-box">
        <div className="cm-receipt-share-header">
          <span className="cm-sys">SHARE TEXT // IMMUTABLE RECORD</span>
          {copyStatus ? (
            <span className="cm-receipt-copy-feedback">{copyStatus}</span>
          ) : (
            <button
              type="button"
              className="btn btn-ghost cm-receipt-copy-btn"
              onClick={handleCopyShare}
            >
              COPY
            </button>
          )}
        </div>
        <p className="cm-receipt-share-text">{effectiveReceipt.shareText}</p>
      </div>

      {/* Actions */}
      <div className="cm-cta-row cm-receipt-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={downloading}
        >
          {downloading
            ? "RENDERING PNG..."
            : downloadSuccess
              ? "RECEIPT SAVED!"
              : "SAVE RUN RECEIPT"}
        </button>

        {onNewRun && (
          <button type="button" className="btn btn-ghost" onClick={onNewRun}>
            NEW RUN
          </button>
        )}

        {onReturnToYard && (
          <button type="button" className="btn btn-ghost" onClick={onReturnToYard}>
            BACK TO 305 YARD
          </button>
        )}
      </div>

      <p className="cm-hint">
        Receipt captures the active disguise, gate outcome, and visual distance. PNG renders in high-resolution 1600&times;1000 dark terminal format.
      </p>
    </section>
  );
}
