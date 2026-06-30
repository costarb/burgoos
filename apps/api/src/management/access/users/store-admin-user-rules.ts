import { ForbiddenException } from "@nestjs/common";
import { AuthUser } from "../../../platform/auth/auth.types";
import { UserStoreAssignmentDto } from "../dto/user-access.dto";

export function manageableStoreIds(actor: AuthUser): string[] {
  if (actor.isMaster || actor.isPlatformAdmin) {
    return [];
  }

  return actor.manageableStoreIds ?? [];
}

export function assertCanManageAssignments(
  actor: AuthUser,
  assignments: UserStoreAssignmentDto[] | undefined
): void {
  if (actor.isMaster || actor.isPlatformAdmin || !assignments) {
    return;
  }

  const allowed = manageableStoreIds(actor);
  const outsideScope = assignments.some((assignment) => !allowed.includes(assignment.storeId));

  if (outsideScope) {
    throw new ForbiddenException("Admin de loja nao pode atribuir acesso fora da propria loja");
  }
}

export function assertCanManageTarget(
  actor: AuthUser,
  target: { isMaster: boolean; storeAssignments: Array<{ tenantId: string }> }
): void {
  if (actor.isMaster || actor.isPlatformAdmin) {
    return;
  }

  if (target.isMaster) {
    throw new ForbiddenException("Admin de loja nao pode alterar usuario master");
  }

  const allowed = manageableStoreIds(actor);
  const hasLocalAssignment = target.storeAssignments.some((assignment) =>
    allowed.includes(assignment.tenantId)
  );

  if (!hasLocalAssignment) {
    throw new ForbiddenException("Usuario fora do escopo da loja");
  }
}
