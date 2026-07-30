import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AccessUserStatus } from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";

export function assertMasterAccess(actor: AuthUser): void {
  if (!actor.isMaster && !actor.isPlatformAdmin) {
    throw new ForbiddenException("Acesso master necessario");
  }
}

const restrictedDelegationPermissions = new Set([
  "pos.override-price",
  "payments.cancel",
  "payments.refund",
  "payments.reconcile",
  "payment-terminals.manage",
  "payment-exceptions.view",
]);

export function assertCanDelegatePermissions(
  actor: AuthUser,
  permissionKeys: string[],
): void {
  if (actor.isMaster || actor.isPlatformAdmin) return;
  const restricted = permissionKeys.filter((key) => restrictedDelegationPermissions.has(key));
  if (restricted.length > 0) {
    throw new ForbiddenException(
      `Somente administracao superior pode delegar: ${restricted.join(", ")}`,
    );
  }
}

export async function assertCanRemoveMaster(
  target: { id: string; isMaster: boolean },
  next: { isMaster?: boolean; status?: AccessUserStatus },
  countActiveMasters: () => Promise<number>
): Promise<void> {
  const removesMaster =
    target.isMaster &&
    (next.isMaster === false ||
      next.status === AccessUserStatus.INACTIVE ||
      next.status === AccessUserStatus.LOCKED);

  if (!removesMaster) {
    return;
  }

  const activeMasters = await countActiveMasters();

  if (activeMasters <= 1) {
    throw new ConflictException("Pelo menos um usuario master ativo deve permanecer");
  }
}
