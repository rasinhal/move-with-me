import { isVisible, type Point3 } from "./geometry";
import { Landmark } from "./landmarks";

export type FramingStatus =
  | "noPerson"
  | "partial"
  | "tooClose"
  | "tooFar"
  | "showFeet"
  | "moveLeft"
  | "moveRight"
  | "good";

export interface FramingResult {
  status: FramingStatus;
  message: string;
}

export const FRAMING_MESSAGES: Readonly<Record<FramingStatus, string>> = {
  noPerson: "Step into view of the camera.",
  partial: "Face the camera so we can see your shoulders and hips.",
  tooClose: "Take a step back from the camera.",
  tooFar: "Take a step closer to the camera.",
  showFeet: "Step back until your knees and feet are in view.",
  // The video is shown mirrored, so these are the person's own left and right.
  moveLeft: "Move a little to your left.",
  moveRight: "Move a little to your right.",
  good: "Great, your whole body is in view.",
};

/** Tunable limits, in normalised image units (0 to 1 across the frame). */
export const FRAMING_LIMITS = {
  /** Points closer than this to the top or bottom edge count as cut off. */
  edgeMargin: 0.02,
  /**
   * Head-to-ankle height above this fraction of the frame is too close. Kept well
   * under 1 so raised hands still fit above the head during a move.
   */
  maxBodyHeight: 0.85,
  /** Head-to-ankle height below this fraction of the frame is too far. */
  minBodyHeight: 0.4,
  /** How far the body centre may drift from the middle of the frame. */
  maxCentreOffset: 0.18,
} as const;

function result(status: FramingStatus): FramingResult {
  return { status, message: FRAMING_MESSAGES[status] };
}

function inFrameVertically(p: Point3): boolean {
  return p.y >= FRAMING_LIMITS.edgeMargin && p.y <= 1 - FRAMING_LIMITS.edgeMargin;
}

/**
 * Decides whether the person is placed well for full-body tracking and, if not,
 * what single instruction would help most. `landmarks` are MediaPipe's normalised
 * image landmarks for one person, in the camera's own (unmirrored) orientation,
 * or undefined when nobody was detected.
 */
export function assessFraming(landmarks: readonly Point3[] | undefined): FramingResult {
  if (!landmarks || landmarks.length === 0) return result("noPerson");

  const L = Landmark;
  const at = (i: number) => landmarks[i];
  const torso = [at(L.LEFT_SHOULDER), at(L.RIGHT_SHOULDER), at(L.LEFT_HIP), at(L.RIGHT_HIP)];
  if (!torso.every((p) => isVisible(p))) return result("partial");

  const nose = at(L.NOSE);
  const shoulders = [at(L.LEFT_SHOULDER)!, at(L.RIGHT_SHOULDER)!];
  if ((nose && nose.y < FRAMING_LIMITS.edgeMargin) || shoulders.some((p) => !inFrameVertically(p))) {
    return result("tooClose");
  }

  const legs = [at(L.LEFT_KNEE), at(L.RIGHT_KNEE), at(L.LEFT_ANKLE), at(L.RIGHT_ANKLE)];
  if (!legs.every((p) => isVisible(p) && inFrameVertically(p))) return result("showFeet");

  const top = Math.min(nose?.y ?? Infinity, ...shoulders.map((p) => p.y));
  const bottom = Math.max(at(L.LEFT_ANKLE)!.y, at(L.RIGHT_ANKLE)!.y);
  const height = bottom - top;
  if (height > FRAMING_LIMITS.maxBodyHeight) return result("tooClose");
  if (height < FRAMING_LIMITS.minBodyHeight) return result("tooFar");

  // Centre of the torso, flipped to match the mirrored picture the person sees.
  const rawCentre = torso.reduce((sum, p) => sum + p!.x, 0) / torso.length;
  const screenCentre = 1 - rawCentre;
  // In a mirror, someone shown on the left of the screen needs to move to their right.
  if (screenCentre < 0.5 - FRAMING_LIMITS.maxCentreOffset) return result("moveRight");
  if (screenCentre > 0.5 + FRAMING_LIMITS.maxCentreOffset) return result("moveLeft");

  return result("good");
}

/**
 * Holds a value steady until a new value has persisted for `holdMs`, so on-screen
 * guidance does not flicker when the tracker wavers between two answers.
 */
export class Debounced<T> {
  private current: T;
  private candidate: T;
  private candidateSince: number;

  constructor(initial: T, private readonly holdMs: number) {
    this.current = initial;
    this.candidate = initial;
    this.candidateSince = Number.NEGATIVE_INFINITY;
  }

  update(value: T, now: number): T {
    if (value === this.current) {
      this.candidate = value;
      return this.current;
    }
    if (value !== this.candidate) {
      this.candidate = value;
      this.candidateSince = now;
    }
    if (now - this.candidateSince >= this.holdMs) this.current = value;
    return this.current;
  }

  get value(): T {
    return this.current;
  }
}
