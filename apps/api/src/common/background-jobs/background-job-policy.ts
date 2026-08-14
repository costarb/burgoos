export type BackgroundJobPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export interface BackgroundJobPolicyInput {
  attempts: number;
  maxAttempts: number;
}

export interface FairJobCandidate {
  id: string;
  tenantId: string | null;
  priority: BackgroundJobPriority;
  availableAt: Date;
  createdAt: Date;
}

const PRIORITY_ORDER: Record<BackgroundJobPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export class BackgroundJobPolicy {
  constructor(
    private readonly baseDelayMs = 1_000,
    private readonly maxDelayMs = 15 * 60_000,
    private readonly jitterRatio = 0.2
  ) {}

  canRetry(input: BackgroundJobPolicyInput): boolean {
    return input.attempts < input.maxAttempts;
  }

  retryDelayMs(attempts: number, random: () => number = Math.random): number {
    const exponent = Math.max(0, attempts - 1);
    const bounded = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** exponent);
    const centeredRandom = Math.min(1, Math.max(0, random())) * 2 - 1;
    const jittered = bounded * (1 + centeredRandom * this.jitterRatio);
    return Math.max(1, Math.round(Math.min(this.maxDelayMs, jittered)));
  }

  orderFairly(candidates: readonly FairJobCandidate[]): FairJobCandidate[] {
    const sorted = [...candidates].sort(compareCandidates);
    const queues = new Map<string, FairJobCandidate[]>();
    const tenantOrder: string[] = [];

    for (const candidate of sorted) {
      const tenantKey = candidate.tenantId ?? `system:${candidate.id}`;
      if (!queues.has(tenantKey)) {
        queues.set(tenantKey, []);
        tenantOrder.push(tenantKey);
      }
      queues.get(tenantKey)!.push(candidate);
    }

    const result: FairJobCandidate[] = [];
    while (result.length < sorted.length) {
      for (const tenantKey of tenantOrder) {
        const candidate = queues.get(tenantKey)?.shift();
        if (candidate) result.push(candidate);
      }
    }
    return result;
  }
}

function compareCandidates(left: FairJobCandidate, right: FairJobCandidate): number {
  return (
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    left.availableAt.getTime() - right.availableAt.getTime() ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}
