import { Landmark } from "./landmarks";

export interface Point3 {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Angle in degrees at joint `b` formed by the segments b→a and b→c,
 * from 0 (fully folded) to 180 (straight). Returns null when either
 * segment has zero length, because the angle is then undefined.
 */
export function jointAngle(a: Point3, b: Point3, c: Point3): number | null {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = a.z - b.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const len1 = Math.hypot(v1x, v1y, v1z);
  const len2 = Math.hypot(v2x, v2y, v2z);
  if (len1 === 0 || len2 === 0) return null;
  const cos = (v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2);
  // Clamp to guard against floating point drift just outside [-1, 1].
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

export interface JointDefinition {
  id: JointId;
  label: string;
  /** Landmark indices [a, joint, c]. */
  points: readonly [number, number, number];
}

export type JointId =
  | "leftElbow" | "rightElbow"
  | "leftShoulder" | "rightShoulder"
  | "leftHip" | "rightHip"
  | "leftKnee" | "rightKnee";

const L = Landmark;

/** The joints the app measures. Step 2 builds tai chi pose checks on these. */
export const JOINTS: readonly JointDefinition[] = [
  { id: "leftShoulder", label: "Left shoulder", points: [L.LEFT_ELBOW, L.LEFT_SHOULDER, L.LEFT_HIP] },
  { id: "rightShoulder", label: "Right shoulder", points: [L.RIGHT_ELBOW, L.RIGHT_SHOULDER, L.RIGHT_HIP] },
  { id: "leftElbow", label: "Left elbow", points: [L.LEFT_SHOULDER, L.LEFT_ELBOW, L.LEFT_WRIST] },
  { id: "rightElbow", label: "Right elbow", points: [L.RIGHT_SHOULDER, L.RIGHT_ELBOW, L.RIGHT_WRIST] },
  { id: "leftHip", label: "Left hip", points: [L.LEFT_SHOULDER, L.LEFT_HIP, L.LEFT_KNEE] },
  { id: "rightHip", label: "Right hip", points: [L.RIGHT_SHOULDER, L.RIGHT_HIP, L.RIGHT_KNEE] },
  { id: "leftKnee", label: "Left knee", points: [L.LEFT_HIP, L.LEFT_KNEE, L.LEFT_ANKLE] },
  { id: "rightKnee", label: "Right knee", points: [L.RIGHT_HIP, L.RIGHT_KNEE, L.RIGHT_ANKLE] },
];

/** Below this visibility a landmark is treated as not reliably seen. */
export const MIN_VISIBILITY = 0.6;

export function isVisible(p: Point3 | undefined, minVisibility = MIN_VISIBILITY): p is Point3 {
  return p !== undefined && (p.visibility ?? 1) >= minVisibility;
}

/**
 * Measures every joint in JOINTS.
 *
 * `world` holds MediaPipe's 3D world landmarks (metres, centred on the hips), which
 * give angles that do not depend on how far the person stands from the camera or on
 * the video's aspect ratio. Visibility is read from `image` (the normalised landmarks)
 * because that is where MediaPipe reports how clearly each point is seen.
 * A joint is null when any of its three points is not clearly visible.
 */
export function measureJoints(
  world: readonly Point3[],
  image: readonly Point3[],
  minVisibility = MIN_VISIBILITY,
): Record<JointId, number | null> {
  const result = {} as Record<JointId, number | null>;
  for (const joint of JOINTS) {
    const [ia, ib, ic] = joint.points;
    const seen = joint.points.every((i) => isVisible(image[i], minVisibility));
    const a = world[ia], b = world[ib], c = world[ic];
    result[joint.id] = seen && a && b && c ? jointAngle(a, b, c) : null;
  }
  return result;
}
