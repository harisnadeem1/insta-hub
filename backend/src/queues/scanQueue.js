const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

const scanQueue = new Queue("instagram-profile-scan", { connection });

async function enqueueProfileScan({ userId, profileId, username }) {
  const jobId = `scan-profile-${profileId}`;

  const existingJob = await scanQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (["waiting", "active", "delayed"].includes(state)) {
      return { id: existingJob.id, status: state, alreadyRunning: true };
    }

    await existingJob.remove().catch(() => {});
  }

  const job = await scanQueue.add(
    "scan-profile",
    { userId, profileId, username },
    {
      jobId,
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 86400 },
    }
  );

  return { id: job.id, status: "queued", alreadyRunning: false };
}

async function getJobStatus(jobId) {
  const job = await scanQueue.getJob(jobId);
  if (!job) return { status: "not_found" };

  const state = await job.getState();
  return {
    status: state,
    progress: job.progress,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

module.exports = { scanQueue, enqueueProfileScan, getJobStatus, connection };