import { useEffect, useState } from "react";
import { DEFAULT_CLEAN_VEHICLE_LIVERY } from "../lib/disguisePackage";
import type { VehicleLivery } from "../lib/vehicleLivery";
import { getSedanSnapshot, getSedanSnapshotKey, type SedanSnapshotAngle } from "../lib/sedanSnapshot";

interface VehicleLiveryProjectionProps {
  livery?: VehicleLivery;
  className?: string;
  angle?: SedanSnapshotAngle;
}

export function VehicleLiveryProjection({
  livery = DEFAULT_CLEAN_VEHICLE_LIVERY,
  className = "",
  angle = "yard",
}: VehicleLiveryProjectionProps) {
  const [snapshot, setSnapshot] = useState<{ key: string; url: string } | null>(null);
  const snapshotKey = getSedanSnapshotKey(livery, angle);

  useEffect(() => {
    let live = true;
    getSedanSnapshot(livery, angle)
      .then((url) => {
        if (live && url) {
          setSnapshot({ key: snapshotKey, url });
        }
      })
      .catch((err) => {
        console.warn("[crewmark] Sedan 3D snapshot generation failed:", err);
      });

    return () => {
      live = false;
    };
  }, [angle, livery, snapshotKey]);

  const displaySrc = snapshot?.key === snapshotKey ? snapshot.url : null;

  return (
    <div
      className={`cm-vehicle-3d-projection ${className}`.trim()}
      data-livery-template={livery.templateId ?? (livery.companyLabel === DEFAULT_CLEAN_VEHICLE_LIVERY.companyLabel ? "clean-factory" : "custom")}
      data-livery-company={livery.companyLabel}
      aria-hidden="true"
    >
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={`${livery.companyLabel} 3D Fleet Car`}
          className="cm-vehicle-3d-img"
          draggable={false}
        />
      ) : null}
    </div>
  );
}
