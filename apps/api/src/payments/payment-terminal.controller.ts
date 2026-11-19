import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { RequirePermission } from "../auth/guards/require-permission.decorator";
import { CurrentUser } from "../platform/auth/current-user.decorator";
import { AuthUser } from "../platform/auth/auth.types";
import { JwtAuthGuard } from "../platform/auth/jwt-auth.guard";
import { PaymentTerminalService } from "./mercado-pago-point/payment-terminal.service";

@ApiTags("payments")
@ApiBearerAuth()
@Controller("admin/payment-terminals")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentTerminalController {
  constructor(private readonly terminals: PaymentTerminalService) {}

  @Get()
  @ApiOperation({ summary: "Listar terminais Point descobertos para a loja" })
  @RequirePermission("payments.charge", "payment-terminals.manage")
  list(@CurrentUser() user: AuthUser) {
    return this.terminals.list(user.tenantId);
  }

  @Post("sync")
  @ApiOperation({ summary: "Sincronizar terminais Point com o Mercado Pago" })
  @RequirePermission("payment-terminals.manage")
  sync(@CurrentUser() user: AuthUser) {
    return this.terminals.synchronize(user.tenantId);
  }

  @Patch(":terminalId/operating-mode")
  @ApiOperation({ summary: "Mudar a maquininha entre modo PDV (integrado) e modo normal" })
  @ApiParam({ name: "terminalId", format: "uuid" })
  @RequirePermission("payment-terminals.manage")
  operatingMode(
    @CurrentUser() user: AuthUser,
    @Param("terminalId", ParseUUIDPipe) terminalId: string,
    @Body() body: { mode?: string },
  ) {
    if (body?.mode !== "PDV" && body?.mode !== "STANDALONE") {
      throw new BadRequestException("Modo deve ser PDV ou STANDALONE");
    }
    return this.terminals.setOperatingMode(user.tenantId, terminalId, body.mode);
  }

  @Patch(":terminalId/enabled")
  @ApiOperation({ summary: "Habilitar ou desabilitar terminal em modo PDV" })
  @ApiParam({ name: "terminalId", format: "uuid" })
  @RequirePermission("payment-terminals.manage")
  enabled(
    @CurrentUser() user: AuthUser,
    @Param("terminalId") terminalId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.terminals.setEnabled(user.tenantId, terminalId, body.enabled === true);
  }
}
