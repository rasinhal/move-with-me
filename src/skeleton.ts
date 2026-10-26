import { MIN_VISIBILITY, type Point3 } from "./geometry";
import { BODY_CONNECTIONS, BODY_POINTS } from "./landmarks";

export interface SkeletonStyle {
  boneColor: string;
  jointColor: string;
}

/**
 * Draws the body skeleton onto `ctx`, which must match the video frame's pixel size.
 * Points the tracker is unsure about are drawn faded rather than hidden, so the
 * user can see which parts of the body the camera is struggling with.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly Point3[],
  style: SkeletonStyle,
): void {
  const { width, height } = ctx.canvas;
  const scale = Math.max(2, Math.min(width, height) / 160);
  const alphaFor = (p: Point3) => ((p.visibility ?? 1) >= MIN_VISIBILITY ? 1 : 0.25);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = scale * 1.5;
  ctx.strokeStyle = style.boneColor;
  for (const [i, j] of BODY_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (!a || !b) continue;
    ctx.globalAlpha = Math.min(alphaFor(a), alphaFor(b));
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  ctx.fillStyle = style.jointColor;
  for (const i of BODY_POINTS) {
    const p = landmarks[i];
    if (!p) continue;
    ctx.globalAlpha = alphaFor(p);
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, scale * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
