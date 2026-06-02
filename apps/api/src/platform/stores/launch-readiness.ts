import { UserRole } from "@prisma/client";
import { isValidStoreSlug } from "./store-slug";

export interface LaunchReadinessCheck {
  key: string;
  passed: boolean;
  message: string;
}

export interface LaunchReadiness {
  ready: boolean;
  checks: LaunchReadinessCheck[];
}

export interface LaunchReadinessStore {
  slug: string;
  phone: string;
  active: boolean;
  defaultLayoutPresetKey?: string | null;
  users?: Array<{ role: UserRole }>;
  visualConfigurations?: Array<{ status: string }>;
}

export function calculateLaunchReadiness(store: LaunchReadinessStore): LaunchReadiness {
  const checks: LaunchReadinessCheck[] = [
    {
      key: "slug",
      passed: isValidStoreSlug(store.slug),
      message: "Slug publico valido",
    },
    {
      key: "active",
      passed: store.active,
      message: "Loja ativa",
    },
    {
      key: "owner",
      passed: Boolean(store.users?.some((user) => user.role === UserRole.OWNER)),
      message: "Responsavel inicial cadastrado",
    },
    {
      key: "phone",
      passed: Boolean(store.phone?.trim()),
      message: "Telefone publico informado",
    },
    {
      key: "branding",
      passed:
        Boolean(store.defaultLayoutPresetKey) ||
        Boolean(store.visualConfigurations?.some((config) => config.status === "PUBLISHED")),
      message: "Identidade visual padrao ou publicada disponivel",
    },
  ];

  return {
    ready: checks.every((check) => check.passed),
    checks,
  };
}
