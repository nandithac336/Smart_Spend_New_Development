import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import goalRoutes from "./routes/goalRoutes.js";
import recurringTransactionRoutes from "./routes/recurringTransactionRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import scanRoutes from "./routes/scanRoutes.js";
import statementImportRoutes from "./routes/statementImportRoutes.js";
import categorizationRoutes from "./routes/categorizationRoutes.js";
import askSpartRoutes from "./routes/askSpartRoutes.js";
import anomalyRoutes from "./routes/anomalyRoutes.js";
import predictionRoutes from "./routes/predictionRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import financialHealthRoutes from "./routes/financialHealthRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";

const app = express();

if (env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", globalLimiter);

app.get("/api/health", (_req, res) => res.json({ success: true, status: "ok" }));
app.get("/api/health/db", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ success: connected, database: connected ? "connected" : "disconnected" });
});

app.use("/api/auth", authRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/recurring", recurringTransactionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/scans", scanRoutes);
app.use("/api/imports", statementImportRoutes);
app.use("/api/categorization", categorizationRoutes);
app.use("/api/ask-spart", askSpartRoutes);
app.use("/api/anomalies", anomalyRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/financial-health", financialHealthRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/sync", syncRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
