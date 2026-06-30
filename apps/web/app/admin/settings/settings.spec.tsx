import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

vi.mock("../../../lib/api", () => ({
  getAdminToken: vi.fn(),
  getFinancialConfiguration: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    taxRate: 0.06,
    cardFeeRate: 0.035,
    operationalLossRate: 0.03,
    desiredMarginRate: 0.32,
    averagePackagingCost: "2.50",
    monthlyFixedCost: "8000.00",
    monthlyRevenueGoal: "35000.00",
    cmvWarningRate: 0.35,
    netMarginGoalRate: 0.15,
  })),
  updateFinancialConfiguration: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("settings maintenance page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders current financial values in editable inputs", async () => {
    const page = await SettingsPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Parametros financeiros");
    expect(html).toContain('name="taxRate"');
    expect(html).toContain('value="0.06"');
    expect(html).toContain('name="averagePackagingCost"');
    expect(html).toContain('value="2.50"');
    expect(html).toContain('name="monthlyFixedCost"');
    expect(html).toContain('value="8000.00"');
    expect(html).toContain("Salvar parametros");
  });
});
