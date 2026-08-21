import { describe, expect, it } from "vitest";
import { processamento_buildTemporalDre, processamento_calcularAtingimento, processamento_calcularDre, processamento_calcularKpis, processamento_calcularRateioProporcional, processamento_contractMargin } from "../shared/finance";

describe("financeiro: rateio e KPIs", () => {
  it("rateia o custo total entre licenças ativas preservando o total", () => {
    const result = processamento_calcularRateioProporcional(100, [{ id: 1, active: true }, { id: 2, active: true }, { id: 3, active: false }]);
    expect(result).toEqual([{ id: 1, amount: 50 }, { id: 2, amount: 50 }]);
    expect(result.reduce((sum, item) => sum + item.amount, 0)).toBe(100);
  });

  it("rateia centavos no último item sem perder valor", () => {
    const result = processamento_calcularRateioProporcional(10, [{ id: 1, active: true }, { id: 2, active: true }, { id: 3, active: true }]);
    expect(result.reduce((sum, item) => sum + item.amount, 0)).toBe(10);
  });

  it("calcula atingimento de meta e trata meta vazia", () => {
    expect(processamento_calcularAtingimento(10, 8)).toBe(80);
    expect(processamento_calcularAtingimento(0, 8)).toBeNull();
  });

  it("calcula DRE gerencial com impostos configuráveis", () => {
    const result = processamento_calcularDre({ revenue: 1000, taxRatePercent: 5, cogs: 200, opex: 300 });
    expect(result.taxes).toBe(50);
    expect(result.netRevenue).toBe(950);
    expect(result.ebitda).toBe(450);
  });

  it("agrupa DRE por mês e calcula EBITDA", () => {
    const result = processamento_buildTemporalDre([{ date: "2026-01-10T00:00:00.000Z", income: 1000, taxes: 50, cogs: 200, opex: 300 }, { date: "2026-01-20T00:00:00.000Z", income: 500, taxes: 25, cogs: 100, opex: 50 }], "month");
    expect(result).toEqual([{ period: "2026-01", revenue: 1500, taxes: 75, cogs: 300, opex: 350, ebitda: 775 }]);
  });

  it("calcula margem de contribuição com COGS direto e rateado", () => {
    const result = processamento_contractMargin({ revenue: 1000, directCogs: 100, allocatedCogs: 200, opex: 50 });
    expect(result.contribution).toBe(700);
    expect(result.marginPercent).toBe(70);
    expect(result.afterOpex).toBe(650);
  });

  it("calcula margem, queima, caixa e runway sobre valores reais", () => {
    const result = processamento_calcularKpis({ mrr: 1000, received: 1000, cogs: 200, opex: 300, openingCash: 5000 });
    expect(result.grossMargin).toBe(80);
    expect(result.netBurnRate).toBe(-500);
    expect(result.cashBalance).toBe(5500);
    expect(result.runway).toBeNull();
  });
});
