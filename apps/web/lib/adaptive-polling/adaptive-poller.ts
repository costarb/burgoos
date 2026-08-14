export interface AdaptivePollerOptions {
  task: (signal: AbortSignal) => Promise<void>;
  visibleIntervalMs: number;
  hiddenIntervalMs: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  jitterRatio?: number;
  random?: () => number;
  runImmediately?: boolean;
  visibility?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
}

export class AdaptivePoller {
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private started = false;
  private refreshOnCompletion = false;
  private failures = 0;

  constructor(private readonly options: AdaptivePollerOptions) {}

  start(): void {
    if (this.started || this.controller.signal.aborted) return;
    this.started = true;
    this.visibility.addEventListener("visibilitychange", this.handleVisibility);
    if (this.options.runImmediately === false) this.schedule(this.currentInterval());
    else void this.run();
  }

  stop(): void {
    if (this.controller.signal.aborted) return;
    this.started = false;
    this.clearTimer();
    this.visibility.removeEventListener("visibilitychange", this.handleVisibility);
    this.controller.abort();
  }

  refresh(): void {
    if (!this.started || this.controller.signal.aborted) return;
    this.clearTimer();
    if (this.running) this.refreshOnCompletion = true;
    else this.schedule(0);
  }

  private readonly handleVisibility = (): void => {
    if (this.visibility.visibilityState === "visible") this.refresh();
    else if (!this.running) {
      this.clearTimer();
      this.schedule(this.currentInterval());
    }
  };

  private schedule(delayMs: number): void {
    if (!this.started || this.controller.signal.aborted) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, Math.max(0, delayMs));
  }

  private async run(): Promise<void> {
    if (this.running || !this.started || this.controller.signal.aborted) return;
    this.running = true;
    try {
      await this.options.task(this.controller.signal);
      this.failures = 0;
    } catch (error) {
      if (!this.controller.signal.aborted && !isAbortError(error)) this.failures += 1;
    } finally {
      this.running = false;
      if (this.started && !this.controller.signal.aborted) {
        if (this.refreshOnCompletion) {
          this.refreshOnCompletion = false;
          this.schedule(0);
        } else {
          this.schedule(this.nextDelay());
        }
      }
    }
  }

  private nextDelay(): number {
    if (this.failures === 0) return this.currentInterval();
    const base = this.options.backoffBaseMs ?? this.currentInterval();
    const maximum = this.options.backoffMaxMs ?? Math.max(base, this.currentInterval() * 8);
    const bounded = Math.min(maximum, base * 2 ** Math.max(0, this.failures - 1));
    const jitter = this.options.jitterRatio ?? 0.2;
    const random = Math.min(1, Math.max(0, (this.options.random ?? Math.random)()));
    return Math.max(1, Math.round(bounded * (1 + (random * 2 - 1) * jitter)));
  }

  private currentInterval(): number {
    return this.visibility.visibilityState === "visible"
      ? this.options.visibleIntervalMs
      : this.options.hiddenIntervalMs;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private get visibility(): AdaptivePollerOptions["visibility"] & object {
    return this.options.visibility ?? document;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
