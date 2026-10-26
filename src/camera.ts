/** A camera problem described in words a non-technical user can act on. */
export class CameraError extends Error {
  constructor(message: string, readonly reason: string) {
    super(message);
    this.name = "CameraError";
  }
}

export function describeCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return new CameraError(
        "Camera access was blocked. Click the camera icon in your browser's address bar, choose Allow, then try again.",
        name,
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new CameraError("No camera was found. Connect a webcam and try again.", name);
    case "NotReadableError":
    case "TrackStartError":
      return new CameraError(
        "The camera is busy. Close other apps or tabs that may be using it (such as video calls), then try again.",
        name,
      );
    case "OverconstrainedError":
      return new CameraError("Your camera does not support the requested settings. Try a different camera.", name);
    case "SecurityError":
      return new CameraError("The browser blocked the camera on this page for security reasons.", name);
    case "NotSupportedError":
      return new CameraError(
        "This browser cannot open the camera on this page. Please try a recent Chrome, Edge, Firefox or Safari.",
        name,
      );
    case "AbortError":
      return new CameraError("The camera could not be started. Please try again.", name);
    default:
      return new CameraError("The camera could not be started. Please try again.", name || "Unknown");
  }
}

/**
 * Starts the front camera and plays it in `video`. Resolves once the first frame
 * is ready, so the video's width and height are known.
 */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new CameraError(
      "The camera only works on a secure page. Open the app at an https:// address or at http://localhost.",
      "InsecureContext",
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("This browser cannot use a camera. Please try a recent Chrome, Edge, Firefox or Safari.", "Unsupported");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
  } catch (error) {
    throw describeCameraError(error);
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) return resolve();
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new CameraError("The camera stream could not be played.", "PlaybackError"));
      };
      const cleanup = () => {
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadeddata", onReady);
      video.addEventListener("error", onError);
    });
    await video.play();
  } catch (error) {
    stopCamera(video, stream);
    throw describeCameraError(error);
  }
  return stream;
}

export function stopCamera(video: HTMLVideoElement, stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
  video.pause();
  video.srcObject = null;
}
