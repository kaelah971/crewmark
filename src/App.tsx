import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import MarkStudio from "./components/MarkStudio";
const CoverInspection3D = lazy(() => import("./components/CoverInspection3D"));
const Prototype3DYard = lazy(() => import("./components/Prototype3DYard"));
import Landing from "./components/Landing";
import IdentityReveal, { type RevealBeat } from "./components/IdentityReveal";
import WorldIntro from "./components/WorldIntro";
import JobYard from "./components/JobYard";
import ForgeryBay from "./components/ForgeryBay";
import FrontTerminal from "./components/FrontTerminal";
import FinalRunReceipt from "./components/FinalRunReceipt";
import PrintApply from "./components/PrintApply";
import Mission from "./components/Mission";
import checkpointPlate from "./assets/world/port-vice-checkpoint.png";
import DistrictSelect from "./components/DistrictSelect";
import WallClaim from "./components/WallClaim";
import CityReaction from "./components/CityReaction";
import Surveillance from "./components/Surveillance";
import IdentityTheft from "./components/IdentityTheft";
import MarkEvolution from "./components/MarkEvolution";
import MarkV2Reveal from "./components/MarkV2Reveal";
import type { WallPlacement } from "./components/WallScene";
import { createBlankMarkDataUrl } from "./lib/blankMark";
import { analyzeAlpha, type AlphaReport } from "./lib/markAlpha";
import { clearMark, clearMarkV2, loadMark, loadMarkV2, saveMark, saveMarkV2 } from "./lib/markStorage";
import {
  clearProgress,
  EMPTY_PROGRESS,
  loadProgress,
  saveProgress,
  type ProgressState,
  type StoryEvent,
} from "./lib/progressStorage";
import { clearJob01Accepted, loadJob01Accepted, saveJob01Accepted } from "./lib/jobStorage";
import {
  clearCoverRecord,
  loadCoverRecord,
  loadCover02Record,
  saveCoverRecord,
  saveCover02Record,
  resolveActiveCover,
  type CoverRecord,
  type Cover02Record,
} from "./lib/coverStorage";
import {
  loadChosenFront,
  saveChosenFront,
  clearChosenFront,
  type ChosenFrontRecord,
} from "./lib/fronts";
import type { CreativeMetrics } from "./lib/creativeMetrics";
import {
  buildRunReceipt,
  clearRunReceipt,
  loadRunReceipt,
  saveRunReceipt,
  type RunReceipt,
} from "./lib/runReceipt";
import type { VisualSignatureComparison } from "./lib/signatureComparison";
import { createCoverStarterDataUrl } from "./lib/coverCanvas";
import type { CoverAnalysis } from "./lib/coverAnalysis";
import type { CoverTemplateId } from "./lib/coverTemplates";
import { getDistrict, type DistrictId } from "./lib/districts";
import { resolveCanonicalResumeStage, resolveResumeTarget } from "./lib/resume";
import { clearMission, loadMission, saveMission } from "./lib/missionStorage";
import { clearReceiptState, loadReceiptState, saveReceiptState } from "./lib/receiptStorage";
import {
  BURN_HEAT_CONSEQUENCE,
  EMPTY_RECEIPT_STATE,
  generateReceipts,
  shouldPayBurnHeat,
  withBurnHeatPaid,
  withReceiptsReviewed,
  type ReceiptState,
} from "./world/receipts";
import {
  CHECKPOINT_HEAT,
  MISSION_REP_REWARD,
  resumeMissionPhase,
  shouldPayCheckpointHeat,
  shouldPayCompletion,
  startMissionState,
  withCheckpoint,
  withCheckpointHeatPaid,
  withCompleted,
  withRepPaid,
  type CheckpointBranch,
  type MissionState,
} from "./world/mission";
import { deriveVehicleLivery } from "./lib/vehicleLivery";
import VehicleEditor from "./components/VehicleEditor";
import {
  type DisguisePackage,
  type DisguisePackageSlot,
  loadDisguisePackage,
  createDisguisePackage,
  replaceDisguisePackage,
  clearDisguisePackage,
  clearDisguisePackages,
  DEFAULT_CLEAN_VEHICLE_LIVERY,
} from "./lib/disguisePackage";

export type Stage =
  | "landing"
  | "studio"
  | "world-intro"
  | "job-yard"
  | "front-terminal"
  | "forgery-bay"
  | "vehicle-editor"
  | "print-apply"
  | "mission"
  | "final-run-receipt"
  | "3d-yard"
  | "cover-inspection"
  | "identity-reveal"
  | "district-select"
  | "wall-claim"
  | "city-reaction"
  | "surveillance"
  | "identity-theft"
  | "mark-evolution"
  | "mark-v2-reveal";

const STAGE_TAGS: Record<Stage, string> = {
  landing: "ENTRY",
  studio: "STUDIO",
  "world-intro": "YARD",
  "job-yard": "PRINT & SIGN",
  "front-terminal": "FRONT",
  "forgery-bay": "FORGERY",
  "vehicle-editor": "CUSTOM BAY",
  "print-apply": "PRINT",
  mission: "PORT VICE",
  "final-run-receipt": "RECEIPT",
  "3d-yard": "3D YARD",
  "cover-inspection": "INSPECTION",
  "identity-reveal": "IDENTITY",
  "district-select": "DISTRICTS",
  "wall-claim": "WALL//001",
  "city-reaction": "CITY",
  surveillance: "V.C.W.",
  "identity-theft": "UNKNOWN",
  "mark-evolution": "RECOVERY",
  "mark-v2-reveal": "MARK//002",
};

/** Deterministic P3 heat consequences. Paid once each, guarded by event flags. */
const EVENT_HEAT: Record<StoryEvent, number> = {
  surveillanceTriggered: 18,
  identityTheftTriggered: 12,
};

function initialProgress(): ProgressState {
  // Progress without a stored mark is orphaned — start clean instead of
  // resurrecting stale territory after a reset.
  if (loadMark() === null) {
    return { ...EMPTY_PROGRESS, claims: [], events: { ...EMPTY_PROGRESS.events } };
  }
  const loaded = loadProgress();
  if (!loaded) {
    return { ...EMPTY_PROGRESS, claims: [], events: { ...EMPTY_PROGRESS.events } };
  }
  return loaded;
}

export default function App() {
  // Source of truth for the saved artwork; mirrored to localStorage.
  const [markV1, setMarkV1] = useState<string | null>(() => loadMark());
  // Evolved MARK//002 in its own slot — MARK//001 is never overwritten.
  const [markV2, setMarkV2] = useState<string | null>(() => loadMarkV2());
  const [stage, setStage] = useState<Stage>(() => {
    if (typeof window !== "undefined" && (window.location.pathname === "/3d-yard" || window.location.hash === "#/3d-yard")) {
      return "3d-yard";
    }
    return "landing";
  });
  // Bumped on RESET so the studio mounts a genuinely fresh editor.
  const [studioKey, setStudioKey] = useState(0);
  const [persistWarning, setPersistWarning] = useState(false);
  // Runtime alpha proof for the current mark (null = not yet analyzed).
  const [alpha, setAlpha] = useState<AlphaReport | null>(null);
  // Same transparency proof for the evolved mark.
  const [alphaV2, setAlphaV2] = useState<AlphaReport | null>(null);
  // Fresh cinematic run per lock; the studio shortcut can jump to the board.
  const [revealSession, setRevealSession] = useState(0);
  const [revealEntry, setRevealEntry] = useState<RevealBeat>(0);
  // P3.5A-R job intake: JOB//01 acceptance persists across refresh.
  // Old saves simply load unaccepted — no migration, no erased state.
  const [job01Accepted, setJob01Accepted] = useState<boolean>(() => loadJob01Accepted());
  // P3.5A-R.2 cover state: locked image + analysis, separate slots.
  // P3.5A-R.2 & P3.5A-R.5 cover state: locked image + analysis, separate slots.
  const [cover, setCover] = useState<CoverRecord | null>(() => loadCoverRecord());
  const [cover02, setCover02] = useState<Cover02Record | null>(() => loadCover02Record());
  const [missionState, setMissionState] = useState<MissionState | null>(() => loadMission());
  // P3.5A-R.4 receipt state: CCTV review, burned cover flag, consequence heat.
  const [receiptState, setReceiptState] = useState<ReceiptState>(() => loadReceiptState());
  // P6 Creative Playground: chosen front and final run receipt state.
  const [chosenFront, setChosenFront] = useState<ChosenFrontRecord | null>(() => loadChosenFront());
  const [activePackage, setActivePackage] = useState<DisguisePackage | null>(() =>
    cover02?.disguisePackage ?? (receiptState.cover01Burned ? null : cover?.disguisePackage ?? null),
  );
  const [runReceipt, setRunReceipt] = useState<RunReceipt | null>(() => loadRunReceipt());
  const [progress, setProgress] = useState<ProgressState>(initialProgress);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);
  // Frozen placement of the most recent commit (phone-photo evidence).
  const [lastPlacement, setLastPlacement] = useState<WallPlacement | null>(null);

  // Local transparent 1024x1024 starter canvas (PNG data URL, zero network/CORS risk).
  const blankMark = useMemo(() => {
    try {
      return createBlankMarkDataUrl();
    } catch (err) {
      console.error("[crewmark] Could not build the transparent starter canvas:", err);
      return null;
    }
  }, []);

  // Surveillance camera receipts derived deterministically from the completed mission snapshot.
  const receipts = useMemo(() => {
    if (!missionState?.completed || !missionState.snapshot) return null;
    return generateReceipts(missionState.snapshot, missionState.checkpoint);
  }, [missionState]);
  // Active vehicle cover resolver: COVER//02 outranks burned COVER//01.
  const activeCover = useMemo(
    () => resolveActiveCover(cover, cover02, receiptState.cover01Burned),
    [cover, cover02, receiptState.cover01Burned],
  );

  const activeVehicleLivery = useMemo(() => {
    if (activePackage) return activePackage.vehicleLivery;
    if (!activeCover) return DEFAULT_CLEAN_VEHICLE_LIVERY;
    return deriveVehicleLivery(activeCover.image, chosenFront?.resolvedFrontId);
  }, [activePackage, activeCover, chosenFront?.resolvedFrontId]);

  const cover01VehicleLivery = useMemo(
    () => (cover?.vehicleLivery ?? (cover ? deriveVehicleLivery(cover.image, chosenFront?.resolvedFrontId) : null)),
    [cover, chosenFront?.resolvedFrontId],
  );
  const cover02VehicleLivery = useMemo(
    () => (cover02?.vehicleLivery ?? (cover02 ? deriveVehicleLivery(cover02.image, chosenFront?.resolvedFrontId) : null)),
    [cover02, chosenFront?.resolvedFrontId],
  );
  // Blank vinyl starter panel or existing cover data URL for the forgery bay.
  const coverStarter = useMemo(() => {
    if (cover02) return cover02.image;
    if (cover) return cover.image;
    try {
      return createCoverStarterDataUrl();
    } catch (err) {
      console.error("[crewmark] Could not build the cover starter panel:", err);
      return null;
    }
  }, [cover, cover02]);

  // Re-editing reloads the saved artwork into the editor (via `image` prop).
  const startImage = markV1 ?? blankMark;

  // Re-analyze alpha whenever the saved mark changes (commit, refresh load, reset).
  useEffect(() => {
    let live = true;
    if (!markV1) {
      setAlpha(null);
      return;
    }
    setAlpha(null);
    analyzeAlpha(markV1).then((report) => {
      if (!live) return;
      setAlpha(report);
      if (report) {
        console.info("[crewmark] Saved-output alpha report:", report);
      }
    });
    return () => {
      live = false;
    };
  }, [markV1]);

  // Re-analyze alpha whenever the evolved mark changes.
  useEffect(() => {
    let live = true;
    if (!markV2) {
      setAlphaV2(null);
      return;
    }
    setAlphaV2(null);
    analyzeAlpha(markV2).then((report) => {
      if (!live) return;
      setAlphaV2(report);
      if (report) {
        console.info("[crewmark] MARK//002 alpha report:", report);
      }
    });
    return () => {
      live = false;
    };
  }, [markV2]);

  // Persist progress whenever it changes (only meaningful with a mark).
  useEffect(() => {
    if (markV1) saveProgress(progress);
  }, [markV1, progress]);

  const enterReveal = (entry: RevealBeat) => {
    setRevealEntry(entry);
    setRevealSession((s) => s + 1);
    setStage("identity-reveal");
  };

  const handleCommit = (dataUrl: string) => {
    setMarkV1(dataUrl);
    const persisted = saveMark(dataUrl);
    setPersistWarning(!persisted);
    // P3.5A-R: a fresh mark spawns the player in the job yard. The legacy
    // world-intro and cinematic IdentityReveal stay reachable via
    // resume/board shortcuts.
    setStage("job-yard");
  };

  /** JOB//01 acceptance: persist the flag; objectives flip immediately. */
  const handleAcceptJob = () => {
    saveJob01Accepted();
    setJob01Accepted(true);
    console.info("[crewmark] JOB//01 accepted.");
  };

  /** MARK//002 lock: validated evolved output into its own slot, V1 untouched. */
  const handleEvolutionCommit = (dataUrl: string) => {
    setMarkV2(dataUrl);
    const persisted = saveMarkV2(dataUrl);
    setPersistWarning(!persisted);
    console.info("[crewmark] MARK//002 locked; MARK//001 preserved.", {
      length: dataUrl.length,
    });
    setStage("mark-v2-reveal");
  };

  const handleArtworkSelection = (
    dataUrl: string,
    templateId: CoverTemplateId | null,
    slot: DisguisePackageSlot,
  ) => {
    const pkg = createDisguisePackage(dataUrl, templateId, chosenFront?.resolvedFrontId, undefined, slot);
    const persisted = replaceDisguisePackage(slot, pkg);
    setActivePackage(pkg);
    setPersistWarning(!persisted);
  };

  const packageForCommit = (dataUrl: string, slot: DisguisePackageSlot): DisguisePackage => {
    const current = activePackage?.slot === slot ? activePackage : loadDisguisePackage(slot);
    return createDisguisePackage(
      dataUrl,
      current?.templateId ?? null,
      current?.identityMetadata.frontId ?? chosenFront?.resolvedFrontId,
      current?.customization,
      slot,
    );
  };

  /** COVER//01 lock: validated output + fresh analysis + creative metrics into own slots. */
  const handleCoverCommit = (
    dataUrl: string,
    analysis: CoverAnalysis,
    metrics?: CreativeMetrics,
  ) => {
    const lockedAt = new Date().toISOString();
    const updatedPkg = packageForCommit(dataUrl, "COVER//01");
    const persisted = saveCoverRecord(dataUrl, analysis, lockedAt, updatedPkg);
    setActivePackage(updatedPkg);
    setCover({
      image: dataUrl,
      analysis,
      lockedAt,
      templateId: updatedPkg.templateId,
      disguisePackage: updatedPkg,
      vehicleLivery: updatedPkg.vehicleLivery,
    });
    setPersistWarning(!persisted);
    console.info("[crewmark] COVER//01 locked with linked disguise package.", {
      score: analysis.score,
      blank: analysis.blank,
      readiness: metrics?.coverReadiness,
      attention: metrics?.cityAttention,
    });
    setStage("print-apply");
  };
  /** COVER//02 lock: validated rotated output + fresh analysis + signature comparison + receipt. */
  const handleCover02Commit = (
    dataUrl: string,
    analysis: CoverAnalysis,
    signature: VisualSignatureComparison,
    metrics?: CreativeMetrics,
  ) => {
    const lockedAt = new Date().toISOString();
    const updatedPkg = packageForCommit(dataUrl, "COVER//02");
    const persisted = saveCover02Record(dataUrl, analysis, signature, lockedAt, updatedPkg);
    setActivePackage(updatedPkg);
    setCover02({
      image: dataUrl,
      analysis,
      signature,
      lockedAt,
      templateId: updatedPkg.templateId,
      disguisePackage: updatedPkg,
      vehicleLivery: updatedPkg.vehicleLivery,
    });
    setPersistWarning(!persisted);
    console.info("[crewmark] COVER//02 locked with linked disguise package.", {
      distance: signature.signatureDistance,
      cityMatch: signature.cityMatchEstimate,
    });
    if (chosenFront && metrics) {
      const receipt = buildRunReceipt({
        runId: `run-${Date.now().toString(36)}`,
        front: chosenFront,
        coverVersion: "COVER//02",
        coverDataUrl: dataUrl,
        cover01DataUrl: cover?.image ?? null,
        metrics,
        checkpoint: missionState?.checkpoint ?? "clean",
        signatureDistance: signature.signatureDistance,
        heat: progress.heat,
        missionStartedAt: missionState?.snapshot?.startedAt ?? lockedAt,
        missionCompletedAt: lockedAt,
        receiptsReviewedAt: receiptState.burnedAt ?? lockedAt,
        completedAt: lockedAt,
      });
      saveRunReceipt(receipt);
      setRunReceipt(receipt);
    }

    setStage("print-apply");
  };
  const handleStartJob = () => {
    if (!cover) return;
    const nextMission = startMissionState(cover, cover.disguisePackage ?? activePackage ?? undefined);
    const persisted = saveMission(nextMission);
    setMissionState(nextMission);
    setPersistWarning(!persisted);
    console.info("[crewmark] JOB//01 mission started with frozen disguise package snapshot.", {
      score: nextMission.snapshot?.score,
    });
    setStage("mission");
  };

  /** Checkpoint outcome: pays HEAT once, idempotently. */
  const handleMissionCheckpoint = (branch: CheckpointBranch) => {
    if (!missionState) return;
    const withOutcome = withCheckpoint(missionState, branch);
    if (shouldPayCheckpointHeat(withOutcome)) {
      const heatGain = CHECKPOINT_HEAT[branch];
      const paid = withCheckpointHeatPaid(withOutcome);
      setMissionState(paid);
      saveMission(paid);
      setProgress((prev) => ({
        ...prev,
        heat: prev.heat + heatGain,
      }));
      console.info("[crewmark] Checkpoint heat applied.", { branch, heatGain });
    } else {
      console.info("[crewmark] Checkpoint heat already paid — no heat added.");
    }
  };

  const handleMissionComplete = () => {
    if (!missionState) return;
    const completedState = withCompleted(missionState);
    if (shouldPayCompletion(completedState)) {
      const paid = withRepPaid(completedState);
      setMissionState(paid);
      saveMission(paid);
      setProgress((prev) => ({
        ...prev,
        rep: prev.rep + MISSION_REP_REWARD,
      }));
      console.info("[crewmark] Mission completed. Rep reward paid.", {
        rep: MISSION_REP_REWARD,
      });
    } else {
      console.info("[crewmark] Mission completion reward already paid.");
    }
  };

  /** Return to 305 Print & Sign yard from mission result. */
  const handleMissionExit = () => {
    setStage("job-yard");
  };
  /** Review of CCTV surveillance receipts completed: mark burned and apply HEAT +10 idempotently. */
  const handleCompleteReceiptReview = () => {
    const reviewed = withReceiptsReviewed(receiptState);
    if (shouldPayBurnHeat(reviewed)) {
      const paid = withBurnHeatPaid(reviewed);
      setReceiptState(paid);
      saveReceiptState(paid);
      setProgress((prev) => ({
        ...prev,
        heat: prev.heat + BURN_HEAT_CONSEQUENCE,
      }));
      console.info("[crewmark] COVER//01 burned. Burn heat consequence applied.", {
        heatGain: BURN_HEAT_CONSEQUENCE,
      });
    } else {
      setReceiptState(reviewed);
      saveReceiptState(reviewed);
      console.info("[crewmark] Receipts reviewed — burn heat already paid.");
    }
    setActivePackage(cover02?.disguisePackage ?? null);
  };

  const handleReset = () => {
    clearMark();
    clearMarkV2();
    clearProgress();
    clearJob01Accepted();
    clearCoverRecord();
    clearMission();
    clearReceiptState();
    clearDisguisePackages();
    setActivePackage(null);
    clearChosenFront();
    clearRunReceipt();
    try {
      sessionStorage.removeItem("crewmark:yard-intro-seen");
    } catch {
      // ignore
    }
    setMarkV1(null);
    setJob01Accepted(false);
    setCover(null);
    setCover02(null);
    setChosenFront(null);
    setRunReceipt(null);
    setMissionState(null);
    setReceiptState(EMPTY_RECEIPT_STATE);
    setAlpha(null);
    setAlphaV2(null);
    setPersistWarning(false);
    setProgress({ ...EMPTY_PROGRESS, claims: [], events: { ...EMPTY_PROGRESS.events } });
    setSelectedDistrict(null);
    setLastPlacement(null);
    setStudioKey((k) => k + 1);
    setStage("landing");
  };
  /**
   * recorded claim. Re-entering an already-claimed wall can never pay twice —
   * WallClaim blocks the CTA, and this guard covers any other path.
   */
  const handleClaimCommit = (placement: WallPlacement) => {
    if (!selectedDistrict) return;
    const district = getDistrict(selectedDistrict);
    const already = progress.claims.some((c) => c.districtId === selectedDistrict);
    setLastPlacement(placement);
    if (!already) {
      const next: ProgressState = {
        rep: progress.rep + district.repReward,
        heat: progress.heat + district.heatRisk,
        territory: progress.territory + district.territoryGain,
        claims: [...progress.claims, { districtId: selectedDistrict, placement }],
        events: progress.events,
      };
      setProgress(next);
      console.info("[crewmark] Wall claimed:", {
        district: district.id,
        placement,
        rewards: {
          rep: district.repReward,
          heat: district.heatRisk,
          territory: district.territoryGain,
        },
      });
    } else {
      console.info("[crewmark] Revisit of claimed wall — no reward paid.", {
        district: district.id,
      });
    }
    setStage("city-reaction");
  };

  /**
   * P3 story-event heat. Idempotent by design: the functional update returns
   * the previous state untouched when the flag is already set, so replays,
   * skips, and StrictMode double-effects can never pay twice.
   */
  const applyEventHeat = (event: StoryEvent) => {
    const amount = EVENT_HEAT[event];
    setProgress((prev) => {
      if (prev.events[event]) {
        console.info("[crewmark] Story event already recorded — no heat paid.", { event });
        return prev;
      }
      console.info("[crewmark] Story event heat applied.", { event, heat: amount });
      return {
        ...prev,
        heat: prev.heat + amount,
        events: { ...prev.events, [event]: true },
      };
    });
  };

  const claimedIds = progress.claims.map((c) => c.districtId);
  const claimForSelected = progress.claims.find((c) => c.districtId === selectedDistrict) ?? null;
  const hud = { rep: progress.rep, heat: progress.heat, territory: progress.territory };
  const locationNames = progress.claims.map((c) => getDistrict(c.districtId).name.toUpperCase());

  return (
    <div className={`cm-shell${stage === "landing" ? " cm-shell--landing" : ""}`}>
      {stage !== "landing" && (
        <header className="cm-topbar">
          <p className="cm-brand">
            Crew<span>//</span>Mark
          </p>
          <p className="cm-sys">305 Print &amp; Sign // After-hours terminal</p>
          <p className="cm-stage-tag" aria-live="polite">
            {STAGE_TAGS[stage]}
          </p>
        </header>
      )}

      <main>
        {startImage === null ? (
          <section className="cm-screen" aria-label="Initialization failure">
            <p className="cm-kicker">Terminal fault</p>
            <h1 className="cm-title">
              No canvas <span className="accent">available.</span>
            </h1>
            <div className="cm-alert" role="alert">
              <span>
                The local starter canvas could not be built and no saved mark
                exists. See the console for diagnostics. Reload once canvas 2D
                is available.
              </span>
            </div>
          </section>
        ) : (
          <AnimatePresence mode="wait">
            {stage === "landing" && (
              <motion.div
                key="landing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <Landing
                  mark={markV1}
                  progress={progress}
                  onEnter={() => {
                    // Fresh canonical flow: Enter 305 -> 305 Print & Sign Garage (job-yard)
                    if (!markV1 && startImage) {
                      // Initialize mark placeholder if needed so yard mounts cleanly
                      saveMark(startImage);
                      setMarkV1(startImage);
                    }
                    setStage("job-yard");
                  }}
                  onContinue={() => {
                    // Story-aware resume: furthest valid checkpoint wins.
                    const target = resolveResumeTarget({
                      hasMarkV1: markV1 !== null,
                      hasMarkV2: markV2 !== null,
                      surveillanceTriggered: progress.events.surveillanceTriggered,
                      identityTheftTriggered: progress.events.identityTheftTriggered,
                      hasClaims: progress.claims.length > 0,
                      hasCover: cover !== null,
                      jobAccepted: job01Accepted,
                      missionStarted: missionState?.started ?? false,
                      missionCompleted: missionState?.completed ?? false,
                      hasChosenFront: chosenFront !== null,
                      receiptsReviewed: receiptState.cover01Burned,
                      hasFinalReceipt: runReceipt !== null,
                    });
                    setStage(resolveCanonicalResumeStage(target));
                  }}
                  onEdit={() => setStage("job-yard")}
                  onReset={handleReset}
                />
              </motion.div>
            )}

            {stage === "studio" && (
              <motion.div
                key={`studio-${studioKey}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <MarkStudio
                  startImage={startImage}
                  hasSavedMark={markV1 !== null}
                  hideIdentityBoard={true}
                  onCommit={handleCommit}
                  onViewVehicle={() => enterReveal(5)}
                />
              </motion.div>
            )}

            {stage === "world-intro" && markV1 !== null && (
              <WorldIntro
                key="world-intro"
                mark={markV1}
                hud={hud}
                onAdvance={() => setStage("district-select")}
              />
            )}

            {stage === "job-yard" && (
              <JobYard
                key="job-yard"
                hud={hud}
                jobAccepted={job01Accepted}
                onAcceptJob={() => {
                  handleAcceptJob();
                  setStage("front-terminal");
                }}
                cover={activeCover ? { image: activeCover.image, score: activeCover.score } : null}
                disguisePackage={activePackage}
                vehicleLivery={activeVehicleLivery}
                onEditCover={() => {
                  if (!chosenFront) {
                    setStage("front-terminal");
                  } else {
                    setStage("forgery-bay");
                  }
                }}
                onEditVehicle={() => setStage("vehicle-editor")}
                onStartJob={handleStartJob}
                onInspect3DCover={() => setStage("cover-inspection")}
                onViewReceipt={() => setStage("final-run-receipt")}
                hasReceipt={runReceipt !== null}
                receipts={receipts}
                receiptsSeen={receiptState.cameraReceiptsSeen}
                coverBurned={receiptState.cover01Burned}
                onCompleteReceiptReview={() => {
                  handleCompleteReceiptReview();
                  // If Cover 02 already locked, offer final receipt view
                  if (cover02 && runReceipt) {
                    setStage("final-run-receipt");
                  }
                }}
                coverVersion={activeCover?.version}
                cityMatch={activeCover?.cityMatchEstimate}
              />
            )}

            {stage === "front-terminal" && (
              <motion.div
                key="front-terminal"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <FrontTerminal
                  onSelectFront={(record) => {
                    saveChosenFront(record);
                    setChosenFront(record);
                    setStage("forgery-bay");
                  }}
                  onBack={() => setStage("job-yard")}
                />
              </motion.div>
            )}

            {stage === "final-run-receipt" && runReceipt && (
              <motion.div
                key="final-run-receipt"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <FinalRunReceipt
                  receipt={runReceipt}
                  cover01Image={cover?.image ?? runReceipt.cover01DataUrl}
                  cover02Image={cover02?.image ?? runReceipt.coverDataUrl}
                  visualDistance={runReceipt.signatureDistance}
                  checkpoint={runReceipt.checkpoint}
                  heat={progress.heat}
                  front={chosenFront}
                  metrics={runReceipt.metrics}
                  onReturnToYard={() => setStage("job-yard")}
                  onNewRun={handleReset}
                />
              </motion.div>
            )}

            {stage === "3d-yard" && (
              <Suspense fallback={<div className="cm-screen" style={{ background: "#06080B" }} />}>
                <Prototype3DYard
                  onBackToHub={() => setStage("job-yard")}
                  onOpenTerminal={() => setStage("front-terminal")}
                  onOpenPrintBay={() => setStage("forgery-bay")}
                />
              </Suspense>
            )}
            {stage === "cover-inspection" && activeCover && (
              <Suspense
                fallback={
                  <div className="cm-screen" style={{ background: "#060709", display: "flex", alignItems: "center", justifyContent: "center", color: "#F2EBDD" }}>
                    <p className="cm-kicker" style={{ color: "var(--cm-cyan, #06B6D4)" }}>INITIALIZING 3D VEHICLE STUDIO...</p>
                  </div>
                }
              >
                <CoverInspection3D
                  cover01Image={cover?.image ?? null}
                  cover02Image={cover02?.image ?? null}
                  vehicleLivery01={cover01VehicleLivery}
                  vehicleLivery02={cover02VehicleLivery}
                  signature={cover02?.signature ?? null}
                  onBackToYard={() => setStage("job-yard")}
                  onTestCover={handleStartJob}
                  onViewReceipt={() => setStage("final-run-receipt")}
                  isRunComplete={missionState?.completed ?? false}
                />
              </Suspense>
            )}
            {stage === "forgery-bay" && coverStarter !== null && (
              <motion.div
                key={`forgery-${cover02 ? "cover02" : cover ? "cover01" : "blank"}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <ForgeryBay
                  chosenFront={chosenFront}
                  initialImage={cover02 ? cover02.image : cover ? cover.image : coverStarter}
                  hasExistingCover={activeCover !== null}
                  onCommit={handleCoverCommit}
                  onBack={() => {
                    const slot: DisguisePackageSlot = cover02 || (receiptState.cover01Burned && !cover02)
                      ? "COVER//02"
                      : "COVER//01";
                    const lockedPackage = slot === "COVER//02" ? cover02?.disguisePackage : cover?.disguisePackage;
                    if (lockedPackage) {
                      replaceDisguisePackage(slot, lockedPackage);
                      setActivePackage(lockedPackage);
                    } else {
                      clearDisguisePackage(slot);
                      setActivePackage(null);
                    }
                    setStage("job-yard");
                  }}
                  isRotationMode={receiptState.cover01Burned && !cover02}
                  isEditingCover02={!!cover02}
                  packageSlot={cover02 || (receiptState.cover01Burned && !cover02) ? "COVER//02" : "COVER//01"}
                  onSelectArtwork={handleArtworkSelection}
                  burnedCover01={cover ? { image: cover.image, score: cover.analysis.score } : null}
                  onCommitRotation={handleCover02Commit}
                  onOpenVehicleEditor={() => {
                    const slot: DisguisePackageSlot = cover02 || (receiptState.cover01Burned && !cover02)
                      ? "COVER//02"
                      : "COVER//01";
                    const slotPackage = loadDisguisePackage(slot);
                    if (slotPackage) {
                      setActivePackage(slotPackage);
                    } else {
                      const initialPkg = createDisguisePackage(
                        coverStarter,
                        null,
                        chosenFront?.resolvedFrontId,
                        undefined,
                        slot,
                      );
                      setActivePackage(initialPkg);
                    }
                    setStage("vehicle-editor");
                  }}
                />
              </motion.div>
            )}

            {stage === "print-apply" && activeCover !== null && (
              <motion.div
                key={`print-${activeCover.image.length}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <PrintApply
                  cover={activeCover.image}
                  analysis={cover02 ? cover02.analysis : cover!.analysis}
                  onDone={() => setStage("job-yard")}
                  onViewReceipt={cover02 && runReceipt ? () => setStage("final-run-receipt") : undefined}
                  isRotation={!!cover02}
                  signature={cover02?.signature ?? null}
                />
              </motion.div>
            )}

            {stage === "mission" && markV1 !== null && missionState?.snapshot && (
              <motion.div
                key={`mission-${missionState.snapshot.coverLockedAt}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <Mission
                  plateSrc={checkpointPlate}
                  snapshot={missionState.snapshot}
                  livery={missionState.snapshot.vehicleLivery ?? deriveVehicleLivery(missionState.snapshot.coverImage, chosenFront?.resolvedFrontId)}
                  heat={progress.heat}
                  initialPhase={resumeMissionPhase(missionState) ?? "departure"}
                  onCheckpoint={handleMissionCheckpoint}
                  onComplete={handleMissionComplete}
                  onExit={handleMissionExit}
                />
              </motion.div>
            )}
            {stage === "vehicle-editor" && (
              <motion.div
                key="vehicle-editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <VehicleEditor
                  currentPackage={
                    activePackage ??
                    createDisguisePackage(
                      cover02?.image ?? cover?.image ?? coverStarter ?? "",
                      null,
                      chosenFront?.resolvedFrontId,
                      undefined,
                      cover02 || (receiptState.cover01Burned && !cover02) ? "COVER//02" : "COVER//01",
                    )
                  }
                  onSave={(updated) => {
                    setActivePackage(updated);
                    if (updated.slot === "COVER//02" && cover02?.image === updated.identityArtwork) {
                      setCover02((prev) =>
                        prev
                          ? { ...prev, disguisePackage: updated, vehicleLivery: updated.vehicleLivery }
                          : null,
                      );
                    } else if (updated.slot === "COVER//01" && cover?.image === updated.identityArtwork) {
                      setCover((prev) =>
                        prev
                          ? { ...prev, disguisePackage: updated, vehicleLivery: updated.vehicleLivery }
                          : null,
                      );
                    }
                    setStage("job-yard");
                  }}
                  onBack={() => {
                    const slot: DisguisePackageSlot = cover02 || (receiptState.cover01Burned && !cover02)
                      ? "COVER//02"
                      : "COVER//01";
                    const lockedPackage = slot === "COVER//02" ? cover02?.disguisePackage : cover?.disguisePackage;
                    if (lockedPackage) {
                      replaceDisguisePackage(slot, lockedPackage);
                      setActivePackage(lockedPackage);
                    } else {
                      clearDisguisePackage(slot);
                      setActivePackage(null);
                    }
                    setStage("job-yard");
                  }}
                />
              </motion.div>
            )}

            {stage === "forgery-bay" && coverStarter === null && (
              <section className="cm-screen" aria-label="Initialization failure">
                <p className="cm-kicker">Terminal fault</p>
                <h1 className="cm-title">
                  No vinyl <span className="accent">available.</span>
                </h1>
                <div className="cm-alert" role="alert">
                  <span>
                    The blank vinyl panel could not be built and no saved cover
                    exists. Reload once canvas 2D is available.
                  </span>
                </div>
              </section>
            )}

            {stage === "identity-reveal" && markV1 !== null && (
              <IdentityReveal
                key={`reveal-${revealSession}`}
                mark={markV1}
                alpha={alpha}
                hud={hud}
                initialBeat={revealEntry}
                onAdvance={() => setStage("district-select")}
                onEdit={() => setStage("studio")}
                onReset={handleReset}
              />
            )}

            {stage === "district-select" && markV1 !== null && (
              <motion.div
                key="district-select"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <DistrictSelect
                  rep={progress.rep}
                  heat={progress.heat}
                  territory={progress.territory}
                  claimedIds={claimedIds}
                  initialSelected={selectedDistrict}
                  onClaim={(id) => {
                    setSelectedDistrict(id);
                    setStage("wall-claim");
                  }}
                  onBack={() => enterReveal(5)}
                />
              </motion.div>
            )}

            {stage === "wall-claim" && markV1 !== null && selectedDistrict !== null && (
              <motion.div
                key={`wall-${selectedDistrict}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <WallClaim
                  mark={markV1}
                  districtId={selectedDistrict}
                  alreadyClaimed={claimForSelected !== null}
                  existingPlacement={claimForSelected?.placement ?? null}
                  onCommit={handleClaimCommit}
                  onBack={() => setStage("district-select")}
                />
              </motion.div>
            )}

            {stage === "city-reaction" &&
              markV1 !== null &&
              selectedDistrict !== null &&
              lastPlacement !== null && (
                <CityReaction
                  key={`city-${selectedDistrict}-${progress.claims.length}`}
                  mark={markV1}
                  districtName={getDistrict(selectedDistrict).name}
                  placement={lastPlacement}
                  rep={progress.rep}
                  heat={progress.heat}
                  territory={progress.territory}
                  recognition={getDistrict(selectedDistrict).repReward}
                  onKeepMoving={() => setStage("surveillance")}
                />
              )}

            {stage === "surveillance" && markV1 !== null && (
              <Surveillance
                key={`vcw-${progress.events.surveillanceTriggered ? "seen" : "fresh"}`}
                mark={markV1}
                locations={locationNames}
                rep={progress.rep}
                heat={progress.heat}
                territory={progress.territory}
                onApplyHeat={() => applyEventHeat("surveillanceTriggered")}
                onAdvance={() => setStage("identity-theft")}
              />
            )}

            {stage === "identity-theft" && markV1 !== null && (
              <IdentityTheft
                key={`theft-${progress.events.identityTheftTriggered ? "seen" : "fresh"}`}
                mark={markV1}
                rep={progress.rep}
                heat={progress.heat}
                territory={progress.territory}
                onApplyHeat={() => applyEventHeat("identityTheftTriggered")}
                onAdvance={() => setStage("mark-evolution")}
              />
            )}

            {stage === "mark-evolution" && markV1 !== null && (
              <motion.div
                key="mark-evolution"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <MarkEvolution
                  markV1={markV1}
                  onCommit={handleEvolutionCommit}
                  onBack={() => setStage("identity-theft")}
                />
              </motion.div>
            )}

            {stage === "mark-v2-reveal" && markV1 !== null && markV2 !== null && (
              <MarkV2Reveal
                key={`v2reveal-${markV2.length}`}
                markV1={markV1}
                markV2={markV2}
                alphaV2={alphaV2}
                onRetake={() => setStage("mark-evolution")}
                onReset={handleReset}
              />
            )}
          </AnimatePresence>
        )}
        {persistWarning && (
          <p className="cm-notice">
            Saved for this session, but localStorage persistence failed (likely
            quota) — a refresh will return to a clean transparent canvas.
          </p>
        )}
      </main>

      {stage !== "landing" && (
        <footer className="cm-footnote">
          <span>P3 stolen identity // recognition becomes evidence</span>
          <span>No affiliation // original placeholder art</span>
        </footer>
      )}
    </div>
  );
}
