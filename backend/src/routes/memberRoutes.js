const express = require("express");
const router = express.Router();

const memberController = require("../controllers/memberController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", memberController.getMembersDashboard);
router.post("/", memberController.createMember);
router.patch("/:id", memberController.updateMember);
router.delete("/:id", memberController.deleteMember);

module.exports = router;