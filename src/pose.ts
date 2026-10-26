import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";

export type ModelQuality = "lite" | "full";

/** Google's hosted pose models. "full" is more accurate, "lite" runs faster on older computers. */
const MODEL_URLS: Record<ModelQuality, string> = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
};

/** The WebAssembly runtime is served by the app itself (copied by scripts/copy-wasm.mjs). */
const WASM_PATH = new URL(`${import.meta.env.BASE_URL}mediapipe/wasm`, window.location.href).href;

export interface PoseTracker {
  detect(video: HTMLVideoElement, timestampMs: number): PoseLandmarkerResult;
  readonly delegate: "GPU" | "CPU";
  close(): void;
}

/**
 * Loads the pose model. Tries the GPU first because it is much faster, and falls
 * back to the CPU on machines where WebGL is unavailable.
 */
export async function createPoseTracker(quality: ModelQuality): Promise<PoseTracker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

  let lastError: unknown;
  for (const delegate of ["GPU", "CPU"] as const) {
    try {
      const landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URLS[quality], delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
      return wrap(landmarker, delegate);
    } catch (error) {
      lastError = error;
      console.warn(`Pose model failed to start on ${delegate}`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The pose model could not be loaded.");
}

function wrap(landmarker: PoseLandmarker, delegate: "GPU" | "CPU"): PoseTracker {
  // MediaPipe requires strictly increasing timestamps in VIDEO mode.
  let lastTimestamp = -1;
  return {
    delegate,
    detect(video, timestampMs) {
      const ts = Math.max(timestampMs, lastTimestamp + 1);
      lastTimestamp = ts;
      return landmarker.detectForVideo(video, ts);
    },
    close() {
      landmarker.close();
    },
  };
}
