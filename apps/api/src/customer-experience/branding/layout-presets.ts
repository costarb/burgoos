export interface LayoutPresetDefinition {
  key: string;
  name: string;
  description: string;
  active: boolean;
}

export const DEFAULT_LAYOUT_PRESET_KEY = "classic";

export const BUILT_IN_LAYOUT_PRESETS: LayoutPresetDefinition[] = [
  {
    key: "classic",
    name: "Classico",
    description: "Menu familiar com categorias em destaque.",
    active: true,
  },
  {
    key: "compact",
    name: "Compacto",
    description: "Menu denso para cardapios com muitas categorias e produtos.",
    active: true,
  },
  {
    key: "visual",
    name: "Visual",
    description: "Menu com mais destaque para fotos e identidade da marca.",
    active: true,
  },
];

export function getLayoutPreset(key: string | null | undefined): LayoutPresetDefinition {
  return (
    BUILT_IN_LAYOUT_PRESETS.find((preset) => preset.key === key && preset.active) ??
    BUILT_IN_LAYOUT_PRESETS[0]
  );
}

export function isActiveLayoutPreset(key: string): boolean {
  return BUILT_IN_LAYOUT_PRESETS.some((preset) => preset.key === key && preset.active);
}

export function toLayoutPresetKey(key: string | null | undefined): string {
  return getLayoutPreset(key).key;
}
