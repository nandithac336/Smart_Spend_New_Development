import { env } from "../config/env.js";
import { purgeExpiredStatementImports } from "../services/statementImportService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startStatementImportCleanupJob({
  intervalMs = DAY_MS,
  retentionDays = env.STATEMENT_RETENTION_DAYS,
} = {}) {
  let running = false;
  let stopped = false;

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const result = await purgeExpiredStatementImports({ retentionDays });
      if (result.failures) {
        process.emitWarning(`Statement cleanup could not remove ${result.failures} expired import(s)`, {
          code: "STATEMENT_CLEANUP_PARTIAL_FAILURE",
        });
      }
    } catch (error) {
      process.emitWarning(`Statement cleanup failed: ${error.message}`, {
        code: "STATEMENT_CLEANUP_ERROR",
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
