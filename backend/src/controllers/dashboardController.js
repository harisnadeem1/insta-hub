const dashboardService = require("../services/dashboardService");

exports.getOverview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = await dashboardService.getOverview(userId);

    return res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};