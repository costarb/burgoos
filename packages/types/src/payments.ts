import type { PaymentInstitution, PaymentMethod } from "./index";

export type ChargeMode = "AUTOMATIC" | "MANUAL";
export type PaymentTargetType = "ORDER" | "SERVICE_TAB";
export type ChargeStatus =
  | "CREATED"
  | "WAITING_CUSTOMER"
  | "PROCESSING"
  | "APPROVED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED"
  | "UNKNOWN"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export interface PaymentTerminal {
  id: string;
  provider: PaymentInstitution;
  providerTerminalId: string;
  displayName: string;
  model: string | null;
  serialNumberMasked: string | null;
  operatingMode: string | null;
  enabled: boolean;
  lastSeenAt: string;
}

export interface CreatePaymentChargeInput {
  targetType: PaymentTargetType;
  targetId: string;
  institution: PaymentInstitution;
  method: PaymentMethod;
  mode: ChargeMode;
  amount: string;
  terminalId?: string;
  cashReceivedAmount?: string;
  manualReference?: string;
}

export interface ManualPaymentOption {
  institution: PaymentInstitution;
  name: string;
  methods: PaymentMethod[];
}

export interface ConfirmManualPaymentInput {
  targetType: PaymentTargetType;
  targetId: string;
  institution: PaymentInstitution;
  method: PaymentMethod;
  amount: string;
  cashReceivedAmount?: string;
  manualReference?: string;
}

export interface CancelManualPaymentInput {
  reason: string;
}

export interface PaymentCharge {
  id: string;
  targetType: PaymentTargetType;
  targetId: string;
  institution: PaymentInstitution;
  method: PaymentMethod;
  mode: ChargeMode;
  status: ChargeStatus;
  amount: string;
  cashReceivedAmount: string | null;
  cashChangeAmount: string | null;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  terminalId: string | null;
  createdAt: string;
  expiresAt: string | null;
  finalizedAt: string | null;
}

export type PaymentExceptionType =
  | "UNKNOWN_RESULT"
  | "POSSIBLE_DUPLICATE"
  | "MANUAL_DIVERGENCE"
  | "REFUND_AFTER_DELIVERY"
  | "TOKEN_ERROR";

export interface PaymentException {
  id: string;
  chargeId: string | null;
  paymentId: string | null;
  type: PaymentExceptionType;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  description: string;
  resolution: string | null;
  openedAt: string;
  resolvedAt: string | null;
  charge?: {
    id: string;
    status: ChargeStatus;
    amount: string;
    orderId?: string | null;
    serviceTabId?: string | null;
  } | null;
  payment?: {
    id: string;
    grossAmount: string;
    providerPaymentId: string | null;
  } | null;
}

export interface PaymentExceptionDetail extends PaymentException {
  timeline: Array<{
    id: string;
    type: string;
    source: "USER" | "PROVIDER" | "SYSTEM";
    reason: string | null;
    occurredAt: string;
  }>;
}

export interface ResolvePaymentExceptionInput {
  resolution: string;
}

export interface ShiftCloseSummary {
  openTabs: number;
  activeOrders: number;
  inconclusiveCharges: number;
  openExceptions: number;
  canClose: boolean;
  generatedAt: string;
}
