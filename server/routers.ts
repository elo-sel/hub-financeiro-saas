import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  processamento_allocateInfrastructureTransaction,
  processamento_createBankAccount,
  processamento_createContract,
  processamento_createCustomer,
  processamento_createLicense,
  processamento_createProduct, processamento_updateProduct, processamento_createProvider, processamento_createPlan, processamento_updatePlan,
  processamento_createTransaction,
  processamento_getDashboard, processamento_temporalDre, processamento_contractMargins, processamento_infrastructureBreakdown, processamento_goalProgress,
  processamento_listCatalog,
  processamento_listGoals,
  processamento_listOperations,
  processamento_listTaxRules,
  processamento_listTransactions,
  processamento_upsertGoal,
} from "./db";

function processamento_monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1));
  const to = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return { from, to };
}

function processamento_currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const transactionInput = z.object({
  productId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  contractId: z.number().int().positive().optional(),
  providerId: z.number().int().positive().optional(),
  costCenterId: z.number().int().positive().optional(),
  bankAccountId: z.number().int().positive().optional(),
  type: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  amount: z.number().positive(),
  occurredAt: z.string().datetime(),
  competenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  status: z.enum(["confirmed", "pending", "cancelled"]).default("confirmed"),
  notes: z.string().max(2000).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  finance: router({
    catalog: protectedProcedure.query(() => processamento_listCatalog()),
    operations: protectedProcedure.query(() => processamento_listOperations()),
    createProduct: protectedProcedure.input(z.object({ name: z.string().min(2), slug: z.string().min(2), category: z.string().optional(), description: z.string().optional(), primaryProviderId: z.number().int().positive().optional(), sharedInfrastructure: z.boolean().default(false), sharedBaseMonthlyCost: z.number().min(0).default(0) })).mutation(({ input }) => processamento_createProduct({ ...input, sharedBaseMonthlyCost: input.sharedBaseMonthlyCost.toFixed(2) })),
    updateProduct: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(2).optional(), category: z.string().optional(), description: z.string().optional(), primaryProviderId: z.number().int().positive().optional(), sharedInfrastructure: z.boolean().optional(), sharedBaseMonthlyCost: z.number().min(0).optional(), active: z.boolean().optional() })).mutation(({ input }) => processamento_updateProduct({ ...input, sharedBaseMonthlyCost: input.sharedBaseMonthlyCost?.toFixed(2) })),
    createProvider: protectedProcedure.input(z.object({ name: z.string().min(2), code: z.string().min(2) })).mutation(({ input }) => processamento_createProvider(input)),
    createPlan: protectedProcedure.input(z.object({ productId: z.number().int().positive(), name: z.string().min(2), description: z.string().optional(), defaultMonthlyPrice: z.number().min(0) })).mutation(({ input }) => processamento_createPlan({ ...input, defaultMonthlyPrice: input.defaultMonthlyPrice.toFixed(2) })),
    updatePlan: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(2).optional(), description: z.string().optional(), defaultMonthlyPrice: z.number().min(0).optional(), active: z.boolean().optional() })).mutation(({ input }) => processamento_updatePlan({ ...input, defaultMonthlyPrice: input.defaultMonthlyPrice?.toFixed(2) })),
    createCustomer: protectedProcedure.input(z.object({ legalName: z.string().trim().min(2).max(180), document: z.string().max(30).optional(), email: z.string().email().optional() })).mutation(({ input }) => processamento_createCustomer(input)),
    createBankAccount: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), institution: z.string().max(120).optional(), openingBalance: z.number().min(0).default(0) })).mutation(({ input }) => processamento_createBankAccount({ ...input, openingBalance: input.openingBalance.toFixed(2) })),
    createContract: protectedProcedure.input(z.object({ customerId: z.number().int().positive(), productId: z.number().int().positive(), code: z.string().trim().min(2).max(80), billingCycle: z.enum(["monthly", "quarterly", "annual"]), monthlyRecurringRevenue: z.number().min(0), startDate: z.string().datetime(), renewalDate: z.string().datetime().optional(), paymentStatus: z.enum(["current", "overdue", "unknown"]).default("unknown") })).mutation(({ input }) => processamento_createContract({ ...input, monthlyRecurringRevenue: input.monthlyRecurringRevenue.toFixed(2), startDate: new Date(input.startDate), renewalDate: input.renewalDate ? new Date(input.renewalDate) : undefined, status: "active" })),
    createLicense: protectedProcedure.input(z.object({ contractId: z.number().int().positive(), licenseKey: z.string().trim().min(2).max(100), activeSeats: z.number().int().min(1).default(1) })).mutation(({ input }) => processamento_createLicense(input)),
    temporalDre: protectedProcedure.input(z.object({ from: z.string().datetime(), to: z.string().datetime(), mode: z.enum(["month", "quarter", "year"]).default("month"), productId: z.number().int().positive().optional() })).query(({ input }) => processamento_temporalDre({ ...input, from: new Date(input.from), to: new Date(input.to) })),
    goalProgress: protectedProcedure.input(z.object({ year: z.number().int().min(2020).max(2200), productId: z.number().int().positive().optional() })).query(({ input }) => processamento_goalProgress(input)),
    contractMargins: protectedProcedure.input(z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional(), productId: z.number().int().positive().optional() }).default({})).query(({ input }) => processamento_contractMargins({ ...input, from: input.from ? new Date(input.from) : undefined, to: input.to ? new Date(input.to) : undefined })),
    infrastructureBreakdown: protectedProcedure.input(z.object({ from: z.string().datetime(), to: z.string().datetime(), productId: z.number().int().positive().optional() })).query(({ input }) => processamento_infrastructureBreakdown({ ...input, from: new Date(input.from), to: new Date(input.to) })),
    dashboard: protectedProcedure.input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), productId: z.number().int().positive().optional() }).default({ month: processamento_currentMonth() })).query(({ input }) => {
      const bounds = processamento_monthBounds(input.month);
      return processamento_getDashboard({ ...bounds, productId: input.productId });
    }),
    transactions: protectedProcedure.input(z.object({ productId: z.number().int().positive().optional(), type: z.enum(["income", "expense"]).optional(), providerId: z.number().int().positive().optional(), category: z.string().trim().max(120).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).default({})).query(({ input }) => {
      const bounds = input.month ? processamento_monthBounds(input.month) : {};
      return processamento_listTransactions({ ...input, ...bounds });
    }),
    createTransaction: protectedProcedure.input(transactionInput).mutation(async ({ input, ctx }) => {
      const transactionId = await processamento_createTransaction({ ...input, amount: input.amount.toFixed(2), occurredAt: new Date(input.occurredAt), createdBy: ctx.user.id, source: "manual" });
      const allocation = transactionId ? await processamento_allocateInfrastructureTransaction(Number(transactionId)) : null;
      return { transactionId, allocation };
    }),
    goals: protectedProcedure.input(z.object({ year: z.number().int().min(2020).max(2200), productId: z.number().int().positive().optional() })).query(({ input }) => processamento_listGoals(input.year, input.productId)),
    upsertGoal: protectedProcedure.input(z.object({ productId: z.number().int().positive().optional(), year: z.number().int().min(2020).max(2200), quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]), targetNewCustomers: z.number().int().min(0), targetMrr: z.number().min(0), notes: z.string().max(2000).optional() })).mutation(({ input }) => processamento_upsertGoal({ ...input, targetMrr: input.targetMrr.toFixed(2) })),
    taxRules: protectedProcedure.input(z.object({ productId: z.number().int().positive().optional() }).default({})).query(({ input }) => processamento_listTaxRules(input.productId)),
  }),
});

export type AppRouter = typeof appRouter;
