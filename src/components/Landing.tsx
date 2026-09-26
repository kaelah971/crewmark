import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Eye,
  Globe2,
  MapPin,
  Menu,
  Pencil,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import heroArt from "../assets/crewmark-landing-scene.png";
import type { ProgressState } from "../lib/progressStorage";

interface LandingProps {
  /** Saved MARK//001, or null for a first-time visitor. */
  mark: string | null;
  progress: ProgressState;
  /** Fresh entry -> studio. */
  onEnter: () => void;
  /** Saved run -> furthest valid story checkpoint (see App routing). */
  onContinue: () => void;
  /** Saved run -> studio with the mark reloaded. */
  onEdit: () => void;
  /** Clear mark + progress + events, stay on landing. */
  onReset: () => void;
}

const STEPS = [
  { n: "01", name: "Create", text: "Design your crew mark", icon: Pencil },
  { n: "02", name: "Infiltrate", text: "Mount disguise and breach Port Vice", icon: MapPin },
  { n: "03", name: "Evade", text: "Rotate visual signature when burned", icon: Eye },
];

const ABOUT_COPY =
  "CREW//MARK imagines a GTA VI world where player-made identity becomes a disguise, a job, and eventually evidence.";

function storyStatus(progress: ProgressState): string {
  if (progress.events.identityTheftTriggered) return "Mark compromised";
  if (progress.events.surveillanceTriggered) return "Identified";
  if (progress.claims.length > 0) return "City active";
  return "Mark active";
}

export default function Landing({ mark, progress, onEnter, onContinue, onEdit, onReset }: LandingProps) {
  const hasRun = mark !== null;
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<"menu" | "about">("menu");
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setMenuOpen(false);
    setDrawerView("menu");
  };

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    drawerRef.current
      ?.querySelector<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")
      ?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const items = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [menuOpen]);

  const showHowItWorks = () => {
    closeMenu();
    window.requestAnimationFrame(() => {
      stepsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
    });
  };

  return (
    <section className="cm-screen cm-landing" aria-label="Crew Mark landing">
      <motion.img
        className="cm-landing-scene"
        src={heroArt}
        alt=""
        aria-hidden="true"
        draggable={false}
        initial={false}
        animate={reduceMotion ? { scale: 1 } : { scale: [1, 1.018, 1] }}
        transition={reduceMotion ? undefined : { duration: 28, repeat: Infinity, ease: "linear" }}
      />
      <div className="cm-landing-grade" aria-hidden="true" />
      <div className="cm-landing-vignette" aria-hidden="true" />

      <div className="cm-landing-layout">
        <header className="cm-landing-topbar">
          <p className="cm-landing-brand">Crew<span>//</span>Mark</p>
          <div className="cm-landing-entry">
            <span>ENTRY//001</span>
            <button
              ref={menuButtonRef}
              type="button"
              className="cm-menu-button"
              aria-label="Open Crew Mark menu"
              aria-expanded={menuOpen}
              aria-controls="crewmark-menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu aria-hidden="true" size={25} strokeWidth={2} />
            </button>
          </div>
        </header>

        <main className="cm-landing-copy">
          <p className="cm-landing-kicker">Crew//Mark // a GTA VI-inspired identity story</p>
          <h1 className="cm-landing-title">Make your mark.<br /><span>Live with it.</span></h1>
          <p className="cm-landing-sub">Create a crew symbol. Wear the disguise. Watch recognition turn into evidence.</p>
          <p className="cm-landing-note">{ABOUT_COPY}</p>
          <button
            type="button"
            className="cm-landing-primary"
            onClick={hasRun ? onContinue : onEnter}
            aria-label={hasRun ? "Continue your saved Crew Mark run" : "Enter the city and create your mark"}
          >
            {hasRun ? (
              <><Play size={17} fill="currentColor" aria-hidden="true" />Continue run</>
            ) : (
              <>Enter 305<ArrowRight size={22} aria-hidden="true" /></>
            )}
          </button>
        </main>

        <div className="cm-landing-bottom">
          <div className="cm-landing-steps" ref={stepsRef} id="how-it-works">
            {STEPS.map(({ n, name, text, icon: Icon }) => (
              <article key={n} className="cm-landing-step">
                <Icon className="cm-landing-step-icon" size={28} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <p className="cm-landing-step-label">{n} // {name}</p>
                  <p className="cm-landing-step-copy">{text}</p>
                </div>
              </article>
            ))}
          </div>

          <aside className="cm-identity-rail" aria-label="Crew Mark identity statement">
            <Globe2 size={31} strokeWidth={1.25} aria-hidden="true" />
            <p>Identity<br />is<br />evidence.</p>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              className="cm-drawer-backdrop"
              aria-label="Close menu"
              onClick={closeMenu}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            />
            <motion.aside
              ref={drawerRef}
              id="crewmark-menu"
              className="cm-landing-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Crew Mark menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 38 }}
            >
              <div className="cm-drawer-head">
                <p>Crew<span>//</span>Mark</p>
                <button type="button" className="cm-drawer-close" onClick={closeMenu} aria-label="Close menu">
                  <X size={23} aria-hidden="true" />
                </button>
              </div>

              <div className="cm-drawer-rule" />
              {drawerView !== "menu" && (
                <button type="button" className="cm-drawer-back" onClick={() => setDrawerView("menu")}>← Back to menu</button>
              )}

              {drawerView === "menu" && (
                <div className="cm-drawer-menu">
                  {hasRun ? (
                    <>
                      <button type="button" className="cm-drawer-action is-primary" onClick={onContinue}>
                        <span>01</span> Continue run <ArrowRight size={18} aria-hidden="true" />
                      </button>
                      <button type="button" className="cm-drawer-action" onClick={onEdit}>
                        <span>02</span> Edit mark//001 <Pencil size={17} aria-hidden="true" />
                      </button>
                      <div className="cm-drawer-session">
                        <div className="cm-drawer-mark-row">
                          <img src={mark} alt="Your saved crew mark" draggable={false} />
                          <div>
                            <p className="cm-drawer-eyebrow">Story status</p>
                            <p className="cm-drawer-status">{storyStatus(progress)}</p>
                          </div>
                        </div>
                        <dl className="cm-drawer-stats">
                          <div><dt>Rep</dt><dd>{progress.rep}</dd></div>
                          <div><dt>Heat</dt><dd>{progress.heat}</dd></div>
                          <div><dt>Status</dt><dd>{progress.heat >= 10 ? "Hot" : "Active"}</dd></div>
                        </dl>
                        <p className="cm-drawer-claims">305 Print &amp; Sign // Disguise Operations</p>
                      </div>
                      <button type="button" className="cm-drawer-reset" onClick={onReset}>
                        <RotateCcw size={16} aria-hidden="true" /> Reset session
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="cm-drawer-action is-primary" onClick={onEnter}>
                        <span>01</span> Enter the city <ArrowRight size={18} aria-hidden="true" />
                      </button>
                      <button type="button" className="cm-drawer-action" onClick={showHowItWorks}>
                        <span>02</span> How it works
                      </button>
                      <button type="button" className="cm-drawer-action" onClick={() => setDrawerView("about")}>
                        <span>03</span> About
                      </button>
                    </>
                  )}
                </div>
              )}

              {drawerView === "about" && (
                <div className="cm-drawer-copy-panel">
                  <p className="cm-drawer-eyebrow">About // Crew Mark</p>
                  <h2>Identity becomes evidence.</h2>
                  <p>{ABOUT_COPY}</p>
                  <button type="button" className="cm-drawer-inline-cta" onClick={onEnter}>
                    Enter the city <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
