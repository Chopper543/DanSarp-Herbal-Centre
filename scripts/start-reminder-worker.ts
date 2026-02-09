import { createReminderWorker, isReminderQueueEnabled } from "../lib/queue/reminders";
import { logger } from "../lib/monitoring/logger";

async function main() {
  if (!isReminderQueueEnabled()) {
    logger.warn(
      "Reminder worker not started. Set ENABLE_BULLMQ_REMINDERS=true and configure Redis connection."
    );
    process.exit(0);
  }

  const worker = createReminderWorker();
  logger.info("Reminder worker started");

  const shutdown = async (signal: string) => {
    logger.info(`Shutting down reminder worker (${signal})`);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("Reminder worker failed to start", error);
  process.exit(1);
});
