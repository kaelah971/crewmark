import { useEffect, useState } from "react";
import serviceVehicleCutout from "../assets/world/service-vehicle.png";
import type { VehicleLivery } from "../lib/vehicleLivery";
import { getSedanSnapshot, type SedanSnapshotAngle } from "../lib/sedanSnapshot";

interface VehicleLiveryProjectionProps {
  livery: VehicleLivery;
  className?: string;
  showVehicle?: boolean;
  angle?: SedanSnapshotAngle;
}

export function VehicleLiveryProjection({
  livery,
  className = "",
  showVehicle = true,
  angle = "yard",
}: VehicleLiveryProjectionProps) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getSedanSnapshot(livery, angle)
      .then((url) => {
        if (live && url) {
          setSnapshotUrl(url);
        }
      })
      .catch((err) => {
        console.warn("[crewmark] Sedan 3D snapshot generation failed:", err);
      });

    return () => {
      live = false;
    };
  }, [livery, angle]);

  const displaySrc = snapshotUrl ?? (showVehicle ? serviceVehicleCutout : null);

  if (!displaySrc) return null;

  return (
    <div
      className={`cm-vehicle-3d-projection ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        src={displaySrc}
        alt={`${livery.companyLabel} 3D Fleet Car`}
        className="cm-vehicle-3d-img"
        draggable={false}
      />
    </div>
  );
}
