import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AccessUserStatus } from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";

export function assertMasterAccess(actor: AuthUser): void {
  if (!actor.isMaster && !actor.isPlatformAdmin) {
    throw new ForbiddenException("Acesso master necessario");
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
