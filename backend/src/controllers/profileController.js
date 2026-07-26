const profileService = require("../services/profileService");
const { enqueueProfileScan, getJobStatus } = require("../queues/scanQueue");

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

exports.refreshProfile = async (req, res, next) => {
  console.log("Refres profile for",req.params.id)
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
        profileId,
        status: result.status,
        alreadyRunning: true,
      });
    }

    return res.status(202).json({
      message: "Profile refresh started",
      jobId: result.id,
      profileId,
      status: result.status,
      alreadyRunning: false,
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