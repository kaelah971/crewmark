import { useEffect, useRef } from "react";
import {
  initMissionVehicle3D,
  type MissionVehicle3DSceneResult,
} from "../lib/missionVehicle3dScene";
import type { VehicleLivery } from "../lib/vehicleLivery";
import type { VehicleState } from "../world/vehicle";

interface MissionVehicle3DProps {
  livery: VehicleLivery;
  state: VehicleState;
  onLoaded?: () => void;
}

export default function MissionVehicle3D({ livery, state, onLoaded }: MissionVehicle3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MissionVehicle3DSceneResult | null>(null);
  const stateRef = useRef(state);
  const liveryRef = useRef(livery);
  const loadedRef = useRef(onLoaded);

  useEffect(() => {
    stateRef.current = state;
    liveryRef.current = livery;
    loadedRef.current = onLoaded;
  }, [state, livery, onLoaded]);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = initMissionVehicle3D(
      containerRef.current,
      liveryRef.current,
      stateRef.current,
      () => loadedRef.current?.(),
    );
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.updateVehicle(state);
  }, [state]);

  useEffect(() => {
    sceneRef.current?.setVehicleLivery(livery);
  }, [livery]);

  return (
    <div
      ref={containerRef}
      className="cm-mission-vehicle3d"
      data-route-progress={state.routeProgress.toFixed(2)}
      data-lateral-offset={state.lateralOffset.toFixed(2)}
      data-speed={state.speed.toFixed(2)}
      data-heading={state.heading.toFixed(3)}
      aria-hidden="true"
    />
  );
}