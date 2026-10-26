import { describe, expect, it } from "vitest";
import { JOINTS, jointAngle, measureJoints, type Point3 } from "../src/geometry";
import { Landmark } from "../src/landmarks";

const p = (x: number, y: number, z = 0, visibility = 1): Point3 => ({ x, y, z, visibility });

describe("jointAngle", () => {
  it("measures a straight limb as 180 degrees", () => {
    expect(jointAngle(p(0, 0), p(1, 0), p(2, 0))).toBeCloseTo(180);
  });

  it("measures a right angle", () => {
    expect(jointAngle(p(0, 1), p(0, 0), p(1, 0))).toBeCloseTo(90);
  });

  it("measures a fully folded limb as 0 degrees", () => {
    expect(jointAngle(p(1, 0), p(0, 0), p(2, 0))).toBeCloseTo(0);
  });

  it("uses depth as well as x and y", () => {
    // Forearm points straight at the camera while the upper arm hangs down.
    expect(jointAngle(p(0, -1, 0), p(0, 0, 0), p(0, 0, 1))).toBeCloseTo(90);
  });

  it("returns null when two points coincide", () => {
    expect(jointAngle(p(0, 0), p(0, 0), p(1, 0))).toBeNull();
  });

  it("stays a real number for nearly parallel vectors", () => {
    const angle = jointAngle(p(1e-9, 1), p(0, 0), p(0, 1));
    expect(Number.isNaN(angle)).toBe(false);
    expect(angle).toBeCloseTo(0);
  });
});

describe("measureJoints", () => {
  function standingBody(visibility = 1): Point3[] {
    const body = Array.from({ length: 33 }, () => p(0, 0, 0, visibility));
    const L = Landmark;
    // A person standing straight with arms hanging and elbows bent to 90 degrees.
    body[L.LEFT_SHOULDER] = p(0.2, 1.5, 0, visibility);
    body[L.LEFT_ELBOW] = p(0.2, 1.2, 0, visibility);
    body[L.LEFT_WRIST] = p(0.2, 1.2, 0.3, visibility);
    body[L.LEFT_HIP] = p(0.1, 0.9, 0, visibility);
    body[L.LEFT_KNEE] = p(0.1, 0.5, 0, visibility);
    body[L.LEFT_ANKLE] = p(0.1, 0.1, 0, visibility);
    return body;
  }

  it("returns every joint", () => {
    const body = standingBody();
    const angles = measureJoints(body, body);
    expect(Object.keys(angles).sort()).toEqual(JOINTS.map((j) => j.id).sort());
  });

  it("measures the joints it can see", () => {
    const body = standingBody();
    const angles = measureJoints(body, body);
    expect(angles.leftKnee).toBeCloseTo(180);
    expect(angles.leftElbow).toBeCloseTo(90);
  });

  it("reports null for joints the camera cannot see clearly", () => {
    const world = standingBody();
    const image = standingBody();
    image[Landmark.LEFT_ANKLE] = { ...image[Landmark.LEFT_ANKLE]!, visibility: 0.2 };
    const angles = measureJoints(world, image);
    expect(angles.leftKnee).toBeNull();
    expect(angles.leftHip).not.toBeNull();
  });

  it("reports null when landmarks are missing", () => {
    expect(measureJoints([], []).leftElbow).toBeNull();
  });
});
