import React from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicMenuByDomain } from "../../../lib/api";
import { PublicMenuClient } from "../[slug]/public-menu-client";

export const revalidate = 30;

export default async function DomainPublicMenuPage() {
  const requestHeaders = headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = firstValue(forwardedHost) ?? firstValue(requestHeaders.get("host"));
  const domain = normalizeHost(host);

  if (!domain) notFound();

  const menu = await getPublicMenuByDomain(domain);
  if (!menu) notFound();

  return <PublicMenuClient menu={menu} navigationBase="/cardapio" />;
}

function firstValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  const host = value.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "").replace(/^www\./, "");
  return /^[a-z0-9.-]+$/.test(host) && host.includes(".") ? host : null;
}
