import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Response } from "express";
import { Observable, catchError, from, mergeMap, of, throwError } from "rxjs";
import { AuthenticatedRequest } from "../../platform/auth/auth.types";
import { IdempotencyService } from "./idempotency.service";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = request.header("Idempotency-Key")?.trim();

    if (!key) {
      throw new BadRequestException({
        statusCode: 400,
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "O cabecalho Idempotency-Key e obrigatorio",
      });
    }
    if (!request.user?.tenantId) {
      throw new BadRequestException("Estabelecimento autenticado nao identificado");
    }

    const scope = `${request.method}:${request.route?.path ?? request.path}`;
    return from(
      this.idempotency.claim({
        tenantId: request.user.tenantId,
        scope,
        key,
        request: request.body ?? null,
      }),
    ).pipe(
      mergeMap((claim) => {
        if (claim.kind === "replay") {
          response.status(claim.statusCode);
          response.setHeader("Idempotency-Replayed", "true");
          return of(claim.body);
        }

        return next.handle().pipe(
          mergeMap((body) =>
            from(this.idempotency.complete(claim.recordId, response.statusCode, body)).pipe(
              mergeMap(() => of(body)),
            ),
          ),
          catchError((error: unknown) =>
            from(this.idempotency.fail(claim.recordId)).pipe(
              catchError(() => of(undefined)),
              mergeMap(() => throwError(() => error)),
            ),
          ),
        );
      }),
    );
  }
}
