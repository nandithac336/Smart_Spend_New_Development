import { once } from "node:events";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { seedDefaultCategories } from "./utils/seedCategories.js";
import app from "./app.js";
import { startRecurringTransactionJob } from "./jobs/recurringTransactionJob.js";
import { startScanCleanupJob } from "./jobs/scanCleanupJob.js";
import { startStatementImportCleanupJob } from "./jobs/statementImportCleanupJob.js";
import { startNotificationDetectionJob } from "./jobs/notificationDetectionJob.js";

let server;
let stopJobs = [];
let shutdownPromise;

function writeLog(stream, event, fields = {}) {
  stream.write(`${JSON.stringify({ event, ...fields })}\n`);
}

async function start() {
  await connectDB();
  await seedDefaultCategories();
  server = app.listen(env.PORT);
  await once(server, "listening");
  writeLog(process.stdout, "api_listening", { port: server.address().port });
  stopJobs = [
    startRecurringTransactionJob(),
    startScanCleanupJob(),
    startStatementImportCleanupJob(),
    startNotificationDetectionJob(),
  ];
  server.on("close", () => {
    stopJobs.forEach((stop) => stop());
  });
}

function shutdown() {
  if (shutdownPromise) return shutdownPromise;
  stopJobs.forEach((stop) => stop());
  shutdownPromise = new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections?.();
  }).then(() => mongoose.disconnect());
  return shutdownPromise;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    shutdown().catch((error) => {
      writeLog(process.stderr, "shutdown_error", {
        errorName: error?.name || "Error",
      });
      process.exitCode = 1;
    });
  });
}

process.on("unhandledRejection", (err) => {
  writeLog(process.stderr, "unhandled_rejection", {
    errorName: err?.name || "Error",
    errorCode: err?.code || "UNHANDLED_REJECTION",
  });
  shutdown().catch((error) => {
    writeLog(process.stderr, "shutdown_error", {
      errorName: error?.name || "Error",
    });
  }).finally(() => {
    process.exitCode = 1;
  });
});

start().catch((err) => {
  writeLog(process.stderr, "startup_error", {
    errorName: err?.name || "Error",
    errorCode: err?.code || "STARTUP_FAILED",
    ...(env.NODE_ENV === "development" && { message: err?.message }),
  });
  shutdown().catch((error) => {
    writeLog(process.stderr, "shutdown_error", {
      errorName: error?.name || "Error",
    });
  }).finally(() => {
    process.exitCode = 1;
  });
});
