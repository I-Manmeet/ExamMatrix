const express = require("express");
const universities = require("../controllers/universityController");

const router = express.Router();

router.post("/", universities.register);
router.post("/verify-email", universities.verifyEmail);
router.post("/resend-verification", universities.resendVerification);
router.post("/forgot-password", universities.forgotPassword);
router.post("/reset-password", universities.resetPassword);

module.exports = router;