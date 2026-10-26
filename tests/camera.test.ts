import { describe, expect, it } from "vitest";
import { CameraError, describeCameraError } from "../src/camera";

describe("describeCameraError", () => {
  it.each([
    ["NotAllowedError", /blocked/],
    ["NotFoundError", /No camera was found/],
    ["NotReadableError", /busy/],
    ["OverconstrainedError", /does not support/],
    ["NotSupportedError", /cannot open the camera/],
  ])("explains %s in plain words", (name, message) => {
    const error = describeCameraError(new DOMException("browser text", name));
    expect(error).toBeInstanceOf(CameraError);
    expect(error.reason).toBe(name);
    expect(error.message).toMatch(message);
  });

  it("falls back to a general message for unknown errors", () => {
    expect(describeCameraError("weird").message).toMatch(/could not be started/);
  });

  it("passes an existing CameraError through unchanged", () => {
    const original = new CameraError("custom", "InsecureContext");
    expect(describeCameraError(original)).toBe(original);
  });
});
