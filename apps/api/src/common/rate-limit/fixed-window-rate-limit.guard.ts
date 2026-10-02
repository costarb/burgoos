import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import type { Request } from "express";

interface Bucket {
  count: number;
  resetsAt: number;
}

@Injectable()
export abstract class FixedWindowRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  protected abstract readonly limit: number;
  protected readonly windowMs: number = 60_000;
  protected readonly namespace: string = "default";

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = `${this.namespace}:${this.bucketKey(request)}`;
    const current = this.buckets.get(key);
    const bucket = !current || current.resetsAt <= now
      ? { count: 0, resetsAt: now + this.windowMs }
      : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.prune(now);
    if (bucket.count > this.limit) {
      throw new HttpException(
        {
          statusCode: 429,
          code: "RATE_LIMITED",
          message: "Muitas requisicoes. Tente novamente em instantes.",
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)),
        },
        429,
      );
    }
    return true;
  }

  /** Identifies the caller sharing a bucket; defaults to the client IP. */
  protected bucketKey(request: Request): string {
    return request.ip || request.socket.remoteAddress || "unknown";
  }

  private prune(now: number) {
    if (this.buckets.size < 2_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetsAt <= now) this.buckets.delete(key);
    }
  }
}
