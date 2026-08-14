import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type MemoryPressureLevel = "NORMAL" | "WARNING" | "HIGH";
export type WorkPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

@Injectable()
export class MemoryPressureService {
  private levelValue: MemoryPressureLevel = "NORMAL";
  private candidate: MemoryPressureLevel | null = null;
  private candidateCount = 0;
  private readonly warningBytes: number;
  private readonly highBytes: number;
  readonly peakBytes: number;
  private readonly requiredSamples: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.warningBytes = mb(config.get<number>("MEMORY_WARNING_RSS_MB") ?? 400);
    this.highBytes = mb(config.get<number>("MEMORY_HIGH_RSS_MB") ?? 440);
    this.peakBytes = mb(config.get<number>("MEMORY_PEAK_RSS_MB") ?? 460);
    this.requiredSamples = config.get<number>("MEMORY_PRESSURE_CONSECUTIVE_SAMPLES") ?? 2;
  }

  get level(): MemoryPressureLevel {
    return this.levelValue;
  }

  observe(rssBytes: number): MemoryPressureLevel {
    const next = this.targetLevel(rssBytes);
    if (next === this.levelValue) {
      this.resetCandidate();
      return this.levelValue;
    }
    if (this.candidate !== next) {
      this.candidate = next;
      this.candidateCount = 1;
      return this.levelValue;
    }
    this.candidateCount += 1;
    if (this.candidateCount >= this.requiredSamples) {
      this.levelValue = next;
      this.resetCandidate();
    }
    return this.levelValue;
  }

  canAdmit(priority: WorkPriority): boolean {
    return this.levelValue !== "HIGH" || priority === "CRITICAL" || priority === "HIGH";
  }

  private targetLevel(rssBytes: number): MemoryPressureLevel {
    if (rssBytes >= this.highBytes) return "HIGH";
    if (rssBytes >= this.warningBytes) return "WARNING";
    return "NORMAL";
  }

  private resetCandidate(): void {
    this.candidate = null;
    this.candidateCount = 0;
  }
}

function mb(value: number): number {
  return value * 1024 * 1024;
}
