const profileService = require("../services/profileService");

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
  console.log("Refreshing profile...");

  try {
    const userId = req.user.id;
    const profileId = req.params.id;

    const profile = await profileService.refreshProfile({
      userId,
      profileId,
    });

    console.log("Controller received refreshed profile", {
      profileId: profile?.id,
    });

    return res.status(200).json({
      message: "Profile refreshed successfully",
      profile,
    });
  } catch (error) {
    console.error("Controller refresh error:", error);
    next(error);
  }
};