const express = require("express");
const {
  getInstagramSessionStatus,
  startInstagramSession,
  completeInstagramSession,
  resetInstagramSession,
} = require("../controllers/instagramSessionController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/status", authMiddleware, getInstagramSessionStatus);
router.post("/start", authMiddleware, startInstagramSession);
router.post("/complete", authMiddleware, completeInstagramSession);
router.post("/reset", authMiddleware, resetInstagramSession);

module.exports = router;