/**
 * Indices of the 33 body landmarks returned by the MediaPipe Pose Landmarker.
 * "Left" and "right" are the person's own left and right, not the screen's.
 * See https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */
export const Landmark = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export const LANDMARK_COUNT = 33;

/** Pairs of landmark indices drawn as bones. Face detail is left out on purpose. */
export const BODY_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [15, 17], [15, 19], [17, 19], [15, 21], // left hand
  [16, 18], [16, 20], [18, 20], [16, 22], // right hand
  [11, 23], [12, 24], [23, 24], // torso
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
  [27, 29], [29, 31], [27, 31], // left foot
  [28, 30], [30, 32], [28, 32], // right foot
];

/** Landmarks drawn as joints. Face points other than the nose are skipped. */
export const BODY_POINTS: readonly number[] = [0, ...Array.from({ length: LANDMARK_COUNT - 11 }, (_, i) => i + 11)];
