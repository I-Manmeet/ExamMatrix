const express = require("express");
const { requireLogin } = require("../middleware/auth");
const auth = require("../controllers/authController");

const router = express.Router();

router.post("/login", auth.login);
router.get("/me", requireLogin, auth.me);
router.post("/logout", auth.logout);

module.exports = router;