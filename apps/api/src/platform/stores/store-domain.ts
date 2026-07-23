const DOMAIN_MAX_LENGTH = 253;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeStoreDomain(value: string): string {
  const input = value.trim().toLowerCase();

  if (!input) {
    throw new Error("Dominio da loja e obrigatorio");
  }

  if (
    input.includes("://") ||
    input.includes("/") ||
    input.includes("?") ||
    input.includes("#") ||
    input.includes("@") ||
    input.includes(":") ||
    /\s/.test(input)
  ) {
    throw new Error("Informe somente o dominio, sem protocolo, porta ou caminho");
  }

  const domain = input.replace(/\.$/, "").replace(/^www\./, "");
  const labels = domain.split(".");

  if (
    domain.length > DOMAIN_MAX_LENGTH ||
    labels.length < 2 ||
    labels.some((label) => !DOMAIN_LABEL.test(label))
  ) {
    throw new Error("Dominio da loja invalido");
  }

  return domain;
}

export function normalizeRequestHost(value: string): string {
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  const withoutPort = first.replace(/:\d+$/, "");
  return normalizeStoreDomain(withoutPort);
}
