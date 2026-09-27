/**
 * Port Vice route vehicle controller.
 *
 * The mission vehicle is no longer a screen-space sprite. This module owns a
 * small, deterministic car model: progress along an authored road route,
 * lateral lane offset, signed speed, steering, and heading. The Three.js
 * mission layer consumes the same state and projects the production sedan GLB
 * into the fixed photographic camera.
 */

export interface VehicleState {
  /** Meters along the authored Port Vice route. */
  readonly routeProgress: number;
  /** Signed lateral offset from the route centerline, in meters. */
  readonly lateralOffset: number;
  /** Lateral movement velocity, in meters per second. */
  readonly lateralVelocity: number;
  /** Signed forward speed. Negative means the car is reversing. */
  readonly speed: number;
  /** World yaw in radians. The production sedan faces +Z at zero yaw. */
  readonly heading: number;
  /** Smoothed steering input used for the front-wheel visual response. */
  readonly steering: number;
}

export interface VehicleInput {
  /** +1 accelerate, -1 brake/reverse, 0 coast. */
  readonly throttle: number;
  /** -1 left, +1 right. */
  readonly steer: number;
}

export interface MissionRouteSample {
  readonly x: number;
  readonly z: number;
  readonly tangentX: number;
  readonly tangentZ: number;
  readonly heading: number;
}

interface RouteAnchor {
  readonly progress: number;
  readonly x: number;
  readonly z: number;
}

/**
 * Route authored against port-vice-checkpoint.png. It bends through the
 * visible wet lane rather than allowing a free screen-space vehicle path.
 */
const ROUTE_ANCHORS: readonly RouteAnchor[] = [
  { progress: 0, x: 1.4, z: 0 },
  { progress: 26, x: 1.0, z: 2.6 },
  { progress: 55, x: 0.25, z: 6.2 },
  // The road turns into the right-hand booth lane in the photograph. The
  // negative x values are intentional: this fixed camera looks from the
  // south-east, so decreasing world x projects right on the plate.
  { progress: 68, x: -1.0, z: 8.5 },
  { progress: 72, x: -2.0, z: 9.2 },
  { progress: 76, x: -3.0, z: 10.0 },
  { progress: 82, x: -5.04, z: 11.2 },
  { progress: 88, x: -5.8, z: 12.3 },
  { progress: 108, x: -9.34, z: 15.1 },
  { progress: 135, x: -11.0, z: 18.3 },
] as const;

export const VEHICLE_TUNING = {
  routeLength: 135,
  checkpointProgress: 82,
  barrierProgress: 88,
  /** Compatibility names for mission/UI contracts that describe the same route. */
  barrierDist: 88,
  yardEnd: 135,
  accel: 7.5,
  brake: 13.5,
  reverseAccel: 4.0,
  drag: 2.8,
  maxSpeed: 12,
  maxReverse: -4.5,
  maxLateralSpeed: 2.1,
  lateralResponse: 5.5,
  maxLateralOffset: 1.25,
  steeringResponse: 5.0,
  headingResponse: 3.8,
} as const;

/** Correct-stop window immediately before the barrier. */
export const STOP_ZONE = { min: 77, max: 85 } as const;
/** Secondary inspection window behind the barrier stop line. */
export const SECONDARY_ZONE = { min: 67, max: 74 } as const;
/** Delivery marker deep in the restricted yard. */
export const DELIVERY_ZONE = { min: 121, max: 130 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(target, value + amount);
  return Math.max(target, value - amount);
}

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function approachAngle(value: number, target: number, amount: number): number {
  const delta = normalizeAngle(target - value);
  return value + clamp(delta, -amount, amount);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function catmullRomTangent(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return 0.5 * (
    (-p0 + p2) +
    2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
    3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  );
}

function routeSegment(progress: number): { index: number; t: number } {
  const p = clamp(progress, 0, VEHICLE_TUNING.routeLength);
  for (let i = 0; i < ROUTE_ANCHORS.length - 1; i += 1) {
    const start = ROUTE_ANCHORS[i];
    const end = ROUTE_ANCHORS[i + 1];
    if (p <= end.progress) {
      return { index: i, t: (p - start.progress) / (end.progress - start.progress) };
    }
  }
  return { index: ROUTE_ANCHORS.length - 2, t: 1 };
}

/** Sample the authored centerline plus a constrained lateral lane offset. */
export function sampleMissionRoute(progress: number, lateralOffset = 0): MissionRouteSample {
  const { index, t } = routeSegment(progress);
  const p0 = ROUTE_ANCHORS[Math.max(0, index - 1)];
  const p1 = ROUTE_ANCHORS[index];
  const p2 = ROUTE_ANCHORS[index + 1];
  const p3 = ROUTE_ANCHORS[Math.min(ROUTE_ANCHORS.length - 1, index + 2)];
  const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
  const z = catmullRom(p0.z, p1.z, p2.z, p3.z, t);
  const rawTangentX = catmullRomTangent(p0.x, p1.x, p2.x, p3.x, t);
  const rawTangentZ = catmullRomTangent(p0.z, p1.z, p2.z, p3.z, t);
  const tangentLength = Math.hypot(rawTangentX, rawTangentZ) || 1;
  const tangentX = rawTangentX / tangentLength;
  const tangentZ = rawTangentZ / tangentLength;
  const boundedOffset = clamp(lateralOffset, -VEHICLE_TUNING.maxLateralOffset, VEHICLE_TUNING.maxLateralOffset);

  // Right-hand normal for an x/z ground plane. Positive offset is D/right.
  return {
    x: x + tangentZ * boundedOffset,
    z: z - tangentX * boundedOffset,
    tangentX,
    tangentZ,
    heading: Math.atan2(tangentX, tangentZ),
  };
}

export function createVehicleState(routeProgress = 0): VehicleState {
  return {
    routeProgress: clamp(routeProgress, 0, VEHICLE_TUNING.routeLength),
    lateralOffset: 0,
    lateralVelocity: 0,
    speed: 0,
    heading: sampleMissionRoute(routeProgress).heading,
    steering: 0,
  };
}

/**
 * Simple believable kinematics. S brakes a moving car first and only starts
 * reversing once speed reaches zero; coasting uses friction and steering has
 * less authority at low speed. Forward progress is hard-clamped by the
 * checkpoint barrier until the mission opens the gate.
 */
export function stepVehicle(
  state: VehicleState,
  input: VehicleInput,
  dtSeconds: number,
  endProgress: number = VEHICLE_TUNING.barrierProgress,
): VehicleState {
  const dt = clamp(dtSeconds, 0, 0.08);
  const throttle = clamp(input.throttle, -1, 1);
  const steer = clamp(input.steer, -1, 1);
  let speed = state.speed;

  if (throttle > 0) {
    if (speed < 0) {
      speed = Math.min(0, speed + VEHICLE_TUNING.brake * throttle * dt);
    } else {
      speed = Math.min(VEHICLE_TUNING.maxSpeed, speed + VEHICLE_TUNING.accel * throttle * dt);
    }
  } else if (throttle < 0) {
    if (speed > 0) {
      speed = Math.max(0, speed + VEHICLE_TUNING.brake * throttle * dt);
    } else {
      speed = Math.max(VEHICLE_TUNING.maxReverse, speed + VEHICLE_TUNING.reverseAccel * throttle * dt);
    }
  } else {
    speed = approach(speed, 0, VEHICLE_TUNING.drag * dt);
  }

  const speedFactor = clamp(Math.abs(speed) / VEHICLE_TUNING.maxSpeed, 0, 1);
  const targetLateralVelocity = steer * VEHICLE_TUNING.maxLateralSpeed * speedFactor;
  let lateralVelocity = approach(
    state.lateralVelocity,
    targetLateralVelocity,
    VEHICLE_TUNING.lateralResponse * dt,
  );
  let lateralOffset = state.lateralOffset + lateralVelocity * dt;
  if (lateralOffset <= -VEHICLE_TUNING.maxLateralOffset || lateralOffset >= VEHICLE_TUNING.maxLateralOffset) {
    lateralOffset = clamp(lateralOffset, -VEHICLE_TUNING.maxLateralOffset, VEHICLE_TUNING.maxLateralOffset);
    lateralVelocity = 0;
  }

  const maxProgress = clamp(endProgress, 0, VEHICLE_TUNING.routeLength);
  let routeProgress = state.routeProgress + speed * dt;
  if (routeProgress >= maxProgress) {
    routeProgress = maxProgress;
    if (speed > 0) speed = 0;
  }
  if (routeProgress <= 0) {
    routeProgress = 0;
    if (speed < 0) speed = 0;
  }

  const route = sampleMissionRoute(routeProgress, lateralOffset);
  const steerAmount = steer * (0.08 + speedFactor * 0.18);
  const lateralYaw = Math.atan2(lateralVelocity, Math.max(1.5, Math.abs(speed))) * 0.42;
  const targetHeading = route.heading + steerAmount + lateralYaw;
  const heading = approachAngle(
    state.heading,
    targetHeading,
    (VEHICLE_TUNING.headingResponse + speedFactor * 1.8) * dt,
  );
  const steering = approach(state.steering, steer * speedFactor, VEHICLE_TUNING.steeringResponse * dt);

  return {
    routeProgress,
    lateralOffset,
    lateralVelocity,
    speed,
    heading,
    steering,
  };
}

export function inStopZone(routeProgress: number): boolean {
  return routeProgress >= STOP_ZONE.min && routeProgress <= STOP_ZONE.max;
}

export function inSecondaryZone(routeProgress: number): boolean {
  return routeProgress >= SECONDARY_ZONE.min && routeProgress <= SECONDARY_ZONE.max;
}

export function inDeliveryZone(routeProgress: number): boolean {
  return routeProgress >= DELIVERY_ZONE.min && routeProgress <= DELIVERY_ZONE.max;
}

export function isStopped(speed: number): boolean {
  return Math.abs(speed) < 0.35;
}
