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
