import { DeliveryProvider } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeliveryProviderAdapter,
  DeliveryProviderCapabilities,
  ProviderValidationResult,
} from "../delivery-provider.adapter";

@Injectable()
export class IfoodClient implements DeliveryProviderAdapter {
  readonly provider = DeliveryProvider.IFOOD;
  readonly capabilities: DeliveryProviderCapabilities = {
    supportsPolling: true,
    supportsWebhook: false,
    supportsMerchantValidation: true,
    supportsOrderConfirmation: true,
    supportsOrderRefusal: true,
    supportedStatusActions: ["DISPATCH", "READY_TO_PICKUP", "DELIVER", "REQUEST_CANCELLATION"],
  };

  constructor(private readonly config: ConfigService) {}

  async validateMerchant(input: {
    externalMerchantId: string;
    credentialSecret: string;
  }): Promise<ProviderValidationResult> {
    if (this.isMockMode()) {
      return {
        valid: true,
        merchantStatus: "OK",
        checks: [
          { key: "credentials", status: "PASS", message: "Credenciais aceitas em modo mock" },
          { key: "merchant", status: "PASS", message: "Merchant mock acessivel" },
        ],
      };
    }

    const apiBaseUrl = this.config.get<string>("IFOOD_API_BASE_URL");
    if (!apiBaseUrl) {
      throw new Error("IFOOD_API_BASE_URL is not configured");
    }

    const response = await fetch(
      `${apiBaseUrl}/merchant/v1.0/merchants/${input.externalMerchantId}`,
      {
        headers: {
          Authorization: `Bearer ${input.credentialSecret}`,
        },
      }
    );

    if (response.status === 404) {
      return {
        valid: false,
        merchantStatus: "NOT_FOUND",
        checks: [{ key: "merchant", status: "FAIL", message: "Merchant iFood nao encontrado" }],
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        merchantStatus: "UNAUTHORIZED",
        checks: [
          { key: "credentials", status: "FAIL", message: "Token sem acesso ao merchant iFood" },
        ],
      };
    }

    if (!response.ok) {
      return {
        valid: false,
        merchantStatus: "WARNING",
        checks: [
          {
            key: "merchant",
            status: "WARNING",
            message: `iFood respondeu com status ${response.status}`,
          },
        ],
      };
    }

    return {
      valid: true,
      merchantStatus: "OK",
      checks: [
        { key: "credentials", status: "PASS", message: "Token aceito pelo iFood" },
        { key: "merchant", status: "PASS", message: "Merchant acessivel" },
      ],
    };
  }

  async pollEvents(input: { accessToken: string; merchantId: string }): Promise<
    Array<{
      id: string;
      code: string;
      fullCode?: string | null;
      orderId?: string | null;
      createdAt?: string | null;
      metadata?: unknown;
      raw: unknown;
    }>
  > {
    if (this.isMockMode()) {
      return [];
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/order/v1.0/events:polling`, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "x-polling-merchants": input.merchantId,
      },
    });

    if (!response.ok) {
      throw new Error(`iFood event polling failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const events = Array.isArray(payload) ? payload : [];

    return events.map((event) => {
      const record = asRecord(event);
      return {
        id: stringFrom(record.id, "missing-event-id"),
        code: stringFrom(record.code, "UNKNOWN"),
        fullCode: nullableString(record.fullCode),
        orderId: nullableString(record.orderId),
        createdAt: nullableString(record.createdAt),
        metadata: record.metadata,
        raw: event,
      };
    });
  }

  async getOrderDetails(input: { accessToken: string; orderId: string }): Promise<unknown> {
    if (this.isMockMode()) {
      return {
        id: input.orderId,
        merchant: { id: "mock-merchant" },
        customer: { name: "Cliente iFood", phone: null },
        total: { orderAmount: 0 },
        items: [],
        payments: { methods: [] },
        createdAt: new Date().toISOString(),
      };
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/order/v1.0/orders/${input.orderId}`, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`iFood order detail failed with status ${response.status}`);
    }

    return response.json();
  }

  async acknowledgeEvents(input: { accessToken: string; eventIds: string[] }): Promise<void> {
    if (input.eventIds.length === 0 || this.isMockMode()) {
      return;
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/order/v1.0/events/acknowledgment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.eventIds.map((id) => ({ id }))),
    });

    if (!response.ok) {
      throw new Error(`iFood event acknowledgment failed with status ${response.status}`);
    }
  }

  async listCancellationReasons(input: {
    accessToken: string;
    orderId: string;
  }): Promise<Array<{ id: string; description: string }>> {
    if (this.isMockMode()) {
      return [
        { id: "501", description: "Loja sem produto para atender o pedido" },
        { id: "502", description: "Loja fechada ou sem operacao no momento" },
      ];
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/order/v1.0/orders/${input.orderId}/cancellationReasons`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`iFood cancellation reasons failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const reasons = Array.isArray(payload) ? payload : asArray(asRecord(payload).reasons);

    return reasons.map((reason) => {
      const record = asRecord(reason);
      return {
        id: stringFrom(record.id ?? record.code, "UNKNOWN"),
        description: stringFrom(record.description ?? record.message, "Motivo iFood"),
      };
    });
  }

  async confirmOrder(input: { accessToken: string; orderId: string }): Promise<void> {
    if (this.isMockMode()) {
      return;
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/order/v1.0/orders/${input.orderId}/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`iFood confirm order failed with status ${response.status}`);
    }
  }

  async requestCancellation(input: {
    accessToken: string;
    orderId: string;
    reasonCode: string;
    reason: string;
  }): Promise<void> {
    if (this.isMockMode()) {
      return;
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/order/v1.0/orders/${input.orderId}/requestCancellation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancellationCode: input.reasonCode,
          reason: input.reason,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`iFood cancellation request failed with status ${response.status}`);
    }
  }

  async dispatchOrder(input: { accessToken: string; orderId: string }): Promise<void> {
    await this.postOrderAction(input, "dispatch", "iFood dispatch order failed");
  }

  async markReadyToPickup(input: { accessToken: string; orderId: string }): Promise<void> {
    await this.postOrderAction(input, "readyToPickup", "iFood ready to pickup failed");
  }

  async markDelivered(input: { accessToken: string; orderId: string }): Promise<void> {
    await this.postOrderAction(input, "delivered", "iFood delivered order failed");
  }

  async respondDispute(input: {
    accessToken: string;
    disputeId: string;
    accepted: boolean;
    reason?: string | null;
  }): Promise<void> {
    if (this.isMockMode()) {
      return;
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/order/v1.0/disputes/${input.disputeId}/response`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accepted: input.accepted,
        reason: input.reason ?? undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`iFood dispute response failed with status ${response.status}`);
    }
  }

  async getDeliveryTracking(input: { accessToken: string; orderId: string }): Promise<unknown> {
    if (this.isMockMode()) {
      return {
        orderId: input.orderId,
        trackingAvailable: false,
        refreshedAt: new Date().toISOString(),
      };
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/order/v1.0/orders/${input.orderId}/tracking`, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`iFood delivery tracking failed with status ${response.status}`);
    }

    return response.json();
  }

  async getMerchantStatus(input: {
    accessToken: string;
    merchantId: string;
  }): Promise<IfoodMerchantOperationStatus[]> {
    if (this.isMockMode()) {
      return [
        {
          salesChannel: "ifood-app",
          operation: "delivery",
          available: true,
          state: "OK",
          title: "Loja aberta",
          subtitle: "Ambiente mock conectado",
          validations: [],
          raw: { mock: true },
        },
      ];
    }

    const payload = await this.fetchMerchantJson({
      accessToken: input.accessToken,
      merchantId: input.merchantId,
      suffix: "status",
      errorMessage: "iFood merchant status failed",
    });
    const statuses = Array.isArray(payload) ? payload : [payload];

    return statuses.map((status) => {
      const record = asRecord(status);
      const message = asRecord(record.message);

      return {
        salesChannel: nullableString(record.salesChannel),
        operation: nullableString(record.operation),
        available: Boolean(record.available),
        state: stringFrom(record.state, "UNKNOWN"),
        title: nullableString(message.title),
        subtitle: nullableString(message.subtitle),
        validations: asArray(record.validations).map((validation) => {
          const validationRecord = asRecord(validation);
          const validationMessage = asRecord(validationRecord.message);
          return {
            id: nullableString(validationRecord.id),
            state: stringFrom(validationRecord.state, "UNKNOWN"),
            code: nullableString(validationRecord.code),
            title: nullableString(validationMessage.title),
            subtitle: nullableString(validationMessage.subtitle),
          };
        }),
        raw: status,
      };
    });
  }

  async getOpeningHours(input: {
    accessToken: string;
    merchantId: string;
  }): Promise<IfoodOpeningHours> {
    if (this.isMockMode()) {
      return {
        storeId: input.merchantId,
        shifts: [
          {
            id: "mock-friday",
            dayOfWeek: "FRIDAY",
            start: "00:00:00",
            duration: 1439,
          },
        ],
        raw: { mock: true },
      };
    }

    const payload = await this.fetchMerchantJson({
      accessToken: input.accessToken,
      merchantId: input.merchantId,
      suffix: "opening-hours",
      errorMessage: "iFood opening hours failed",
    });
    const record = asRecord(payload);

    return {
      storeId: nullableString(record.storeId),
      shifts: asArray(record.shifts).map((shift) => {
        const shiftRecord = asRecord(shift);
        return {
          id: nullableString(shiftRecord.id),
          dayOfWeek: stringFrom(shiftRecord.dayOfWeek, "UNKNOWN"),
          start: stringFrom(shiftRecord.start, "00:00:00"),
          duration: Number(shiftRecord.duration ?? 0),
        };
      }),
      raw: payload,
    };
  }

  private isMockMode() {
    return this.config.get<string>("IFOOD_MOCK_MODE") === "true";
  }

  private requireApiBaseUrl() {
    const apiBaseUrl = this.config.get<string>("IFOOD_API_BASE_URL");
    if (!apiBaseUrl) {
      throw new Error("IFOOD_API_BASE_URL is not configured");
    }
    return apiBaseUrl;
  }

  private async fetchMerchantJson(input: {
    accessToken: string;
    merchantId: string;
    suffix: string;
    errorMessage: string;
  }): Promise<unknown> {
    const apiBaseUrl = this.requireApiBaseUrl();
    const normalized = apiBaseUrl.replace(/\/+$/, "");
    const paths = [
      `${normalized}/merchants/${input.merchantId}/${input.suffix}`,
      `${normalized}/merchant/v1.0/merchants/${input.merchantId}/${input.suffix}`,
    ];
    let lastStatus = 0;

    for (const url of paths) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
      });
      lastStatus = response.status;

      if (response.ok) {
        return response.json();
      }

      if (response.status !== 404) {
        throw new Error(`${input.errorMessage} with status ${response.status}`);
      }
    }

    throw new Error(`${input.errorMessage} with status ${lastStatus}`);
  }

  private async postOrderAction(
    input: { accessToken: string; orderId: string },
    actionPath: string,
    errorMessage: string
  ): Promise<void> {
    if (this.isMockMode()) {
      return;
    }

    const apiBaseUrl = this.requireApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/order/v1.0/orders/${input.orderId}/${actionPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`${errorMessage} with status ${response.status}`);
    }
  }
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringFrom(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export interface IfoodMerchantOperationStatus {
  salesChannel: string | null;
  operation: string | null;
  available: boolean;
  state: string;
  title: string | null;
  subtitle: string | null;
  validations: Array<{
    id: string | null;
    state: string;
    code: string | null;
    title: string | null;
    subtitle: string | null;
  }>;
  raw: unknown;
}

export interface IfoodOpeningHours {
  storeId: string | null;
  shifts: Array<{
    id: string | null;
    dayOfWeek: string;
    start: string;
    duration: number;
  }>;
  raw: unknown;
}
