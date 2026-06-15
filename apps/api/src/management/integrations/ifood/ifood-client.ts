import { DeliveryProvider } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeliveryProviderAdapter, ProviderValidationResult } from "../delivery-provider.adapter";

@Injectable()
export class IfoodClient implements DeliveryProviderAdapter {
  readonly provider = DeliveryProvider.IFOOD;

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

  private isMockMode() {
    return this.config.get<string>("IFOOD_MOCK_MODE") === "true";
  }
}
