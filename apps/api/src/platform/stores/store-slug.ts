const RESERVED_STORE_SLUGS = new Set([
  "admin",
  "api",
  "platform",
  "login",
  "pedido",
  "checkout",
  "cardapio",
]);

export function normalizeStoreSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function isReservedStoreSlug(slug: string): boolean {
  return RESERVED_STORE_SLUGS.has(slug);
}

export function isValidStoreSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !isReservedStoreSlug(slug);
}

export function assertValidStoreSlug(value: string): string {
  const slug = normalizeStoreSlug(value);

  if (!slug) {
    throw new Error("Slug da loja e obrigatorio");
  }

  if (isReservedStoreSlug(slug)) {
    throw new Error("Este slug e reservado para rotas internas");
  }

  if (!isValidStoreSlug(slug)) {
    throw new Error("Slug deve conter apenas letras, numeros e hifen");
  }

  return slug;
}
