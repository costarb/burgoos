export interface StoreBrandingView {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  neutralTheme: "LIGHT" | "DARK" | "SYSTEM_DEFAULT";
  layoutPreset: string;
}

export const DEFAULT_STORE_BRANDING: StoreBrandingView = {
  logoUrl: null,
  primaryColor: "#C92A2A",
  accentColor: "#F59F00",
  neutralTheme: "LIGHT",
  layoutPreset: "classic",
};

export function toPublicBranding(
  configuration:
    | {
        logoUrl: string | null;
        primaryColor: string;
        accentColor: string;
        neutralTheme: "LIGHT" | "DARK" | "SYSTEM_DEFAULT";
        layoutPresetKey: string;
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
  };
}
