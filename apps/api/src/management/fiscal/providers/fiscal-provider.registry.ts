import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { FiscalProvider } from "@prisma/client";
import type { FiscalProviderAdapter } from "./fiscal-provider.adapter";

@Injectable()
export class FiscalProviderRegistry {
  private readonly adapters = new Map<FiscalProvider, FiscalProviderAdapter>();

  register(adapter: FiscalProviderAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new ConflictException(`Provedor fiscal ${adapter.provider} ja registrado`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  /** Test helper and provider swap: replaces a registered adapter. */
  replace(adapter: FiscalProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: FiscalProvider): FiscalProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new NotFoundException(`Provedor fiscal ${provider} nao suportado`);
    return adapter;
  }

  has(provider: FiscalProvider): boolean {
    return this.adapters.has(provider);
  }
}
