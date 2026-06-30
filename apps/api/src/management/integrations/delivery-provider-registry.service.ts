import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { DeliveryProvider } from "@prisma/client";
import { DeliveryProviderAdapter } from "./delivery-provider.adapter";
import { IfoodClient } from "./ifood/ifood-client";

@Injectable()
export class DeliveryProviderRegistryService {
  private readonly adapters: Map<DeliveryProvider, DeliveryProviderAdapter>;

  constructor(@Inject(IfoodClient) ifoodClient: IfoodClient) {
    this.adapters = new Map([[ifoodClient.provider, ifoodClient]]);
  }

  get(provider: DeliveryProvider): DeliveryProviderAdapter {
    const adapter = this.adapters.get(provider);

    if (!adapter) {
      throw new ConflictException(`Provider ${provider} is not registered`);
    }

    return adapter;
  }

  list() {
    return [...this.adapters.values()].map((adapter) => ({
      provider: adapter.provider,
      capabilities: adapter.capabilities,
    }));
  }
}
