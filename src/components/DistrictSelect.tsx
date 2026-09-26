import { useState } from "react";
import { ArrowLeft, ArrowRight, Flame, MapPin, Star } from "lucide-react";
import { DISTRICTS, type DistrictId } from "../lib/districts";
import Hud from "./Hud";

interface DistrictSelectProps {
  rep: number;
  heat: number;
  territory: number;
  claimedIds: DistrictId[];
  initialSelected: DistrictId | null;
  onClaim: (id: DistrictId) => void;
  onBack: () => void;
}

/** Stylized district selector — graphic cards, never a map product. */
export default function DistrictSelect({
  rep,
  heat,
  territory,
  claimedIds,
  initialSelected,
  onClaim,
  onBack,
}: DistrictSelectProps) {
  const [selected, setSelected] = useState<DistrictId | null>(initialSelected);
  const active = DISTRICTS.find((d) => d.id === selected) ?? null;

  return (
    <section className="cm-screen" aria-label="District select">
      <p className="cm-kicker">Make yourself known // pick your wall</p>
      <h1 className="cm-title">
        Where do you want <span className="accent">to be seen?</span>
      </h1>
      <p className="cm-lede">
        Every wall earns recognition.{" "}
        <span className="cm-dim">Every wall leaves evidence.</span>
      </p>

      <div className="cm-board-hud">
        <Hud rep={rep} heat={heat} territory={territory} variant="strip" />
      </div>

      <div className="cm-districts" role="radiogroup" aria-label="Districts">
        {DISTRICTS.map((d) => {
          const isSelected = selected === d.id;
          const isClaimed = claimedIds.includes(d.id);
          const isRival = d.status !== "NEUTRAL";
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(d.id)}
              className={
                "cm-district" +
                (isSelected ? " selected" : "") +
                (isRival ? " rival" : "") +
                (isClaimed ? " claimed" : "")
              }
            >
              <span className="cm-district-top">
                <MapPin size={16} aria-hidden={true} />
                <span className="cm-district-name">{d.name}</span>
              </span>
              <span className={`cm-district-status${isRival ? " hostile" : ""}`}>
                {d.status}
              </span>
              <span className="cm-district-blurb">{d.blurb}</span>
              <span className="cm-district-stats">
                <span className="cm-district-stat">
                  <Star size={13} aria-hidden={true} />
                  Rep +{d.repReward}
                </span>
                <span className="cm-district-stat risk">
                  <Flame size={13} aria-hidden={true} />
                  Heat +{d.heatRisk}
                </span>
                <span className="cm-district-stat">Terr +{d.territoryGain}%</span>
              </span>
              {isClaimed && <span className="cm-district-claimed">Claimed</span>}
            </button>
          );
        })}
      </div>

      <div className="cm-cta-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={active === null}
          onClick={() => {
            if (active) onClaim(active.id);
          }}
        >
          Claim {active ? active.name : "a district"}
          <ArrowRight size={16} aria-hidden={true} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden={true} />
          Back to board
        </button>
      </div>
      <p className="cm-hint">
        Rewards are fixed per district and each wall pays out once — revisiting
        a claimed wall earns nothing new.
      </p>
    </section>
  );
}
