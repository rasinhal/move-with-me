import "./styles.css";
import { CameraError, startCamera, stopCamera } from "./camera";
import { Debounced, FRAMING_MESSAGES, assessFraming, type FramingStatus } from "./framing";
import { JOINTS, measureJoints, type JointId } from "./geometry";
import { createPoseTracker, type ModelQuality, type PoseTracker } from "./pose";
import { drawSkeleton } from "./skeleton";
import { FpsCounter, Smoother } from "./smoothing";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const stage = byId<HTMLDivElement>("stage");
const video = byId<HTMLVideoElement>("video");
const canvas = byId<HTMLCanvasElement>("overlay");
const placeholder = byId<HTMLDivElement>("placeholder");
const statusEl = byId<HTMLParagraphElement>("status");
const startButton = byId<HTMLButtonElement>("start");
const stopButton = byId<HTMLButtonElement>("stop");
const qualitySelect = byId<HTMLSelectElement>("quality");
const jointsEl = byId<HTMLDListElement>("joints");
const metaEl = byId<HTMLParagraphElement>("meta");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D is not supported in this browser.");

type Tone = "neutral" | "good" | "warn" | "error";
type StageState = "idle" | "starting" | "running" | "error";

const css = getComputedStyle(document.documentElement);
const skeletonStyle = {
  boneColor: css.getPropertyValue("--bone").trim() || "#7fe0c0",
  jointColor: css.getPropertyValue("--joint").trim() || "#ffffff",
};

let stream: MediaStream | null = null;
let tracker: PoseTracker | null = null;
let trackerQuality: ModelQuality | null = null;
let frameRequest = 0;
let lastVideoTime = -1;
let lastPanelUpdate = 0;
let running = false;

let framing = new Debounced<FramingStatus>("noPerson", 400);
const fps = new FpsCounter();
const smoothers = new Map<JointId, Smoother>(JOINTS.map((j) => [j.id, new Smoother()]));
const jointValueEls = new Map<JointId, HTMLElement>();

for (const joint of JOINTS) {
  const dt = document.createElement("dt");
  dt.textContent = joint.label;
  const dd = document.createElement("dd");
  dd.textContent = "–";
  jointsEl.append(dt, dd);
  jointValueEls.set(joint.id, dd);
}

function setStatus(message: string, tone: Tone): void {
  // Only touch the DOM on change so screen readers are not flooded with repeats.
  if (statusEl.textContent === message && statusEl.dataset.tone === tone) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function setStage(state: StageState, placeholderText?: string): void {
  stage.dataset.state = state;
  if (placeholderText) placeholder.textContent = placeholderText;
  startButton.hidden = state === "running";
  stopButton.hidden = state !== "running";
  startButton.disabled = state === "starting";
  qualitySelect.disabled = state === "starting" || state === "running";
  startButton.textContent = state === "starting" ? "Starting…" : state === "error" ? "Try again" : "Start camera";
}

async function getTracker(quality: ModelQuality): Promise<PoseTracker> {
  if (tracker && trackerQuality === quality) return tracker;
  tracker?.close();
  tracker = null;
  const created = await createPoseTracker(quality);
  tracker = created;
  trackerQuality = quality;
  return created;
}

async function start(): Promise<void> {
  if (running || stage.dataset.state === "starting") return;
  setStage("starting", "Starting camera and loading the body tracker…");
  setStatus("Getting ready. Your browser may ask for permission to use the camera.", "neutral");

  const quality = qualitySelect.value === "lite" ? "lite" : "full";
  // Start both at once; the model download is the slower of the two on first use.
  const [cameraResult, trackerResult] = await Promise.allSettled([startCamera(video), getTracker(quality)]);

  if (cameraResult.status === "rejected" || trackerResult.status === "rejected") {
    if (cameraResult.status === "fulfilled") stopCamera(video, cameraResult.value);
    const message =
      cameraResult.status === "rejected"
        ? cameraResult.reason instanceof CameraError
          ? cameraResult.reason.message
          : "The camera could not be started. Please try again."
        : "The body tracker could not be loaded. Check your internet connection and try again.";
    if (trackerResult.status === "rejected") console.error(trackerResult.reason);
    setStage("error", "Something went wrong. See the message below.");
    setStatus(message, "error");
    return;
  }

  stream = cameraResult.value;
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    stop();
    setStatus("The camera was disconnected. Reconnect it and press Start camera.", "warn");
  });

  running = true;
  lastVideoTime = -1;
  fps.reset();
  framing = new Debounced<FramingStatus>("noPerson", 400);
  setStage("running");
  setStatus("Looking for you…", "neutral");
  frameRequest = requestAnimationFrame(loop);
}

function stop(): void {
  running = false;
  cancelAnimationFrame(frameRequest);
  stopCamera(video, stream);
  stream = null;
  ctx!.clearRect(0, 0, canvas.width, canvas.height);
  for (const el of jointValueEls.values()) el.textContent = "–";
  metaEl.textContent = "";
  setStage("idle", "Your camera picture will appear here.");
  setStatus("Camera stopped. Press Start camera to begin again.", "neutral");
}

const TONE_FOR: Record<FramingStatus, Tone> = {
  noPerson: "warn",
  partial: "warn",
  tooClose: "warn",
  tooFar: "warn",
  showFeet: "warn",
  moveLeft: "warn",
  moveRight: "warn",
  good: "good",
};

function loop(now: number): void {
  if (!running || !tracker) return;
  frameRequest = requestAnimationFrame(loop);

  // Only run the model when the camera has produced a new frame.
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  let result;
  try {
    result = tracker.detect(video, now);
  } catch (error) {
    console.error(error);
    stop();
    setStage("error", "Tracking stopped unexpectedly.");
    setStatus("Body tracking stopped unexpectedly. Press Try again.", "error");
    return;
  }

  const image = result.landmarks[0];
  const world = result.worldLandmarks[0];

  ctx!.clearRect(0, 0, canvas.width, canvas.height);
  if (image) drawSkeleton(ctx!, image, skeletonStyle);

  const status = framing.update(assessFraming(image).status, now);
  setStatus(FRAMING_MESSAGES[status], TONE_FOR[status]);

  const angles = image && world ? measureJoints(world, image) : null;
  const smoothed = new Map<JointId, number | null>();
  for (const joint of JOINTS) {
    smoothed.set(joint.id, smoothers.get(joint.id)!.update(angles?.[joint.id] ?? null, now));
  }

  const currentFps = fps.tick(now);
  // Refreshing text a few times a second is easier to read than every frame.
  if (now - lastPanelUpdate > 200) {
    lastPanelUpdate = now;
    for (const [id, el] of jointValueEls) {
      const value = smoothed.get(id);
      el.textContent = value == null ? "–" : `${Math.round(value)}°`;
    }
    metaEl.textContent = `${Math.round(currentFps)} frames per second · ${tracker.delegate === "GPU" ? "graphics card" : "processor"} · ${trackerQuality === "lite" ? "faster" : "best accuracy"} model`;
  }
}

startButton.addEventListener("click", () => void start());
stopButton.addEventListener("click", stop);

document.addEventListener("visibilitychange", () => {
  // Save battery while the tab is hidden; resume tracking when it comes back.
  if (!running) return;
  if (document.hidden) cancelAnimationFrame(frameRequest);
  else frameRequest = requestAnimationFrame(loop);
});

window.addEventListener("pagehide", () => {
  if (running) stop();
  tracker?.close();
  tracker = null;
});

setStage("idle");
