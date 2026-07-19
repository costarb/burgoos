import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SalesProvider,
  SalesProviderAdapter,
  SalesProviderCapability,
} from "./sales-provider.adapter";

@Injectable()
export class SalesProviderRegistry {
  private readonly adapters = new Map<SalesProvider, SalesProviderAdapter>();

  register(adapter: SalesProviderAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new ConflictException(`Provider ${adapter.provider} ja registrado`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: SalesProvider): SalesProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new NotFoundException(`Provider ${provider} nao suportado`);
    return adapter;
  }

  listCapabilities(): SalesProviderCapability[] {
    return [...this.adapters.values()].map((adapter) => adapter.capabilities);
  }
}
