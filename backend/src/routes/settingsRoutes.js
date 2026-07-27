const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const settingsController = require("../controllers/settingsController");

router.use(authMiddleware);

router.get("/", settingsController.getSettings);
router.patch("/profile", settingsController.updateProfile);
router.patch("/preferences", settingsController.updatePreferences);
router.patch("/password", settingsController.updatePassword);
router.delete("/account", settingsController.deleteAccount);

module.exports = router;