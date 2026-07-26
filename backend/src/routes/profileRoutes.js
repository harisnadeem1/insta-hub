const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");

router.use(authMiddleware);

router.get("/", profileController.getProfilesDashboard);
router.post("/", profileController.createProfile);
router.patch("/:id", profileController.updateProfile);
router.post("/:id/refresh", profileController.refreshProfile);
router.get("/:id/refresh-status/:jobId", profileController.getRefreshStatus);

module.exports = router;