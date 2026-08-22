import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const products = mysqlTable("saas_products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  category: varchar("category", { length: 120 }),
  description: text("description"),
  primaryProviderId: int("primaryProviderId"),
  sharedInfrastructure: boolean("sharedInfrastructure").default(false).notNull(),
  sharedBaseMonthlyCost: decimal("sharedBaseMonthlyCost", { precision: 14, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ nameIdx: index("saas_products_name_idx").on(table.name) }));

export const providers = mysqlTable("infrastructure_providers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const costCenters = mysqlTable("cost_centers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  kind: mysqlEnum("kind", ["cogs", "opex", "revenue", "cash"]).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  defaultMonthlyPrice: decimal("defaultMonthlyPrice", { precision: 14, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ productNameIdx: uniqueIndex("plans_product_name_idx").on(table.productId, table.name) }));

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  legalName: varchar("legalName", { length: 180 }).notNull(),
  document: varchar("document", { length: 30 }),
  email: varchar("email", { length: 320 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ nameIdx: index("customers_legal_name_idx").on(table.legalName) }));

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  productId: int("productId").notNull(),
  planId: int("planId"),
  code: varchar("code", { length: 80 }).notNull().unique(),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "quarterly", "annual"]).notNull(),
  monthlyRecurringRevenue: decimal("monthlyRecurringRevenue", { precision: 14, scale: 2 }).default("0").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  renewalDate: timestamp("renewalDate"),
  status: mysqlEnum("status", ["active", "paused", "cancelled", "expired"]).default("active").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["current", "overdue", "unknown"]).default("unknown").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ productStatusIdx: index("contracts_product_status_idx").on(table.productId, table.status), customerIdx: index("contracts_customer_idx").on(table.customerId) }));

export const licenses = mysqlTable("licenses", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  licenseKey: varchar("licenseKey", { length: 100 }).notNull().unique(),
  activeSeats: int("activeSeats").default(1).notNull(),
  status: mysqlEnum("status", ["active", "suspended", "cancelled"]).default("active").notNull(),
  activatedAt: timestamp("activatedAt").defaultNow().notNull(),
  deactivatedAt: timestamp("deactivatedAt"),
});

export const bankAccounts = mysqlTable("bank_accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  institution: varchar("institution", { length: 120 }),
  openingBalance: decimal("openingBalance", { precision: 14, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const transactions = mysqlTable("financial_transactions", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId"),
  customerId: int("customerId"),
  contractId: int("contractId"),
  providerId: int("providerId"),
  costCenterId: int("costCenterId"),
  bankAccountId: int("bankAccountId"),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  description: varchar("description", { length: 240 }).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  occurredAt: timestamp("occurredAt").notNull(),
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(),
  status: mysqlEnum("status", ["confirmed", "pending", "cancelled"]).default("confirmed").notNull(),
  source: mysqlEnum("source", ["manual", "contract", "import"]).default("manual").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ dateIdx: index("transactions_date_idx").on(table.occurredAt), productDateIdx: index("transactions_product_date_idx").on(table.productId, table.occurredAt), typeIdx: index("transactions_type_idx").on(table.type) }));

export const invoices = mysqlTable("financial_invoices", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull().unique(),
  number: varchar("number", { length: 40 }).notNull(),
  series: varchar("series", { length: 20 }),
  issueDate: timestamp("issueDate").notNull(),
  accessKey: varchar("accessKey", { length: 44 }),
  issuerDocument: varchar("issuerDocument", { length: 30 }),
  recipientDocument: varchar("recipientDocument", { length: 30 }),
  status: mysqlEnum("status", ["issued", "cancelled", "pending"]).default("issued").notNull(),
  notes: text("notes"),
  fileKey: varchar("fileKey", { length: 255 }),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: int("fileSize"),
  fileContentType: varchar("fileContentType", { length: 100 }),
  extractionStatus: mysqlEnum("extractionStatus", ["pending", "completed", "failed", "reviewed"]).default("pending").notNull(),
  extractedAmount: decimal("extractedAmount", { precision: 14, scale: 2 }),
  extractedIssueDate: timestamp("extractedIssueDate"),
  extractedIssuerDocument: varchar("extractedIssuerDocument", { length: 30 }),
  extractedRecipientDocument: varchar("extractedRecipientDocument", { length: 30 }),
  extractedSupplierName: varchar("extractedSupplierName", { length: 255 }),
  extractionConfidence: decimal("extractionConfidence", { precision: 5, scale: 2 }),
  extractionRaw: text("extractionRaw"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ transactionIdx: index("invoices_transaction_idx").on(table.transactionId), accessKeyIdx: uniqueIndex("invoices_access_key_idx").on(table.accessKey) }));
export const infrastructureAllocations = mysqlTable("infrastructure_allocations", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  productId: int("productId").notNull(),
  licenseId: int("licenseId"),
  allocationMethod: mysqlEnum("allocationMethod", ["direct", "active_license_count"]).notNull(),
  allocationUnits: decimal("allocationUnits", { precision: 14, scale: 4 }).default("0").notNull(),
  allocationRate: decimal("allocationRate", { precision: 14, scale: 6 }).default("0").notNull(),
  allocatedAmount: decimal("allocatedAmount", { precision: 14, scale: 2 }).notNull(),
  competenceMonth: varchar("competenceMonth", { length: 7 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ transactionIdx: index("infra_alloc_transaction_idx").on(table.transactionId), licenseIdx: index("infra_alloc_license_idx").on(table.licenseId), monthIdx: index("infra_alloc_month_idx").on(table.competenceMonth) }));

export const goals = mysqlTable("financial_goals", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId"),
  year: int("year").notNull(),
  quarter: mysqlEnum("quarter", ["Q1", "Q2", "Q3", "Q4"]).notNull(),
  targetNewCustomers: int("targetNewCustomers").default(0).notNull(),
  targetMrr: decimal("targetMrr", { precision: 14, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ goalIdx: uniqueIndex("goals_product_year_quarter_idx").on(table.productId, table.year, table.quarter) }));

export const taxRules = mysqlTable("tax_rules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  ratePercent: decimal("ratePercent", { precision: 7, scale: 4 }).notNull(),
  productId: int("productId"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
