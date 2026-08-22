import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  bankAccounts,
  contracts,
  costCenters,
  customers,
  infrastructureAllocations,
  invoices,
  providers,
  plans,
  InsertUser,
  licenses,
  products,
  goals,
  taxRules,
  transactions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { processamento_filterInvoiceRows, processamento_parseInvoiceExtraction, processamento_rankCustomerProfitability, processamento_validateInvoicePdf } from "../shared/finance";
import { storagePut, storageGetSignedUrl } from "./storage";
import { invokeLLM } from "./_core/llm";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const defaultProducts = [
  { name: "Grupo Elo", slug: "grupo-elo", category: "Consolidador" },
  { name: "Solar Manager", slug: "solar-manager", category: "Gestão Fotovoltaica" },
  { name: "Elo Pay", slug: "elo-pay", category: "Fintech e Cobranças" },
  { name: "Elo CRM", slug: "elo-crm", category: "Vendas e CRM" },
];
const defaultProviders = [
  { name: "Google Cloud Platform", code: "gcp" },
  { name: "Amazon Web Services", code: "aws" },
  { name: "Microsoft Azure", code: "azure" },
  { name: "Cloudflare", code: "cloudflare" },
  { name: "APIs e serviços externos", code: "apis" },
];
const defaultCostCenters = [
  { name: "Receita de contratos", code: "revenue-contracts", kind: "revenue" as const },
  { name: "Infraestrutura e computação", code: "cogs-infra", kind: "cogs" as const },
  { name: "Despesas operacionais", code: "opex-general", kind: "opex" as const },
  { name: "Caixa e bancos", code: "cash-banks", kind: "cash" as const },
];

export async function processamento_ensureCatalog() {
  const db = await getDb();
  if (!db) return;
  for (const item of defaultProviders) {
    await db.insert(providers).values(item).onDuplicateKeyUpdate({ set: { name: item.name } });
  }
  for (const item of defaultCostCenters) {
    await db.insert(costCenters).values(item).onDuplicateKeyUpdate({ set: { name: item.name } });
  }
  for (const item of defaultProducts) {
    await db.insert(products).values(item).onDuplicateKeyUpdate({ set: { name: item.name, category: item.category } });
  }
}

export async function processamento_createProduct(input: { name: string; slug: string; category?: string; description?: string; primaryProviderId?: number; sharedInfrastructure: boolean; sharedBaseMonthlyCost: string }) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const result = await db.insert(products).values(input); return { id: Number(result[0].insertId) }; }
export async function processamento_updateProduct(input: { id: number; name?: string; category?: string; description?: string; primaryProviderId?: number; sharedInfrastructure?: boolean; sharedBaseMonthlyCost?: string; active?: boolean }) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const { id, ...changes } = input; await db.update(products).set(changes).where(eq(products.id, id)); return { id }; }
export async function processamento_createProvider(input: { name: string; code: string }) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const result = await db.insert(providers).values(input); return { id: Number(result[0].insertId) }; }
export async function processamento_createPlan(input: { productId: number; name: string; description?: string; defaultMonthlyPrice: string }) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const result = await db.insert(plans).values(input); return { id: Number(result[0].insertId) }; }
export async function processamento_updatePlan(input: { id: number; name?: string; description?: string; defaultMonthlyPrice?: string; active?: boolean }) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const { id, ...changes } = input; await db.update(plans).set(changes).where(eq(plans.id, id)); return { id }; }

export async function processamento_listCatalog() {
  const db = await getDb();
  if (!db) return { products: [], providers: [], costCenters: [] };
  await processamento_ensureCatalog();
  const [productRows, providerRows, costCenterRows] = await Promise.all([
    db.select().from(products).where(eq(products.active, true)),
    db.select().from(providers).where(eq(providers.active, true)),
    db.select().from(costCenters).where(eq(costCenters.active, true)),
  ]);
  return { products: productRows, providers: providerRows, costCenters: costCenterRows };
}

export async function processamento_listTransactions(input: {
  productId?: number;
  type?: "income" | "expense";
  providerId?: number;
  category?: string;
  from?: Date;
  to?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const filters = [];
  if (input.productId) filters.push(eq(transactions.productId, input.productId));
  if (input.type) filters.push(eq(transactions.type, input.type));
  if (input.providerId) filters.push(eq(transactions.providerId, input.providerId));
  if (input.category) filters.push(eq(transactions.category, input.category));
  if (input.from) filters.push(gte(transactions.occurredAt, input.from));
  if (input.to) filters.push(lte(transactions.occurredAt, input.to));
  return db.select({ transaction: transactions, productName: products.name, providerName: providers.name })
    .from(transactions)
    .leftJoin(products, eq(products.id, transactions.productId))
    .leftJoin(providers, eq(providers.id, transactions.providerId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(transactions.occurredAt));
}

export async function processamento_createTransaction(input: typeof transactions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(transactions).values(input);
  return result[0]?.insertId;
}

export async function processamento_temporalDre(input: { from: Date; to: Date; productId?: number; mode?: "month" | "quarter" | "year" }) {
  const db = await getDb(); if (!db) return [];
  const filters = [gte(transactions.occurredAt, input.from), lte(transactions.occurredAt, input.to), eq(transactions.status, "confirmed" as const)]; if (input.productId) filters.push(eq(transactions.productId, input.productId));
  const [rows, rules] = await Promise.all([db.select({ transaction: transactions, costCenterKind: costCenters.kind }).from(transactions).leftJoin(costCenters, eq(costCenters.id, transactions.costCenterId)).where(and(...filters)).orderBy(transactions.occurredAt), db.select().from(taxRules).where(eq(taxRules.active, true))]);
  const grouped = new Map<string, { date: string; income: number; taxes: number; cogs: number; opex: number }>();
  for (const row of rows) { const date = new Date(row.transaction.occurredAt); const year = date.getUTCFullYear(); const month = date.getUTCMonth() + 1; const period = input.mode === "year" ? String(year) : input.mode === "quarter" ? `${year}-Q${Math.ceil(month / 3)}` : `${year}-${String(month).padStart(2, "0")}`; const item = grouped.get(period) ?? { date: date.toISOString(), income: 0, taxes: 0, cogs: 0, opex: 0 }; const amount = Number(row.transaction.amount); if (row.transaction.type === "income") { item.income += amount; const rule = rules.find(rule => rule.productId === row.transaction.productId) ?? rules.find(rule => rule.productId == null); item.taxes += amount * Number(rule?.ratePercent ?? 0) / 100; } else if (row.costCenterKind === "cogs" || row.transaction.category.toLowerCase().includes("infra")) item.cogs += amount; else if (row.costCenterKind === "opex") item.opex += amount; grouped.set(period, item); }
  return Array.from(grouped.entries()).map(([period, item]) => ({ period, ...item, ebitda: item.income - item.taxes - item.cogs - item.opex })).sort((a, b) => a.period.localeCompare(b.period));
}
export async function processamento_contractMargins(input: { from?: Date; to?: Date; productId?: number }) {
  const db = await getDb(); if (!db) return [];
  const filters = [eq(contracts.status, "active" as const)]; if (input.productId) filters.push(eq(contracts.productId, input.productId));
  const contractRows = await db.select({ contract: contracts, customerName: customers.legalName, productName: products.name }).from(contracts).leftJoin(customers, eq(customers.id, contracts.customerId)).leftJoin(products, eq(products.id, contracts.productId)).where(and(...filters));
  const txFilters = [eq(transactions.status, "confirmed" as const)]; if (input.from) txFilters.push(gte(transactions.occurredAt, input.from)); if (input.to) txFilters.push(lte(transactions.occurredAt, input.to));
  const txRows = await db.select({ transaction: transactions, costCenterKind: costCenters.kind }).from(transactions).leftJoin(costCenters, eq(costCenters.id, transactions.costCenterId)).where(and(...txFilters));
  const allocations = await db.select({ allocation: infrastructureAllocations, contractId: contracts.id, customerId: contracts.customerId }).from(infrastructureAllocations).leftJoin(licenses, eq(licenses.id, infrastructureAllocations.licenseId)).leftJoin(contracts, eq(contracts.id, licenses.contractId)).where(and(input.from && input.to ? gte(infrastructureAllocations.competenceMonth, input.from.toISOString().slice(0, 7)) : undefined, input.from && input.to ? lte(infrastructureAllocations.competenceMonth, input.to.toISOString().slice(0, 7)) : undefined));
  return contractRows.map(row => { const revenue = txRows.filter(item => item.transaction.contractId === row.contract.id && item.transaction.type === "income").reduce((sum, item) => sum + Number(item.transaction.amount), 0); const directCogs = txRows.filter(item => item.transaction.contractId === row.contract.id && item.transaction.type === "expense").reduce((sum, item) => sum + Number(item.transaction.amount), 0); const allocatedCogs = allocations.filter(item => item.contractId === row.contract.id && (!input.productId || item.allocation.productId === input.productId)).reduce((sum, item) => sum + Number(item.allocation.allocatedAmount), 0); const contribution = revenue - directCogs - allocatedCogs; return { contractId: row.contract.id, code: row.contract.code, customerName: row.customerName, productName: row.productName, mrr: Number(row.contract.monthlyRecurringRevenue), revenue, directCogs, allocatedCogs, contribution, marginPercent: revenue > 0 ? (contribution / revenue) * 100 : null }; });
}
export async function processamento_customerProfitability(input: { from?: Date; to?: Date; productId?: number }) {
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
}
export async function processamento_listInvoices(input: { from?: Date; to?: Date; paymentStatus?: "confirmed" | "pending" | "cancelled"; search?: string } = {}) { const db = await getDb(); if (!db) return []; const rows = await db.select({ invoice: invoices, transaction: transactions, customerName: customers.legalName }).from(invoices).innerJoin(transactions, eq(transactions.id, invoices.transactionId)).leftJoin(customers, eq(customers.id, transactions.customerId)).orderBy(desc(invoices.issueDate)); return processamento_filterInvoiceRows(rows, input); }
export async function processamento_createInvoice(input: typeof invoices.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const [transaction] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, input.transactionId)).limit(1); if (!transaction) throw new Error("Lançamento não encontrado"); const [existing] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.transactionId, input.transactionId)).limit(1); if (existing) throw new Error("Este lançamento já possui uma nota fiscal vinculada"); const result = await db.insert(invoices).values(input); return result[0]?.insertId; }
export async function processamento_deleteInvoice(id: number) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); await db.delete(invoices).where(eq(invoices.id, id)); return { success: true }; }
export async function processamento_extractInvoiceData(invoiceId: number) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const [invoice] = await db.select({ id: invoices.id, fileKey: invoices.fileKey }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1); if (!invoice?.fileKey) throw new Error("Esta nota fiscal não possui PDF anexado"); try { const pdfUrl = await storageGetSignedUrl(invoice.fileKey); const response = await invokeLLM({ messages: [{ role: "system", content: "Você extrai dados fiscais de PDFs. Retorne apenas JSON conforme o schema. Não invente valores: use null quando o campo não estiver legível. Os dados são sugestões para revisão humana." }, { role: "user", content: [{ type: "text", text: "Extraia valor total, data de emissão, CNPJ do emissor, CNPJ do destinatário e nome do fornecedor desta nota fiscal." }, { type: "file_url", file_url: { url: pdfUrl, mime_type: "application/pdf" } }] }], response_format: { type: "json_schema", json_schema: { name: "invoice_extraction", strict: true, schema: { type: "object", properties: { amount: { type: ["number", "null"] }, issueDate: { type: ["string", "null"] }, issuerDocument: { type: ["string", "null"] }, recipientDocument: { type: ["string", "null"] }, supplierName: { type: ["string", "null"] }, confidence: { type: ["number", "null"] } }, required: ["amount", "issueDate", "issuerDocument", "recipientDocument", "supplierName", "confidence"], additionalProperties: false } } } }); const rawContent = response.choices?.[0]?.message?.content; const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent); const extracted = processamento_parseInvoiceExtraction(content); const extractedDate = extracted.issueDate ? new Date(extracted.issueDate) : null; await db.update(invoices).set({ extractionStatus: "completed", extractedAmount: extracted.amount == null ? null : extracted.amount.toFixed(2), extractedIssueDate: extractedDate && !Number.isNaN(extractedDate.getTime()) ? extractedDate : null, extractedIssuerDocument: extracted.issuerDocument, extractedRecipientDocument: extracted.recipientDocument, extractedSupplierName: extracted.supplierName, extractionConfidence: extracted.confidence == null ? null : extracted.confidence.toFixed(2), extractionRaw: JSON.stringify(extracted) }).where(eq(invoices.id, invoiceId)); return extracted; } catch (error) { await db.update(invoices).set({ extractionStatus: "failed", extractionRaw: JSON.stringify({ error: error instanceof Error ? error.message : "Falha na extração" }) }).where(eq(invoices.id, invoiceId)); return { amount: null, issueDate: null, issuerDocument: null, recipientDocument: null, supplierName: null, confidence: null, status: "failed" as const }; } }
export async function processamento_uploadInvoicePdf(input: { invoiceId: number; base64: string; fileName: string; fileSize: number; contentType: string }) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const buffer = Buffer.from(input.base64, "base64"); processamento_validateInvoicePdf({ fileName: input.fileName, fileSize: input.fileSize, contentType: input.contentType, signature: buffer.subarray(0, 4).toString() }); if (buffer.length !== input.fileSize) throw new Error("O tamanho do arquivo não corresponde ao conteúdo enviado"); const [invoice] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1); if (!invoice) throw new Error("Nota fiscal não encontrada"); const uploaded = await storagePut(`invoices/${input.invoiceId}/${input.fileName}`, buffer, "application/pdf"); await db.update(invoices).set({ fileKey: uploaded.key, fileName: input.fileName, fileSize: buffer.length, fileContentType: "application/pdf", extractionStatus: "pending" }).where(eq(invoices.id, input.invoiceId)); const extraction = await processamento_extractInvoiceData(input.invoiceId); return { key: uploaded.key, fileName: input.fileName, fileSize: buffer.length, extraction }; }
export async function processamento_getInvoicePdfUrl(invoiceId: number) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const [invoice] = await db.select({ fileKey: invoices.fileKey }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1); if (!invoice?.fileKey) throw new Error("Esta nota fiscal não possui PDF anexado"); return { url: await storageGetSignedUrl(invoice.fileKey) }; }
export async function processamento_reviewInvoiceExtraction(input: { invoiceId: number; amount?: number | null; issueDate?: Date | null; issuerDocument?: string | null; recipientDocument?: string | null; supplierName?: string | null }) { const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível"); const [invoice] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1); if (!invoice) throw new Error("Nota fiscal não encontrada"); await db.update(invoices).set({ extractionStatus: "reviewed", extractedAmount: input.amount == null ? null : input.amount.toFixed(2), extractedIssueDate: input.issueDate ?? null, extractedIssuerDocument: input.issuerDocument ?? null, extractedRecipientDocument: input.recipientDocument ?? null, extractedSupplierName: input.supplierName ?? null }).where(eq(invoices.id, input.invoiceId)); return { success: true as const }; }
export async function processamento_goalProgress(input: { year: number; productId?: number }) { const db = await getDb(); if (!db) return []; const goalFilters = [eq(goals.year, input.year)]; if (input.productId) goalFilters.push(eq(goals.productId, input.productId)); const goalRows = await db.select().from(goals).where(and(...goalFilters)); const start = new Date(`${input.year}-01-01T00:00:00.000Z`); const end = new Date(`${input.year}-12-31T23:59:59.999Z`); const contractFilters = [gte(contracts.startDate, start), lte(contracts.startDate, end)]; if (input.productId) contractFilters.push(eq(contracts.productId, input.productId)); const contractRows = await db.select({ startDate: contracts.startDate, mrr: contracts.monthlyRecurringRevenue }).from(contracts).where(and(...contractFilters)); const txFilters = [gte(transactions.occurredAt, start), lte(transactions.occurredAt, end), eq(transactions.type, "income" as const), eq(transactions.status, "confirmed" as const)]; if (input.productId) txFilters.push(eq(transactions.productId, input.productId)); const incomeRows = await db.select({ occurredAt: transactions.occurredAt, amount: transactions.amount }).from(transactions).where(and(...txFilters)); return goalRows.map(goal => { const quarter = Number(goal.quarter.slice(1)); const actualContracts = contractRows.filter(row => Math.ceil((new Date(row.startDate).getUTCMonth() + 1) / 3) === quarter); const actualMrr = actualContracts.reduce((sum, row) => sum + Number(row.mrr), 0); const actualReceived = incomeRows.filter(row => Math.ceil((new Date(row.occurredAt).getUTCMonth() + 1) / 3) === quarter).reduce((sum, row) => sum + Number(row.amount), 0); return { ...goal, actualMrr, actualReceived, actualNewCustomers: actualContracts.length, mrrAttainment: Number(goal.targetMrr) > 0 ? actualMrr / Number(goal.targetMrr) * 100 : null, receivedAttainment: Number(goal.targetMrr) > 0 ? actualReceived / Number(goal.targetMrr) * 100 : null, customerAttainment: Number(goal.targetNewCustomers) > 0 ? actualContracts.length / Number(goal.targetNewCustomers) * 100 : null }; }); }
export async function processamento_infrastructureBreakdown(input: { from: Date; to: Date; productId?: number }) {
  const db = await getDb(); if (!db) return [];
  const filters = [gte(infrastructureAllocations.createdAt, input.from), lte(infrastructureAllocations.createdAt, input.to)]; if (input.productId) filters.push(eq(infrastructureAllocations.productId, input.productId));
  const rows = await db.select({ allocation: infrastructureAllocations, productName: products.name, customerName: customers.legalName }).from(infrastructureAllocations).leftJoin(products, eq(products.id, infrastructureAllocations.productId)).leftJoin(licenses, eq(licenses.id, infrastructureAllocations.licenseId)).leftJoin(contracts, eq(contracts.id, licenses.contractId)).leftJoin(customers, eq(customers.id, contracts.customerId)).where(and(...filters));
  const grouped = new Map<string, { label: string; displayLabel: string; productName: string; customerName: string; amount: number; units: number }>(); for (const row of rows) { const label = row.customerName ?? row.productName ?? "Sem vínculo"; const productName = row.productName ?? "Produto"; const displayLabel = `${productName} · ${label}`; const key = `${productName}-${label}`; const current = grouped.get(key) ?? { label, displayLabel, productName, customerName: label, amount: 0, units: 0 }; current.amount += Number(row.allocation.allocatedAmount); current.units += Number(row.allocation.allocationUnits); grouped.set(key, current); } return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
}

export async function processamento_getDashboard(input: { productId?: number; from: Date; to: Date }) {
  const db = await getDb();
  if (!db) return { mrr: 0, received: 0, cogs: 0, opex: 0, grossMargin: null, netBurnRate: 0, cashBalance: 0, runway: null, transactionCount: 0, incomeCount: 0, pendingInvoiceAttachments: 0 };
  const transactionFilters = [gte(transactions.occurredAt, input.from), lte(transactions.occurredAt, input.to), eq(transactions.status, "confirmed" as const)];
  if (input.productId) transactionFilters.push(eq(transactions.productId, input.productId));
  const rows = await db.select({ transaction: transactions, costCenterKind: costCenters.kind })
    .from(transactions)
    .leftJoin(costCenters, eq(costCenters.id, transactions.costCenterId))
    .where(and(...transactionFilters));
  const contractFilters = [eq(contracts.status, "active" as const)];
  if (input.productId) contractFilters.push(eq(contracts.productId, input.productId));
  const activeContracts = await db.select({ mrr: contracts.monthlyRecurringRevenue }).from(contracts).where(and(...contractFilters));
  const bankRows = await db.select({ openingBalance: bankAccounts.openingBalance }).from(bankAccounts).where(eq(bankAccounts.active, true));
  let received = 0, expenses = 0, cogs = 0, opex = 0, incomeCount = 0;
  for (const row of rows) {
    const amount = Number(row.transaction.amount);
    if (row.transaction.type === "income") { received += amount; incomeCount += 1; }
    else {
      expenses += amount;
      if (row.costCenterKind === "cogs" || row.transaction.category.toLowerCase().includes("infra")) cogs += amount;
      if (row.costCenterKind === "opex") opex += amount;
    }
  }
  const mrr = activeContracts.reduce((sum, row) => sum + Number(row.mrr), 0);
  const pendingInvoiceFilters = [...transactionFilters, eq(transactions.type, "income" as const)];
  const pendingInvoiceRows = await db.select({ id: transactions.id }).from(transactions).leftJoin(invoices, eq(invoices.transactionId, transactions.id)).where(and(...pendingInvoiceFilters, isNull(invoices.id)));

  const grossMargin = received > 0 ? ((received - cogs) / received) * 100 : null;
  const netBurnRate = expenses - received;
  const cashBalance = bankRows.reduce((sum, row) => sum + Number(row.openingBalance), 0) + received - expenses;
  const runway = netBurnRate > 0 ? cashBalance / netBurnRate : null;
  return { mrr, received, cogs, opex, grossMargin, netBurnRate, cashBalance, runway, transactionCount: rows.length, incomeCount, pendingInvoiceAttachments: pendingInvoiceRows.length };
}

export async function processamento_allocateInfrastructureTransaction(transactionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [row] = await db.select({ transaction: transactions, centerKind: costCenters.kind, sharedBaseMonthlyCost: products.sharedBaseMonthlyCost }).from(transactions).leftJoin(costCenters, eq(costCenters.id, transactions.costCenterId)).leftJoin(products, eq(products.id, transactions.productId)).where(eq(transactions.id, transactionId)).limit(1);
  if (!row || row.transaction.type !== "expense" || !row.transaction.productId || row.centerKind !== "cogs") return { allocated: false, reason: "Lançamento não elegível para rateio" };
  const existing = await db.select({ id: infrastructureAllocations.id }).from(infrastructureAllocations).where(eq(infrastructureAllocations.transactionId, transactionId)).limit(1);
  if (existing.length) return { allocated: false, reason: "Rateio já realizado" };
  const active = await db.select({ licenseId: licenses.id, contractId: licenses.contractId, customerId: contracts.customerId }).from(licenses).innerJoin(contracts, eq(contracts.id, licenses.contractId)).where(and(eq(licenses.status, "active" as const), eq(contracts.productId, row.transaction.productId), eq(contracts.status, "active" as const)));
  if (!active.length) return { allocated: false, reason: "Nenhuma licença ativa para o produto" };
  const configuredSharedBase = row.transaction.category === "infraestrutura compartilhada" ? Number(row.sharedBaseMonthlyCost ?? 0) : 0;
  const total = Number(row.transaction.amount) + configuredSharedBase;
  const direct = row.transaction.customerId ? active.filter(item => item.customerId === row.transaction.customerId).slice(0, 1) : [];
  const targets = direct.length ? direct : active;
  const method = direct.length ? "direct" as const : "active_license_count" as const;
  const amount = total / targets.length;
  await db.insert(infrastructureAllocations).values(targets.map(target => ({ transactionId, productId: row.transaction.productId!, licenseId: target.licenseId, allocationMethod: method, allocationUnits: "1", allocationRate: (1 / targets.length).toFixed(6), allocatedAmount: amount.toFixed(2), competenceMonth: row.transaction.competenceMonth })));
  return { allocated: true, method, licenseCount: targets.length, allocatedAmount: total };
}

export async function processamento_listGoals(year: number, productId?: number) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(goals.year, year)];
  if (productId) filters.push(eq(goals.productId, productId));
  return db.select().from(goals).where(and(...filters));
}

export async function processamento_upsertGoal(input: typeof goals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.insert(goals).values(input).onDuplicateKeyUpdate({ set: { targetNewCustomers: input.targetNewCustomers, targetMrr: input.targetMrr, notes: input.notes ?? null } });
}

export async function processamento_listOperations() {
  const db = await getDb();
  if (!db) return { customers: [], contracts: [], licenses: [], bankAccounts: [] };
  const [customerRows, contractRows, licenseRows, bankRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.active, true)),
    db.select().from(contracts),
    db.select().from(licenses),
    db.select().from(bankAccounts).where(eq(bankAccounts.active, true)),
  ]);
  return { customers: customerRows, contracts: contractRows, licenses: licenseRows, bankAccounts: bankRows };
}

export async function processamento_createCustomer(input: typeof customers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(customers).values(input);
  return result[0]?.insertId;
}

export async function processamento_createBankAccount(input: typeof bankAccounts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(bankAccounts).values(input);
  return result[0]?.insertId;
}

export async function processamento_createContract(input: typeof contracts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(contracts).values(input);
  return result[0]?.insertId;
}

export async function processamento_createLicense(input: typeof licenses.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(licenses).values(input);
  return result[0]?.insertId;
}

export async function processamento_listTaxRules(productId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taxRules).where(productId ? and(eq(taxRules.active, true), eq(taxRules.productId, productId)) : eq(taxRules.active, true));
}
