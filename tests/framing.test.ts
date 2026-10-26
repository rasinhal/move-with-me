import { describe, expect, it } from "vitest";
import { Debounced, assessFraming } from "../src/framing";
import type { Point3 } from "../src/geometry";
import { Landmark } from "../src/landmarks";

const L = Landmark;

/**
 * A synthetic, well-placed person in normalised image coordinates (camera
 * orientation, not mirrored). `dx` shifts them sideways, `scale` changes their
 * size around the frame's centre, `dy` moves them up or down.
 */
function person({ dx = 0, dy = 0, scale = 1, visibility = 0.99 } = {}): Point3[] {
  const body: Point3[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility }));
  const set = (i: number, x: number, y: number) => {
    body[i] = { x: 0.5 + (x - 0.5) * scale + dx, y: 0.5 + (y - 0.5) * scale + dy, z: 0, visibility };
  };
  set(L.NOSE, 0.5, 0.15);
  set(L.LEFT_SHOULDER, 0.56, 0.25);
  set(L.RIGHT_SHOULDER, 0.44, 0.25);
  set(L.LEFT_HIP, 0.54, 0.52);
  set(L.RIGHT_HIP, 0.46, 0.52);
  set(L.LEFT_KNEE, 0.54, 0.7);
  set(L.RIGHT_KNEE, 0.46, 0.7);
  set(L.LEFT_ANKLE, 0.54, 0.88);
  set(L.RIGHT_ANKLE, 0.46, 0.88);
  return body;
}

describe("assessFraming", () => {
  it("asks the person to step into view when nobody is detected", () => {
    expect(assessFraming(undefined).status).toBe("noPerson");
    expect(assessFraming([]).status).toBe("noPerson");
  });

  it("accepts a centred, full-body view", () => {
    const result = assessFraming(person());
    expect(result.status).toBe("good");
    expect(result.message).toMatch(/whole body/);
  });

  it("asks to see the torso when shoulders or hips are unclear", () => {
    const body = person();
    body[L.LEFT_HIP] = { ...body[L.LEFT_HIP]!, visibility: 0.1 };
    expect(assessFraming(body).status).toBe("partial");
  });

  it("asks the person to step back when the feet are cut off", () => {
    expect(assessFraming(person({ dy: 0.15 })).status).toBe("showFeet");
  });

  it("asks the person to step back when the feet are hidden", () => {
    const body = person();
    body[L.RIGHT_ANKLE] = { ...body[L.RIGHT_ANKLE]!, visibility: 0.3 };
    expect(assessFraming(body).status).toBe("showFeet");
  });

  it("asks the person to step back when the head is cut off", () => {
    expect(assessFraming(person({ dy: -0.2 })).status).toBe("tooClose");
  });

  it("asks the person to step back when they fill the frame", () => {
    const body = person({ scale: 1.25 });
    expect(assessFraming(body).status).toBe("tooClose");
  });

  it("asks the person to come closer when they are very small", () => {
    expect(assessFraming(person({ scale: 0.5 })).status).toBe("tooFar");
  });

  it("gives left and right in the person's own terms for the mirrored view", () => {
    // Small raw x means the person is on the right of the mirrored screen,
    // so they need to move to their own left to reach the centre.
    expect(assessFraming(person({ dx: -0.3 })).status).toBe("moveLeft");
    expect(assessFraming(person({ dx: 0.3 })).status).toBe("moveRight");
  });
});

describe("Debounced", () => {
  it("keeps the old value until the new one has held long enough", () => {
    const d = new Debounced("a", 400);
    expect(d.update("b", 0)).toBe("a");
    expect(d.update("b", 399)).toBe("a");
    expect(d.update("b", 400)).toBe("b");
  });

  it("restarts the wait when the candidate changes", () => {
    const d = new Debounced("a", 400);
    d.update("b", 0);
    d.update("c", 300);
    expect(d.update("c", 600)).toBe("a");
    expect(d.update("c", 700)).toBe("c");
  });

  it("ignores a brief flicker back to the current value", () => {
    const d = new Debounced("a", 400);
    d.update("b", 0);
    d.update("a", 100);
    expect(d.update("b", 450)).toBe("a");
  });
});
