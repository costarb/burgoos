import type { SalesProviderCapability } from "@burgoos/types";
import React from "react";

export function SalesProviderSelector({
  providers,
  selectedProvider,
  onChange,
}: {
  providers: SalesProviderCapability[];
  selectedProvider: string;
  onChange: (provider: string) => void;
}) {
  const selected = providers.find((provider) => provider.provider === selectedProvider);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold">
        Provider de vendas
        <select
          aria-label="Provider de vendas"
          value={selectedProvider}
          onChange={(event) => onChange(event.target.value)}
          className="rounded border px-3 py-2 font-normal"
        >
          {providers.map((provider) => (
            <option key={provider.provider} value={provider.provider}>{provider.provider}</option>
          ))}
        </select>
      </label>
      {selected ? (
        <p className="self-end text-sm text-slate-600">
          Canal: {selected.channels.join(", ")} · período máximo: {selected.maxPeriodDays} dias
        </p>
      ) : null}
    </div>
  );
}
