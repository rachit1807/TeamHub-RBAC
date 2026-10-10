const express = require("express");
const { dashboard } = require("../controllers/userController");
const { verifyToken } = require("../middleware/authMiddleware");
const router = express.Router();
router.get("/dashboard", verifyToken, dashboard);
module.exports = router;
