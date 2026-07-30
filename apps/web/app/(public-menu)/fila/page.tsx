import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getPublicOrderQueue,
  getPublicOrderQueueByDomain,
} from "../../../lib/api";
import { PublicOrderQueueClient } from "./public-order-queue";

export const dynamic = "force-dynamic";

export default async function PublicOrderQueuePage({
  searchParams,
}: {
  searchParams?: { loja?: string };
}) {
  const slug = normalizeSlug(searchParams?.loja);
  const host = requestHost();
  const domain = normalizeDomain(host);
  const queue = slug
    ? await getPublicOrderQueue(slug)
    : domain
      ? await getPublicOrderQueueByDomain(domain)
      : null;

  if (!queue) notFound();

  return (
    <PublicOrderQueueClient
      initialQueue={queue}
      source={slug ? { slug } : { domain: domain! }}
    />
  );
}

function requestHost() {
  const requestHeaders = headers();
  return firstValue(requestHeaders.get("x-forwarded-host"))
    ?? firstValue(requestHeaders.get("host"));
}

function firstValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function normalizeDomain(value: string | null): string | null {
  if (!value) return null;
  const domain = value.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
    .replace(/^www\./, "");
  return domain.includes(".") && /^[a-z0-9.-]+$/.test(domain) ? domain : null;
}

function normalizeSlug(value?: string): string | null {
  const slug = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
