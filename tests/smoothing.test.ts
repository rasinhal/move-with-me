import { describe, expect, it } from "vitest";
import { FpsCounter, Smoother } from "../src/smoothing";

describe("Smoother", () => {
  it("starts at the first sample", () => {
    expect(new Smoother(0.5).update(100, 0)).toBe(100);
  });

  it("moves part of the way toward each new sample", () => {
    const s = new Smoother(0.5);
    s.update(100, 0);
    expect(s.update(200, 33)).toBe(150);
  });

  it("keeps its value through a short gap", () => {
    const s = new Smoother(0.5, 500);
    s.update(100, 0);
    expect(s.update(null, 100)).toBe(100);
  });

  it("forgets the value after a long gap", () => {
    const s = new Smoother(0.5, 500);
    s.update(100, 0);
    expect(s.update(null, 600)).toBeNull();
    expect(s.update(40, 650)).toBe(40);
  });

  it("rejects an invalid alpha", () => {
    expect(() => new Smoother(0)).toThrow(RangeError);
    expect(() => new Smoother(1.5)).toThrow(RangeError);
  });
});

describe("FpsCounter", () => {
  it("reports frames per second over the window", () => {
    const fps = new FpsCounter(1000);
    let value = 0;
    for (let t = 0; t <= 1000; t += 1000 / 30) value = fps.tick(t);
    expect(value).toBeCloseTo(30, 0);
  });

  it("reports zero until two frames have arrived", () => {
    expect(new FpsCounter().tick(0)).toBe(0);
  });
});
