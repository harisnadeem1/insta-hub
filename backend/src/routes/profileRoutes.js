const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");

router.use(authMiddleware);

router.get("/", profileController.getProfilesDashboard);
router.post("/", profileController.createProfile);

router.post("/refresh-all", profileController.refreshAllProfiles);
router.get("/refresh-all/status", profileController.getRefreshAllStatus);

router.patch("/:id", profileController.updateProfile);
router.delete("/:id", profileController.deleteProfile);
router.post("/:id/refresh", profileController.refreshProfile);
router.get("/:id/refresh-status/:jobId", profileController.getRefreshStatus);

module.exports = router;