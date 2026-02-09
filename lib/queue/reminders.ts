import { Queue, Worker, JobsOptions } from "bullmq";
import { dispatchReminder, ReminderPreferences } from "@/lib/notifications/reminder-dispatch";

type ReminderJobData = {
  appointmentId: string;
  preferences: ReminderPreferences;
  triggerAt?: string;
};

const connectionUrl =
  process.env.BULLMQ_REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;
const queueExplicitlyEnabled = process.env.ENABLE_BULLMQ_REMINDERS === "true";

export function isReminderQueueEnabled(): boolean {
  return queueExplicitlyEnabled && Boolean(connectionUrl);
}

function getConnection() {
  if (!queueExplicitlyEnabled) {
    throw new Error(
      "BullMQ reminders are disabled. Set ENABLE_BULLMQ_REMINDERS=true to enable queued reminders."
    );
  }
  if (!connectionUrl) {
    throw new Error(
      "BullMQ Redis connection missing. Set BULLMQ_REDIS_URL (or UPSTASH_REDIS_URL/REDIS_URL)."
    );
  }
  return { url: connectionUrl };
}

let reminderQueue: Queue<ReminderJobData> | null = null;

function ensureQueue() {
  if (!reminderQueue) {
    const connection = getConnection();
    reminderQueue = new Queue<ReminderJobData>("reminders", { connection });
  }
  return reminderQueue!;
}

export async function enqueueReminderJob(
  data: ReminderJobData,
  delayMs: number
): Promise<string | undefined> {
  const queue = ensureQueue();
  const opts: JobsOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60_000,
    },
    delay: Math.max(0, delayMs),
    removeOnComplete: true,
    removeOnFail: false,
  };

  const job = await queue.add("send-reminder", data, opts);
  return job.id;
}

/**
 * Optional in-process worker (for dedicated worker runtime).
 * Not invoked automatically to avoid running long-lived workers in serverless.
 */
export function createReminderWorker() {
  const connection = getConnection();
  return new Worker<ReminderJobData>(
    "reminders",
    async (job) => {
      await dispatchReminder(job.data.appointmentId, job.data.preferences);
    },
    { connection, concurrency: 5 }
  );
}
