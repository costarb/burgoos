export interface StoreBrandingView {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  neutralTheme: "LIGHT" | "DARK" | "SYSTEM_DEFAULT";
  layoutPreset: string;
  showProductImages: boolean;
  showProductDescriptions: boolean;
  orderingEnabled: boolean;
}

export const DEFAULT_STORE_BRANDING: StoreBrandingView = {
  logoUrl: null,
  primaryColor: "#C92A2A",
  accentColor: "#F59F00",
  neutralTheme: "LIGHT",
  layoutPreset: "classic",
  showProductImages: false,
  showProductDescriptions: false,
  orderingEnabled: true,
};

export function toPublicBranding(
  configuration:
    | {
        logoUrl: string | null;
        primaryColor: string;
        accentColor: string;
        neutralTheme: "LIGHT" | "DARK" | "SYSTEM_DEFAULT";
        layoutPresetKey: string;
        showProductImages?: boolean;
        showProductDescriptions?: boolean;
        orderingEnabled?: boolean;
      }
    | null
    | undefined
): StoreBrandingView {
  if (!configuration) {
    return DEFAULT_STORE_BRANDING;
  }

  return {
    logoUrl: configuration.logoUrl,
    primaryColor: configuration.primaryColor,
    accentColor: configuration.accentColor,
    neutralTheme: configuration.neutralTheme,
    layoutPreset: configuration.layoutPresetKey,
    showProductImages: configuration.showProductImages ?? DEFAULT_STORE_BRANDING.showProductImages,
    showProductDescriptions:
      configuration.showProductDescriptions ?? DEFAULT_STORE_BRANDING.showProductDescriptions,
    orderingEnabled: configuration.orderingEnabled ?? DEFAULT_STORE_BRANDING.orderingEnabled,
  };
}
