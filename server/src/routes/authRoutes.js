const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  validateSignup,
  validateLogin,
  validateEmailVerification,
  validateResendVerification,
  validateProfileUpdate,
} = require("../middleware/validation");
const { authLimiter } = require("../middleware/security");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  signupUser,
  loginUser,
  verifyUserEmail,
  resendVerificationEmail,
  logoutUser,
  getCurrentUserProfile,
  updateUserProfile,
  completeUserOnboarding,
} = require("../services/authService");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.post(
  "/signup",
  authLimiter,
  validateSignup,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.validated;
    const payload = await signupUser(name, email, password, req, res);
    return res.status(201).json(payload);
  })
);

router.post(
  "/register",
  authLimiter,
  validateSignup,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.validated;
    const payload = await signupUser(name, email, password, req, res);
    return res.status(201).json(payload);
  })
);

router.post(
  "/login",
  authLimiter,
  validateLogin,
  asyncHandler(async (req, res) => {
    const { email, password } = req.validated;
    const payload = await loginUser(email, password, req, res);
    return res.json(payload);
  })
);

router.get(
  "/verify-email",
  validateEmailVerification,
  asyncHandler(async (req, res) => {
    const payload = await verifyUserEmail(req.validated.token, req, res);
    return res.json(payload);
  })
);

router.post(
  "/resend-verification",
  authLimiter,
  validateResendVerification,
  asyncHandler(async (req, res) => {
    const payload = await resendVerificationEmail(req.validated.email, req);
    return res.json(payload);
  })
);

router.post("/logout", (req, res) => {
  logoutUser(req, res);
  return res.status(204).end();
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json(await getCurrentUserProfile(req.user.id));
  })
);

router.get(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json(await getCurrentUserProfile(req.user.id));
  })
);

router.patch(
  "/profile",
  requireAuth,
  validateProfileUpdate,
  asyncHandler(async (req, res) => {
    return res.json(await updateUserProfile(req.user.id, req.validated));
  })
);

router.post(
  "/complete-onboarding",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json(await completeUserOnboarding(req.user.id));
  })
);

module.exports = router;
