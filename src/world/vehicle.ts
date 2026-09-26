/**
 * Lightweight 2.5D vehicle controller math (P3.5A-R.3) — pure functions.
 *
 * Cinematic controlled approach, not racing physics: one forward axis
 * (dist), one lateral lane axis, simple accel/brake/reverse with caps.
 * The gate barrier is a hard clamp; the stop zones are checked by the
 * mission layer. Deterministic and fully unit-testable.
 */

export interface VehicleState {
  /** Forward progress along the service lane. Gate barrier at BARRIER_DIST. */
  readonly dist: number;
  /** Lateral lane offset, -1 (left) .. 1 (right). */
  readonly lane: number;
  /** Signed speed, units/sec. Negative = reversing. */
  readonly speed: number;
}

export interface VehicleInput {
  /** +1 accelerate (W/Up), -1 brake/reverse (S/Down), 0 coast. */
  readonly throttle: number;
  /** -1 left, +1 right (A/D or arrows). */
  readonly steer: number;
}

export const VEHICLE_TUNING = {
  accel: 16,
  brake: 30,
  drag: 8,
  maxSpeed: 26,
  maxReverse: -6,
  steerRate: 0.9,
  /** Gate barrier: dist never exceeds this until the barrier opens. */
  barrierDist: 92,
  /** Open gate: extended clamp for the restricted yard + delivery marker. */
  yardEnd: 135,
} as const;

/** Correct-stop window in front of the booth. */
export const STOP_ZONE = { min: 78, max: 86 } as const;

/** Secondary inspection window (weak-branch recovery), behind the gate. */
export const SECONDARY_ZONE = { min: 68, max: 74 } as const;

/** Delivery marker deep in the restricted yard. */
export const DELIVERY_ZONE = { min: 122, max: 130 } as const;

export function stepVehicle(
  state: VehicleState,
  input: VehicleInput,
  dtSeconds: number,
  endDist: number = VEHICLE_TUNING.barrierDist,
): VehicleState {
  const dt = Math.max(0, dtSeconds);
  let speed = state.speed;
  if (input.throttle > 0) {
    speed = Math.min(VEHICLE_TUNING.maxSpeed, speed + VEHICLE_TUNING.accel * input.throttle * dt);
  } else if (input.throttle < 0) {
    speed = Math.max(VEHICLE_TUNING.maxReverse, speed + VEHICLE_TUNING.brake * input.throttle * dt);
  } else {
    const drag = VEHICLE_TUNING.drag * dt;
    speed = speed > 0 ? Math.max(0, speed - drag) : Math.min(0, speed + drag);
  }
  let dist = state.dist + speed * dt;
  if (dist >= endDist) {
    dist = endDist;
    if (speed > 0) speed = 0;
  }
  if (dist <= 0) {
    dist = 0;
    if (speed < 0) speed = 0;
  }
  const lane = Math.min(1, Math.max(-1, state.lane + input.steer * VEHICLE_TUNING.steerRate * dt));
  return { dist, lane, speed };
}

export function inStopZone(dist: number): boolean {
  return dist >= STOP_ZONE.min && dist <= STOP_ZONE.max;
}

export function inSecondaryZone(dist: number): boolean {
  return dist >= SECONDARY_ZONE.min && dist <= SECONDARY_ZONE.max;
}

export function inDeliveryZone(dist: number): boolean {
  return dist >= DELIVERY_ZONE.min && dist <= DELIVERY_ZONE.max;
}

/** Considered stopped when nearly stationary (handbrake feel without a button). */
export function isStopped(speed: number): boolean {
  return Math.abs(speed) < 0.5;
}
