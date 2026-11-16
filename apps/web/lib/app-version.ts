/** Version of this web build: short git commit and build time (spec: admin version check). */
export const WEB_VERSION = {
  commit: (process.env.NEXT_PUBLIC_APP_COMMIT || "").slice(0, 7) || "dev",
  builtAt: process.env.NEXT_PUBLIC_APP_BUILT_AT || null,
};

export interface ApiVersion {
  commit: string;
  branch: string | null;
  startedAt: string;
}

/** "16/11 17:18" in the store time zone; empty when the date is missing. */
export function formatVersionTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}
