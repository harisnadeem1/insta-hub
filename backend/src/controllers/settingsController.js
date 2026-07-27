const settingsService = require("../services/settingsService");

exports.getSettings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = await settingsService.getSettings(userId);

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { full_name, email } = req.body;

    const user = await settingsService.updateProfile({
      userId,
      fullName: full_name,
      email,
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = req.body;

    const preferences = await settingsService.updatePreferences({
      userId,
      payload,
    });

    return res.status(200).json({
      message: "Preferences updated successfully",
      preferences,
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    await settingsService.updatePassword({
      userId,
      currentPassword: current_password,
      newPassword: new_password,
    });

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    await settingsService.deleteAccount({
      userId,
      password,
    });

    return res.status(200).json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};