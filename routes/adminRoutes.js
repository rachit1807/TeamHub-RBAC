const express = require("express");
const { dashboard, listUsers, updateUserRole } = require("../controllers/adminController");
const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware");
const router = express.Router();
router.use(verifyToken, verifyAdmin);
router.get("/dashboard", dashboard);
router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
module.exports = router;
