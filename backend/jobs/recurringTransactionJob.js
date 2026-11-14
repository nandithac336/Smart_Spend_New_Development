import { processDueRecurringTransactions } from "../services/recurringTransactionService.js";
import { notifyRecurringJobFailures } from "../services/notificationDetectionService.js";

const DEFAULT_INTERVAL_MS = 60_000;

export function startRecurringTransactionJob({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  let running = false;
  let stopped = false;

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const results = await processDueRecurringTransactions();
      await notifyRecurringJobFailures(results);
    } catch (error) {
      process.emitWarning(`Recurring transaction job failed: ${error.message}`, {
        code: "RECURRING_TRANSACTION_JOB_ERROR",
      });
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
