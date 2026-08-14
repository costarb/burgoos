export interface ResourceAlertSample {
  role: string;
  rss: number;
  level: "NORMAL" | "WARNING" | "HIGH";
  activeHandler?: string;
  correlationId?: string;
}

export function resourceAlerts(samples: readonly ResourceAlertSample[], peakBytes: number): Array<{
  severity: "warning" | "critical";
  role: string;
  handler?: string;
  correlationId?: string;
}> {
  return samples.flatMap((sample, index) => {
    const previous = samples[index - 1];
    const sustained = previous?.role === sample.role && previous.level !== "NORMAL";
    if (sample.rss >= peakBytes) return [{ severity: "critical" as const, role: sample.role, handler: sample.activeHandler, correlationId: sample.correlationId }];
    if (sample.level !== "NORMAL" && sustained) return [{ severity: sample.level === "HIGH" ? "critical" as const : "warning" as const, role: sample.role, handler: sample.activeHandler, correlationId: sample.correlationId }];
    return [];
  });
}
