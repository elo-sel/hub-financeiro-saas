import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  bankAccounts,
  contracts,
  costCenters,
  customers,
  infrastructureAllocations,
  providers,
  InsertUser,
  licenses,
  products,
  goals,
  taxRules,
  transactions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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

export async function processamento_getDashboard(input: { productId?: number; from: Date; to: Date }) {
  const db = await getDb();
  if (!db) return { mrr: 0, received: 0, cogs: 0, opex: 0, grossMargin: null, netBurnRate: 0, cashBalance: 0, runway: null, transactionCount: 0 };
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
  let received = 0, expenses = 0, cogs = 0, opex = 0;
  for (const row of rows) {
    const amount = Number(row.transaction.amount);
    if (row.transaction.type === "income") received += amount;
    else {
      expenses += amount;
      if (row.costCenterKind === "cogs" || row.transaction.category.toLowerCase().includes("infra")) cogs += amount;
      if (row.costCenterKind === "opex") opex += amount;
    }
  }
  const mrr = activeContracts.reduce((sum, row) => sum + Number(row.mrr), 0);
  const grossMargin = received > 0 ? ((received - cogs) / received) * 100 : null;
  const netBurnRate = expenses - received;
  const cashBalance = bankRows.reduce((sum, row) => sum + Number(row.openingBalance), 0) + received - expenses;
  const runway = netBurnRate > 0 ? cashBalance / netBurnRate : null;
  return { mrr, received, cogs, opex, grossMargin, netBurnRate, cashBalance, runway, transactionCount: rows.length };
}

export async function processamento_allocateInfrastructureTransaction(transactionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [row] = await db.select({ transaction: transactions, centerKind: costCenters.kind }).from(transactions).leftJoin(costCenters, eq(costCenters.id, transactions.costCenterId)).where(eq(transactions.id, transactionId)).limit(1);
  if (!row || row.transaction.type !== "expense" || !row.transaction.productId || row.centerKind !== "cogs") return { allocated: false, reason: "Lançamento não elegível para rateio" };
  const existing = await db.select({ id: infrastructureAllocations.id }).from(infrastructureAllocations).where(eq(infrastructureAllocations.transactionId, transactionId)).limit(1);
  if (existing.length) return { allocated: false, reason: "Rateio já realizado" };
  const active = await db.select({ licenseId: licenses.id, contractId: licenses.contractId, customerId: contracts.customerId }).from(licenses).innerJoin(contracts, eq(contracts.id, licenses.contractId)).where(and(eq(licenses.status, "active" as const), eq(contracts.productId, row.transaction.productId), eq(contracts.status, "active" as const)));
  if (!active.length) return { allocated: false, reason: "Nenhuma licença ativa para o produto" };
  const total = Number(row.transaction.amount);
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
