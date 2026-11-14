import { z } from "zod";
import { isValidTimeZone } from "../utils/dates.js";

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const idParam = z.object({ id: objectId });

const paymentMethod = z.enum(["cash", "upi", "debit_card", "credit_card", "net_banking"]);
const paise = z.number().int("Amount must be a whole number of paise").positive("Amount must be greater than 0").max(10_000_000_000);

// A date that is not more than a day in the future
const pastOrToday = z.coerce.date().refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, "Date cannot be in the future");

/* ---------------- auth ---------------- */
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password must contain a letter and a number");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number").optional(),
  password,
  userType: z.enum(["student", "professional", "homemaker", "family", "business", "other"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
    userType: z.enum(["student", "professional", "homemaker", "family", "business", "other"]),
    language: z.enum(["en", "hi", "kn"]),
    timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
    settings: z
      .object({
        autoSaveHighConfidence: z.boolean(),
        confidenceThreshold: z.number().min(0.5).max(0.99),
        reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
        simpleMode: z.boolean(),
      })
      .partial(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Send at least one field to update");

/* ---------------- wallets ---------------- */
export const createWalletSchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(["cash", "bank", "upi", "card"]),
  openingBalance: z.number().int().min(0).max(10_000_000_000).default(0),
});

export const updateWalletSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    type: z.enum(["cash", "bank", "upi", "card"]),
    openingBalance: z.number().int().min(0).max(10_000_000_000),
    archived: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Send at least one field to update");

export const listWalletsQuery = z.object({ includeArchived: z.enum(["true", "false"]).optional() });

/* ---------------- budgets ---------------- */
const budgetPeriod = z.enum(["weekly", "monthly", "yearly", "custom"]);
const budgetDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const budgetAmount = z
  .number()
  .int("Amount must be a whole number of paise")
  .positive("Amount must be greater than 0")
  .max(10_000_000_000);

export const budgetIdParam = idParam;
export const budgetListQuery = z.object({ includeArchived: z.enum(["true", "false"]).optional() });
export const createBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    amount: budgetAmount,
    categoryId: objectId.nullable().optional(),
    period: budgetPeriod,
    startDate: budgetDate,
    endDate: budgetDate,
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "End date must be on or after start date",
  });
export const updateBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    amount: budgetAmount,
    categoryId: objectId.nullable(),
    period: budgetPeriod,
    startDate: budgetDate,
    endDate: budgetDate,
    status: z.enum(["active", "archived"]),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Send at least one field to update")
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "End date must be on or after start date",
  });

/* ---------------- savings goals ---------------- */
const goalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const goalAmount = z
  .number()
  .int("Amount must be a whole number of paise")
  .positive("Amount must be greater than 0")
  .max(10_000_000_000);

export const goalIdParam = idParam;
export const goalListQuery = z.object({
  status: z.enum(["active", "completed", "paused", "archived"]).optional(),
  includeArchived: z.enum(["true", "false"]).optional(),
});
export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  targetAmount: goalAmount,
  targetDate: goalDate,
  walletId: objectId.nullable().optional(),
});
export const updateGoalSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500),
    targetAmount: goalAmount,
    targetDate: goalDate,
    walletId: objectId.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Send at least one field to update");
export const goalTransactionSchema = z.object({
  amount: goalAmount,
  contributionDate: goalDate.optional(),
  note: z.string().trim().max(300).optional(),
});

/* ---------------- recurring transactions ---------------- */
const recurringDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const recurringAmount = z
  .number()
  .int("Amount must be a whole number of paise")
  .positive("Amount must be greater than 0")
  .max(10_000_000_000);
export const recurringIdParam = idParam;
export const recurringListQuery = z.object({
  status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
});
export const recurringUpcomingQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export const createRecurringSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(["income", "expense"]),
    amount: recurringAmount,
    walletId: objectId,
    categoryId: objectId.nullable().optional(),
    description: z.string().trim().max(300).optional(),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    startDate: recurringDate,
    endDate: recurringDate.nullable().optional(),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End date must be on or after start date",
  });
export const updateRecurringSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(["income", "expense"]),
    amount: recurringAmount,
    walletId: objectId,
    categoryId: objectId.nullable(),
    description: z.string().trim().max(300),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
    startDate: recurringDate,
    endDate: recurringDate.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Send at least one field to update")
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End date must be on or after start date",
  });

/* ---------------- notifications ---------------- */
export const notificationIdParam = idParam;
export const notificationListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum([
    "budget_approaching",
    "budget_exceeded",
    "recurring_upcoming",
    "recurring_failed",
    "subscription_upcoming",
    "subscription_detected",
    "goal_reached",
    "goal_milestone",
    "anomaly_detected",
    "spending_increase",
  ]).optional(),
  severity: z.enum(["info", "warning", "high", "critical"]).optional(),
  isRead: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).strict();

/* ---------------- analytics and exports ---------------- */
const reportDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const reportPeriod = z.enum(["week", "month", "year", "custom"]);
const reportFilterObject = z.object({
  startDate: reportDate.optional(),
  endDate: reportDate.optional(),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone").optional(),
  categoryId: objectId.optional(),
  walletId: objectId.optional(),
  period: reportPeriod.optional(),
  type: z.enum(["income", "expense"]).optional(),
});
const validateReportDates = (value, context) => {
  if (Boolean(value.startDate) !== Boolean(value.endDate)) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Provide both startDate and endDate",
    });
  }
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be on or after startDate",
    });
  }
  if (value.period === "custom" && !value.startDate) {
    context.addIssue({
      code: "custom",
      path: ["startDate"],
      message: "Custom periods require startDate and endDate",
    });
  }
};
export const analyticsQuery = reportFilterObject.superRefine(validateReportDates);
export const comparisonQuery = reportFilterObject.extend({
  compareStartDate: reportDate.optional(),
  compareEndDate: reportDate.optional(),
}).superRefine((value, context) => {
  validateReportDates(value, context);
  if ((value.compareStartDate || value.compareEndDate) && !value.startDate) {
    context.addIssue({
      code: "custom",
      path: ["startDate"],
      message: "Custom comparison dates require a current date range",
    });
  }
  if (Boolean(value.compareStartDate) !== Boolean(value.compareEndDate)) {
    context.addIssue({
      code: "custom",
      path: ["compareEndDate"],
      message: "Provide both compareStartDate and compareEndDate",
    });
  }
  if (value.compareStartDate && value.compareEndDate && value.compareStartDate > value.compareEndDate) {
    context.addIssue({
      code: "custom",
      path: ["compareEndDate"],
      message: "compareEndDate must be on or after compareStartDate",
    });
  }
});
export const exportQuery = reportFilterObject.extend({
  type: z.enum(["income", "expense"]).optional(),
}).superRefine(validateReportDates);
export const pdfReportQuery = reportFilterObject.superRefine(validateReportDates);
export const dashboardQuery = z.object({ date: reportDate.optional() }).strict();

export const transferSchema = z.object({
  fromWalletId: objectId,
  toWalletId: objectId,
  amount: paise,
  note: z.string().trim().max(300).optional(),
  txnDate: pastOrToday.optional(),
});

/* ---------------- categories ---------------- */
export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(["expense", "income"]),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1f7a4d").optional(),
});

export const listCategoriesQuery = z.object({ type: z.enum(["expense", "income"]).optional() });

/* ---------------- transactions ---------------- */
export const createTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: paise,
  walletId: objectId,
  categoryId: objectId.optional(),
  merchant: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  paymentMethod: paymentMethod.default("cash"),
  txnDate: pastOrToday.optional(),
  clientId: z.string().uuid().optional(),
  source: z.enum(["manual", "quickadd", "voice"]).default("manual"),
});

export const updateTransactionSchema = z
  .object({
    amount: paise,
    walletId: objectId,
    categoryId: objectId.nullable(),
    merchant: z.string().trim().max(80),
    note: z.string().trim().max(300),
    tags: z.array(z.string().trim().min(1).max(30)).max(10),
    paymentMethod,
    txnDate: pastOrToday,
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Send at least one field to update");

const syncOperationBase = z.object({
  clientOperationId: z.string().uuid(),
  entityType: z.literal("transaction"),
  clientTimestamp: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
});
const syncEntityVersion = z.string().datetime({ offset: true }).transform((value) => new Date(value));
export const syncOperationSchema = z.discriminatedUnion("operationType", [
  syncOperationBase.extend({
    operationType: z.literal("create"),
    payload: createTransactionSchema.omit({ clientId: true }).strict(),
  }).strict(),
  syncOperationBase.extend({
    operationType: z.literal("update"),
    entityId: objectId,
    baseUpdatedAt: syncEntityVersion,
    payload: updateTransactionSchema.strict(),
  }).strict(),
  syncOperationBase.extend({
    operationType: z.literal("delete"),
    entityId: objectId,
    baseUpdatedAt: syncEntityVersion,
    payload: z.object({}).strict().optional(),
  }).strict(),
]);
export const pushSyncSchema = z.object({
  operations: z.array(z.unknown()).min(1).max(50),
}).strict();
export const syncPullQuery = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export const syncStatusQuery = z.object({}).strict();

export const listTransactionsQuery = z.object({
  type: z.enum(["income", "expense", "transfer"]).optional(),
  walletId: objectId.optional(),
  categoryId: objectId.optional(),
  tag: z.string().trim().max(30).optional(),
  q: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/* ---------------- transaction categorization ---------------- */
export const categorizationSuggestSchema = z.object({ transactionId: objectId }).strict();
export const categorizationBulkSuggestSchema = z.object({
  transactionIds: z.array(objectId).min(1).max(50).refine(
    (ids) => new Set(ids).size === ids.length,
    "Transaction IDs must be unique"
  ),
}).strict();
export const categorizationSuggestionsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "accepted", "rejected"]).optional(),
});
export const categorizationIdParam = idParam;
export const categorizationReviewSchema = z.object({ categoryId: objectId.optional() }).strict();
export const merchantRuleListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  transactionType: z.enum(["income", "expense"]).optional(),
});
export const createMerchantRuleSchema = z.object({
  merchant: z.string().trim().min(1).max(80),
  transactionType: z.enum(["income", "expense"]),
  categoryId: objectId,
}).strict();
export const updateMerchantRuleSchema = z.object({
  merchant: z.string().trim().min(1).max(80),
  transactionType: z.enum(["income", "expense"]),
  categoryId: objectId,
}).partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "Send at least one field to update"
);

/* ---------------- Ask Spart ---------------- */
export const askSpartIdParam = idParam;
export const askSpartChatSchema = z.object({
  conversationId: objectId.nullable().optional(),
  message: z.string().trim().min(1).max(2000),
}).strict();
export const askSpartConversationListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["active", "archived"]).optional(),
});
export const renameAskSpartConversationSchema = z.object({
  title: z.string().trim().min(1).max(80),
}).strict();

/* ---------------- receipt and UPI scans ---------------- */
const scanText = z.string().trim().max(80).nullable();

export const scanIdParam = z.object({ id: objectId });

export const scanListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["receipt", "upi"]).optional(),
  status: z.enum(["processing", "ready", "failed", "confirmed"]).optional(),
});

export const updateScanDraftSchema = z.object({
  merchant: scanText.optional(),
  transactionDate: pastOrToday.nullable().optional(),
  amountPaise: paise.nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().nullable().optional(),
  taxPaise: z.number().int().min(0).max(10_000_000_000).nullable().optional(),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120).nullable(),
    amountPaise: z.number().int().min(0).max(10_000_000_000).nullable(),
  }).strict()).max(100).optional(),
  upiRef: z.string().trim().min(1).max(100).nullable().optional(),
  paymentStatus: z.enum(["success", "failed", "pending", "unknown"]).nullable().optional(),
  paymentDirection: z.enum(["in", "out"]).nullable().optional(),
  transactionType: z.enum(["income", "expense"]).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Send at least one field to update");

export const confirmScanSchema = z.object({
  type: z.enum(["income", "expense"]),
  walletId: objectId,
  categoryId: objectId.nullable().optional(),
  merchant: z.string().trim().max(80).nullable().optional(),
  note: z.string().trim().max(300).optional(),
  paymentMethod,
  allowPossibleDuplicate: z.boolean().default(false),
}).strict();

/* ---------------- bank statement imports ---------------- */
const statementMappingSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.object({
  headerRow: z.coerce.number().int().min(1).max(30).optional(),
  date: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().min(1).max(100).optional(),
  debit: z.string().trim().min(1).max(100).optional(),
  credit: z.string().trim().min(1).max(100).optional(),
  amount: z.string().trim().min(1).max(100).optional(),
  direction: z.string().trim().min(1).max(100).optional(),
  balance: z.string().trim().min(1).max(100).optional(),
  reference: z.string().trim().min(1).max(100).optional(),
}).strict());

export const statementUploadSchema = z.object({
  walletId: objectId,
  bankName: z.string().trim().min(1).max(80).optional(),
  mapping: statementMappingSchema.optional(),
}).strict();

export const statementImportIdParam = z.object({ id: objectId });
export const statementDraftParam = z.object({ id: objectId, transactionId: objectId });

export const statementImportListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["processing", "review", "partially_imported", "completed", "failed"]).optional(),
});

export const statementDraftListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  reviewStatus: z.enum(["pending", "skipped", "imported"]).optional(),
});

export const updateStatementDraftSchema = z.object({
  txnDate: z.coerce.date().nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  amountPaise: paise.nullable().optional(),
  direction: z.enum(["debit", "credit"]).nullable().optional(),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  categoryId: objectId.nullable().optional(),
  reviewStatus: z.enum(["pending", "skipped"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Send at least one field to update");

export const confirmStatementImportSchema = z.object({
  draftIds: z.array(objectId).min(1).max(5_000).refine(
    (ids) => new Set(ids).size === ids.length,
    "draftIds must not contain duplicates"
  ),
  allowDuplicateIds: z.array(objectId).max(5_000).default([]).refine(
    (ids) => new Set(ids).size === ids.length,
    "allowDuplicateIds must not contain duplicates"
  ),
}).strict().refine(
  (value) => value.allowDuplicateIds.every((id) => value.draftIds.includes(id)),
  "allowDuplicateIds must be included in draftIds"
);

const anomalyDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const anomalyIdParam = idParam;
export const anomalyTransactionParam = z.object({ transactionId: objectId });
export const anomalyDetectSchema = z.object({
  startDate: anomalyDate.optional(),
  endDate: anomalyDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict()
  .refine((value) => Boolean(value.startDate) === Boolean(value.endDate), {
    path: ["endDate"],
    message: "Provide both startDate and endDate",
  })
  .refine((value) => !value.startDate || value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "endDate must be on or after startDate",
  })
  .refine((value) => !value.startDate || value.endDate - value.startDate < 90 * 86_400_000, {
    path: ["endDate"],
    message: "Detection date ranges cannot exceed 90 days",
  });
export const anomalyListQuery = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  type: z.enum([
    "large_transaction",
    "duplicate_exact",
    "duplicate_possible",
    "new_merchant",
    "unusual_merchant_amount",
    "merchant_spending_increase",
    "high_frequency",
    "category_spending_increase",
    "category_amount_anomaly",
    "wallet_anomaly",
  ]).optional(),
  status: z.enum(["new", "reviewed", "dismissed", "resolved"]).optional(),
  startDate: anomalyDate.optional(),
  endDate: anomalyDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(
  (value) => !value.startDate || !value.endDate || value.startDate <= value.endDate,
  { path: ["endDate"], message: "endDate must be on or after startDate" }
);
export const anomalyStatusSchema = z.object({
  status: z.enum(["reviewed", "dismissed", "resolved"]),
}).strict();

const predictionMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a calendar month in YYYY-MM format")
  .refine((value) => {
    const [year, month] = value.split("-").map(Number);
    return year >= 2000 && year <= 2200 && month >= 1 && month <= 12;
  }, "Invalid calendar month");

export const predictionMonthQuery = z.object({
  month: predictionMonth.optional(),
}).strict();
export const predictionCategoryQuery = predictionMonthQuery.extend({
  categoryId: objectId.optional(),
}).strict();
export const predictionDailyQuery = predictionCategoryQuery;
export const predictionAccuracyQuery = z.object({
  months: z.coerce.number().int().min(3).max(24).default(12),
}).strict();

/* ---------------- subscription detection ---------------- */
const subscriptionDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
const subscriptionFrequencies = z.enum(["weekly", "monthly", "quarterly", "annual"]);
const subscriptionAmount = z.number().int().positive().max(10_000_000_000);
export const subscriptionIdParam = idParam;
export const subscriptionDetectSchema = z.object({
  startDate: subscriptionDate.optional(),
  endDate: subscriptionDate.optional(),
  limit: z.coerce.number().int().min(1).max(5_000).default(5_000),
}).strict()
  .refine((value) => Boolean(value.startDate) === Boolean(value.endDate), {
    path: ["endDate"],
    message: "Provide both startDate and endDate",
  })
  .refine((value) => !value.startDate || value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "endDate must be on or after startDate",
  })
  .refine((value) => !value.startDate || value.endDate - value.startDate <= 5 * 366 * 86_400_000, {
    path: ["endDate"],
    message: "Subscription detection history cannot exceed five years",
  })
  .refine((value) => !value.endDate || value.endDate <= new Date(), {
    path: ["endDate"],
    message: "endDate cannot be in the future",
  });
export const subscriptionListQuery = z.object({
  status: z.enum(["detected", "confirmed", "dismissed", "cancelled"]).optional(),
  frequency: subscriptionFrequencies.optional(),
  confidenceLevel: z.enum(["low", "medium", "high"]).optional(),
  merchant: z.string().trim().min(1).max(120).optional(),
  startDate: subscriptionDate.optional(),
  endDate: subscriptionDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(
  (value) => !value.startDate || !value.endDate || value.startDate <= value.endDate,
  { path: ["endDate"], message: "endDate must be on or after startDate" }
);
export const subscriptionHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const updateSubscriptionSchema = z.object({
  merchantName: z.string().trim().min(1).max(120).optional(),
  categoryId: objectId.nullable().optional(),
  averageAmountPaise: subscriptionAmount.optional(),
  frequency: subscriptionFrequencies.optional(),
  estimatedNextPaymentDate: subscriptionDate.optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0,
  "Send at least one field to update"
);
