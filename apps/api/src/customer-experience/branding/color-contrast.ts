const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function assertHexColor(value: string, fieldName: string): string {
  if (!isHexColor(value)) {
    throw new Error(`${fieldName} deve usar formato hexadecimal #RRGGBB`);
  }

  return value.toUpperCase();
}

export function getContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function hasReadableContrast(
  foreground: string,
  background: string,
  minimumRatio = 4.5
): boolean {
  return getContrastRatio(foreground, background) >= minimumRatio;
}

export function getReadableTextColor(background: string): "#000000" | "#FFFFFF" {
  assertHexColor(background, "Cor de fundo");

  return getContrastRatio("#000000", background) >= getContrastRatio("#FFFFFF", background)
    ? "#000000"
    : "#FFFFFF";
}

function getRelativeLuminance(hexColor: string): number {
  assertHexColor(hexColor, "Cor");

  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hexColor.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
