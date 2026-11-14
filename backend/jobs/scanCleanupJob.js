import { env } from "../config/env.js";
import { purgeExpiredScans } from "../services/scanService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startScanCleanupJob({ intervalMs = DAY_MS, retentionDays = env.SCAN_RETENTION_DAYS } = {}) {
  let running = false;
  let stopped = false;

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const result = await purgeExpiredScans({ retentionDays });
      if (result.failures) {
        process.emitWarning(`Scan cleanup could not remove ${result.failures} expired record(s)`, {
          code: "SCAN_CLEANUP_PARTIAL_FAILURE",
        });
      }
    } catch (error) {
      process.emitWarning(`Scan cleanup failed: ${error.message}`, { code: "SCAN_CLEANUP_ERROR" });
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
