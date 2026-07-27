const profileService = require("../services/profileService");
const {
  enqueueProfileScan,
  getJobStatus,
  getJobsStatusByProfiles,
} = require("../queues/scanQueue");

exports.getProfilesDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = await profileService.getProfilesDashboard(userId);

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

exports.createProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { member_id, username, profile_name, profile_url } = req.body;

    const profile = await profileService.createProfile({
      userId,
      memberId: member_id,
      username,
      profileName: profile_name,
      profileUrl: profile_url,
    });

    return res.status(201).json({
      message: "Profile created successfully",
      profile,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileId = req.params.id;
    const payload = req.body;

    const profile = await profileService.updateProfile({
      userId,
      profileId,
      payload,
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      profile,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileId = req.params.id;

    await profileService.deleteProfile({
      userId,
      profileId,
    });

    return res.status(200).json({
      message: "Profile deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshProfile = async (req, res, next) => {
  console.log("Refresh profile for", req.params.id);

  try {
    const userId = req.user.id;
    const profileId = req.params.id;

    const existing = await profileService.getProfileById({ userId, profileId });
    if (!existing) {
      const err = new Error("Profile not found");
      err.statusCode = 404;
      throw err;
    }

    const result = await enqueueProfileScan({
      userId,
      profileId,
      username: existing.username,
    });

    if (result.alreadyRunning) {
      return res.status(200).json({
        message: "Profile refresh already in progress",
        jobId: result.id,
        profileId: Number(profileId),
        username: existing.username,
        status: result.status,
        alreadyRunning: true,
      });
    }

    return res.status(202).json({
      message: "Profile refresh started",
      jobId: result.id,
      profileId: Number(profileId),
      username: existing.username,
      status: result.status,
      alreadyRunning: false,
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshAllProfiles = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profiles = await profileService.getActiveProfilesForSync({ userId });

    if (profiles.length === 0) {
      return res.status(200).json({
        message: "No active profiles available for sync",
        batch: {
          total: 0,
          queued: 0,
          alreadyRunning: 0,
        },
        jobs: [],
      });
    }

    const jobs = [];
    let queued = 0;
    let alreadyRunning = 0;

    for (const profile of profiles) {
      const result = await enqueueProfileScan({
        userId,
        profileId: profile.id,
        username: profile.username,
      });

      if (result.alreadyRunning) {
        alreadyRunning += 1;
      } else {
        queued += 1;
      }

      jobs.push({
        profileId: profile.id,
        username: profile.username,
        member_name: profile.member_name,
        jobId: result.id,
        status: result.status,
        alreadyRunning: result.alreadyRunning,
      });
    }

    return res.status(202).json({
      message: "Bulk profile refresh started",
      batch: {
        total: profiles.length,
        queued,
        alreadyRunning,
      },
      jobs,
    });
  } catch (error) {
    next(error);
  }
};

exports.getRefreshStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const status = await getJobStatus(jobId);
    return res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

exports.getRefreshAllStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profiles = await profileService.getActiveProfilesForSync({ userId });
    const items = await getJobsStatusByProfiles(profiles);

    const summary = items.reduce(
      (acc, item) => {
        acc.total += 1;

        if (item.status === "waiting" || item.status === "delayed") acc.waiting += 1;
        else if (item.status === "active") acc.active += 1;
        else if (item.status === "completed") acc.completed += 1;
        else if (item.status === "failed") acc.failed += 1;
        else acc.idle += 1;

        return acc;
      },
      {
        total: 0,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        idle: 0,
      }
    );

    return res.status(200).json({
      summary,
      items,
    });
  } catch (error) {
    next(error);
  }
};