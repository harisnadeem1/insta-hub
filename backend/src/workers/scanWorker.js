const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const profileService = require("../services/profileService");

console.log("[worker] booting...");

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

connection.on("connect", () => {
  console.log("[worker] redis connected");
});

connection.on("ready", () => {
  console.log("[worker] redis ready");
});

connection.on("error", (err) => {
  console.error("[worker] redis error", err);
});

const concurrency = 1;
const interJobDelayMs = Number(process.env.SCAN_JOB_DELAY_MS || 15000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const worker = new Worker(
  "instagram-profile-scan",
  async (job) => {
    const { userId, profileId, username } = job.data;

    console.log("[worker] picked job", {
      jobId: job.id,
      userId,
      profileId,
      username,
    });

    try {
      await job.updateProgress({
        stage: "scraping",
        pct: 10,
        username,
        profileId,
      });

      const profile = await profileService.refreshProfile({ userId, profileId });

      await job.updateProgress({
        stage: "saving",
        pct: 90,
        username,
        profileId,
      });

      await job.updateProgress({
        stage: "done",
        pct: 100,
        username,
        profileId,
      });

      console.log("[worker] finished scan job", {
        jobId: job.id,
        profileId: profile?.id,
      });

      await sleep(interJobDelayMs);

      return {
        profileId: profile?.id,
        username,
        followers_count: profile?.current_followers_count,
        posts_count: profile?.current_posts_count,
        comments_count: profile?.current_comments_count,
        visible_views_count: profile?.current_visible_views_count,
      };
    } catch (error) {
      await job.updateProgress({
        stage: "failed",
        pct: 100,
        username,
        profileId,
      });

      throw error;
    }
  },
  {
    connection,
    concurrency,
  }
);

worker.on("ready", () => {
  console.log("[worker] ready");
});

worker.on("active", (job) => {
  console.log("[worker] active", { jobId: job.id, name: job.name });
});

worker.on("completed", (job, result) => {
  console.log("[worker] job completed", { jobId: job.id, result });
});

worker.on("failed", (job, err) => {
  console.error("[worker] job failed", {
    jobId: job?.id,
    message: err?.message,
    stack: err?.stack,
  });
});

worker.on("error", (err) => {
  console.error("[worker] worker error", err);
});

process.on("SIGTERM", async () => {
  console.log("[worker] shutting down...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[worker] interrupted, shutting down...");
  await worker.close();
  process.exit(0);
});

module.exports = { worker };