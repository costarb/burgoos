import { BadRequestException, ConflictException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { EditOrderDto } from "./dto/edit-order.dto";

export function validateOrderMaintenanceInput(status: OrderStatus, dto: EditOrderDto): void {
  if (dto.items.length === 0) {
    throw new BadRequestException("Order must contain at least one item");
  }

  const gross = money(dto.paymentGrossAmount);
  const fee = money(dto.paymentFeeAmount);
  const net = money(dto.paymentNetAmount);

  if (gross?.lt(0) || fee?.lt(0) || net?.lt(0)) {
    throw new BadRequestException("Payment amounts cannot be negative");
  }

  if (gross && fee?.gt(gross)) {
    throw new BadRequestException("Payment fee cannot exceed gross amount");
  }

  if (gross && net?.gt(gross)) {
    throw new BadRequestException("Payment net amount cannot exceed gross amount");
  }

  if ((status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED) && !validReason(dto.reason)) {
    throw new BadRequestException("Reason is required for finalized order maintenance");
  }
}

export function validReason(reason?: string | null): boolean {
  return Boolean(reason?.trim() && reason.trim().length >= 3);
}

export function assertOrderVersion(
  updatedAt: Date,
  deletedAt: Date | null,
  expectedUpdatedAt: string
): void {
  if (deletedAt) {
    throw new ConflictException("Deleted orders cannot be changed");
  }

  if (updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ConflictException("Order changed since it was opened");
  }
}

function money(value?: string | null): Prisma.Decimal | null {
  return value == null || value === "" ? null : new Prisma.Decimal(value);
}
