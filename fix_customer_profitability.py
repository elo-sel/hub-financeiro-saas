from pathlib import Path
import re

path = Path('/home/ubuntu/hub-financeiro-saas/server/db.ts')
text = path.read_text()
replacement = '''export async function processamento_customerProfitability(input: { from?: Date; to?: Date; productId?: number }) {
  const db = await getDb();
  if (!db) return { top: [], bottom: [] };
  const txFilters = [eq(transactions.status, "confirmed" as const)];
  if (input.from) txFilters.push(gte(transactions.occurredAt, input.from));
  if (input.to) txFilters.push(lte(transactions.occurredAt, input.to));
  if (input.productId) txFilters.push(eq(transactions.productId, input.productId));
  const txRows = await db.select({ transaction: transactions }).from(transactions).where(and(...txFilters));
  const customerRows = await db.select({ customerId: contracts.customerId, customerName: customers.legalName }).from(contracts).leftJoin(customers, eq(customers.id, contracts.customerId)).where(eq(contracts.status, "active" as const));
  const allocationRows = await db.select({ allocation: infrastructureAllocations, customerId: contracts.customerId }).from(infrastructureAllocations).leftJoin(licenses, eq(licenses.id, infrastructureAllocations.licenseId)).leftJoin(contracts, eq(contracts.id, licenses.contractId)).where(input.from && input.to ? and(gte(infrastructureAllocations.competenceMonth, input.from.toISOString().slice(0, 7)), lte(infrastructureAllocations.competenceMonth, input.to.toISOString().slice(0, 7))) : undefined);
  const rows = customerRows.map(row => {
    const revenue = txRows.filter(item => item.transaction.customerId === row.customerId && item.transaction.type === "income").reduce((sum, item) => sum + Number(item.transaction.amount), 0);
    const directCogs = txRows.filter(item => item.transaction.customerId === row.customerId && item.transaction.type === "expense").reduce((sum, item) => sum + Number(item.transaction.amount), 0);
    const allocatedCogs = allocationRows.filter(item => item.customerId === row.customerId && (!input.productId || item.allocation.productId === input.productId)).reduce((sum, item) => sum + Number(item.allocation.allocatedAmount), 0);
    return { customerId: row.customerId, customerName: row.customerName ?? "Cliente sem nome", revenue, cogs: directCogs + allocatedCogs, contribution: 0, marginPercent: null };
  });
  return processamento_rankCustomerProfitability(rows);
}'''
text, count = re.subn(r'export async function processamento_customerProfitability\(.*?\nexport async function processamento_listInvoices', replacement + '\nexport async function processamento_listInvoices', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'replaced {count} functions')
path.write_text(text)
