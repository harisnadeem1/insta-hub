const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

const scanQueue = new Queue("instagram-profile-scan", { connection });

function getProfileJobId(profileId) {
  return `scan-profile-${profileId}`;
}

async function enqueueProfileScan({ userId, profileId, username }) {
  const jobId = getProfileJobId(profileId);

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

  await job.updateProgress({
    stage: "waiting",
    pct: 0,
    username,
    profileId,
  });

  return { id: job.id, status: "waiting", alreadyRunning: false };
}

async function getJobStatus(jobId) {
  const job = await scanQueue.getJob(jobId);
  if (!job) {
    return { status: "not_found" };
  }

  const state = await job.getState();

  return {
    status: state,
    progress: job.progress || null,
    returnvalue: job.returnvalue || null,
    failedReason: job.failedReason || null,
    jobId: job.id,
  };
}

async function getJobsStatusByProfiles(profiles = []) {
  const items = await Promise.all(
    profiles.map(async (profile) => {
      const jobId = getProfileJobId(profile.id);
      const job = await scanQueue.getJob(jobId);

      if (!job) {
        return {
          profileId: profile.id,
          username: profile.username,
          member_name: profile.member_name,
          jobId,
          status: "idle",
          progress: null,
          returnvalue: null,
          failedReason: null,
          last_scraped_at: profile.last_scraped_at,
        };
      }

      const state = await job.getState();

      return {
        profileId: profile.id,
        username: profile.username,
        member_name: profile.member_name,
        jobId: job.id,
        status: state,
        progress: job.progress || null,
        returnvalue: job.returnvalue || null,
        failedReason: job.failedReason || null,
        last_scraped_at: profile.last_scraped_at,
      };
    })
  );

  return items;
}

module.exports = {
  scanQueue,
  enqueueProfileScan,
  getJobStatus,
  getJobsStatusByProfiles,
  getProfileJobId,
  connection,
};