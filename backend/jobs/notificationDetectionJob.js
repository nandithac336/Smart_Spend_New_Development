import { runNotificationDetectionBatch } from "../services/notificationDetectionService.js";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;

export function createNotificationDetectionJob({
  intervalMs = DEFAULT_INTERVAL_MS,
  batchSize = DEFAULT_BATCH_SIZE,
  detectBatch = runNotificationDetectionBatch,
  onError = () => process.emitWarning("Notification detection job failed", {
    code: "NOTIFICATION_JOB_ERROR",
  }),
} = {}) {
  let running = false;
  let stopped = false;
  let afterUserId;

  const run = async () => {
    if (running || stopped) return null;
    running = true;
    try {
      const result = await detectBatch({ afterUserId, limit: batchSize });
      afterUserId = result.nextAfterUserId || undefined;
      return result;
    } catch (error) {
      onError(error);
      return null;
    } finally {
      running = false;
    }
  };

  return {
    run,
    start() {
      if (stopped) return () => {};
      void run();
      const timer = setInterval(run, intervalMs);
      timer.unref();
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    },
    stop() {
      stopped = true;
    },
  };
}

export function startNotificationDetectionJob(options) {
  const job = createNotificationDetectionJob(options);
  return job.start();
}
