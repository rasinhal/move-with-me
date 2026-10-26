/**
 * Exponential moving average that tolerates gaps: a null sample (joint not seen)
 * leaves the value alone, and after `resetAfterMs` without a sample the next one
 * starts fresh instead of blending with a stale reading.
 */
export class Smoother {
  private value: number | null = null;
  private lastSampleAt = Number.NEGATIVE_INFINITY;

  /** `alpha` is the weight of each new sample, between 0 (frozen) and 1 (no smoothing). */
  constructor(private readonly alpha = 0.3, private readonly resetAfterMs = 500) {
    if (!(alpha > 0 && alpha <= 1)) throw new RangeError("alpha must be in (0, 1]");
  }

  update(sample: number | null, now: number): number | null {
    if (sample === null || !Number.isFinite(sample)) {
      if (now - this.lastSampleAt > this.resetAfterMs) this.value = null;
      return this.value;
    }
    const stale = now - this.lastSampleAt > this.resetAfterMs;
    this.value = this.value === null || stale ? sample : this.value + this.alpha * (sample - this.value);
    this.lastSampleAt = now;
    return this.value;
  }
}

/** Frames-per-second over a sliding window of recent frame times. */
export class FpsCounter {
  private times: number[] = [];

  constructor(private readonly windowMs = 1000) {}

  tick(now: number): number {
    this.times.push(now);
    while (this.times.length > 0 && now - this.times[0]! > this.windowMs) this.times.shift();
    if (this.times.length < 2) return 0;
    const span = now - this.times[0]!;
    return span > 0 ? ((this.times.length - 1) * 1000) / span : 0;
  }

  reset(): void {
    this.times = [];
  }
}
