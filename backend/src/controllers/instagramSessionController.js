const instagramSessionService = require("../services/instagramSessionService");

async function getInstagramSessionStatus(req, res, next) {
  try {
    console.log("[instagram-session] GET /status");
    const result = instagramSessionService.getStatus();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function startInstagramSession(req, res, next) {
  try {
    console.log("[instagram-session] POST /start");
    const result = instagramSessionService.startSessionSetup();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function completeInstagramSession(req, res, next) {
  try {
    console.log("[instagram-session] POST /complete");
    const result = instagramSessionService.completeSessionSetup();

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function resetInstagramSession(req, res, next) {
  try {
    console.log("[instagram-session] POST /reset");
    const result = instagramSessionService.resetSession();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInstagramSessionStatus,
  startInstagramSession,
  completeInstagramSession,
  resetInstagramSession,
};