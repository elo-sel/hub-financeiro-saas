export type processamento_RateioItem = { id: number; active: boolean };

export function processamento_calcularRateioProporcional(total: number, itens: processamento_RateioItem[]) {
  const ativos = itens.filter(item => item.active);
  if (total < 0 || ativos.length === 0) return [];
  const base = Math.floor((total / ativos.length) * 100) / 100;
  const remainder = Math.round((total - base * ativos.length) * 100) / 100;
  return ativos.map((item, index) => ({ id: item.id, amount: Math.round((base + (index === ativos.length - 1 ? remainder : 0)) * 100) / 100 }));
}

export function processamento_calcularAtingimento(meta: number, realizado: number) {
  if (meta <= 0) return null;
  return (realizado / meta) * 100;
}

export function processamento_calcularDre(input: { revenue: number; taxRatePercent: number; cogs: number; opex: number }) {
  const taxes = input.revenue * (input.taxRatePercent / 100);
  const netRevenue = input.revenue - taxes;
  const ebitda = netRevenue - input.cogs - input.opex;
  return { taxes, netRevenue, ebitda };
}

export function processamento_calcularKpis(input: { mrr: number; received: number; cogs: number; opex: number; openingCash: number }) {
  const grossMargin = input.received > 0 ? ((input.received - input.cogs) / input.received) * 100 : null;
  const netBurnRate = input.cogs + input.opex - input.received;
  const cashBalance = input.openingCash + input.received - input.cogs - input.opex;
  const runway = netBurnRate > 0 ? cashBalance / netBurnRate : null;
  return { ...input, grossMargin, netBurnRate, cashBalance, runway };
}

export type processamento_DreRow = { period: string; revenue: number; taxes: number; cogs: number; opex: number; ebitda: number };
export function processamento_buildTemporalDre(rows: Array<{ date: string; income: number; taxes: number; cogs: number; opex: number }>, mode: "month" | "quarter" | "year"): processamento_DreRow[] {
  const grouped = new Map<string, processamento_DreRow>();
  for (const row of rows) { const date = new Date(row.date); const year = date.getUTCFullYear(); const month = date.getUTCMonth() + 1; const period = mode === "year" ? String(year) : mode === "quarter" ? `${year}-Q${Math.ceil(month / 3)}` : `${year}-${String(month).padStart(2, "0")}`; const current = grouped.get(period) ?? { period, revenue: 0, taxes: 0, cogs: 0, opex: 0, ebitda: 0 }; current.revenue += row.income; current.taxes += row.taxes; current.cogs += row.cogs; current.opex += row.opex; current.ebitda = current.revenue - current.taxes - current.cogs - current.opex; grouped.set(period, current); }
  return Array.from(grouped.values()).sort((a, b) => a.period.localeCompare(b.period));
}
export function processamento_contractMargin(input: { revenue: number; directCogs: number; allocatedCogs: number; opex: number }) { const contribution = input.revenue - input.directCogs - input.allocatedCogs; return { contribution, marginPercent: input.revenue > 0 ? (contribution / input.revenue) * 100 : null, afterOpex: contribution - input.opex }; }
