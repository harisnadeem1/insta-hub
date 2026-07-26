const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");

router.use(authMiddleware);

router.get("/", profileController.getProfilesDashboard);
router.post("/", profileController.createProfile);
router.patch("/:id", profileController.updateProfile);
router.post("/:id/refresh", profileController.refreshProfile);

module.exports = router;